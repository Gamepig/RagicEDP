import { formatSheetsForPrompt, RAGIC_SHEETS } from "@/lib/ragic/sheets";
import { COLUMN_ZH } from "@/lib/dbops/schema-metadata";

type CatalogSection = {
  title: string;
  lines: string[];
};

function formatTableColumns(tableName: string, columns: string[]): string {
  return `${tableName}: ${columns.map((c) => `${c} (${COLUMN_ZH[c] ?? c})`).join(", ")}`;
}

const GA4_CATALOG: CatalogSection[] = [
  {
    title: "GA4 可用表",
    lines: [
      "mat_ga4_daily_traffic: brand_code, date, sessions, users, new_users, engaged_sessions, engaged_rate, avg_engagement_sec, purchasers, cvr",
      "mat_ga4_source_daily: brand_code, event_date, source, medium, sessions, users, first_visit_count, engaged_rate, avg_engagement_sec, purchasers, cvr",
      "mat_ga4_campaign_daily: brand_code, date, source, medium, campaign_name, sessions, users, new_visitors, returning_visitors, engaged_rate, avg_engagement_sec, purchasers, cvr",
      "mat_ga4_sessions: brand_code, event_date, ga_session_id, user_pseudo_id, ga_session_number, source, medium, campaign, device_category, landing_page, session_engaged, total_engagement_time_msec, purchase_count, event_count",
      "mat_ga4_ecommerce: event_date, event_name, user_pseudo_id, item_name, item_revenue, brand_code",
      "mat_ga4_flat_events: event_date, event_name, user_pseudo_id, ga_session_id, event_timestamp, page_location, brand_code",
    ],
  },
];

const ERP_CATALOG: CatalogSection[] = [
  {
    title: "ERP 可用表",
    lines: [
      formatTableColumns("view_order_customer", ["order_code", "order_date", "customer_code", "customer_name", "status", "order_amount", "order_amount_with_shipping", "brand_code"]),
      formatTableColumns("ls_v_orders_ext", ["order_code", "order_date", "customer_code", "customer_name", "order_amount", "city", "district"]),
      formatTableColumns("ls_v_order_lines_ext", ["order_code", "order_date", "customer_code", "customer_name", "product_code", "product_name", "brand_code", "brand_name", "channel_code", "channel_name", "quantity", "unit_price", "subtotal", "order_amount", "amount_paid", "amount_with_shipping", "payment_method", "payment_name", "logistics_name", "shipping_income", "status"]),
      formatTableColumns("v_customer_rfm", ["customer_code", "recency", "frequency", "monetary", "rfm_segment", "last_order_date"]),
      formatTableColumns("erp_daily_sales", ["date", "brand_code", "revenue", "orders", "customers", "aov"]),
      formatTableColumns("dim_customer", ["customer_code", "customer_name", "phone", "email"]),
      formatTableColumns("dim_brand", ["brand_code", "brand_name"]),
      formatTableColumns("dim_channel", ["channel_code", "channel_name"]),
      formatTableColumns("dim_product", ["product_code", "product_name", "price", "brand_code"]),
      formatTableColumns("fact_orders", ["order_code", "customer_code", "order_date", "order_amount", "status"]),
      formatTableColumns("fact_order_details", ["order_code", "product_code", "quantity", "unit_price", "subtotal"]),
    ],
  },
];

const RAGIC_CATALOG: CatalogSection[] = [
  {
    title: "Ragic 可用表單",
    lines: RAGIC_SHEETS.map(
      (sheet) => `sheet_${sheet.code}_${sheet.name}: ${Object.entries(sheet.keyFields)
        .map(([bq, zh]) => `${bq} (${zh})`)
        .join(", ")}`,
    ),
  },
];

export function formatDataCatalogForPrompt(): string {
  const sections: string[] = [];

  sections.push("=== DATA CATALOG (AI WHITE-LIST) ===");
  sections.push("Only use table names and columns listed below. If a field is not listed, do not invent it.");
  sections.push("");

  for (const section of [...GA4_CATALOG, ...ERP_CATALOG, ...RAGIC_CATALOG]) {
    sections.push(`## ${section.title}`);
    sections.push(...section.lines.map((line) => `- ${line}`));
    sections.push("");
  }

  sections.push("### Ragic summary");
  sections.push(formatSheetsForPrompt());
  sections.push("");
  sections.push("### Field rules");
  sections.push("- GA4 traffic queries should prefer mat_ga4_daily_traffic.");
  sections.push("- GA4 source/medium queries must use mat_ga4_source_daily.event_date, not date.");
  sections.push("- GA4 source/medium tables do not contain returning_users, revenue, or orders; join ERP views only when revenue/order metrics are requested.");
  sections.push("- GA4 event-level queries should use mat_ga4_flat_events or mat_ga4_ecommerce only when the column exists in the summary above.");
  sections.push("- ERP brand/revenue queries should prefer view_order_customer or erp_daily_sales.");
  sections.push("- Ragic raw queries require the exact phrase: 使用Ragic API取得原始資料.");

  return sections.join("\n");
}
