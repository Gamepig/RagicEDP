import { generateText } from "ai";
import { getChatModel } from "./vertex-client";

export async function generateTitle(userPrompt: string, assistantResponse: string): Promise<string> {
  try {
    const result = await generateText({
      model: getChatModel(),
      system: "你是標題生成器。根據對話內容產生一個簡短的對話標題（10 字以內，繁體中文）。只輸出標題文字，不加引號或其他格式。",
      prompt: `使用者問：${userPrompt.slice(0, 200)}\nAI 回答摘要：${assistantResponse.slice(0, 300)}`,
      maxOutputTokens: 1024,
    });
    return result.text.trim() || "新對話";
  } catch {
    return "新對話";
  }
}
