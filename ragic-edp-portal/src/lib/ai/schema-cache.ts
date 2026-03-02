import "server-only";

import { aiLog } from "./logger";

export type TableSchema = {
  tableName: string;
  tableType: "BASE TABLE" | "VIEW";
  columns: { name: string; type: string }[];
  rowCount?: number;
};

export type AiTableSchema = {
  projectId: string;
  dataset: string;
  tableName: string;
  fqTable: string;
  tableType: "BASE TABLE" | "VIEW";
  columns: { name: string; type: string }[];
};

let cachedSchema: TableSchema[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Force clear schema cache (useful after code changes) */
export function clearSchemaCache() {
  cachedSchema = null;
  cacheTimestamp = 0;
  cachedErpSchema = null;
  erpCacheTs = 0;
  cachedGa4Schema = null;
  ga4CacheTs = 0;
}

/**
 * Load all table/view schemas from BigQuery INFORMATION_SCHEMA.
 * Results are cached for 30 minutes.
 */
export async function getDatasetSchema(): Promise<TableSchema[]> {
  if (cachedSchema && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSchema;
  }

  try {
    const { BigQuery } = await import("@google-cloud/bigquery");
    const bq = new BigQuery({ projectId: "b25h01-ragic", location: "asia-east1" });

    // Get all tables and views with their columns in one query
    const [rows] = await bq.query({
      query: `
        SELECT
          t.table_name,
          t.table_type,
          c.column_name,
          c.data_type
        FROM erp_backup.INFORMATION_SCHEMA.TABLES t
        JOIN erp_backup.INFORMATION_SCHEMA.COLUMNS c
          ON t.table_name = c.table_name
        WHERE t.table_name NOT LIKE 'sheet_%'
        ORDER BY t.table_name, c.ordinal_position
      `,
    });

    const schemaMap = new Map<string, TableSchema>();

    for (const row of rows as Record<string, string>[]) {
      const name = row.table_name;
      if (!schemaMap.has(name)) {
        schemaMap.set(name, {
          tableName: name,
          tableType: row.table_type as TableSchema["tableType"],
          columns: [],
        });
      }
      schemaMap.get(name)!.columns.push({
        name: row.column_name,
        type: row.data_type,
      });
    }

    cachedSchema = Array.from(schemaMap.values());
    cacheTimestamp = Date.now();

    aiLog({
      level: "info",
      correlationId: "schema-cache",
      module: "ai_expert",
      action: "query",
      extra: { tables: cachedSchema.length },
    } as Parameters<typeof aiLog>[0]);

    return cachedSchema;
  } catch (err) {
    aiLog({
      level: "warn",
      correlationId: "schema-cache",
      module: "ai_expert",
      action: "query",
      extra: { error: String(err) },
    } as Parameters<typeof aiLog>[0]);
    // Return cached even if expired, or empty
    return cachedSchema ?? [];
  }
}

const AI_DATASET_SOURCES = [
  { projectId: "b25h01", dataset: "ga4_analytics", excludePattern: "", includePrefix: "mat_" },
  { projectId: "b25h01-ragic", dataset: "erp_backup", excludePattern: "sheet_%", includePrefix: "" },
] as const;

/** GA4 keywords — if the user query contains any of these, load GA4 schema */
const GA4_KEYWORDS = /ga4|GA\b|google\s*analytics|流量|sessions?|pageview|瀏覽|來源|source|medium|campaign|廣告|CVR|轉換率|conversion|bounce|跳出|event|事件|channel.*?(?:分析|比較|trend)|網站/i;

export function needsGa4Schema(_query: string): boolean {
// Always load GA4 schema — Gemini 3.1 Pro handles the full schema well
  return true;
}

// Separate caches for ERP-only vs ERP+GA4
let cachedErpSchema: AiTableSchema[] | null = null;
let erpCacheTs = 0;
let cachedGa4Schema: AiTableSchema[] | null = null;
let ga4CacheTs = 0;

async function loadDatasetSchema(
  source: (typeof AI_DATASET_SOURCES)[number]
): Promise<AiTableSchema[]> {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || "b25h01-ragic", location: "asia-east1" });

  const where = source.excludePattern
    ? `WHERE t.table_name NOT LIKE '${source.excludePattern}'`
    : "";
  const [rows] = await bq.query({
    query: `
      SELECT
        t.table_name,
        t.table_type,
        c.column_name,
        c.data_type
      FROM \`${source.projectId}.${source.dataset}.INFORMATION_SCHEMA.TABLES\` t
      JOIN \`${source.projectId}.${source.dataset}.INFORMATION_SCHEMA.COLUMNS\` c
        ON t.table_name = c.table_name
      ${where}
      ORDER BY t.table_name, c.ordinal_position
    `,
    location: "asia-east1",
    useQueryCache: true,
  });

  const map = new Map<string, AiTableSchema>();
  for (const row of rows as Record<string, string>[]) {
    const tableName = row.table_name;
    if (source.includePrefix && !tableName.startsWith(source.includePrefix)) continue;
    const fqTable = `${source.projectId}.${source.dataset}.${tableName}`;
    if (!map.has(fqTable)) {
      map.set(fqTable, {
        projectId: source.projectId,
        dataset: source.dataset,
        tableName,
        fqTable,
        tableType: row.table_type as AiTableSchema["tableType"],
        columns: [],
      });
    }
    map.get(fqTable)!.columns.push({
      name: row.column_name,
      type: row.data_type,
    });
  }
  return Array.from(map.values());
}

