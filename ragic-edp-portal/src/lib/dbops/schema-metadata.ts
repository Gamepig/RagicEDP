/**
 * Chinese metadata for BQ tables and columns.
 * Source of truth: docs/erp_backup_資料表欄位說明.md
 */

/** Table-level metadata: Chinese name + description */
export const TABLE_META: Record<string, { zhName: string; description: string; category: string }> = {
  // ── 主要檢視表 (Views) ──
  v_customer_rfm:                       { zhName: "客戶 RFM 分析",          description: "客戶分群：購買頻率、最近購買、消費金額",   category: "analysis_view" },
  view_order_customer:                  { zhName: "訂單客戶關聯",            description: "已清洗的客戶欄位，最適合客戶分析",         category: "analysis_view" },
  ls_v_orders_ext:                      { zhName: "訂單擴展 (含地區)",       description: "含縣市、區域、通路、訂單金額",             category: "analysis_view" },
  ls_v_order_lines:                     { zhName: "訂單明細行",              description: "訂單行項目含商品資訊",                     category: "analysis_view" },
  v_daily_order_stats:                  { zhName: "每日訂單統計",            description: "每日彙總的訂單統計數據",                   category: "analysis_view" },
  ls_v_05_channel_contribution_trend:   { zhName: "通路貢獻趨勢",            description: "各通路營收貢獻隨時間變化",                 category: "analysis_view" },
  v_orders:                             { zhName: "訂單檢視",                description: "含客戶資訊的訂單檢視",                     category: "analysis_view" },
  view_customer_brand:                  { zhName: "客戶品牌關聯",            description: "客戶與品牌的關聯分析",                     category: "analysis_view" },
  view_customer_primary_brand:          { zhName: "客戶主要品牌",            description: "每位客戶的主要/首選品牌",                   category: "analysis_view" },
  mv_monthly_sales:                     { zhName: "月度銷售彙總",            description: "月度銷售金額彙總（物化檢視）",              category: "analysis_view" },

  // ── Looker Studio 圖表檢視 ──
  ls_v_daily_sales_trend_this_month:    { zhName: "本月每日銷售趨勢",        description: "當月每日銷售金額與訂單數",                 category: "chart_view" },
  ls_v_02_top_10_brands_yesterday:      { zhName: "昨日 Top 10 品牌",       description: "昨日銷售前十名品牌",                       category: "chart_view" },
  ls_v_03_monthly_revenue_accumulation: { zhName: "月度營收累積",            description: "每月營收累積曲線",                         category: "chart_view" },
  ls_v_01_today_revenue_achievement:    { zhName: "今日營收達成率",          description: "今日營收與目標比較",                       category: "chart_view" },
  ls_p1_2_brand_revenue_share:          { zhName: "品牌營收佔比",            description: "各品牌營收貢獻百分比",                     category: "chart_view" },
  ls_p1_9_monthly_asp:                  { zhName: "月度平均客單價",          description: "各品牌每月平均訂單金額",                   category: "chart_view" },
  ls_p1_4_category_dow_heat:            { zhName: "品類星期熱力圖",          description: "品類銷售量按星期幾分佈",                   category: "chart_view" },
  ls_p1_5_top20_products_by_qty:        { zhName: "銷量 Top 20 商品",       description: "按銷售數量排名前 20 商品",                 category: "chart_view" },
  ls_p1_10_weekend_weekday_qty:         { zhName: "平假日銷量比較",          description: "週末與平日銷售數量對比",                   category: "chart_view" },
  ls_p3_rfm:                            { zhName: "RFM 客戶分群",           description: "客戶 RFM 分群視覺化",                     category: "chart_view" },

  // ── 資料品質檢視 ──
  v_daily_cleaning_stats:               { zhName: "每日清洗統計",            description: "每日資料清洗處理量與結果",                 category: "quality_view" },
  v_pending_violations:                 { zhName: "待處理違規",              description: "尚未修正的資料品質問題",                   category: "quality_view" },
  v_rule_stats:                         { zhName: "規則統計",                description: "資料清洗規則觸發統計",                     category: "quality_view" },

  // ── 維度表 (dim_*) ──
  dim_customer:   { zhName: "客戶維度",   description: "已清洗的客戶主檔",               category: "dimension" },
  dim_brand:      { zhName: "品牌維度",   description: "品牌主檔",                       category: "dimension" },
  dim_channel:    { zhName: "通路維度",   description: "銷售通路主檔",                   category: "dimension" },
  dim_product:    { zhName: "商品維度",   description: "商品主檔（含單價）",              category: "dimension" },
  dim_payment:    { zhName: "金流維度",   description: "付款方式主檔",                   category: "dimension" },
  dim_logistics:  { zhName: "物流維度",   description: "物流廠商主檔",                   category: "dimension" },
  dim_postal:     { zhName: "郵遞區號",   description: "縣市區域對照表",                 category: "dimension" },
  dim_campaign:   { zhName: "活動維度",   description: "行銷活動主檔",                   category: "dimension" },

  // ── 事實表 (fact_*) ──
  fact_orders:        { zhName: "訂單事實表",     description: "已清洗的訂單記錄",                     category: "fact" },
  fact_order_details: { zhName: "訂單明細事實表", description: "訂單行項目（⚠️ subtotal 不可靠）",     category: "fact" },

  // ── 來源資料表 (sheet_*) ──
  sheet_10_brand:         { zhName: "品牌原始表",     description: "Ragic 品牌表原始資料",     category: "raw" },
  sheet_20_channel:       { zhName: "通路原始表",     description: "Ragic 通路表原始資料",     category: "raw" },
  sheet_30_payment:       { zhName: "金流原始表",     description: "Ragic 金流表原始資料",     category: "raw" },
  sheet_40_logistics:     { zhName: "物流原始表",     description: "Ragic 物流表原始資料",     category: "raw" },
  sheet_41_zipcode:       { zhName: "郵遞區號原始表", description: "Ragic 郵遞區號原始資料",   category: "raw" },
  sheet_50_order:         { zhName: "訂單原始表",     description: "Ragic 訂單表原始資料",     category: "raw" },
  sheet_60_customer:      { zhName: "客戶原始表",     description: "Ragic 客戶表原始資料",     category: "raw" },
  sheet_70_product:       { zhName: "商品原始表",     description: "Ragic 商品表原始資料",     category: "raw" },
  sheet_80_campaign:      { zhName: "活動原始表",     description: "Ragic 活動表原始資料",     category: "raw" },
  sheet_99_order_detail:  { zhName: "訂單明細原始表", description: "Ragic 訂單明細原始資料",   category: "raw" },

  // ── 系統表 ──
  cleaning_batches:     { zhName: "清洗批次",     description: "清洗執行批次記錄",     category: "system" },
  cleaning_results:     { zhName: "清洗結果",     description: "每筆記錄的清洗狀態",   category: "system" },
  cleaning_history:     { zhName: "清洗歷史",     description: "清洗操作變更歷史",     category: "system" },
  violations:           { zhName: "違規記錄",     description: "資料品質違規項目",     category: "system" },
  fill_results:         { zhName: "回填結果",     description: "自動回填操作結果",     category: "system" },
  backup_logs:          { zhName: "備份日誌",     description: "備份執行詳細資訊",     category: "system" },
  portal_audit_events:  { zhName: "Portal 稽核", description: "Portal 操作稽核紀錄",  category: "system" },
};

