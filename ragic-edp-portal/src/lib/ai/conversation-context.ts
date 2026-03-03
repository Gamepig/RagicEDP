import "server-only";

import { AiMessageRepository } from "../firestore/ai-message.repo";

const messageRepo = new AiMessageRepository();

const MAX_RECENT_MESSAGES = 10; // 5 輪（user + assistant）
const MAX_MESSAGE_LENGTH = 800; // 每條訊息截斷長度
const MAX_TOTAL_LENGTH = 4000; // 整體上下文字數限制

/**
 * 從 Session 載入對話上下文，組合短期 + 長期記憶。
 * - 短期記憶：最近 3 輪（6 條訊息）原文
 * - 長期記憶：rollingSummary（更早對話的壓縮摘要）
 */
export async function buildConversationContext(
  sessionId: string,
  rollingSummary?: string,
): Promise<string> {
  const { items: messages } = await messageRepo.listBySession(sessionId, { limit: 50 });

  if (messages.length === 0) return "";

  // 取最後 MAX_RECENT_MESSAGES 條作為短期記憶（排除本輪剛儲存的 user message）
  // 因為 user message 已經在當前 prompt 中，所以取倒數第 2 條開始往前
  const recentMessages = messages.slice(-MAX_RECENT_MESSAGES);

  const parts: string[] = [];

  // 長期記憶：rollingSummary 放在短期記憶之前
  if (rollingSummary) {
    parts.push(`## 對話摘要（早期對話重點）\n${rollingSummary}`);
  }

  // 短期記憶：格式化最近幾輪對話
  if (recentMessages.length > 0) {
    const formatted = recentMessages.map((msg) => {
      const role = msg.role === "user" ? "使用者" : "助理";
      const content = msg.content.length > MAX_MESSAGE_LENGTH
        ? msg.content.slice(0, MAX_MESSAGE_LENGTH) + "..."
        : msg.content;
      return `[${role}] ${content}`;
    }).join("\n\n");

    parts.push(`## 最近對話紀錄\n${formatted}`);
  }

  let result = parts.join("\n\n");

  // 限制總量
  if (result.length > MAX_TOTAL_LENGTH) {
    result = result.slice(0, MAX_TOTAL_LENGTH) + "\n...（已截斷）";
  }

  return result;
}
