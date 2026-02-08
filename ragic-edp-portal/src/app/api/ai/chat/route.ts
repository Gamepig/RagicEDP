import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { getChatModel, getFastModel, streamText } from "@/lib/ai/vertex-client";
import { buildSystemPrompt } from "@/lib/ai/expert-prompt";
import { AiSessionRepository } from "@/lib/firestore/ai-session.repo";
import { AiMessageRepository } from "@/lib/firestore/ai-message.repo";
import { aiLog, createCorrelationId } from "@/lib/ai/logger";
import { classifyIntent } from "@/lib/ai/intent-router";
import { generateSql, executeBqQuery, recommendChartType } from "@/lib/ai/sql-generator";
import { searchKnowledge, formatKnowledgeContext } from "@/lib/ai/knowledge-rag";
import { AiKnowledgeRepository } from "@/lib/firestore/ai-knowledge.repo";
import { runDeepResearch } from "@/lib/ai/deep-research";
import { generateSessionSummary, formatPastConclusions } from "@/lib/ai/session-summary";
import type { AiChartDataV1, AiKnowledgeSourceV1 } from "@/lib/data/types";

const MAX_PROMPT_LENGTH = 5000;
const MAX_MESSAGES_PER_SESSION = 50;

const sessionRepo = new AiSessionRepository();
const messageRepo = new AiMessageRepository();

// Cache org memory conclusions (5 min TTL) to reduce Firestore reads
let cachedConclusions: { text: string; expiresAt: number } | null = null;
const CONCLUSIONS_CACHE_TTL = 5 * 60 * 1000;