/** Column-level Chinese names (covers all known columns) */
export const COLUMN_ZH: Record<string, string> = {
  // ── 通用欄位 ──
  ragic_id:             "Ragic ID",
  ragic_created:        "Ragic 建立時間",
  ragic_modified:       "Ragic 修改時間",
  etl_loaded_at:        "ETL 載入時間",
  etl_updated_at:       "ETL 更新時間",
  backup_time:          "備份時間",
  status:               "狀態",
  data:                 "原始 JSON 資料",
  cleaning_status:      "清洗狀態",
  cleaning_updated_at:  "清洗更新時間",
  cleaning_batch_id:    "清洗批次 ID",
  is_filtered:          "是否已過濾",
  filter_reason:        "過濾原因",

  // ── 客戶 ──
  customer_code:  "客戶編號",
  customer_name:  "客戶名稱",
  phone:          "手機",
  email:          "電子郵件",
  landline:       "市話",

  // ── 品牌 ──
  brand_code: "品牌編號",
  brand_name: "品牌名稱",

  // ── 通路 ──
  channel_code: "通路編號",
  channel_name: "通路名稱",

  // ── 商品 ──
  product_code: "商品編號",
  product_name: "商品名稱",
  price:        "單價",

  // ── 訂單 ──
  order_code:   "訂單編號",
  order_date:   "訂單日期",
  order_amount: "訂單金額",
  quantity:     "數量",
  unit_price:   "單價",
  subtotal:     "小計",

  // ── 金流 ──
  payment_code: "金流編號",
  payment_name: "金流名稱",

  // ── 物流 ──
  logistics_code: "物流編號",
  logistics_name: "物流名稱",

  // ── 地區 ──
  zipcode:  "郵遞區號",
  city:     "縣市",
  district: "區域",

  // ── 活動 ──
  campaign_code: "活動編號",
  campaign_name: "活動名稱",
  start_date:    "開始日期",
  end_date:      "結束日期",

  // ── RFM ──
  recency:        "最近購買天數",
  frequency:      "購買次數",
  monetary:       "消費金額",
  r_score:        "R 分數",
  f_score:        "F 分數",
  m_score:        "M 分數",
  rfm_segment:    "RFM 分群",
  last_order_date: "最後訂單日",
  first_order_date: "首次訂單日",
  total_spent:    "累計消費",
  avg_order_value: "平均客單價",

  // ── 統計 / 彙總常見欄位 ──
  order_count:    "訂單數",
  revenue:        "營收",
  match_rate:     "匹配率",
  matched_count:  "已匹配數",
  unmatched_count: "未匹配數",
  total_count:    "總計",
  cnt:            "筆數",
  month:          "月份",
  week:           "週",
  day:            "日",
  year:           "年",
  date:           "日期",
};

