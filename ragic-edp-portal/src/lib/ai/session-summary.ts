import "server-only";

import { generateText } from "ai";
import { getChatModel } from "./vertex-client";
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
      model: getChatModel(),
      system: `你是一位對話摘要助手。請根據以下行銷分析對話，產出 JSON 格式的摘要。

回傳格式（純 JSON，不要 markdown code block）：
{
  "summary": "2-3 句話的對話摘要，描述討論了什麼主題與得到什麼結論",
  "tags": ["最多5個標籤，如：營收分析、Shopee、Q4、品牌比較"],
  "conclusion": "1-2 句話的核心結論或行動建議，供後續對話引用"
}`,
      prompt: conversation.slice(0, 8000),
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
