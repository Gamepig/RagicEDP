import { generateText } from "ai";
import { getChatModel } from "./vertex-client";
import { validateSql, type SqlSafetyResult } from "./sql-safety";
import { getDatasetSchema, formatSchemaForPrompt } from "./schema-cache";
import { aiLog, type AiLogEntry } from "./logger";
import type { AiChartDataV1, QueryTraceV0 } from "../data/types";

const SQL_RULES = `You are a BigQuery SQL generator for a food e-commerce company.

=== CORE PRINCIPLE: VIEWS FIRST ===
This database has two layers:
1. VIEWS (cleaned, enriched, joined) — ALWAYS use these as your PRIMARY data source.
   Views already contain cleaned data with all relationships resolved (customer names, brand names,
   product series, channel names, city/district, etc.). Using Views avoids NULL fields and missing JOINs.
2. BASE TABLES (raw dimensions/facts) — ONLY use when no View covers the needed data.
   Base tables have incomplete data (e.g. fact_orders.customer_code is often NULL, dim_product has no category field).

When you see a View that has the columns you need, USE IT DIRECTLY. Do NOT go to base tables and
try to JOIN them yourself — the Views already did that work with proper data cleaning.

=== SQL OUTPUT RULES ===
1. Only SELECT statements. Never INSERT/UPDATE/DELETE/DROP.
2. Dataset: \`erp_backup\`. ALWAYS prefix ALL table/view names with \`erp_backup.\`
3. Output ONLY pure SQL. No explanations, no markdown, no comments.
4. Do NOT add LIMIT unless the user explicitly requests a limited number of results. The system will handle data truncation for display.
5. ALL text in SQL must be ASCII only. Use English aliases.
6. No SQL comments.
7. ALWAYS add ORDER BY for date-based queries (ASC) or by value (DESC for rankings).
8. NEVER query sheet_* raw tables directly.
9. ALWAYS output a valid SELECT statement. Never output text explanations.

=== DATA QUALITY NOTES ===
  - fact_order_details.subtotal is UNRELIABLE (5x inflated). NEVER use SUM(subtotal) for revenue.
  - For revenue, ALWAYS use order_amount from Views (ls_v_orders_ext, view_order_customer, etc.) or fact_orders.
  - NEVER group by SUBSTR of product_code — the "PD_" prefix is meaningless for categorization.

=== ENRICHMENT RULE: ALWAYS JOIN FOR HUMAN-READABLE NAMES (MANDATORY) ===
  CRITICAL: Results will be displayed in charts. Code-only labels (AC_007029) are UNACCEPTABLE.
  You MUST JOIN dimension tables to get human-readable names whenever a _code field appears:
  - customer_code → LEFT JOIN erp_backup.dim_customer dc ON dc.customer_code = x.customer_code → SELECT COALESCE(dc.customer_name, x.customer_code) AS customer_name
  - brand_code → LEFT JOIN erp_backup.dim_brand ON brand_code → SELECT brand_name
  - channel_code → LEFT JOIN erp_backup.dim_channel ON channel_code → SELECT channel_name
  - product_code → LEFT JOIN erp_backup.dim_product ON product_code → SELECT product_name
  Use LEFT JOIN + COALESCE so rows without a match still appear (with code as fallback).
  The SELECT clause MUST include the name column, NOT the code column, as the first string field.

=== COMMON QUERY PATTERNS (use these as templates) ===

  Customer purchase frequency (e.g. "only bought once", "top repeat customers"):
    SELECT COALESCE(dc.customer_name, r.customer_code) AS customer_name, r.frequency, r.monetary AS total_spent, r.recency, r.last_order_date
    FROM erp_backup.v_customer_rfm r
    LEFT JOIN erp_backup.dim_customer dc ON dc.customer_code = r.customer_code
    WHERE r.frequency = 1
    ORDER BY r.monetary DESC

  Customer count by purchase frequency (for "how many bought once"):
    SELECT frequency AS purchase_count, COUNT(*) AS customer_count
    FROM erp_backup.v_customer_rfm
    GROUP BY frequency ORDER BY frequency

  Channel revenue comparison:
    SELECT channel_name, SUM(order_amount) AS revenue, COUNT(*) AS order_count
    FROM erp_backup.ls_v_orders_ext
    GROUP BY channel_name ORDER BY revenue DESC

  Monthly revenue trend:
    SELECT FORMAT_DATE('%Y-%m', order_date) AS month, SUM(order_amount) AS revenue
    FROM erp_backup.ls_v_orders_ext
    GROUP BY month ORDER BY month

  Brand revenue (dominant brand per order):
    WITH order_brand AS (
      SELECT d.order_code, b.brand_name, SUM(d.subtotal) as s
      FROM erp_backup.fact_order_details d JOIN erp_backup.dim_brand b ON b.brand_code = SUBSTR(d.product_code, 4, 3)
      GROUP BY d.order_code, b.brand_name
    ), dominant AS (
      SELECT order_code, brand_name, ROW_NUMBER() OVER (PARTITION BY order_code ORDER BY s DESC) as rn FROM order_brand
    )
    SELECT d.brand_name, SUM(o.order_amount) AS revenue
    FROM erp_backup.fact_orders o JOIN dominant d ON o.order_code = d.order_code AND d.rn = 1
    GROUP BY d.brand_name ORDER BY revenue DESC

=== IMPORTANT: NO LIMIT ===
  - Do NOT add LIMIT to your SQL. The system handles data truncation.
  - When user asks "how many" or "有多少", include COUNT(*) in SELECT.`;