export async function getAiDatasetSchema(includeGa4 = true): Promise<AiTableSchema[]> {
  const now = Date.now();

  // Always load ERP
  if (!cachedErpSchema || now - erpCacheTs >= CACHE_TTL_MS) {
    try {
      cachedErpSchema = await loadDatasetSchema(AI_DATASET_SOURCES[1]);
      erpCacheTs = now;
    } catch (err) {
      aiLog({
        level: "warn",
        correlationId: "schema-cache-ai",
        module: "ai_expert",
        action: "query",
        extra: { error: String(err), dataset: "erp_backup" },
      } as Parameters<typeof aiLog>[0]);
      cachedErpSchema = cachedErpSchema ?? [];
    }
  }

  if (!includeGa4) {
    console.log("[SCHEMA] Skipping GA4 schema (not needed for this query)");
    return cachedErpSchema;
  }

  // Load GA4 only when needed
  if (!cachedGa4Schema || now - ga4CacheTs >= CACHE_TTL_MS) {
    try {
      cachedGa4Schema = await loadDatasetSchema(AI_DATASET_SOURCES[0]);
      ga4CacheTs = now;
    } catch (err) {
      aiLog({
        level: "warn",
        correlationId: "schema-cache-ai",
        module: "ai_expert",
        action: "query",
        extra: { error: String(err), dataset: "ga4_analytics" },
      } as Parameters<typeof aiLog>[0]);
      cachedGa4Schema = cachedGa4Schema ?? [];
    }
  }

  return [...cachedGa4Schema, ...cachedErpSchema];
}

export function formatAiSchemaForPrompt(schemas: AiTableSchema[]): string {
  const lines: string[] = [];
  const ga4 = schemas.filter((s) => s.dataset === "ga4_analytics");
  const erp = schemas.filter((s) => s.dataset === "erp_backup");
  const keyGa4 = new Set([
    "mat_ga4_daily_traffic",
    "mat_ga4_source_daily",
    "mat_ga4_campaign_daily",
    "mat_ga4_sessions",
    "mat_ga4_ecommerce",
    "mat_ga4_flat_events",
  ]);
  const keyErp = new Set([
    "view_order_customer",
    "ls_v_orders_ext",
    "ls_v_order_lines",
    "ls_v_order_lines_ext",
    "v_customer_rfm",
    "erp_daily_sales",
    "dim_customer",
    "dim_channel",
    "dim_brand",
    "dim_product",
    "fact_orders",
    "fact_order_details",
  ]);

  lines.push("=== GA4 DATASET: b25h01.ga4_analytics ===");
  lines.push("GA4 data range: 2025-09-03 to present. When JOINing GA4 with ERP, ALWAYS filter ERP data to GA4's date range (>= '2025-09-03').");
  lines.push("All mat_* tables contain brand_code column (GMK/HYA/BDF/YAS/HHH). Use WHERE brand_code = 'XXX' to filter by brand.");
  lines.push("Brand mapping: GMK=菜市仔嬤, HYA=HOYA, BDF=寶島鮮, YAS=有樹食, HHH=HH-Life");
  lines.push("Use this for traffic, sessions, users, events, channel/campaign and GA-side ecommerce metrics.");
  for (const s of ga4.filter((x) => keyGa4.has(x.tableName))) {
    lines.push(`  ${s.fqTable}: ${s.columns.map((c) => `${c.name} ${c.type}`).join(", ")}`);
  }
  const ga4Others = ga4
    .filter((x) => !keyGa4.has(x.tableName))
    .map((x) => x.fqTable);
  if (ga4Others.length > 0) lines.push(`  Other views: ${ga4Others.join(", ")}`);
  lines.push("");
  lines.push("=== ERP DATASET: b25h01-ragic.erp_backup ===");
  lines.push("Use this for orders, revenue, customer/order dimensions and cross-analysis.");
  for (const s of erp.filter((x) => keyErp.has(x.tableName))) {
    lines.push(`  ${s.fqTable}: ${s.columns.map((c) => `${c.name} ${c.type}`).join(", ")}`);
  }
  const erpOthers = erp
    .filter((x) => x.tableType === "VIEW" && !keyErp.has(x.tableName))
    .map((x) => x.fqTable);
  if (erpOthers.length > 0) lines.push(`  Other views: ${erpOthers.join(", ")}`);

  // Omit base tables list to keep prompt compact — key tables already shown above

  return lines.join("\n");
}

