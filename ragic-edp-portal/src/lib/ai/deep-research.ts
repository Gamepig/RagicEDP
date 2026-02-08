import "server-only";

import { generateText } from "ai";
import { getChatModel } from "./vertex-client";
import { generateSql, executeBqQuery, recommendChartType } from "./sql-generator";
import { searchKnowledge, formatKnowledgeContext } from "./knowledge-rag";
import { AiKnowledgeRepository } from "@/lib/firestore/ai-knowledge.repo";
import { buildSystemPrompt } from "./expert-prompt";
import { aiLog } from "./logger";
import type { AiChartDataV1, AiKnowledgeSourceV1, QueryTraceV0 } from "@/lib/data/types";

export type ResearchSection = {
  heading: string;
  contentMarkdown: string;
  charts?: AiChartDataV1[];
};

export type DeepResearchResult = {
  sections: ResearchSection[];
  knowledgeSources: AiKnowledgeSourceV1[];
  traces: QueryTraceV0[];
  summary: string;
};

export type ProgressCallback = (step: string, current: number, total: number) => void;

const RESEARCH_STEPS = 6;

/**
 * Orchestrate a deep research report:
 * 1. Decompose topic into sub-questions
 * 2. Query BQ for relevant data (parallel)
 * 3. Search knowledge base (parallel)
 * 4. Generate analysis per section
 * 5. Generate summary/conclusion
 */