/** Category display order and Chinese labels */
export const CATEGORY_ORDER: { key: string; zhName: string; icon: string }[] = [
  { key: "analysis_view", zhName: "分析檢視表",     icon: "📊" },
  { key: "chart_view",    zhName: "圖表檢視表",     icon: "📈" },
  { key: "quality_view",  zhName: "資料品質檢視表", icon: "🔍" },
  { key: "dimension",     zhName: "維度表",         icon: "📋" },
  { key: "fact",           zhName: "事實表",         icon: "📦" },
  { key: "raw",            zhName: "來源資料表",     icon: "💾" },
  { key: "system",         zhName: "系統表",         icon: "⚙️" },
];

/** Get Chinese name for a column, fallback to English */
export function getColumnZh(columnName: string): string {
  return COLUMN_ZH[columnName] ?? columnName;
}

/** Get table metadata, with fallback for unknown tables */
export function getTableMeta(tableName: string): { zhName: string; description: string; category: string } {
  return TABLE_META[tableName] ?? {
    zhName: tableName,
    description: "",
    category: tableName.startsWith("ls_") ? "chart_view"
      : tableName.startsWith("v_") || tableName.startsWith("view_") || tableName.startsWith("mv_") ? "analysis_view"
      : tableName.startsWith("dim_") ? "dimension"
      : tableName.startsWith("fact_") ? "fact"
      : tableName.startsWith("sheet_") ? "raw"
      : "system",
  };
}
