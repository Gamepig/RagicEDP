const ERP_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "b25h01-ragic";
const ERP_DATASET = process.env.BIGQUERY_DATASET || process.env.BQ_DATASET || "erp_backup";

const GA4_MAT_PROJECT_ID = process.env.GA4_TARGET_PROJECT_ID || ERP_PROJECT_ID;
const GA4_MAT_DATASET = process.env.GA4_TARGET_DATASET || ERP_DATASET;

export const ERP_FQ_DATASET = `${ERP_PROJECT_ID}.${ERP_DATASET}`;
export const GA4_MAT_FQ_DATASET = `${GA4_MAT_PROJECT_ID}.${GA4_MAT_DATASET}`;

export function erpTable(tableName: string): string {
  return `\`${ERP_FQ_DATASET}.${tableName}\``;
}

const GA4_TABLE_MAP: Record<string, string> = {
  "ga4_daily_traffic": "mat_ga4_daily_traffic",
  "ga4_source_daily": "mat_ga4_source_daily",
  "ga4_campaign_daily": "mat_ga4_campaign_daily",
  "ga4_ecommerce": "mat_ga4_ecommerce",
};

export function ga4MatTable(tableName: string): string {
  const mapped = GA4_TABLE_MAP[tableName];
  if (tableName === "ga4_source_daily") {
    return `(SELECT *, event_date AS date FROM ${erpTable(mapped)})`;
  }
  if (mapped) {
    return erpTable(mapped);
  }
  return erpTable(tableName);
}