/**
 * Semantic hints for key views to help AI choose the right data source.
 * Maps view name patterns to descriptions of what cleaned data they contain.
 */
/** Key views that should show FULL column details in the prompt */
const PRIMARY_VIEWS = new Set([
  "v_customer_rfm",
  "view_order_customer",
  "ls_v_orders_ext",
  "ls_v_order_lines",
  "v_daily_order_stats",
  "ls_v_05_channel_contribution_trend",
]);

/** Key dimension tables that should show FULL column details */
const PRIMARY_TABLES = new Set([
  "dim_customer",
  "dim_brand",
  "dim_channel",
  "dim_product",
  "fact_orders",
]);

const VIEW_HINTS: Record<string, string> = {
  view_order_customer: "★ BEST for customer analysis — has CLEANED customer_code (backfilled). JOIN with dim_customer ON customer_code to get customer_name",
  v_customer_rfm: "★ BEST for customer segmentation — has RFM scores, total spending, order frequency per customer. JOIN with dim_customer for customer_name",
  ls_v_orders_ext: "Order-level view with location (city, district) and order_amount. NOTE: does NOT have brand/channel/product fields — use ls_v_order_lines_ext for those",
  ls_v_order_lines_ext: "★ BEST for detailed analysis — has brand_name, channel_name, product_name, payment, logistics, plus order_amount, quantity, unit_price",
  ls_v_order_lines: "Order line items with product details — NOTE: customer fields may be NULL here, use view_order_customer for customer queries",
  v_daily_order_stats: "Daily aggregated order statistics — good for time trends",
  ls_v_05_channel_contribution_trend: "Channel contribution trends over time",
  erp_daily_sales: "★ BEST for brand daily/monthly revenue trends — has brand_code, date, revenue, orders, customers, aov. JOIN dim_brand for brand_name",
};

/**
 * Format schema into a compact text for SQL prompt injection.
 */
export function formatSchemaForPrompt(schemas: TableSchema[]): string {
  const lines: string[] = [];

  const tables = schemas.filter((s) => s.tableType === "BASE TABLE");
  const views = schemas.filter((s) => s.tableType === "VIEW");

  // === PRIMARY VIEWS (full columns) ===
  lines.push("=== PRIMARY VIEWS (USE THESE FIRST — full column details) ===");
  lines.push("These views contain cleaned, enriched data. ALWAYS prefer these.\n");
  for (const v of views.filter((v) => PRIMARY_VIEWS.has(v.tableName))) {
    const cols = v.columns.map((c) => `${c.name} ${c.type}`).join(", ");
    const hint = VIEW_HINTS[v.tableName] || "";
    lines.push(`  erp_backup.${v.tableName}${hint ? ` [${hint}]` : ""}`);
    lines.push(`    Columns: ${cols}\n`);
  }

  // === PRIMARY DIMENSION/FACT TABLES (full columns) ===
  lines.push("=== KEY DIMENSION & FACT TABLES (for JOINs) ===\n");
  for (const t of tables.filter((t) => PRIMARY_TABLES.has(t.tableName))) {
    const cols = t.columns.map((c) => `${c.name} ${c.type}`).join(", ");
    lines.push(`  erp_backup.${t.tableName}: ${cols}\n`);
  }

  // === OTHER VIEWS (names only) ===
  const otherViews = views.filter((v) => !PRIMARY_VIEWS.has(v.tableName));
  if (otherViews.length > 0) {
    lines.push("=== OTHER VIEWS (available if needed — query INFORMATION_SCHEMA for columns) ===");
    lines.push(`  ${otherViews.map((v) => `erp_backup.${v.tableName}`).join(", ")}\n`);
  }

  // === OTHER TABLES (names only) ===
  const otherTables = tables.filter((t) => !PRIMARY_TABLES.has(t.tableName));
  if (otherTables.length > 0) {
    lines.push("=== OTHER BASE TABLES (fallback only) ===");
    lines.push(`  ${otherTables.map((t) => `erp_backup.${t.tableName}`).join(", ")}`);
  }

  return lines.join("\n");
}
