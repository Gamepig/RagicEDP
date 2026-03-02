import { generateText, tool } from "ai";
import { z } from "zod";
import { getFastModel } from "./vertex-client";

export type AiIntent =
  | { type: "simple_answer" }
  | { type: "query_database"; query: string }
  | { type: "generate_chart"; query: string; chartType?: string }
  | { type: "deep_research"; topic: string }
  | { type: "knowledge_lookup"; question: string }
  | { type: "query_ragic"; query: string; sheetHint?: string };

const ROUTER_SYSTEM = `你是意圖分類器。根據使用者問題，呼叫最合適的工具。規則：
- 明確要求圖表、視覺化、「產生圖表」、「畫圖」、「圖表」 → generate_chart
- 需要查詢公司數據（營收、訂單、通路）但沒提到圖表 → query_database
- 明確提到「Ragic」「即時」「最新資料」「目前」「real-time」且需要查詢表單資料 → query_ragic
- 要求深度分析、研究報告、多角度 → deep_research
- 問行銷理論、方法論、名詞解釋 → knowledge_lookup
- 一般對話、簡單問答 → simple_answer
重要：只要使用者提到「圖表」「圖」「chart」就必須分類為 generate_chart。
一律只呼叫一個工具。`;

export async function classifyIntent(prompt: string): Promise<AiIntent> {
  const text = prompt.toLowerCase();

  // Fast rule-based path: detect chart requests FIRST (user explicitly asks for a chart type)
  const chartKeywords = ["圖表", "chart", "圓餅圖", "pie", "折線圖", "line", "長條圖", "bar",
    "面積圖", "area", "雷達圖", "radar", "環圈圖", "donut", "散佈圖", "scatter",
    "矩形樹圖", "treemap", "橫向長條", "用圖", "畫圖", "產生圖"];
  const chartMatch = chartKeywords.find((kw) => text.includes(kw));
  if (chartMatch) {
    // Extract chart type hint from the prompt
    let chartType: string | undefined;
    if (text.includes("圓餅") || text.includes("pie")) chartType = "pie";
    else if (text.includes("折線") || text.includes("line") || text.includes("趨勢")) chartType = "line";
    else if (text.includes("面積") || text.includes("area")) chartType = "area";
    else if (text.includes("雷達") || text.includes("radar")) chartType = "radar";
    else if (text.includes("環圈") || text.includes("donut")) chartType = "donut";
    else if (text.includes("散佈") || text.includes("scatter")) chartType = "scatter";
    else if (text.includes("橫向") || text.includes("horizontal")) chartType = "horizontal_bar";
    return { type: "generate_chart", query: prompt, chartType };
  }

  // Fast rule-based path: detect Ragic real-time query requests
  const ragicKeywords = ["ragic", "即時", "最新資料", "目前ragic", "即時資料", "real-time", "live data"];
  const ragicMatch = ragicKeywords.find((kw) => text.includes(kw));
  if (ragicMatch) {
    // Extract sheet hint from prompt
    let sheetHint: string | undefined;
    if (text.includes("訂單")) sheetHint = "50";
    else if (text.includes("客戶")) sheetHint = "60";
    else if (text.includes("商品") || text.includes("產品")) sheetHint = "70";
    else if (text.includes("明細")) sheetHint = "99";
    else if (text.includes("品牌")) sheetHint = "10";
    else if (text.includes("通路")) sheetHint = "20";
    else if (text.includes("活動")) sheetHint = "80";
    return { type: "query_ragic", query: prompt, sheetHint };
  }

  // Fast rule-based path: detect casual chat / greetings → simple_answer (skip LLM call)
  const casualPatterns = /^(你好|嗨|哈囉|hi|hello|hey|早安|午安|晚安|謝謝|感謝|你是誰|你是什麼|你叫什麼|你是哪個|幫我|請問你|測試|test)\b/i;
  if (casualPatterns.test(text.trim()) && text.length < 30) {
    return { type: "simple_answer" };
  }

  // Fast rule-based path: detect conversation recap / summary requests → simple_answer
  // These may contain analytics keywords like "分析" but user is asking about the conversation, not new data
  const recapPatterns = /(?:總結|回顧|整理|彙整|歸納).*(?:我們|今天|剛才|剛剛|之前|以上|對話|討論|聊|分析了|內容|重點)/;
  if (recapPatterns.test(text)) {
    return { type: "simple_answer" };
  }

  // Fast rule-based path for common analytics prompts (avoid extra LLM call)
  if (
    text.includes("趨勢") ||
    text.includes("比較") ||
    text.includes("ga4") ||
    text.includes("營收") ||
    text.includes("訂單") ||
    text.includes("sessions") ||
    text.includes("cvr") ||
    text.includes("分析") ||
    text.includes("客戶") ||
    text.includes("通路") ||
    text.includes("品牌") ||
    text.includes("排名") ||
    text.includes("revenue") ||
    text.includes("order") ||
    text.includes("customer") ||
    text.includes("前") && /\d/.test(text) || // "前10名", "前20"
    text.includes("列出") ||
    text.includes("查詢") ||
    text.includes("明細") ||
    text.includes("統計") ||
    text.includes("佔比") ||
    text.includes("占比") ||
    text.includes("成長") ||
    text.includes("下降") ||
    text.includes("avg_") ||
    text.includes("_count") ||
    text.includes("_value")
  ) {
    return { type: "query_database", query: prompt };
  }

  try {
    const result = await generateText({
      model: getFastModel(),
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
        query_ragic: tool({
          description: "即時查詢 Ragic ERP 表單資料（最新訂單、客戶、商品等）",
          inputSchema: z.object({
            query: z.string().describe("查詢描述"),
            sheetHint: z.string().optional().describe("表單代碼提示 (50=訂單, 60=客戶, 70=商品, 99=明細)"),
          }),
        }),
        knowledge_lookup: tool({
          description: "查詢行銷知識庫（理論、方法、名詞）",
          inputSchema: z.object({
            question: z.string().describe("知識庫查詢問題"),
          }),
        }),
      },
      maxOutputTokens: 512,
    });

    const call = result.toolCalls[0];
    if (!call) return { type: "simple_answer" };

    switch (call.toolName) {
      case "query_database":
        return { type: "query_database", query: (call.input as any).query };
      case "generate_chart":
        return { type: "generate_chart", query: (call.input as any).query, chartType: (call.input as any).chartType };
      case "query_ragic":
        return { type: "query_ragic", query: (call.input as any).query, sheetHint: (call.input as any).sheetHint };
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
