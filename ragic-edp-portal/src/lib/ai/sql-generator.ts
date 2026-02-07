import { generateText } from "ai";
import { getChatModel } from "./vertex-client";
import { validateSql, type SqlSafetyResult } from "./sql-safety";
import { aiLog, type AiLogEntry } from "./logger";
import type { AiChartDataV1, QueryTraceV0 } from "../data/types";

const SQL_SYSTEM = `你是 BigQuery SQL 生成器。根據使用者的自然語言描述，產生 SELECT 查詢。

規則：
1. 只產生 SELECT 語句，不可使用 INSERT/UPDATE/DELETE/DROP 等
2. 預設查詢 \`erp_backup\` dataset
3. 常用表格：
   - erp_backup.sheet_50_order (訂單：日期、品牌、通路、金額)
   - erp_backup.sheet_60_customer (客戶)
   - erp_backup.sheet_70_product (產品)
4. 如果不確定表格結構，使用 INFORMATION_SCHEMA.COLUMNS 查詢
5. 只輸出 SQL，不加任何解釋文字或 markdown 格式
6. 一律加上合理的 LIMIT（預設 1000）
7. 日期相關查詢使用 DATE 函數`;

export type SqlGenerationResult = {
  sql: string;
  safetyCheck: SqlSafetyResult;
};

export async function generateSql(
  naturalLanguage: string,
  correlationId: string
): Promise<SqlGenerationResult> {
  const result = await generateText({
    model: getChatModel(),
    system: SQL_SYSTEM,
    prompt: naturalLanguage,
    maxTokens: 500,
  });

  const rawSql = result.text
    .replace(/```sql\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const safetyCheck = validateSql(rawSql);

  aiLog({
    level: safetyCheck.safe ? "info" : "warn",
    correlationId,
    module: "ai_expert",
    action: "query",
    extra: { rawSql, safe: safetyCheck.safe },
  } as AiLogEntry);

  return { sql: rawSql, safetyCheck };
}

export type BqQueryResult = {
  data: Record<string, unknown>[];
  trace: QueryTraceV0;
};

export async function executeBqQuery(
  sql: string,
  correlationId: string
): Promise<BqQueryResult> {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const bq = new BigQuery();
  const startMs = Date.now();

  const [job] = await bq.createQueryJob({ query: sql });
  const [rows] = await job.getQueryResults();
  const [metadata] = await job.getMetadata();

  const bytesProcessed = parseInt(
    metadata.statistics?.totalBytesProcessed ?? "0",
    10
  );
  const durationMs = Date.now() - startMs;

  const trace: QueryTraceV0 = {
    correlationId,
    mode: "real",
    sourceSurface: { type: "QUERY", name: "ai_generated" },
    sql,
    bytesProcessed,
    executionMs: durationMs,
    cacheHit: metadata.statistics?.query?.cacheHit ?? false,
    readonlyValidated: true,
    allowlistValidated: false,
  };

  aiLog({
    level: "info",
    correlationId,
    module: "ai_expert",
    action: "query",
    bytesProcessed,
    durationMs,
  } as AiLogEntry);

  return { data: rows as Record<string, unknown>[], trace };
}

export function recommendChartType(
  data: Record<string, unknown>[],
  hint?: string
): { chartType: AiChartDataV1["chartType"]; xKey: string; yKeys: string[] } {
  if (!data.length) return { chartType: "bar", xKey: "", yKeys: [] };

  const keys = Object.keys(data[0]);
  const numericKeys = keys.filter((k) =>
    data.some((row) => typeof row[k] === "number")
  );
  const stringKeys = keys.filter((k) =>
    data.some((row) => typeof row[k] === "string")
  );

  const xKey = stringKeys[0] ?? keys[0];
  const yKeys = numericKeys.length > 0 ? numericKeys : [keys[1] ?? keys[0]];

  let chartType: AiChartDataV1["chartType"] = "bar";
  if (hint) {
    const h = hint.toLowerCase();
    if (h.includes("line") || h.includes("趨勢") || h.includes("折線")) chartType = "line";
    else if (h.includes("pie") || h.includes("圓餅") || h.includes("比例")) chartType = "pie";
    else if (h.includes("area") || h.includes("面積")) chartType = "area";
    else if (h.includes("scatter") || h.includes("散佈")) chartType = "scatter";
    else if (h.includes("donut") || h.includes("環圈")) chartType = "donut";
  }

  // If only one category with many data points → line
  if (!hint && data.length > 10 && numericKeys.length === 1) chartType = "line";
  // If few categories → pie
  if (!hint && data.length <= 5 && numericKeys.length === 1) chartType = "pie";

  return { chartType, xKey, yKeys };
}