export type SqlGenerationResult = {
  sql: string;
  safetyCheck: SqlSafetyResult;
};

/** Extract clean SQL from model output */
function extractSql(text: string): string {
  // Try code block first
  const codeBlockMatch = text.match(/```(?:sql)?\s*\n?([\s\S]*?)```/);
  let sql = codeBlockMatch
    ? codeBlockMatch[1].trim()
    : text.trim();

  // Find SELECT if there's preamble text
  if (!sql.toUpperCase().startsWith("SELECT") && !sql.toUpperCase().startsWith("WITH")) {
    const idx = sql.search(/\b(SELECT|WITH)\b/i);
    if (idx >= 0) sql = sql.slice(idx);
  }

  // Remove comments
  sql = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  // Cut at semicolon (remove trailing text after SQL)
  const semiIdx = sql.indexOf(";");
  if (semiIdx > 0) sql = sql.slice(0, semiIdx);

  return sql.replace(/\n{2,}/g, "\n").trim();
}

/** Generate SQL with one retry if BQ execution fails */
async function generateSqlWithRetry(
  systemPrompt: string,
  naturalLanguage: string,
  correlationId: string,
): Promise<string> {
  const MAX_ATTEMPTS = 2;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = attempt === 1
      ? naturalLanguage
      : `${naturalLanguage}\n\n上一次生成的 SQL 執行失敗，錯誤：${lastError}\n請修正 SQL 語法錯誤，使用更簡單的查詢結構（避免複雜子查詢），直接使用 Views。只輸出純 SQL。`;

    const result = await generateText({
      model: getChatModel(),
      system: systemPrompt,
      prompt,
      maxOutputTokens: 8192,
    } as never);

    console.log(`[SQL-GEN] Attempt ${attempt} finishReason=${result.finishReason} textLen=${result.text.length} raw (first 800): ${result.text.slice(0, 800)}`);

    const sql = extractSql(result.text);
    console.log(`[SQL-GEN] Attempt ${attempt} extracted SQL (first 500): ${sql.slice(0, 500)}`);

    if (attempt < MAX_ATTEMPTS) {
      // Quick validation: try executing, if it fails retry
      const safety = validateSql(sql);
      if (!safety.safe) {
        lastError = safety.reason;
        console.warn(`[SQL-GEN] Validation failed on attempt ${attempt}: ${safety.reason}`);
        continue; // Retry instead of returning bad SQL
      }

      try {
        const { BigQuery } = await import("@google-cloud/bigquery");
        const bq = new BigQuery();
        // Dry-run to validate syntax without scanning data
        await bq.createQueryJob({ query: sql, dryRun: true });
        console.log(`[SQL-GEN] Dry-run passed on attempt ${attempt}`);
        return sql;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.warn(`[SQL-GEN] Dry-run failed on attempt ${attempt}: ${lastError}`);
        // Continue to retry
      }
    } else {
      return sql;
    }
  }

  return "SELECT 1"; // Should never reach here
}

