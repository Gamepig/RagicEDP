import { generateText } from "ai";
import { getChatModel, getFastModel } from "./vertex-client";
import { validateSql, type SqlSafetyResult } from "./sql-safety";
import { getAiDatasetSchema, formatAiSchemaForPrompt, needsGa4Schema } from "./schema-cache";
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
2. Datasets:
   - GA4: \`b25h01.ga4_analytics\` (use mat_* materialized tables, e.g. mat_ga4_sessions)
   - ERP: \`b25h01-ragic.erp_backup\`
   ALWAYS use FULLY QUALIFIED table names: \`project.dataset.table\`.
3. Output ONLY pure SQL. No explanations, no markdown, no comments, no natural language. Your ENTIRE response must be a single SQL statement starting with SELECT or WITH...AS(.
4. ALWAYS add a LIMIT to the FINAL (outermost) SELECT:
   - Ranking queries ("前N名", "top N"): LIMIT N (match the requested count exactly).
   - Cross-entity queries ("前5名客戶買了什麼"): use ROW_NUMBER() + WHERE rn <= K inside a CTE, then LIMIT N*K on the outer SELECT.
   - General aggregation queries: LIMIT 50 (safe default for chart display).
   - Only omit LIMIT if the user explicitly says "全部" or "不限".
5. ALL text in SQL must be ASCII only. Use English aliases.
6. No SQL comments.
7. ALWAYS add ORDER BY for date-based queries (ASC) or by value (DESC for rankings).
8. NEVER query sheet_* raw tables directly.
9. ALWAYS output a valid SELECT statement. Never output text explanations.
10. BigQuery syntax only — use CAST(x AS type) or SAFE_CAST(x AS type). NEVER use CONVERT() or CAST(x TO type).

=== DATE RANGE NOTES ===
  - GA4 data starts from 2025-09-03. ERP data starts from 2018.
  - When comparing GA4 and ERP data, ALWAYS add WHERE date >= '2025-09-03' to the ERP side.
  - ALWAYS use CURRENT_DATE('Asia/Taipei') for "今天" or "today".
  - For "最近N個月", use DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL N MONTH). "最近三個月" = last 3 calendar months from today.
  - Do NOT hardcode dates. Always use BigQuery date functions relative to CURRENT_DATE.
  - When user says "這段時間" or "最近", default to the last 30 days unless specified otherwise.
  - When user says "過去一週" or "最近一週", use INTERVAL 7 DAY. If no daily data exists for recent dates, fall back to the most recent available dates.
  - When user says "上個月", calculate the previous calendar month: DATE_TRUNC(DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 1 MONTH), MONTH) to LAST_DAY(DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 1 MONTH)).

=== TABLE SELECTION GUIDE (CRITICAL — read before writing any query) ===
  ★ ls_v_order_lines_ext — MOST COMPLETE view. Use for: brand, channel, product, payment, logistics analysis.
    Columns: order_code, order_date, customer_code, customer_name, product_code, product_name,
             brand_code, brand_name, channel_code, channel_name, quantity, unit_price, subtotal,
             order_amount, payment_method, payment_name, logistics_name, shipping_income, etc.
  - ls_v_orders_ext — Order-level with LOCATION only. Use for: city/district geographic analysis.
    Columns: order_code, order_date, customer_code, customer_name, order_amount, city, district.
    ⚠️ Does NOT have: brand_name, channel_name, product_name — DO NOT query these from this table!
  - view_order_customer — Best for customer analysis (cleaned customer_code). JOIN dim_customer for names.
  - v_customer_rfm — Best for RFM segmentation. Has recency, frequency, monetary, rfm_segment.
  - erp_daily_sales — Best for brand daily/monthly revenue trends. Has brand_code, date, revenue.
  - fact_orders — Raw order table. Has order_code, customer_code, order_date, order_amount.

=== KNOWN ENTITY VALUES (use EXACT strings in WHERE clauses) ===
  Brand names (brand_name): '菜市仔嬤', '有樹食', '四季晴', 'HOYA', '寶島鮮', 'HH-Life', '茶納雅言'
  Brand codes (brand_code): GMK=菜市仔嬤, HYA=HOYA, BDF=寶島鮮, YAS=有樹食, HHH=HH-Life
  Common channel prefixes: 'FB_', 'LINE@_', 'KOL_', '官網_', '社團_'
  ⚠️ CRITICAL: When user mentions a brand name, you MUST use the EXACT brand_name value from the list above.
     e.g. user says "菜市仔嬤" → WHERE brand_name = '菜市仔嬤' (NOT empty string '')

=== DATA QUALITY NOTES ===
  - fact_order_details.subtotal is UNRELIABLE (5x inflated). NEVER use SUM(subtotal) for revenue.
  - For revenue, ALWAYS use order_amount from Views (ls_v_order_lines_ext, ls_v_orders_ext, view_order_customer, etc.) or fact_orders.
  - NEVER group by SUBSTR of product_code — the "PD_" prefix is meaningless for categorization.

=== ENRICHMENT RULE: ALWAYS JOIN FOR HUMAN-READABLE NAMES (MANDATORY) ===
  CRITICAL: Results will be displayed in charts. Code-only labels (AC_007029) are UNACCEPTABLE.
  You MUST JOIN dimension tables to get human-readable names whenever a _code field appears:
  - customer_code → LEFT JOIN b25h01-ragic.erp_backup.dim_customer dc ON dc.customer_code = x.customer_code → SELECT COALESCE(dc.customer_name, x.customer_code) AS customer_name
  - brand_code → LEFT JOIN b25h01-ragic.erp_backup.dim_brand ON brand_code → SELECT brand_name
  - channel_code → LEFT JOIN b25h01-ragic.erp_backup.dim_channel ON channel_code → SELECT channel_name
  - product_code → LEFT JOIN b25h01-ragic.erp_backup.dim_product ON product_code → SELECT product_name
  Use LEFT JOIN + COALESCE so rows without a match still appear (with code as fallback).
  The SELECT clause MUST include the name column, NOT the code column, as the first string field.

=== COMMON QUERY PATTERNS (use these as templates) ===

  Customer purchase frequency (e.g. "only bought once", "top repeat customers"):
    SELECT COALESCE(dc.customer_name, r.customer_code) AS customer_name, r.frequency, r.monetary AS total_spent, r.recency, r.last_order_date
    FROM b25h01-ragic.erp_backup.v_customer_rfm r
    LEFT JOIN b25h01-ragic.erp_backup.dim_customer dc ON dc.customer_code = r.customer_code
    WHERE r.frequency = 1
    ORDER BY r.monetary DESC

  Customer count by purchase frequency (for "how many bought once"):
    SELECT frequency AS purchase_count, COUNT(*) AS customer_count
    FROM b25h01-ragic.erp_backup.v_customer_rfm
    GROUP BY frequency ORDER BY frequency

  Channel revenue comparison (MUST use ls_v_order_lines_ext which has channel_name):
    SELECT channel_name, SUM(order_amount) AS revenue, COUNT(DISTINCT order_code) AS order_count
    FROM b25h01-ragic.erp_backup.ls_v_order_lines_ext
    GROUP BY channel_name ORDER BY revenue DESC

  ⚠️ Channel name mapping (通路名稱對照表) — channel_name format is "類別_名稱":
    - Shopee / 蝦皮 → channel_name = '電商_蝦皮'
    - momo → channel_name = '電商_MOMO轉單'
    - PCHome → channel_name = '電商_PCHOME轉單'
    - 官網 / Official → channel_name LIKE '官網_%'
    - KOL → channel_name LIKE 'KOL_%'
    - 社團 / Group buy → channel_name LIKE '社團_%'
    - Facebook / FB → channel_name LIKE 'FB_%'
    - LINE → channel_name LIKE 'LINE@_%'
    - 電話 / Phone → channel_name LIKE '電話_%'
    - 電商 / E-commerce (all) → channel_name LIKE '電商_%'
    - For channel category analysis, use: SPLIT(channel_name, '_')[SAFE_OFFSET(0)] AS channel_category

  Monthly revenue trend:
    SELECT FORMAT_DATE('%Y-%m', order_date) AS month, SUM(order_amount) AS revenue
    FROM b25h01-ragic.erp_backup.ls_v_order_lines_ext
    GROUP BY month ORDER BY month

  Top N customers by order amount (e.g. "前10名客戶", "訂單金額最高的客戶", "最近一個月前20名"):
    SELECT COALESCE(dc.customer_name, o.customer_code) AS customer_name,
      SUM(o.order_amount) AS total_amount, COUNT(DISTINCT o.order_code) AS order_count
    FROM \`b25h01-ragic.erp_backup.fact_orders\` o
    LEFT JOIN \`b25h01-ragic.erp_backup.dim_customer\` dc ON dc.customer_code = o.customer_code
    WHERE o.order_date >= DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 1 MONTH)
      AND o.customer_code IS NOT NULL
    GROUP BY customer_name
    ORDER BY total_amount DESC
    LIMIT 20

  All-time top N customers (RFM-based, no date filter):
    SELECT COALESCE(dc.customer_name, r.customer_code) AS customer_name, r.monetary AS total_amount
    FROM \`b25h01-ragic.erp_backup.v_customer_rfm\` r
    LEFT JOIN \`b25h01-ragic.erp_backup.dim_customer\` dc ON dc.customer_code = r.customer_code
    ORDER BY r.monetary DESC
    LIMIT 10

  Top N customers and what they bought (e.g. "前5名客戶都買了什麼", "大客戶購買商品"):
    WITH top_customers AS (
      SELECT customer_code
      FROM \`b25h01-ragic.erp_backup.v_customer_rfm\`
      ORDER BY monetary DESC
      LIMIT 5
    ),
    ranked AS (
      SELECT COALESCE(dc.customer_name, l.customer_code) AS customer_name,
        l.product_name,
        SUM(l.quantity) AS total_quantity,
        SUM(l.order_amount) AS total_amount,
        ROW_NUMBER() OVER (PARTITION BY COALESCE(dc.customer_name, l.customer_code) ORDER BY SUM(l.order_amount) DESC) AS rn
      FROM \`b25h01-ragic.erp_backup.ls_v_order_lines\` l
      JOIN top_customers tc ON l.customer_code = tc.customer_code
      LEFT JOIN \`b25h01-ragic.erp_backup.dim_customer\` dc ON dc.customer_code = l.customer_code
      GROUP BY customer_name, l.product_name
    )
    SELECT customer_name, product_name, total_quantity, total_amount
    FROM ranked WHERE rn <= 3
    ORDER BY total_amount DESC

  Brand revenue by brand (★ USE erp_daily_sales for brand analysis):
    SELECT b.brand_name, SUM(ds.revenue) AS revenue, SUM(ds.orders) AS orders, SUM(ds.customers) AS customers
    FROM \`b25h01-ragic.erp_backup.erp_daily_sales\` ds
    JOIN \`b25h01-ragic.erp_backup.dim_brand\` b ON b.brand_code = ds.brand_code
    WHERE ds.date >= DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 3 MONTH)
    GROUP BY b.brand_name ORDER BY revenue DESC

  Brand monthly revenue trend:
    SELECT FORMAT_DATE('%Y-%m', ds.date) AS month, b.brand_name, SUM(ds.revenue) AS revenue
    FROM \`b25h01-ragic.erp_backup.erp_daily_sales\` ds
    JOIN \`b25h01-ragic.erp_backup.dim_brand\` b ON b.brand_code = ds.brand_code
    WHERE ds.date >= DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 3 MONTH)
    GROUP BY month, b.brand_name ORDER BY month, revenue DESC

=== GA4 TRAFFIC = 吉立方官網 grefun.com.tw (NOT a single brand) ===
  GA4 traffic is for 吉立方 (Grefun) official website. 吉立方 is the parent company that distributes 6 brands.
  菜市仔嬤 is NOT 吉立方 — it is one of 吉立方's brands (the biggest one).
  GA4 sessions/users reflect 吉立方官網 overall traffic, mostly related to 菜市仔嬤 products but not exclusively.
  Other brands (有樹食, HH-Life, 寶島鮮, HOYA) sell via third-party channels and are NOT in GA4.
  GA4 tables do NOT contain brand_code or brand_name columns.
  NEVER JOIN GA4 tables directly with dim_brand. NEVER use FULL OUTER JOIN between brand and GA4.

  When user asks for "brand + traffic" analysis, use this pattern:
  - Brand revenue/orders: from ERP tables (per brand)
  - Traffic: from GA4 as SITE-WIDE totals (same time period)
  - Show them SIDE BY SIDE, with traffic as a shared denominator for all brands

  Brand comparison with site-wide traffic context:
    WITH brand_summary AS (
      SELECT b.brand_name,
        SUM(o.order_amount) AS revenue,
        COUNT(DISTINCT o.order_code) AS order_count,
        SAFE_DIVIDE(SUM(o.order_amount), COUNT(DISTINCT o.order_code)) AS avg_order_value
      FROM \`b25h01-ragic.erp_backup.fact_orders\` o
      JOIN \`b25h01-ragic.erp_backup.fact_order_details\` d ON o.order_code = d.order_code
      JOIN \`b25h01-ragic.erp_backup.dim_brand\` b ON b.brand_code = SUBSTR(d.product_code, 4, 3)
      WHERE o.order_date BETWEEN '2025-10-01' AND '2025-12-31'
      GROUP BY b.brand_name
    ),
    site_traffic AS (
      SELECT SUM(sessions) AS total_sessions, SUM(purchasers) AS total_purchasers
      FROM \`b25h01.ga4_analytics.mat_ga4_daily_traffic\`
      WHERE date BETWEEN '2025-10-01' AND '2025-12-31'
    )
    SELECT bs.brand_name, bs.revenue, bs.order_count, bs.avg_order_value,
      st.total_sessions AS site_sessions, st.total_purchasers AS site_purchasers,
      SAFE_DIVIDE(bs.revenue, st.total_sessions) AS brand_revenue_per_session
    FROM brand_summary bs
    CROSS JOIN site_traffic st
    ORDER BY bs.revenue DESC

  The CROSS JOIN gives every brand the SAME site-wide traffic numbers as context.
  brand_revenue_per_session = how much of each session's value this brand captures.

=== CRITICAL: ROW COUNT RULES (MANDATORY — violations cause system failure) ===

  RULE 1 — OUTER LIMIT IS MANDATORY:
    Every query MUST have a LIMIT on the OUTERMOST SELECT. No exceptions.
    - "前N名" / "top N" → LIMIT N
    - Cross-entity (top N × details) → LIMIT N*K (e.g. 5 customers × 3 products = LIMIT 15)
    - General aggregation → LIMIT 50

  RULE 2 — CROSS-ENTITY QUERIES MUST USE ROW_NUMBER:
    When the query combines a "top N" entity with detail rows (e.g. customers + their products):
    Step 1: CTE to get top N entity IDs (with LIMIT N)
    Step 2: CTE with ROW_NUMBER() OVER (PARTITION BY entity ORDER BY metric DESC) AS rn
    Step 3: Final SELECT ... WHERE rn <= K ... ORDER BY ... LIMIT N*K
    This ensures exactly N entities × K details per entity.

  RULE 3 — ALWAYS AGGREGATE:
    NEVER return raw transaction/order line rows. Always GROUP BY + aggregate (SUM/COUNT/AVG).

  RULE 4 — COUNT QUERIES:
    When user asks "how many" or "有多少", SELECT must include COUNT(*).

  RULE 5 — VERIFY YOUR OUTPUT:
    Before outputting SQL, mentally count the maximum rows your query can return.
    If it could exceed 50, you MUST restructure to add tighter constraints.`;

