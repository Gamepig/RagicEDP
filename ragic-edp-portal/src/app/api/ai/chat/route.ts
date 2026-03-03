import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { getFastModel, getModelChain, streamText } from "@/lib/ai/vertex-client";
import type { ModelEntry } from "@/lib/ai/vertex-client";
import { buildSystemPrompt } from "@/lib/ai/expert-prompt";
import { AiSessionRepository } from "@/lib/firestore/ai-session.repo";
import { AiMessageRepository } from "@/lib/firestore/ai-message.repo";
import { aiLog, createCorrelationId } from "@/lib/ai/logger";
import { classifyIntent } from "@/lib/ai/intent-router";
import { generateSql, executeBqQuery, recommendChartType } from "@/lib/ai/sql-generator";
import { searchKnowledge, formatKnowledgeContext } from "@/lib/ai/knowledge-rag";
import { AiKnowledgeRepository } from "@/lib/firestore/ai-knowledge.repo";
import { runDeepResearch } from "@/lib/ai/deep-research";
import { generateSessionSummary, formatPastConclusions, updateRollingSummary } from "@/lib/ai/session-summary";
import { buildConversationContext } from "@/lib/ai/conversation-context";
import { generateRagicQuery } from "@/lib/ai/ragic-query-gen";
import { fetchRagicSheet } from "@/lib/ragic/client";
import type { RagicQueryResult } from "@/lib/ragic/client";
import type { AiChartDataV1, AiKnowledgeSourceV1 } from "@/lib/data/types";

const MAX_PROMPT_LENGTH = 5000;
const MAX_MESSAGES_PER_SESSION = 50;
const SQL_GEN_TIMEOUT_MS = 150000;
const BQ_QUERY_TIMEOUT_MS = 20000;
const BQ_FALLBACK_TIMEOUT_MS = 10000;
const RAGIC_QUERY_TIMEOUT_MS = 15000;
const BQ_RESULT_CACHE_TTL_MS = 2 * 60 * 1000;
const CONTEXT_FETCH_BUDGET_MS = 1500;
const KNOWLEDGE_QUERY_CACHE_TTL_MS = 10 * 60 * 1000;

const sessionRepo = new AiSessionRepository();
const messageRepo = new AiMessageRepository();

// Cache org memory conclusions (5 min TTL) to reduce Firestore reads
let cachedConclusions: { text: string; expiresAt: number } | null = null;
const CONCLUSIONS_CACHE_TTL = 5 * 60 * 1000;

// Cache knowledge chunks (10 min TTL) to avoid loading all Firestore docs per request
let cachedKnowledgeChunks: { chunks: import("@/lib/ai/knowledge-rag").KnowledgeChunk[]; expiresAt: number } | null = null;
const KNOWLEDGE_CACHE_TTL = 10 * 60 * 1000;
type CachedBqResult = {
  data: Record<string, unknown>[];
  sql: string;
  trace?: { correlationId: string; bytesProcessed?: number };
  expiresAt: number;
};
let cachedBqResults = new Map<string, CachedBqResult>();
let cachedKnowledgeByQuery = new Map<string, { sources: AiKnowledgeSourceV1[]; expiresAt: number }>();