export async function generateSql(
  naturalLanguage: string,
  correlationId: string
): Promise<SqlGenerationResult> {
  // Dynamically load schema from BQ (cached 30min)
  const schemas = await getDatasetSchema();
  const schemaText = formatSchemaForPrompt(schemas);
  const systemPrompt = `${SQL_RULES}\n\n=== AVAILABLE SCHEMA (auto-discovered from BigQuery) ===\n${schemaText}\n\nREMINDER: Output ONLY the SQL SELECT statement. No text before or after. No explanations. No markdown fences. Just pure SQL.`;

  // Debug: log schema structure to verify Views-first ordering
  const viewCount = schemas.filter(s => s.tableType === "VIEW").length;
  const tableCount = schemas.filter(s => s.tableType === "BASE TABLE").length;
  console.log(`[SQL-GEN] Schema: ${viewCount} views, ${tableCount} tables. Prompt length: ${systemPrompt.length} chars. Query: ${naturalLanguage.slice(0, 80)}`);

  const rawSql = await generateSqlWithRetry(systemPrompt, naturalLanguage, correlationId);

  const safetyCheck = validateSql(rawSql);
  console.log(`[SQL-GEN] Final SQL: ${rawSql.slice(0, 300)}`);

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
  const [rows] = await job.getQueryResults({ maxResults: 10000 });
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

  // Serialize BQ custom types and round float values (TWD has no decimals)
  const plainRows = (rows as Record<string, unknown>[]).map((row) => {
    const plain: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      if (val && typeof val === "object" && "value" in val) {
        plain[key] = (val as { value: string }).value;
      } else if (typeof val === "number") {
        plain[key] = Math.round(val);
      } else {
        plain[key] = val;
      }
    }
    return plain;
  });
  return { data: plainRows, trace };
}

export function recommendChartType(
  data: Record<string, unknown>[],
  hint?: string
): { chartType: AiChartDataV1["chartType"]; xKey: string; yKeys: string[] } {
  if (!data.length) return { chartType: "bar", xKey: "", yKeys: [] };

  const keys = Object.keys(data[0]);
  const numericKeys = keys.filter((k) => {
    const nums = data.map((row) => Number(row[k]) || 0);
    // Must have at least one number AND not all identical (constant columns are useless for charts)
    const hasNumber = data.some((row) => typeof row[k] === "number");
    const allSame = nums.length > 1 && nums.every((n) => n === nums[0]);
    return hasNumber && !allSame;
  });
  const stringKeys = keys.filter((k) =>
    data.some((row) => typeof row[k] === "string")
  );

  const xKey = stringKeys[0] ?? keys[0];

  // Filter yKeys to only include compatible scales (within 100x of each other)
  // and exclude percentage/growth columns that can be negative
  let yKeys: string[];
  if (numericKeys.length <= 1) {
    yKeys = numericKeys.length > 0 ? numericKeys : [keys[1] ?? keys[0]];
  } else {
    // Calculate median absolute value for each numeric key
    const keyMedians = numericKeys.map((k) => {
      const vals = data.map((r) => Math.abs(Number(r[k]) || 0)).filter((v) => v > 0).sort((a, b) => a - b);
      return { key: k, median: vals[Math.floor(vals.length / 2)] || 0 };
    }).filter((km) => km.median > 0);

    if (keyMedians.length === 0) {
      yKeys = numericKeys.slice(0, 2);
    } else {
      // Group by similar magnitude — pick the group with the most keys (or first key's group)
      const primary = keyMedians[0];
      const compatible = keyMedians.filter(
        (km) => km.median / primary.median < 100 && primary.median / km.median < 100
      );
      yKeys = compatible.length > 0 ? compatible.map((km) => km.key) : [primary.key];
    }

    // Cap at 3 yKeys for readability
    yKeys = yKeys.slice(0, 3);
  }

  let chartType: AiChartDataV1["chartType"] = "bar";
  if (hint) {
    const h = hint.toLowerCase();
    if (h.includes("line") || h.includes("趨勢") || h.includes("折線")) chartType = "line";
    else if (h.includes("pie") || h.includes("圓餅") || h.includes("比例")) chartType = "pie";
    else if (h.includes("area") || h.includes("面積")) chartType = "area";
    else if (h.includes("scatter") || h.includes("散佈")) chartType = "scatter";
    else if (h.includes("donut") || h.includes("環圈")) chartType = "donut";
  }

  // Many categories (>15) → horizontal_bar for readability
  if (!hint && data.length > 15) chartType = "horizontal_bar";
  // If only one category with many data points → line (time series likely)
  else if (!hint && data.length > 10 && numericKeys.length === 1) chartType = "line";
  // If 2-5 categories with one metric → pie (but NOT for single row)
  else if (!hint && data.length >= 2 && data.length <= 5 && numericKeys.length === 1) chartType = "pie";
  // Single row → bar (default, no change needed)

  return { chartType, xKey, yKeys };
}