export type SqlGenerationResult = {
  sql: string;
  safetyCheck: SqlSafetyResult;
};

/** Check if the outermost SELECT already has a LIMIT clause (CTE-internal LIMITs don't count) */
function hasOuterSelectLimit(sql: string): boolean {
  const upper = sql.toUpperCase();
  if (!upper.trimStart().startsWith("WITH")) {
    // Simple SELECT — just check for LIMIT anywhere
    return /\bLIMIT\s+\d+/i.test(upper);
  }
  // CTE query: find the final top-level SELECT by tracking paren depth
  let depth = 0;
  let lastTopSelectPos = -1;
  for (let i = 0; i < upper.length; i++) {
    if (upper[i] === "(") depth++;
    else if (upper[i] === ")") depth--;
    if (depth === 0 && upper.slice(i, i + 6) === "SELECT" && (i + 6 >= upper.length || /\s/.test(upper[i + 6]))) {
      lastTopSelectPos = i;
    }
  }
  if (lastTopSelectPos < 0) return false;
  return /\bLIMIT\s+\d+/i.test(upper.slice(lastTopSelectPos));
}

/**
 * Extract the requested "top N" from user prompt.
 * Returns N if found, or null if not a top-N query.
 */
export function extractTopN(prompt: string): number | null {
  // Match patterns: "前5名", "top 10", "前 3 名", "Top10", "前五名"
  const chineseDigits: Record<string, number> = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10 };

  const m1 = prompt.match(/前\s*(\d+)\s*名/);
  if (m1) return parseInt(m1[1], 10);

  const m2 = prompt.match(/top\s*(\d+)/i);
  if (m2) return parseInt(m2[1], 10);

  const m3 = prompt.match(/前\s*([一二三四五六七八九十])\s*名/);
  if (m3) return chineseDigits[m3[1]] ?? null;

  return null;
}

