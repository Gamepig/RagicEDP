import "server-only";

import { generateText } from "ai";
import { getChatModel } from "./vertex-client";
import { generateSql, executeBqQuery, recommendChartType } from "./sql-generator";
import { searchKnowledge, formatKnowledgeContext } from "./knowledge-rag";
import { AiKnowledgeRepository } from "@/lib/firestore/ai-knowledge.repo";
import { buildSystemPrompt } from "./expert-prompt";
import { aiLog, createCorrelationId } from "./logger";
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

  const decomposition = await generateText({
    model: getChatModel(),
    system: `你是研究規劃助手。將使用者的研究主題拆解為 3-5 個具體的子問題，每個子問題一行。
格式：每行一個問題，不加編號。只輸出問題，不加其他文字。`,
    prompt: topic,
    maxTokens: 300,
  });

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
      const sqlResult = await generateSql(q, correlationId);
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
      let sectionPrompt = `針對以下子問題撰寫分析段落（200-400字）：\n\n${q}`;

      let sectionCharts: AiChartDataV1[] | undefined;

      if (matchingData && matchingData.data.length > 0) {
        sectionPrompt += `\n\n相關數據（前 10 筆）：\n${JSON.stringify(matchingData.data.slice(0, 10), null, 2)}`;

        const rec = recommendChartType(matchingData.data);
        const chart: AiChartDataV1 = {
          chartId: `research_${createCorrelationId().slice(0, 8)}`,
          title: q.slice(0, 50),
          chartType: rec.chartType,
          data: matchingData.data.slice(0, 500),
          xKey: rec.xKey,
          yKeys: rec.yKeys,
        };
        sectionCharts = [chart];
      }

      const sectionResult = await generateText({
        model: getChatModel(),
        system: systemPrompt,
        prompt: sectionPrompt,
        maxTokens: 800,
      });

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
    maxTokens: 800,
  });

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
