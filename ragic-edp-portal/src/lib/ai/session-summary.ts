import "server-only";

import { generateText } from "ai";
import { getFastModel } from "./vertex-client";
import { aiLog } from "./logger";
import type { AiMessageV1 } from "../data/types";

/**
 * Generate a summary, tags, and conclusion for a completed session.
 * Called after a conversation reaches a natural conclusion (e.g., 4+ messages).
 */
export async function generateSessionSummary(
  messages: AiMessageV1[],
  correlationId: string,
): Promise<{ summary: string; tags: string[]; conclusion: string }> {
  const conversation = messages
    .map((m) => `[${m.role}] ${m.content.slice(0, 500)}`)
    .join("\n\n");

  const startTime = Date.now();

  try {
    const { text } = await generateText({
      model: getFastModel(),
      system: `你是一位對話摘要助手。請根據以下行銷分析對話，產出 JSON 格式的摘要。

回傳格式（純 JSON，不要 markdown code block）：
{
  "summary": "2-3 句話的對話摘要，描述討論了什麼主題與得到什麼結論",
  "tags": ["最多5個標籤，如：營收分析、Shopee、Q4、品牌比較"],
  "conclusion": "1-2 句話的核心結論或行動建議，供後續對話引用"
}`,
      prompt: conversation.slice(0, 8000),
      maxOutputTokens: 512,
    });

    aiLog({
      level: "info",
      correlationId,
      module: "org_memory",
      action: "summarize",
      durationMs: Date.now() - startTime,
    });

    // Strip markdown code block wrapper if present (e.g., ```json ... ```)
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      conclusion: parsed.conclusion ?? "",
    };
  } catch (err) {
    aiLog({
      level: "error",
      correlationId,
      module: "org_memory",
      action: "summarize",
      error: err instanceof Error ? err.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    return { summary: "", tags: [], conclusion: "" };
  }
}

/**
 * 基於最新一輪問答 + 現有摘要，產生更新的滾動摘要。
 * 使用 Flash 模型，設計為 fire-and-forget，不阻塞主流程。
 */
export async function updateRollingSummary(
  existingSummary: string | undefined,
  latestUserPrompt: string,
  latestAssistantResponse: string,
  correlationId: string,
): Promise<string> {
  const startTime = Date.now();

  try {
    const { text } = await generateText({
      model: getFastModel(),
      system: `你是一個對話摘要助手。根據現有摘要和最新一輪對話，產生更新的摘要。
摘要規則：
1. 保留所有重要的數據發現、結論、使用者偏好
2. 合併重複內容，移除過時資訊
3. 限制在 800 字以內
4. 使用條列式，每條一個重點`,
      prompt: `現有摘要：${existingSummary || "（無）"}

最新對話：
使用者：${latestUserPrompt}
助理：${latestAssistantResponse.slice(0, 1500)}

請直接輸出更新後的摘要（純文字，不要 JSON）：`,
      maxOutputTokens: 512,
      temperature: 0.2,
    });

    aiLog({
      level: "info",
      correlationId,
      module: "org_memory",
      action: "rolling_summary",
      durationMs: Date.now() - startTime,
    });

    return text.trim();
  } catch (err) {
    aiLog({
      level: "error",
      correlationId,
      module: "org_memory",
      action: "rolling_summary",
      error: err instanceof Error ? err.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    // 失敗時回傳現有摘要，不丟失已有的記憶
    return existingSummary ?? "";
  }
}

/**
 * Format past session conclusions for injection into the system prompt.
 */
export function formatPastConclusions(
  sessions: Array<{ title: string; conclusion: string; updatedAt: string }>,
): string {
  if (sessions.length === 0) return "";

  return sessions
    .map(
      (s) =>
        `- **${s.title}**（${s.updatedAt.slice(0, 10)}）：${s.conclusion}`,
    )
    .join("\n");
}
