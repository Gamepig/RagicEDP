import { generateText, tool } from "ai";
import { z } from "zod";
import { getChatModel } from "./vertex-client";

export type AiIntent =
  | { type: "simple_answer" }
  | { type: "query_database"; query: string }
  | { type: "generate_chart"; query: string; chartType?: string }
  | { type: "deep_research"; topic: string }
  | { type: "knowledge_lookup"; question: string };

const ROUTER_SYSTEM = `你是意圖分類器。根據使用者問題，呼叫最合適的工具。規則：
- 明確要求圖表、視覺化、「產生圖表」、「畫圖」、「圖表」 → generate_chart
- 需要查詢公司數據（營收、訂單、通路）但沒提到圖表 → query_database
- 要求深度分析、研究報告、多角度 → deep_research
- 問行銷理論、方法論、名詞解釋 → knowledge_lookup
- 一般對話、簡單問答 → simple_answer
重要：只要使用者提到「圖表」「圖」「chart」就必須分類為 generate_chart。
一律只呼叫一個工具。`;

export async function classifyIntent(prompt: string): Promise<AiIntent> {
  try {
    const result = await generateText({
      model: getChatModel(),
      system: ROUTER_SYSTEM,
      prompt,
      tools: {
        simple_answer: tool({
          description: "一般問答，不需查詢數據",
          inputSchema: z.object({}),
        }),
        query_database: tool({
          description: "查詢公司數據（營收、訂單、客戶、通路等）",
          inputSchema: z.object({
            query: z.string().describe("使用者想查詢的數據描述"),
          }),
        }),
        generate_chart: tool({
          description: "產生圖表視覺化",
          inputSchema: z.object({
            query: z.string().describe("圖表所需的數據描述"),
            chartType: z.string().optional().describe("建議的圖表類型：bar/line/pie/area"),
          }),
        }),
        deep_research: tool({
          description: "深度研究分析，整合多個來源",
          inputSchema: z.object({
            topic: z.string().describe("研究主題"),
          }),
        }),
        knowledge_lookup: tool({
          description: "查詢行銷知識庫（理論、方法、名詞）",
          inputSchema: z.object({
            question: z.string().describe("知識庫查詢問題"),
          }),
        }),
      },
      maxOutputTokens: 2048,
    });

    const call = result.toolCalls[0];
    if (!call) return { type: "simple_answer" };

    switch (call.toolName) {
      case "query_database":
        return { type: "query_database", query: (call.input as any).query };
      case "generate_chart":
        return { type: "generate_chart", query: (call.input as any).query, chartType: (call.input as any).chartType };
      case "deep_research":
        return { type: "deep_research", topic: (call.input as any).topic };
      case "knowledge_lookup":
        return { type: "knowledge_lookup", question: (call.input as any).question };
      default:
        return { type: "simple_answer" };
    }
  } catch {
    return { type: "simple_answer" };
  }
}