export async function runDeepResearch(
  topic: string,
  correlationId: string,
  onProgress: ProgressCallback,
): Promise<DeepResearchResult> {
  const startTime = Date.now();

  // Step 1: Decompose topic into sub-questions
  onProgress("decomposing_topic", 1, RESEARCH_STEPS);

  // Use Pro model for decomposition — needs to understand user intent accurately
  const decomposition = await generateText({
    model: getChatModel(),
    system: `你是研究規劃助手。將使用者的研究主題拆解為 3-5 個具體的、可用 SQL 查詢回答的子問題。

規則：
- 子問題必須直接回應使用者的原始需求，不可偏離主題
- 子問題必須是可以透過查詢公司數據庫回答的（可用資料：訂單、營收、品牌、通路、客戶、產品、每日統計）
- 每個子問題應產出一組有意義的「多行比較數據」（至少 3-10 行），而非單一數字
- 避免產生只會回傳一個數字的問題（例如「平均訂單金額是多少？」），改為「各通路的平均訂單金額比較」
- 每行一個問題，不加編號，只輸出問題

好的拆解範例（使用者問「分析本季營收表現」）：
- 本季各月營收趨勢變化
- 本季各通路營收金額排名
- 本季各品牌營收佔比
- 本季與上季各月營收對比

壞的拆解範例（避免）：
- 本季總營收是多少？（只回傳一個數字）
- 新客戶的回購率？（偏離主題且只有一個數字）`,
    prompt: topic,
    maxOutputTokens: 4096,
  } as Parameters<typeof generateText>[0]);

  const subQuestions = decomposition.text
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .slice(0, 5);

  aiLog({
    level: "info",
    correlationId,
    module: "deep_research",
    action: "query",
    extra: { step: "decompose", subQuestions: subQuestions.length },
  });

  // Step 2: Generate SQL queries for data-related sub-questions (parallel)
  onProgress("querying_database", 2, RESEARCH_STEPS);

  const dataQueries = subQuestions.map(async (q) => {
    try {
      // Augment sub-question to ensure SQL produces grouped/comparison data suitable for charting
      const chartFriendlyQuery = `${q}\n（重要：查詢必須使用 GROUP BY 產出多行分組比較數據，適合製作圖表。不要只回傳一個聚合數字。至少要有 3 行以上的結果。）`;
      const sqlResult = await generateSql(chartFriendlyQuery, correlationId);
      if (!sqlResult.safetyCheck.safe) return null;
      const bqResult = await executeBqQuery(sqlResult.safetyCheck.sql, correlationId);
      return { question: q, data: bqResult.data, trace: bqResult.trace };
    } catch {
      return null;
    }
  });

  // Step 3: Search knowledge base (parallel with Step 2)
  onProgress("searching_knowledge", 3, RESEARCH_STEPS);

  let knowledgeSources: AiKnowledgeSourceV1[] = [];
  try {
    const knowledgeRepo = new AiKnowledgeRepository();
    const allChunks = await knowledgeRepo.loadAllChunks();
    if (allChunks.length > 0) {
      knowledgeSources = await searchKnowledge(topic, allChunks, correlationId);
    }
  } catch {
    // Knowledge search failure is non-critical
  }

  // Wait for all data queries
  const dataResults = (await Promise.all(dataQueries)).filter(
    (r): r is NonNullable<typeof r> => r !== null && r.data.length > 0,
  );
  const allTraces = dataResults.map((r) => r.trace);

  // Step 4: Generate sections
  onProgress("generating_sections", 4, RESEARCH_STEPS);

  const knowledgeContext = formatKnowledgeContext(knowledgeSources);
  const systemPrompt = buildSystemPrompt({
    knowledgeContext: knowledgeContext || undefined,
  });

  const sections: ResearchSection[] = await Promise.all(
    subQuestions.map(async (q) => {
      const matchingData = dataResults.find((d) => d.question === q);
      let sectionPrompt: string;
      let sectionCharts: AiChartDataV1[] | undefined;

      if (matchingData && matchingData.data.length > 0) {
        sectionPrompt = `使用者的研究主題是：「${topic}」
針對子問題「${q}」，根據以下從公司資料庫查詢到的真實數據撰寫數據分析段落（300-600字）。
重要：只基於提供的數據進行分析，不要編造任何數字。分析必須回扣使用者的原始研究主題。回答要完整，不要中途截斷。

查詢到的數據（共 ${matchingData.data.length} 筆，顯示前 20 筆）：
${JSON.stringify(matchingData.data.slice(0, 20), null, 2)}`;

        // Only generate chart if data has >= 2 rows (single value charts are meaningless)
        if (matchingData.data.length >= 2) {
          const rec = recommendChartType(matchingData.data, q);

          // For category-based charts, limit to top 20 by first yKey for readability
          let chartData = matchingData.data;
          if (chartData.length > 20 && rec.yKeys.length > 0) {
            const sortKey = rec.yKeys[0];
            chartData = [...chartData]
              .sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0))
              .slice(0, 20);
          }

          const chart: AiChartDataV1 = {
            chartId: `research_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            title: q.slice(0, 50),
            chartType: rec.chartType,
            data: chartData,
            xKey: rec.xKey,
            yKeys: rec.yKeys,
          };
          sectionCharts = [chart];
        }
      } else {
        sectionPrompt = `針對「${q}」，目前資料庫沒有直接相關的數據。請基於行銷專業知識提供分析觀點（300-600字），但明確說明此段落為專業見解而非數據分析結果。回答要完整，不要中途截斷。`;
      }

      const sectionResult = await generateText({
        model: getChatModel(),
        system: systemPrompt,
        prompt: sectionPrompt,
        maxOutputTokens: 8192,
      } as Parameters<typeof generateText>[0]);

      return {
        heading: q,
        contentMarkdown: sectionResult.text,
        charts: sectionCharts,
      };
    }),
  );

  // Step 5: Generate summary
  onProgress("generating_summary", 5, RESEARCH_STEPS);

  const summaryPrompt = `基於以下研究段落，撰寫一段綜合結論與行動建議（300-500字）：\n\n${sections.map((s) => `## ${s.heading}\n${s.contentMarkdown}`).join("\n\n")}`;

  const summaryResult = await generateText({
    model: getChatModel(),
    system: systemPrompt,
    prompt: summaryPrompt,
    maxOutputTokens: 8192,
  } as Parameters<typeof generateText>[0]);

  onProgress("complete", 6, RESEARCH_STEPS);

  const durationMs = Date.now() - startTime;
  aiLog({
    level: "info",
    correlationId,
    module: "deep_research",
    action: "query",
    durationMs,
    extra: {
      sections: sections.length,
      dataQueries: dataResults.length,
      knowledgeSources: knowledgeSources.length,
    },
  });

  return {
    sections,
    knowledgeSources,
    traces: allTraces,
    summary: summaryResult.text,
  };
}