/** Extract clean SQL from model output */
function extractSql(text: string): string {
  // Try code block first
  const codeBlockMatch = text.match(/```(?:sql)?\s*\n?([\s\S]*?)```/);
  let sql = codeBlockMatch
    ? codeBlockMatch[1].trim()
    : text.trim();

  // Find SELECT/WITH if there's preamble text (e.g., model thinking output)
  // Require SQL structure after keyword: SELECT must be followed by column/expression, not ':'
  // WITH must be followed by a CTE name
  if (!sql.toUpperCase().startsWith("SELECT") && !sql.toUpperCase().startsWith("WITH")) {
    const idx = sql.search(/\bWITH\s+\w+\s+AS\b/i);
    const selectIdx = idx < 0 ? sql.search(/\bSELECT\s+(?!:)[^\n]{5}/i) : -1;
    const bestIdx = idx >= 0 ? idx : selectIdx;
    if (bestIdx >= 0) sql = sql.slice(bestIdx);
  }

  // Remove comments
  sql = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  // Cut at semicolon (remove trailing text after SQL)
  const semiIdx = sql.indexOf(";");
  if (semiIdx > 0) sql = sql.slice(0, semiIdx);

  // Truncate trailing garbage after the outer LIMIT clause.
  // Model sometimes repeats SQL blocks (e.g., "LIMIT 3`table`...LIMIT 3`table`...").
  // Find the LAST "LIMIT <number>" and cut everything after it.
  let lastLimitIdx = -1;
  let lastLimitLen = 0;
  const limitRe = /\bLIMIT\s+\d+/gi;
  let m;
  while ((m = limitRe.exec(sql)) !== null) {
    lastLimitIdx = m.index;
    lastLimitLen = m[0].length;
  }
  if (lastLimitIdx >= 0 && lastLimitIdx + lastLimitLen < sql.length) {
    sql = sql.slice(0, lastLimitIdx + lastLimitLen).trim();
  }

  // Sanitize non-ASCII characters that cause BigQuery "Illegal input character" errors
  // Replace smart quotes with regular quotes, strip problematic non-ASCII (but keep CJK for string values)
  sql = sql
    .replace(/[\u2018\u2019\u201A]/g, "'")   // smart single quotes → '
    .replace(/[\u201C\u201D\u201E]/g, '"')   // smart double quotes → "
    .replace(/[\u2013\u2014]/g, "-")         // en/em dash → -
    .replace(/[\u2026]/g, "...");            // ellipsis → ...
  // Strip problematic non-ASCII but preserve CJK characters (used in WHERE values like '電商_蝦皮')
  // Keep: ASCII (\x00-\x7F), CJK Unified (\u4E00-\u9FFF), CJK Compat (\uF900-\uFAFF),
  //   Fullwidth forms (\uFF00-\uFFEF), CJK symbols (\u3000-\u303F), Bopomofo (\u3100-\u312F)
  sql = sql.replace(/[^\x00-\x7F\u3000-\u303F\u3100-\u312F\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/g, "");

  sql = sql.replace(/\n{2,}/g, "\n").trim();

  // Safety net: inject LIMIT 50 if the OUTER SELECT has no LIMIT
  // (CTE-internal LIMITs don't count)
  if (!hasOuterSelectLimit(sql)) {
    sql = sql + "\nLIMIT 50";
  }

  return sql;
}

/** Generate SQL with model fallback: fast first, then pro if needed */
async function generateSqlWithRetry(
  systemPrompt: string,
  naturalLanguage: string,
  _correlationId: string,
): Promise<string> {
  const MAX_ATTEMPTS = 2;
  let lastError = "validation failed";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = attempt === 1
      ? naturalLanguage
      : `${naturalLanguage}\n\n上一次生成的 SQL 執行失敗，錯誤：${lastError}\n請修正 SQL 語法錯誤，使用更簡單的查詢結構（避免複雜子查詢），直接使用 Views。只輸出純 SQL。`;

    let result;
    try {
      result = await generateText({
        model: attempt === 1 ? getFastModel() : getChatModel(),
        system: systemPrompt,
        prompt,
        maxOutputTokens: 8192,
      } as never);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[SQL-GEN] Model call failed on attempt ${attempt}: ${lastError}`);
      if (attempt < MAX_ATTEMPTS) continue;
      throw err;
    }

    console.log(`[SQL-GEN] Attempt ${attempt} finishReason=${result.finishReason} textLen=${result.text.length} raw (first 2000): ${result.text.slice(0, 2000)}`);

    const sql = extractSql(result.text);
    console.log(`[SQL-GEN] Attempt ${attempt} extracted SQL (first 500): ${sql.slice(0, 500)}`);

    // Validate SQL shape; retry on first-attempt failure
    const safety = validateSql(sql);
    if (!safety.safe) {
      lastError = safety.reason;
      console.warn(`[SQL-GEN] Validation failed on attempt ${attempt}: ${safety.reason}`);
      if (attempt < MAX_ATTEMPTS) continue;
    }

    return sql;
  }

  return "SELECT 1"; // Should never reach here
}

// Known entities for pre-processing user queries
const BRAND_MAP: Record<string, string> = {
  "菜市仔嬤": "菜市仔嬤", "HOYA": "HOYA", "hoya": "HOYA",
  "有樹食": "有樹食", "四季晴": "四季晴", "寶島鮮": "寶島鮮",
  "HH-Life": "HH-Life", "hh-life": "HH-Life", "茶納雅言": "茶納雅言",
};

/** Detect brand names in user query and append explicit SQL hint */
function enrichQueryWithEntities(query: string): string {
  const detected: string[] = [];
  for (const [keyword, brandName] of Object.entries(BRAND_MAP)) {
    if (query.includes(keyword)) {
      detected.push(brandName);
    }
  }
  if (detected.length > 0) {
    return `${query}\n\n[SYSTEM ENTITY HINT: Use WHERE brand_name = '${detected[0]}' in the SQL. This is the exact brand_name value in BigQuery.]`;
  }
  return query;
}

/** Post-process: fix empty string conditions by injecting detected entity */
function fixEmptyStringConditions(sql: string, query: string): string {
  // If SQL has brand_name = '' and we can detect the brand from query
  if (/brand_name\s*=\s*''/i.test(sql)) {
    for (const [keyword, brandName] of Object.entries(BRAND_MAP)) {
      if (query.includes(keyword)) {
        return sql.replace(/brand_name\s*=\s*''/gi, `brand_name = '${brandName}'`);
      }
    }
  }
  if (/channel_name\s*=\s*''/i.test(sql)) {
    // Can't auto-fix channel names — let it fail with useful error
    console.warn(`[SQL-GEN] Detected empty channel_name condition in SQL`);
  }
  return sql;
}

export async function generateSql(
  naturalLanguage: string,
  correlationId: string
): Promise<SqlGenerationResult> {
  // Only load GA4 schema when the query is GA4-related (saves ~2-5s)
  const includeGa4 = needsGa4Schema(naturalLanguage);
  const schemas = await getAiDatasetSchema(includeGa4);
  const schemaText = formatAiSchemaForPrompt(schemas);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }); // YYYY-MM-DD
  const systemPrompt = `Today's date (Taipei timezone): ${today}\n\n${SQL_RULES}\n\n=== AVAILABLE SCHEMA (auto-discovered from BigQuery) ===\n${schemaText}\n\nCRITICAL REMINDER: Output ONLY the SQL SELECT/WITH statement. ABSOLUTELY NO text before or after the SQL. No explanations, no descriptions, no markdown fences, no "Based on your request" preamble. The FIRST character of your response must be SELECT or WITH. VIOLATION = SYSTEM FAILURE.`;

  // Enrich query with explicit entity hints for the AI model
  const enrichedQuery = enrichQueryWithEntities(naturalLanguage);

  // Debug: log schema structure to verify Views-first ordering
  const viewCount = schemas.filter(s => s.tableType === "VIEW").length;
  const tableCount = schemas.filter(s => s.tableType === "BASE TABLE").length;
  console.log(`[SQL-GEN] Schema: ${viewCount} views, ${tableCount} tables (ga4=${includeGa4}). Prompt length: ${systemPrompt.length} chars. Query: ${enrichedQuery.slice(0, 200)}`);

  let rawSql = await generateSqlWithRetry(systemPrompt, enrichedQuery, correlationId);

  // Post-process: fix known model issues (empty brand_name conditions)
  rawSql = fixEmptyStringConditions(rawSql, naturalLanguage);

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
  const bq = new BigQuery({ projectId: "b25h01-ragic", location: "asia-east1" });
  const startMs = Date.now();

  const [job] = await bq.createQueryJob({ query: sql });
  const [rows] = await job.getQueryResults({ maxResults: 500 });
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
): { chartType: AiChartDataV1["chartType"]; xKey: string; yKeys: string[]; seriesKey?: string } {
  if (!data.length) return { chartType: "bar", xKey: "", yKeys: [] };

  const keys = Object.keys(data[0]);
  const numericKeys = keys.filter((k) => {
    const nums = data.map((row) => Number(row[k]) || 0);
    const hasNumber = data.some((row) => typeof row[k] === "number");
    const allSame = nums.length > 1 && nums.every((n) => n === nums[0]);
    const isContextColumn = /^(site_|total_)/.test(k);
    return hasNumber && (!allSame || isContextColumn);
  });
  // Exclude "rn" (row_number) from string keys — it's a technical column
  const stringKeys = keys.filter((k) =>
    k !== "rn" && data.some((row) => typeof row[k] === "string")
  );

  // Detect multi-dimension data: 2+ string keys where first key has duplicates
  // e.g. customer_name + product_name — customer_name repeats across rows
  let seriesKey: string | undefined;
  let xKey = stringKeys[0] ?? keys[0];

  if (stringKeys.length >= 2) {
    const firstKeyValues = data.map((r) => String(r[stringKeys[0]] ?? ""));
    const uniqueFirstKey = new Set(firstKeyValues).size;
    const hasDuplicates = uniqueFirstKey < data.length;

    if (hasDuplicates) {
      // First string key has duplicates → it's the group key (xKey), second is the series key
      xKey = stringKeys[0];
      seriesKey = stringKeys[1];
    }
  }

  // Filter yKeys to only include compatible scales (within 100x of each other)
  let yKeys: string[];
  if (numericKeys.length <= 1) {
    yKeys = numericKeys.length > 0 ? numericKeys : [keys[1] ?? keys[0]];
  } else {
    const keyMedians = numericKeys.map((k) => {
      const vals = data.map((r) => Math.abs(Number(r[k]) || 0)).filter((v) => v > 0).sort((a, b) => a - b);
      return { key: k, median: vals[Math.floor(vals.length / 2)] || 0 };
    }).filter((km) => km.median > 0);

    if (keyMedians.length === 0) {
      yKeys = numericKeys.slice(0, 2);
    } else {
      const primary = keyMedians[0];
      const compatible = keyMedians.filter(
        (km) => km.median / primary.median < 100 && primary.median / km.median < 100
      );
      yKeys = compatible.length > 0 ? compatible.map((km) => km.key) : [primary.key];
    }
    yKeys = yKeys.slice(0, 3);
  }

  let chartType: AiChartDataV1["chartType"] = "bar";

  // Parse explicit hint from user or AI
  if (hint) {
    const h = hint.toLowerCase();
    if (h.includes("line") || h.includes("折線")) chartType = "line";
    else if (h.includes("pie") || h.includes("圓餅")) chartType = "pie";
    else if (h.includes("area") || h.includes("面積")) chartType = "area";
    else if (h.includes("scatter") || h.includes("散佈")) chartType = "scatter";
    else if (h.includes("donut") || h.includes("環圈")) chartType = "donut";
    else if (h.includes("stacked") || h.includes("堆疊")) chartType = "stacked_bar";
    else if (h.includes("horizontal") || h.includes("橫向")) chartType = "horizontal_bar";
    else if (h.includes("radar") || h.includes("雷達")) chartType = "radar";
    else if (h.includes("composed") || h.includes("組合")) chartType = "composed";
    else if (h.includes("treemap") || h.includes("矩形")) chartType = "treemap";
    else if (h.includes("grouped") || h.includes("分組")) chartType = "grouped_bar";
    else if (h.includes("bar") || h.includes("長條")) chartType = "bar";
    else if (h.includes("趨勢") || h.includes("trend") || h.includes("走勢") || h.includes("變化")) chartType = "line";
    else if (h.includes("佔比") || h.includes("比例") || h.includes("占比") || h.includes("share")) chartType = "pie";
  }

  // Detect time-series xKey
  const isTimeSeries = xKey && /^(month|date|year|day|week|quarter|period)/i.test(xKey);

  // Check if yKeys have very different magnitudes → composed chart
  const hasMultiScale = (() => {
    if (yKeys.length < 2) return false;
    const medians = yKeys.map((k) => {
      const vals = data.map((r) => Math.abs(Number(r[k]) || 0)).filter((v) => v > 0).sort((a, b) => a - b);
      return vals[Math.floor(vals.length / 2)] || 0;
    });
    return medians.length >= 2 && medians[0] > 0 && (medians[1] / medians[0] > 50 || medians[0] / medians[1] > 50);
  })();

  const hasPercentKey = yKeys.some((k) => /rate|pct|ratio|growth|share|percent/i.test(k));

  if (!hint) {
    // Rule 0 (NEW): Multi-dimension data → grouped_bar
    if (seriesKey) {
      chartType = "grouped_bar";
    }
    // Rule 1: Time series → line (always)
    else if (isTimeSeries && data.length >= 2) {
      chartType = "line";
    }
    // Rule 2: Multiple metrics with very different scales → composed
    else if (hasMultiScale && data.length >= 2) {
      chartType = "composed";
    }
    // Rule 3: Multiple metrics with percentage → composed
    else if (hasPercentKey && yKeys.length >= 2 && data.length >= 2) {
      chartType = "composed";
    }
    // Rule 4: Many categories (>15) → horizontal_bar for readability
    else if (data.length > 15) {
      chartType = "horizontal_bar";
    }
    // Rule 5: Only one metric + few categories (2-7) + NOT time series → pie
    else if (!isTimeSeries && data.length >= 2 && data.length <= 7 && numericKeys.length === 1) {
      chartType = "pie";
    }
  }

  return { chartType, xKey, yKeys, seriesKey };
}