// Cache knowledge chunks (10 min TTL) to avoid loading all Firestore docs per request
let cachedKnowledgeChunks: { chunks: import("@/lib/ai/knowledge-rag").KnowledgeChunk[]; expiresAt: number } | null = null;
const KNOWLEDGE_CACHE_TTL = 10 * 60 * 1000;

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

  const userId = session?.user?.email ?? (process.env.NODE_ENV === "development" ? "dev@local" : null);
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
    if (currentSessionId) {
      const existing = await sessionRepo.get(currentSessionId);
      if (!existing || existing.userId !== userId) {
        return Response.json(
          { error: { code: "FORBIDDEN", message: "無權存取此對話" } },
          { status: 403 }
        );
      }
      if (existing.messageCount >= MAX_MESSAGES_PER_SESSION) {
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
      model: "gemini-3-pro",
      extra: { sessionId: currentSessionId, promptLength: prompt.length, mode: mode ?? "auto" },
    });

    // Classify intent
    const intent = mode === "deep_research"
      ? { type: "deep_research" as const, topic: prompt }
      : await classifyIntent(prompt);

    const resolvedMode = intent.type === "generate_chart" || intent.type === "query_database"
      ? "chart_gen" as const
      : intent.type === "deep_research"
        ? "deep_research" as const
        : "simple" as const;

    // Knowledge RAG search (with module-level cache)
    let knowledgeSources: AiKnowledgeSourceV1[] = [];
    if (intent.type === "knowledge_lookup" || intent.type === "simple_answer") {
      try {
        let allChunks: import("@/lib/ai/knowledge-rag").KnowledgeChunk[];
        if (cachedKnowledgeChunks && Date.now() < cachedKnowledgeChunks.expiresAt) {
          allChunks = cachedKnowledgeChunks.chunks;
        } else {
          const knowledgeRepo = new AiKnowledgeRepository();
          allChunks = await knowledgeRepo.loadAllChunks();
          cachedKnowledgeChunks = { chunks: allChunks, expiresAt: Date.now() + KNOWLEDGE_CACHE_TTL };
        }
        if (allChunks.length > 0) {
          const queryText = intent.type === "knowledge_lookup" ? intent.question : prompt;
          knowledgeSources = await searchKnowledge(queryText, allChunks, correlationId);
        }
      } catch {
        // Knowledge search failure is non-critical
      }
    }

    // Fetch past conclusions for organization memory (cached 5 min)
    let pastConclusions = "";
    if (cachedConclusions && Date.now() < cachedConclusions.expiresAt) {
      pastConclusions = cachedConclusions.text;
    } else {
      try {
        const recentSessions = await sessionRepo.listOrgSessions({ limit: 10 });
        const sessionsWithConclusions = recentSessions.items.filter((s) => s.conclusion);
        if (sessionsWithConclusions.length > 0) {
          pastConclusions = formatPastConclusions(
            sessionsWithConclusions.map((s) => ({
              title: s.title,
              conclusion: s.conclusion!,
              updatedAt: s.updatedAt,
            })),
          );
        }
        cachedConclusions = { text: pastConclusions, expiresAt: Date.now() + CONCLUSIONS_CACHE_TTL };
      } catch {
        // Organization memory is non-critical
      }
    }

    // Build system prompt with optional knowledge context + past conclusions
    const knowledgeContext = formatKnowledgeContext(knowledgeSources);
    const systemPrompt = buildSystemPrompt({
      knowledgeContext: knowledgeContext || undefined,
      pastConclusions: pastConclusions || undefined,
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
          const shouldQueryBq = intent.type !== "deep_research" && intent.type !== "knowledge_lookup";
          if (shouldQueryBq) {
            const totalSteps = 4;
            controller.enqueue(encoder.encode(sseEncode("progress", { step: "generating_sql", total: totalSteps, current: 1 })));

            const queryText = intent.type === "generate_chart" || intent.type === "query_database"
              ? (intent as { query: string }).query
              : prompt;
            try {
            const sqlResult = await generateSql(queryText, correlationId);
            console.log(`[ROUTE] SQL safe=${sqlResult.safetyCheck.safe}, sql=${sqlResult.safetyCheck.safe ? sqlResult.safetyCheck.sql.slice(0, 500) : sqlResult.safetyCheck.reason}`);
            if (!sqlResult.safetyCheck.safe) {
              sqlFallbackReason = sqlResult.safetyCheck.reason;
            } else {
              controller.enqueue(encoder.encode(sseEncode("progress", { step: "querying_database", total: totalSteps, current: 2 })));

              const bqResult = await executeBqQuery(sqlResult.safetyCheck.sql, correlationId);
              controller.enqueue(encoder.encode(sseEncode("trace", {
                correlationId: bqResult.trace.correlationId,
                sql: bqResult.trace.sql,
                bytesProcessed: bqResult.trace.bytesProcessed,
              })));

              console.log(`[ROUTE] BQ result: ${bqResult.data.length} rows`);
              if (bqResult.data.length === 0) {
                sqlFallbackReason = "查無符合條件的資料，請嘗試調整條件";
              } else {
                bqData = bqResult.data;

                // Generate chart when data has enough rows for meaningful visualization
                if (bqResult.data.length >= 2) {
                  controller.enqueue(encoder.encode(sseEncode("progress", { step: "rendering_chart", total: totalSteps, current: 3 })));
                  const chartHint = intent.type === "generate_chart" ? (intent as { chartType?: string }).chartType : undefined;
                  const rec = recommendChartType(bqResult.data, chartHint);

                  // Limit chart data to top 20 rows for readability
                  let chartRows = bqResult.data;
                  if (chartRows.length > 20 && rec.yKeys.length > 0) {
                    const sortKey = rec.yKeys[0];
                    chartRows = [...chartRows]
                      .sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0))
                      .slice(0, 20);
                  }

                  const chartData: AiChartDataV1 = {
                    chartId: `chart_${Date.now()}`,
                    title: prompt.slice(0, 50),
                    chartType: rec.chartType,
                    data: chartRows,
                    xKey: rec.xKey,
                    yKeys: rec.yKeys,
                  };
                  charts = [chartData];
                  controller.enqueue(encoder.encode(sseEncode("chart", chartData)));
                }
              }
            }
            } catch (bqErr) {
              console.error(`[ROUTE] SQL/BQ error:`, bqErr instanceof Error ? bqErr.message : bqErr);
              sqlFallbackReason = `資料庫查詢失敗: ${bqErr instanceof Error ? bqErr.message : "未知錯誤"}`;
            }

            controller.enqueue(encoder.encode(sseEncode("progress", { step: "generating_analysis", total: totalSteps, current: totalSteps })));
          }

          // Deep Research mode — full orchestration
          if (resolvedMode === "deep_research") {
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
              const titleImport = await import("@/lib/ai/title-generator");
              sessionTitle = await titleImport.generateTitle(prompt, fullContent.slice(0, 500));
              await sessionRepo.update(currentSessionId!, { title: sessionTitle });
            }

            // Fire-and-forget: auto-summarize session
            triggerAutoSummary(currentSessionId!, correlationId).catch(() => {});

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

          // Stream AI analysis text — inject actual BQ data or fallback reason into prompt
          let augmentedPrompt = prompt;
          if (bqData.length > 0) {
            const previewRows = bqData.slice(0, 50);
            const dataPreview = JSON.stringify(previewRows, null, 2);
            augmentedPrompt = `${prompt}\n\n以下是從 BigQuery 查詢到的真實數據：\n- **精確總筆數：${bqData.length} 筆**（這是完整查詢結果，非取樣）\n- 以下顯示前 ${previewRows.length} 筆供分析：\n\`\`\`json\n${dataPreview}\n\`\`\`\n\n重要規則：\n1. 總數請使用上方的「精確總筆數」，這是真實數據\n2. 分析內容只能基於提供的數據，嚴禁捏造\n3. 如果數據有排序，前幾筆就是最重要的`;
          } else if (sqlFallbackReason) {
            augmentedPrompt = `${prompt}\n\n注意：系統無法取得此查詢的數據。原因：${sqlFallbackReason}。請向使用者解釋目前資料的限制，並建議可行的替代分析方式（例如按縣市、品牌、通路分析）。`;
          }

          // Try main model, fallback to fast model if it fails
          let streamModel;
          try {
            streamModel = getChatModel();
            // Quick probe: if model creation itself throws, catch here
          } catch {
            streamModel = getFastModel();
          }

          try {
            const result = streamText({
              model: streamModel,
              system: systemPrompt,
              prompt: augmentedPrompt,
            });

            for await (const chunk of result.textStream) {
              fullContent += chunk;
              controller.enqueue(encoder.encode(sseEncode("token", { text: chunk })));
            }
          } catch (streamErr) {
            // Fallback to fast model if main model fails during streaming
            aiLog({
              level: "warn",
              correlationId,
              module: "ai_expert",
              action: "chat",
              userId,
              error: `Main model failed, falling back to fast model: ${streamErr instanceof Error ? streamErr.message : "unknown"}`,
            });
            const fallbackResult = streamText({
              model: getFastModel(),
              system: systemPrompt,
              prompt: augmentedPrompt,
            });

            for await (const chunk of fallbackResult.textStream) {
              fullContent += chunk;
              controller.enqueue(encoder.encode(sseEncode("token", { text: chunk })));
            }
          }

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
            const titleImport = await import("@/lib/ai/title-generator");
            sessionTitle = await titleImport.generateTitle(prompt, fullContent);
            await sessionRepo.update(currentSessionId!, { title: sessionTitle });
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
          triggerAutoSummary(currentSessionId!, correlationId).catch(() => {});

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
          controller.enqueue(
            encoder.encode(sseEncode("error", {
              code: "MODEL_UNAVAILABLE",
              message: process.env.NODE_ENV === "development"
                ? `AI 服務錯誤: ${errDetail}`
                : "AI 服務暫時無法使用，請稍後再試",
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
      { error: { code: "INTERNAL_ERROR", message: "系統錯誤，請稍後再試" } },
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
