import "server-only";

import { aiLog } from "./logger";

export type TableSchema = {
  tableName: string;
  tableType: "BASE TABLE" | "VIEW";
  columns: { name: string; type: string }[];
  rowCount?: number;
};

let cachedSchema: TableSchema[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Force clear schema cache (useful after code changes) */
export function clearSchemaCache() {
  cachedSchema = null;
  cacheTimestamp = 0;
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
    const bq = new BigQuery();

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
  ls_v_orders_ext: "★ BEST for order-level analysis with location — has city, district, channel, order_amount",
  ls_v_order_lines: "Order line items with product details — NOTE: customer fields may be NULL here, use view_order_customer for customer queries",
  v_daily_order_stats: "Daily aggregated order statistics — good for time trends",
  ls_v_05_channel_contribution_trend: "Channel contribution trends over time",
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