function withTimeout<T>(p: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout (${timeoutMs}ms)`)), timeoutMs);
    p.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }).catch((e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

function getBqCacheKey(queryText: string): string {
  return queryText.trim().toLowerCase().replace(/\s+/g, " ");
}

async function withTimeoutOrFallback<T>(
  p: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  try {
    return await withTimeout(p, timeoutMs, "context_fetch");
  } catch {
    return fallback;
  }
}

function shouldUseBrandShareFallback(prompt: string): boolean {
  const q = prompt.toLowerCase();
  return (q.includes("品牌") || q.includes("brand")) && (q.includes("佔比") || q.includes("占比") || q.includes("share"));
}

function getBrandShareFallbackSql(): string {
  return `
SELECT
  brand_name,
  SUM(order_amount) AS revenue,
  ROUND(
    SAFE_DIVIDE(
      SUM(order_amount),
      SUM(SUM(order_amount)) OVER()
    ) * 100,
    2
  ) AS revenue_share_pct
FROM \`b25h01-ragic.erp_backup.ls_v_order_lines_ext\`
WHERE order_date >= DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 30 DAY)
  AND brand_name IS NOT NULL
GROUP BY brand_name
ORDER BY revenue DESC
LIMIT 10`.trim();
}

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  // Auth check OUTSIDE try — returns 401, not 500
  const session = await auth();
  try {
    assertAuthorized(session);
  } catch {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "未授權" } },
      { status: 401 }
    );
  }

  const userId = session?.user?.email ?? "dev@local";
  if (!userId) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "無法識別使用者" } },
      { status: 401 }
    );
  }

  const correlationId = createCorrelationId();
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { sessionId, prompt, mode } = body as {
      sessionId?: string;
      prompt: string;
      mode?: "auto" | "deep_research";
    };

    if (!prompt || typeof prompt !== "string") {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "Prompt is required" } },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return Response.json(
        { error: { code: "PROMPT_TOO_LONG", message: `提問長度不可超過 ${MAX_PROMPT_LENGTH} 字元` } },
        { status: 400 }
      );
    }

    // Resolve or create session — with ownership verification
    let currentSessionId = sessionId;
    let isNewSession = false;
    let existingSession: import("@/lib/data/types").AiSessionV1 | null = null;
    if (currentSessionId) {
      existingSession = await sessionRepo.get(currentSessionId);
      if (!existingSession || existingSession.userId !== userId) {
        return Response.json(
          { error: { code: "FORBIDDEN", message: "無權存取此對話" } },
          { status: 403 }
        );
      }
      if (existingSession.messageCount >= MAX_MESSAGES_PER_SESSION) {
        return Response.json(
          { error: { code: "SESSION_LIMIT", message: "此對話已達訊息上限，請開啟新對話" } },
          { status: 400 }
        );
      }
    } else {
      const newSession = await sessionRepo.create({
        userId,
        title: "新對話",
        mode: "simple",
      });
      currentSessionId = newSession.sessionId;
      isNewSession = true;
    }

    // Save user message
    await messageRepo.create({
      sessionId: currentSessionId,
      role: "user",
      content: prompt,
      mode: "simple",
    });
    await sessionRepo.incrementMessageCount(currentSessionId);

    aiLog({
      level: "info",
      correlationId,
      module: "ai_expert",
      action: "chat",
      userId,
      model: "gemini-3.1-pro-preview",
      extra: { sessionId: currentSessionId, promptLength: prompt.length, mode: mode ?? "auto" },
    });

    // Guard: block idle chat from entering deep_research mode
    const isCasualChat = /^(你好|嗨|哈囉|hi|hello|hey|早安|午安|晚安|謝謝|感謝|你是誰|你是什麼|你叫什麼|你是哪個|幫我|請問你|測試|test)\b/i.test(prompt.trim())
      || (prompt.trim().length < 15 && !/營收|訂單|品牌|通路|客戶|趨勢|分析|比較|報告|研究|數據|revenue|order|brand|channel|customer|trend|report|chart|圖表/i.test(prompt));

    // Resolve intent and org memory in parallel to reduce pre-stream blocking
    const intentPromise = mode === "deep_research" && !isCasualChat
      ? Promise.resolve({ type: "deep_research" as const, topic: prompt })
      : (async () => {
        try {
          return await classifyIntent(prompt);
        } catch (err) {
          aiLog({
            level: "warn",
            correlationId,
            module: "ai_expert",
            action: "chat",
            userId,
            error: `Intent classify failed, fallback to simple_answer: ${err instanceof Error ? err.message : "unknown"}`,
          });
          return { type: "simple_answer" as const };
        }
      })();

    const pastConclusionsPromise = (async (): Promise<string> => {
      if (cachedConclusions && Date.now() < cachedConclusions.expiresAt) {
        return cachedConclusions.text;
      }
      try {
        const recentSessions = await sessionRepo.listOrgSessions({ limit: 10 });
        const sessionsWithConclusions = recentSessions.items.filter((s) => s.conclusion);
        let text = "";
        if (sessionsWithConclusions.length > 0) {
          text = formatPastConclusions(
            sessionsWithConclusions.map((s) => ({
              title: s.title,
              conclusion: s.conclusion!,
              updatedAt: s.updatedAt,
            })),
          );
        }
        cachedConclusions = { text, expiresAt: Date.now() + CONCLUSIONS_CACHE_TTL };
        return text;
      } catch (e) {
        console.warn("[AI_ROUTE] past conclusions failed:", e instanceof Error ? e.message : e);
        return "";
      }
    })();

    // 對話上下文（短期 + 長期記憶），只有非新 Session 才載入
    const conversationContextPromise = !isNewSession && currentSessionId
      ? buildConversationContext(currentSessionId, existingSession?.rollingSummary)
      : Promise.resolve("");

    const intent = await intentPromise;

    const resolvedMode = intent.type === "generate_chart" || intent.type === "query_database"
      ? "chart_gen" as const
      : intent.type === "deep_research"
        ? "deep_research" as const
        : intent.type === "query_ragic"
          ? "ragic_query" as const
          : "simple" as const;

    // Knowledge RAG search (with module-level + query cache), time-boxed for lower latency
    let knowledgeSources: AiKnowledgeSourceV1[] = [];
    if (intent.type === "knowledge_lookup" || intent.type === "simple_answer") {
      try {
        const queryText = intent.type === "knowledge_lookup" ? intent.question : prompt;
        const queryKey = getBqCacheKey(queryText);
        const cachedQuery = cachedKnowledgeByQuery.get(queryKey);
        if (cachedQuery && Date.now() < cachedQuery.expiresAt) {
          knowledgeSources = cachedQuery.sources;
        } else {
          const searchPromise = (async () => {
            let allChunks: import("@/lib/ai/knowledge-rag").KnowledgeChunk[];
            if (cachedKnowledgeChunks && Date.now() < cachedKnowledgeChunks.expiresAt) {
              allChunks = cachedKnowledgeChunks.chunks;
            } else {
              const knowledgeRepo = new AiKnowledgeRepository();
              allChunks = await knowledgeRepo.loadAllChunks();
              cachedKnowledgeChunks = { chunks: allChunks, expiresAt: Date.now() + KNOWLEDGE_CACHE_TTL };
            }
            if (allChunks.length === 0) return [] as AiKnowledgeSourceV1[];
            return searchKnowledge(queryText, allChunks, correlationId);
          })();
          knowledgeSources = await withTimeoutOrFallback(searchPromise, CONTEXT_FETCH_BUDGET_MS, []);
          if (knowledgeSources.length > 0) {
            cachedKnowledgeByQuery.set(queryKey, {
              sources: knowledgeSources,
              expiresAt: Date.now() + KNOWLEDGE_QUERY_CACHE_TTL_MS,
            });
          }
        }
      } catch (e) {
        console.warn("[AI_ROUTE] knowledge search failed:", e instanceof Error ? e.message : e);
      }
    }

    const [pastConclusions, conversationContext] = await Promise.all([
      withTimeoutOrFallback(pastConclusionsPromise, CONTEXT_FETCH_BUDGET_MS, ""),
      withTimeoutOrFallback(conversationContextPromise, CONTEXT_FETCH_BUDGET_MS, ""),
    ]);

    // Build system prompt with optional knowledge context + past conclusions + conversation context
    const knowledgeContext = formatKnowledgeContext(knowledgeSources);
    const systemPrompt = buildSystemPrompt({
      knowledgeContext: knowledgeContext || undefined,
      pastConclusions: pastConclusions || undefined,
      conversationContext: conversationContext || undefined,
    });

    // Create SSE response
    const encoder = new TextEncoder();
    let fullContent = "";
    let charts: AiChartDataV1[] = [];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // ALWAYS attempt BQ query for any data-related question
          // Only skip for deep_research (has its own BQ flow) and pure knowledge_lookup
          let bqData: Record<string, unknown>[] = [];
          let sqlFallbackReason: string | null = null;
          const shouldQueryBq = intent.type !== "deep_research" && intent.type !== "knowledge_lookup" && intent.type !== "simple_answer" && intent.type !== "query_ragic";
          if (shouldQueryBq) {
            const totalSteps = 4;
            controller.enqueue(encoder.encode(sseEncode("progress", { step: "generating_sql", total: totalSteps, current: 1 })));

            const queryText = intent.type === "generate_chart" || intent.type === "query_database"
              ? (intent as { query: string }).query
              : prompt;
            const cacheKey = getBqCacheKey(queryText);
            const cached = cachedBqResults.get(cacheKey);
            if (cached && Date.now() < cached.expiresAt) {
              bqData = cached.data;
              controller.enqueue(encoder.encode(sseEncode("trace", {
                correlationId: cached.trace?.correlationId ?? correlationId,
                sql: cached.sql,
                bytesProcessed: cached.trace?.bytesProcessed,
              })));
            } else if (cached) {
              cachedBqResults.delete(cacheKey);
            }
            if (bqData.length === 0) {
              try {
            const sqlResult = await withTimeout(generateSql(queryText, correlationId, conversationContext || undefined), SQL_GEN_TIMEOUT_MS, "generateSql");
            console.log(`[ROUTE] SQL safe=${sqlResult.safetyCheck.safe}, sql=${sqlResult.safetyCheck.safe ? sqlResult.safetyCheck.sql.slice(0, 2000) : sqlResult.safetyCheck.reason}`);
            if (!sqlResult.safetyCheck.safe) {
              sqlFallbackReason = sqlResult.safetyCheck.reason;
            } else {
              controller.enqueue(encoder.encode(sseEncode("progress", { step: "querying_database", total: totalSteps, current: 2 })));

              const bqResult = await withTimeout(
                executeBqQuery(sqlResult.safetyCheck.sql, correlationId),
                BQ_QUERY_TIMEOUT_MS,
                "executeBqQuery"
              );
              controller.enqueue(encoder.encode(sseEncode("trace", {
                correlationId: bqResult.trace.correlationId,
                sql: bqResult.trace.sql,
                bytesProcessed: bqResult.trace.bytesProcessed,
              })));

              console.log(`[ROUTE] BQ result: ${bqResult.data.length} rows`);
              if (bqResult.data.length === 0) {
                sqlFallbackReason = `查無符合條件的資料 (0 rows)。已執行的 SQL：\n${sqlResult.safetyCheck.sql.slice(0, 500)}`;
              } else {
                bqData = bqResult.data;
                cachedBqResults.set(cacheKey, {
                  data: bqResult.data,
                  sql: sqlResult.safetyCheck.sql,
                  trace: {
                    correlationId: bqResult.trace.correlationId,
                    bytesProcessed: bqResult.trace.bytesProcessed,
                  },
                  expiresAt: Date.now() + BQ_RESULT_CACHE_TTL_MS,
                });
                if (cachedBqResults.size > 200) {
                  const now = Date.now();
                  for (const [k, v] of cachedBqResults) {
                    if (now > v.expiresAt) cachedBqResults.delete(k);
                  }
                }

                // Generate chart when data has enough rows for meaningful visualization
                if (bqResult.data.length >= 2) {
                  controller.enqueue(encoder.encode(sseEncode("progress", { step: "rendering_chart", total: totalSteps, current: 3 })));
                  // Determine chart type hint from intent or prompt keywords
                  let chartHint: string | undefined;
                  if (intent.type === "generate_chart") {
                    chartHint = (intent as { chartType?: string }).chartType;
                  }
                  if (!chartHint) {
                    const p = prompt.toLowerCase();
                    if (/趨勢|trend|走勢|變化|月.*營收|revenue.*month|逐月|逐日|逐週/i.test(p)) chartHint = "line";
                    else if (/佔比|占比|比例|結構|share|proportion|分佈/i.test(p)) chartHint = "pie";
                    else if (/堆疊|stacked|組成/i.test(p)) chartHint = "stacked_bar";
                    else if (/排名|排行|top|前\d|名次/i.test(p)) chartHint = "bar";
                    else if (/相關|correlation|散佈|scatter/i.test(p)) chartHint = "scatter";
                    else if (/雷達|radar|多維/i.test(p)) chartHint = "radar";
                  }
                  const rec = recommendChartType(bqResult.data, chartHint);

                  // Limit chart data for readability
                  let chartRows = bqResult.data;
                  const MAX_CHART_ROWS_TIMESERIES = 60;
                  const MAX_CHART_ROWS_DEFAULT = 30;
                  if (rec.yKeys.length > 0) {
                    if (rec.chartType === "line" || rec.chartType === "area") {
                      if (chartRows.length > MAX_CHART_ROWS_TIMESERIES) {
                        chartRows = [...chartRows].slice(-MAX_CHART_ROWS_TIMESERIES);
                      }
                    } else if (rec.seriesKey) {
                      // Multi-dimension: per-group truncation to preserve fairness
                      // Group by xKey, keep top groups by sum of first yKey, then keep top K items per group
                      const groupMap = new Map<string, Record<string, unknown>[]>();
                      for (const row of chartRows) {
                        const gk = String(row[rec.xKey] ?? "");
                        if (!groupMap.has(gk)) groupMap.set(gk, []);
                        groupMap.get(gk)!.push(row);
                      }
                      // Sort groups by total metric descending
                      const sortKey = rec.yKeys[0];
                      const sortedGroups = [...groupMap.entries()]
                        .map(([gk, rows]) => ({
                          gk,
                          rows,
                          total: rows.reduce((s, r) => s + (Number(r[sortKey]) || 0), 0),
                        }))
                        .sort((a, b) => b.total - a.total);

                      // Keep top 10 groups, top 5 items per group
                      const MAX_GROUPS = 10;
                      const MAX_PER_GROUP = 5;
                      const truncated: Record<string, unknown>[] = [];
                      for (const g of sortedGroups.slice(0, MAX_GROUPS)) {
                        const sorted = [...g.rows].sort(
                          (a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0)
                        );
                        truncated.push(...sorted.slice(0, MAX_PER_GROUP));
                      }
                      chartRows = truncated;
                    } else if (chartRows.length > MAX_CHART_ROWS_DEFAULT) {
                      const sortKey = rec.yKeys[0];
                      chartRows = [...chartRows]
                        .sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0))
                        .slice(0, MAX_CHART_ROWS_DEFAULT);
                    }
                  }

                  const chartData: AiChartDataV1 = {
                    chartId: `chart_${Date.now()}`,
                    title: prompt.slice(0, 50),
                    chartType: rec.chartType,
                    data: chartRows,
                    xKey: rec.xKey,
                    yKeys: rec.yKeys,
                    ...(rec.seriesKey ? { seriesKey: rec.seriesKey } : {}),
                  };
                  charts = [chartData];
                  // NOTE: chart SSE emission is DEFERRED until after AI streaming
                  // so that AI's [CHART_TYPE:xxx] suggestion can be applied first
                }
              }
            }
            } catch (bqErr) {
              console.error(`[ROUTE] SQL/BQ error:`, bqErr instanceof Error ? bqErr.message : bqErr);
              const bqErrMsg = bqErr instanceof Error ? bqErr.message : "未知錯誤";
              let fallbackSucceeded = false;
              if (shouldUseBrandShareFallback(prompt)) {
                try {
                  const fallbackSql = getBrandShareFallbackSql();
                  const fallbackResult = await withTimeout(
                    executeBqQuery(fallbackSql, correlationId),
                    BQ_FALLBACK_TIMEOUT_MS,
                    "executeBqFallback"
                  );
                  if (fallbackResult.data.length > 0) {
                    bqData = fallbackResult.data;
                    fallbackSucceeded = true;
                    controller.enqueue(encoder.encode(sseEncode("trace", {
                      correlationId: fallbackResult.trace.correlationId,
                      sql: fallbackResult.trace.sql,
                      bytesProcessed: fallbackResult.trace.bytesProcessed,
                    })));
                    const rec = recommendChartType(fallbackResult.data, "pie");
                    const chartData: AiChartDataV1 = {
                      chartId: `chart_${Date.now()}`,
                      title: "各品牌營收佔比（最近30天）",
                      chartType: "donut",
                      data: fallbackResult.data,
                      xKey: rec.xKey,
                      yKeys: rec.yKeys.length > 0 ? rec.yKeys : ["revenue_share_pct"],
                    };
                    charts = [chartData];
                    // Deferred: chart will be emitted after AI streaming
                  }
                } catch (fallbackErr) {
                  console.error(`[ROUTE] BQ fallback error:`, fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
                }
              }

              if (!fallbackSucceeded) {
                sqlFallbackReason = `資料庫查詢失敗: ${bqErrMsg}`;
              }
            }
            }

            controller.enqueue(encoder.encode(sseEncode("progress", { step: "generating_analysis", total: totalSteps, current: totalSteps })));
          }

          // Ragic real-time query mode
          let ragicData: RagicQueryResult | null = null;
          if (intent.type === "query_ragic") {
            const totalSteps = 3;
            controller.enqueue(encoder.encode(sseEncode("progress", { step: "planning_ragic_query", total: totalSteps, current: 1 })));

            try {
              const queryPlan = await withTimeout(
                generateRagicQuery(prompt, correlationId),
                RAGIC_QUERY_TIMEOUT_MS,
                "generateRagicQuery",
              );

              controller.enqueue(encoder.encode(sseEncode("progress", { step: "querying_ragic", total: totalSteps, current: 2 })));

              ragicData = await withTimeout(
                fetchRagicSheet(queryPlan.sheetCode, {
                  where: queryPlan.where,
                  limit: queryPlan.limit,
                  reverse: true,
                }),
                RAGIC_QUERY_TIMEOUT_MS,
                "fetchRagicSheet",
              );

              aiLog({
                level: "info",
                correlationId,
                module: "ai_expert",
                action: "ragic_query",
                userId,
                extra: {
                  sheetCode: queryPlan.sheetCode,
                  recordCount: ragicData.totalFetched,
                  hasWhere: !!queryPlan.where,
                },
              });

              // If compareBq is requested, also run BQ query in parallel
              if (queryPlan.compareBq && queryPlan.bqCompareQuery) {
                try {
                  const sqlResult = await withTimeout(
                    generateSql(queryPlan.bqCompareQuery, correlationId),
                    SQL_GEN_TIMEOUT_MS,
                    "generateSql_compare",
                  );
                  if (sqlResult.safetyCheck.safe) {
                    const bqResult = await withTimeout(
                      executeBqQuery(sqlResult.safetyCheck.sql, correlationId),
                      BQ_QUERY_TIMEOUT_MS,
                      "executeBqQuery_compare",
                    );
                    bqData = bqResult.data;
                    controller.enqueue(encoder.encode(sseEncode("trace", {
                      correlationId: bqResult.trace.correlationId,
                      sql: bqResult.trace.sql,
                      bytesProcessed: bqResult.trace.bytesProcessed,
                    })));
                  }
                } catch (bqCompareErr) {
                  console.warn("[ROUTE] BQ compare query failed:", bqCompareErr instanceof Error ? bqCompareErr.message : bqCompareErr);
                }
              }

              controller.enqueue(encoder.encode(sseEncode("progress", { step: "generating_analysis", total: totalSteps, current: totalSteps })));
            } catch (ragicErr) {
              console.error("[ROUTE] Ragic query error:", ragicErr instanceof Error ? ragicErr.message : ragicErr);
              sqlFallbackReason = `Ragic 即時查詢失敗: ${ragicErr instanceof Error ? ragicErr.message : "未知錯誤"}`;
            }
          }

          // Deep Research mode — full orchestration
          if (resolvedMode === "deep_research") {
            const warmupText = "正在產生深度研究報告，先整理子題與資料來源...\n\n";
            fullContent += warmupText;
            controller.enqueue(encoder.encode(sseEncode("token", { text: warmupText })));

            const researchResult = await runDeepResearch(
              prompt,
              correlationId,
              (step, current, total) => {
                controller.enqueue(encoder.encode(sseEncode("progress", { step, current, total })));
              },
            );

            // Emit research sections as a single event
            controller.enqueue(encoder.encode(sseEncode("research", {
              sections: researchResult.sections,
              summary: researchResult.summary,
            })));

            // Emit knowledge and traces from research
            if (researchResult.knowledgeSources.length > 0) {
              controller.enqueue(encoder.encode(sseEncode("knowledge", { sources: researchResult.knowledgeSources })));
              knowledgeSources = researchResult.knowledgeSources;
            }
            for (const trace of researchResult.traces) {
              controller.enqueue(encoder.encode(sseEncode("trace", {
                correlationId: trace.correlationId,
                sql: trace.sql,
                bytesProcessed: trace.bytesProcessed,
              })));
            }

            // Collect all charts from sections
            const researchCharts = researchResult.sections.flatMap((s) => s.charts ?? []);
            charts = researchCharts;
            for (const chart of researchCharts) {
              controller.enqueue(encoder.encode(sseEncode("chart", chart)));
            }

            fullContent = `## 深度研究報告\n\n${researchResult.sections.map((s) => `### ${s.heading}\n${s.contentMarkdown}`).join("\n\n")}\n\n### 結論與建議\n${researchResult.summary}`;

            // Save and finalize (skip streaming text for deep research)
            const assistantMsg = await messageRepo.create({
              sessionId: currentSessionId!,
              role: "assistant",
              content: fullContent,
              mode: resolvedMode,
              charts: charts.length > 0 ? charts : undefined,
              knowledgeSources: knowledgeSources.length > 0 ? knowledgeSources : undefined,
            });
            await sessionRepo.incrementMessageCount(currentSessionId!);

            let sessionTitle = "新對話";
            if (isNewSession) {
              import("@/lib/ai/title-generator")
                .then(async (titleImport) => {
                  const generatedTitle = await titleImport.generateTitle(prompt, fullContent.slice(0, 500));
                  await sessionRepo.update(currentSessionId!, { title: generatedTitle });
                })
                .catch((e: unknown) => { console.warn("[AI_ROUTE] title generation failed (deep_research):", e instanceof Error ? e.message : e); });
            }

            // Fire-and-forget: auto-summarize session
            triggerAutoSummary(currentSessionId!, correlationId).catch((e: unknown) => { console.warn("[AI_ROUTE] auto-summary failed:", e instanceof Error ? e.message : e); });

            // Fire-and-forget: 更新滾動摘要（不阻塞回覆）
            updateRollingSummary(
              existingSession?.rollingSummary,
              prompt,
              fullContent.slice(0, 2000),
              correlationId,
            ).then((newSummary) => {
              sessionRepo.update(currentSessionId!, { rollingSummary: newSummary });
            }).catch((e) => {
              console.warn("[AI_ROUTE] rolling summary update failed (deep_research):", e instanceof Error ? e.message : e);
            });

            controller.enqueue(encoder.encode(sseEncode("token", { text: fullContent })));
            controller.enqueue(encoder.encode(sseEncode("done", {
              sessionId: currentSessionId,
              messageId: assistantMsg.messageId,
              mode: resolvedMode,
              title: sessionTitle,
            })));
            controller.close();
            return;
          }

          // Emit knowledge sources if found
          if (knowledgeSources.length > 0) {
            controller.enqueue(encoder.encode(sseEncode("knowledge", { sources: knowledgeSources })));
          }

          // Stream AI analysis text — inject actual data into prompt
          let augmentedPrompt = prompt;
          const hasChart = charts.length > 0;

          // Inject Ragic real-time data if available
          if (ragicData && ragicData.totalFetched > 0) {
            const ragicPreview = ragicData.records.slice(0, 20);
            const ragicJson = JSON.stringify(ragicPreview);
            augmentedPrompt = `${prompt}\n\n以下是從 Ragic ERP 即時查詢到的真實數據（${ragicData.sheetName}）：\n- **即時資料筆數：${ragicData.totalFetched} 筆**\n- 以下顯示前 ${ragicPreview.length} 筆：\n\`\`\`json\n${ragicJson}\n\`\`\`\n\n${bqData.length > 0 ? `同時從 BigQuery 歷史資料查到 ${bqData.length} 筆供比對：\n\`\`\`json\n${JSON.stringify(bqData.slice(0, 10))}\n\`\`\`\n\n` : ""}重要規則：\n1. 這是 Ragic 上的即時資料，請明確標註「即時資料」\n2. 分析內容只能基於提供的數據，嚴禁捏造\n3. 欄位名稱為中文，請直接使用${bqData.length > 0 ? "\n4. 如果同時有 BigQuery 資料，請比對兩者差異並說明" : ""}`;
          } else if (ragicData && ragicData.totalFetched === 0) {
            augmentedPrompt = `${prompt}\n\n系統從 Ragic「${ragicData.sheetName}」即時查詢，但沒有找到符合條件的資料（0 筆）。\n\n請在回覆中：\n1. 告知使用者 Ragic 即時查詢未找到資料\n2. 建議使用者調整查詢條件（例如放寬時間範圍、換一張表）\n3. 提醒使用者也可以查詢 BigQuery 歷史資料（不需加「即時」關鍵字）`;
          } else if (bqData.length > 0) {
            const previewRows = bqData.slice(0, 20);
            const dataPreview = JSON.stringify(previewRows);
            // Build data summary for AI chart type selection
            const columnNames = Object.keys(bqData[0]);
            const sampleRows = bqData.slice(0, 5);
            const dataSummary = `\n\n--- 資料摘要（供圖表類型判斷）---\n- 欄位：${columnNames.join(", ")}\n- 總筆數：${bqData.length}\n- 前 ${sampleRows.length} 筆樣本：\n${JSON.stringify(sampleRows)}\n---`;
            augmentedPrompt = `${prompt}\n\n以下是從 BigQuery 查詢到的真實數據：\n- **精確總筆數：${bqData.length} 筆**（這是完整查詢結果，非取樣）\n- 以下顯示前 ${previewRows.length} 筆供分析：\n\`\`\`json\n${dataPreview}\n\`\`\`\n\n重要規則：\n1. 總數請使用上方的「精確總筆數」，這是真實數據\n2. 分析內容只能基於提供的數據，嚴禁捏造\n3. 如果數據有排序，前幾筆就是最重要的${hasChart ? `\n4. 根據以下資料摘要，判斷最佳圖表類型，在回覆最後一行加上 [CHART_TYPE:類型代碼]（如 bar/line/pie/grouped_bar/area/stacked_bar/horizontal_bar/composed/scatter/radar/donut）${dataSummary}` : ""}`;
          } else if (sqlFallbackReason) {
            augmentedPrompt = `${prompt}\n\n注意：系統在提取資料時發生異常，錯誤訊息如下：
\`${sqlFallbackReason}\`

請在回覆中：
1. 用友善語氣說明「目前系統在○○時遇到語法錯誤，暫時無法顯示數據」（○○ = 使用者原始問題的摘要）
2. 將上方錯誤訊息用 \`code\` 格式顯示，說明「請協助將以下錯誤代碼回報給技術團隊」
3. 主動提出 2-3 個相關的替代分析角度，讓使用者選擇
4. 語氣要積極、像一個專業分析師提出替代方案
5. 嚴禁說「AI 服務暫時無法使用」或類似服務不可用的字眼——系統是正常的，只是這次查詢有語法問題`;
          }

          // Stream with timeout + fast-fail + model fallback chain
          // Each model: 1 attempt with first-token timeout (30s) + total timeout (300s)
          // Chain: Main (Gemini 3.1 Pro) → Gemini 3.1 Pro → Gemini 3 Flash
          const FIRST_TOKEN_TIMEOUT_MS = 30_000;  // Fail fast if no token within 30s
          const TOTAL_STREAM_TIMEOUT_MS = 300_000; // Total streaming budget per model (Cloud Run allows 600s)
          const modelChain: ModelEntry[] = intent.type === "simple_answer"
            ? [{ model: getFastModel(), name: "Gemini 3 Flash" }]
            : getModelChain();
          let streamSuccess = false;

          // Helper: attempt streaming with a single model
          const attemptStream = async (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            model: any,
            modelName: string,
          ): Promise<boolean> => {
            const streamAbort = new AbortController();
            let gotFirstToken = false;

            // First-token timer: abort quickly if model is unresponsive
            const firstTokenTimer = setTimeout(() => {
              if (!gotFirstToken) {
                console.log(`[ROUTE] ${modelName}: no token in ${FIRST_TOKEN_TIMEOUT_MS / 1000}s, aborting`);
                streamAbort.abort();
              }
            }, FIRST_TOKEN_TIMEOUT_MS);

            // Total stream timer: hard limit for the entire response
            const totalTimer = setTimeout(() => {
              console.log(`[ROUTE] ${modelName}: total timeout ${TOTAL_STREAM_TIMEOUT_MS / 1000}s, aborting`);
              streamAbort.abort();
            }, TOTAL_STREAM_TIMEOUT_MS);

            try {
              const result = streamText({
                model,
                system: systemPrompt,
                prompt: augmentedPrompt,
                abortSignal: streamAbort.signal,
                temperature: 0.3,
                maxOutputTokens: 32768,
              });

              for await (const chunk of result.textStream) {
                if (!gotFirstToken) {
                  gotFirstToken = true;
                  clearTimeout(firstTokenTimer);
                  console.log(`[ROUTE] ${modelName}: first token received`);
                }
                fullContent += chunk;
                controller.enqueue(encoder.encode(sseEncode("token", { text: chunk })));
              }

              if (fullContent.trim().length === 0) {
                throw new Error("Stream completed but produced no content");
              }
              return true;
            } finally {
              clearTimeout(firstTokenTimer);
              clearTimeout(totalTimer);
            }
          };

          for (let i = 0; i < modelChain.length; i++) {
            if (streamSuccess) break;
            const { model: currentModel, name: modelName } = modelChain[i];

            console.log(`[ROUTE] Trying model #${i}: ${modelName}`);
            controller.enqueue(encoder.encode(sseEncode("progress", {
              step: "model_waiting",
              message: `正在使用 ${modelName} 生成回覆...`,
            })));

            try {
              streamSuccess = await attemptStream(currentModel, modelName);
              if (streamSuccess) {
                console.log(`[ROUTE] Model ${modelName} succeeded, content length: ${fullContent.length}`);
                break;
              }
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : "unknown";
              const reason = errMsg.includes("abort")
                ? "回應超時" : errMsg.includes("high demand") ? "模型高流量" : errMsg.slice(0, 60);
              console.error(`[ROUTE] Model ${modelName} failed: ${errMsg}`);

              // If we already got substantial content, treat as partial success
              // instead of discarding and switching models
              if (fullContent.trim().length > 100) {
                console.log(`[ROUTE] ${modelName} errored but has ${fullContent.length} chars of content, treating as partial success`);
                streamSuccess = true;
                break;
              }

              fullContent = "";

              aiLog({
                level: "warn",
                correlationId,
                module: "ai_expert",
                action: "chat",
                userId,
                error: `Model ${modelName} failed (${errMsg})`,
              });

              if (i < modelChain.length - 1) {
                const nextName = modelChain[i + 1].name;
                controller.enqueue(encoder.encode(sseEncode("progress", {
                  step: "model_fallback",
                  message: `${modelName} ${reason}，切換至 ${nextName}...`,
                })));
              } else {
                throw err; // Last model, no more fallbacks
              }
            }
          }

          // Apply AI's chart type suggestion BEFORE emitting chart
          if (charts.length > 0) {
            const typeMap: Record<string, string> = {
              bar: "bar", grouped_bar: "grouped_bar", line: "line", pie: "pie", area: "area",
              stacked_bar: "stacked_bar", horizontal_bar: "horizontal_bar", composed: "composed",
              scatter: "scatter", radar: "radar", donut: "donut", treemap: "treemap",
              "長條": "bar", "分組": "grouped_bar", "折線": "line", "圓餅": "pie", "面積": "area",
              "堆疊": "stacked_bar", "橫向": "horizontal_bar", "組合": "composed",
              "散佈": "scatter", "雷達": "radar", "環圈": "donut", "矩形": "treemap",
            };

            // Priority 1: Parse structured [CHART_TYPE:xxx] tag (AI-driven selection)
            const structuredMatch = fullContent.match(/\[CHART_TYPE[：:]?\s*(bar|grouped_bar|line|pie|area|stacked_bar|horizontal_bar|composed|scatter|radar|donut|treemap)\s*\]/i);
            // Priority 2: Fallback to legacy "建議圖表：xxx" format
            const legacyMatch = !structuredMatch
              ? fullContent.match(/建議圖表[：:]?\s*(bar|grouped_bar|line|pie|area|stacked_bar|horizontal_bar|composed|scatter|radar|donut|treemap|長條|分組|折線|圓餅|面積|堆疊|橫向|組合|散佈|雷達|環圈|矩形)/i)
              : null;

            const suggestMatch = structuredMatch || legacyMatch;
            if (suggestMatch) {
              const suggestedType = typeMap[suggestMatch[1].toLowerCase()] ?? suggestMatch[1].toLowerCase();
              if (suggestedType && suggestedType !== charts[0].chartType) {
                console.log(`[ROUTE] AI chart type applied: ${charts[0].chartType} → ${suggestedType}`);
                charts[0] = { ...charts[0], chartType: suggestedType as AiChartDataV1["chartType"] };
              }
            }

            // Emit chart AFTER AI's type suggestion has been applied
            controller.enqueue(encoder.encode(sseEncode("chart", charts[0])));
          }

          // Always remove chart type tags from displayed content (even when no chart)
          fullContent = fullContent
            .replace(/\n?\[CHART_TYPE[：:]?\s*[a-z_]+\s*\]/gi, "")
            .replace(/\n?建議圖表[：:].*/g, "")
            .trim();

          // Save assistant message
          const assistantMsg = await messageRepo.create({
            sessionId: currentSessionId!,
            role: "assistant",
            content: fullContent,
            mode: resolvedMode,
            charts: charts.length > 0 ? charts : undefined,
            knowledgeSources: knowledgeSources.length > 0 ? knowledgeSources : undefined,
          });
          await sessionRepo.incrementMessageCount(currentSessionId!);

          // Generate and update title for new sessions
          let sessionTitle = "新對話";
          if (isNewSession) {
            import("@/lib/ai/title-generator")
              .then(async (titleImport) => {
                const generatedTitle = await titleImport.generateTitle(prompt, fullContent);
                await sessionRepo.update(currentSessionId!, { title: generatedTitle });
              })
              .catch((e: unknown) => { console.warn("[AI_ROUTE] title generation failed:", e instanceof Error ? e.message : e); });
          }

          const durationMs = Date.now() - startTime;
          aiLog({
            level: "info",
            correlationId,
            module: "ai_expert",
            action: "chat",
            userId,
            durationMs,
            extra: { sessionId: currentSessionId, messageId: assistantMsg.messageId, contentLength: fullContent.length },
          });

          // Fire-and-forget: auto-summarize session when it has 4+ messages and no summary
          triggerAutoSummary(currentSessionId!, correlationId).catch((e: unknown) => { console.warn("[AI_ROUTE] auto-summary failed:", e instanceof Error ? e.message : e); });

          // Fire-and-forget: 更新滾動摘要（不阻塞回覆）
          updateRollingSummary(
            existingSession?.rollingSummary,
            prompt,
            fullContent.slice(0, 2000),
            correlationId,
          ).then((newSummary) => {
            sessionRepo.update(currentSessionId!, { rollingSummary: newSummary });
          }).catch((e) => {
            console.warn("[AI_ROUTE] rolling summary update failed:", e instanceof Error ? e.message : e);
          });

          controller.enqueue(
            encoder.encode(
              sseEncode("done", {
                sessionId: currentSessionId,
                messageId: assistantMsg.messageId,
                mode: resolvedMode,
                title: sessionTitle,
              })
            )
          );
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          aiLog({
            level: "error",
            correlationId,
            module: "ai_expert",
            action: "chat",
            userId,
            error: message,
            durationMs: Date.now() - startTime,
          });
          const errDetail = err instanceof Error ? err.message : "Unknown error";
          // Classify error and ALWAYS show error detail for debugging
          const isSqlError = /Unrecognized name|Syntax error|BigQuery/i.test(errDetail);
          const isTimeout = /timeout|DEADLINE_EXCEEDED/i.test(errDetail);
          const code = isSqlError ? "SQL_ERROR" : isTimeout ? "TIMEOUT" : "MODEL_ERROR";
          const shortErr = errDetail.slice(0, 300);
          const userMsg = isSqlError
            ? `資料庫查詢失敗: ${shortErr}`
            : isTimeout
              ? `AI 回應逾時，請縮小查詢範圍後重試 [${shortErr}]`
              : `AI 服務異常 [${code}]: ${shortErr}`;
          controller.enqueue(
            encoder.encode(sseEncode("error", {
              code,
              message: userMsg,
            }))
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[AI_CHAT_ROUTE] fatal pre-stream error:", err);
    aiLog({
      level: "error",
      correlationId,
      module: "ai_expert",
      action: "chat",
      userId,
      error: message,
      durationMs: Date.now() - startTime,
    });
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "系統錯誤，請稍後再試",
          detail: process.env.NODE_ENV === "development" ? message : undefined,
        },
      },
      { status: 500 }
    );
  }
}

const AUTO_SUMMARY_THRESHOLD = 4;

async function triggerAutoSummary(
  sessionId: string,
  correlationId: string,
): Promise<void> {
  const session = await sessionRepo.get(sessionId);
  if (!session || session.summary || session.messageCount < AUTO_SUMMARY_THRESHOLD) return;

  const { items: messages } = await messageRepo.listBySession(sessionId, { limit: 50 });
  if (messages.length < AUTO_SUMMARY_THRESHOLD) return;

  const result = await generateSessionSummary(messages, correlationId);
  if (result.summary) {
    await sessionRepo.update(sessionId, {
      summary: result.summary,
      tags: result.tags,
      conclusion: result.conclusion,
    });
  }
}
