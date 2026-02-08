/**
 * Chart Registry - 圖表規格的唯一來源
 *
 * Purpose: T010 - 定義並落地 Chart Registry 的單一來源
 * Source of Truth: ragic-edp-portal/docs/portal/analytics/portal_bq_chart_catalog.md
 *
 * 本模組從 ChartSpec 合約讀取圖表清單，不建立第二份清單。
 * 所有圖表查詢、狀態檢查、metadata 都應該透過此 registry。
 */

export type ChartStatus = "ready" | "needs_new_view";

export type ChartCategory = "executive" | "product" | "brand" | "channel" | "customer" | "operations";

export type ChartSourceType = "VIEW" | "TABLE" | "QUERY";

export interface ChartSource {
  type: ChartSourceType;
  name?: string;
  base?: string;
}

export interface ChartDimension {
  field: string;
  type: "DATE" | "STRING" | "INT64" | "NUMERIC";
}

export interface ChartMetric {
  field: string;
  type: "NUMERIC" | "INT64";
  agg?: "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
  formula?: string;
}

export interface ChartFilter {
  field: string;
  op: string;
  value: string;
}

export interface ChartSpecV0 {
  chart_id: string;
  name: string;
  status: ChartStatus;
  category?: ChartCategory;
  source: ChartSource;
  chart_type: string;
  dimensions?: ChartDimension[];
  metrics?: ChartMetric[];
  filters?: ChartFilter[];
  required_fields: string[];
  depends_on?: string[];
  unit?: string;
}

export interface ChartRegistrySpec {
  spec_version: string;
  bq_project: string;
  bq_dataset: string;
  assumptions: {
    timezone: string;
    primary_order_date_field: string;
  };
  data_surfaces: {
    ready_views: string[];
    planned_views: Array<{
      name: string;
      purpose: string;
    }>;
  };
  charts: ChartSpecV0[];
}

/**
 * ChartSpec 合約資料（從 portal_bq_chart_catalog.md JSON 區塊擷取）
 *
 * 維護規則：
 * - 此物件應與 docs/portal/analytics/portal_bq_chart_catalog.md 的 JSON 保持同步
 * - 新增/修改圖表時，先更新 ChartSpec 合約文件，再同步此處
 * - 不得在程式碼其他地方建立第二份圖表清單
 */
const CHART_SPEC: ChartRegistrySpec = {
  spec_version: "v0",
  bq_project: "b25h01-ragic",
  bq_dataset: "erp_backup",
  assumptions: {
    timezone: "Asia/Taipei",
    primary_order_date_field: "order_date",
  },
  data_surfaces: {
    ready_views: [
      "ls_v_daily_sales_trend_this_month",
      "ls_v_02_top_10_brands_yesterday",
      "ls_v_03_monthly_revenue_accumulation",
      "ls_v_01_today_revenue_achievement",
      "ls_p1_2_brand_revenue_share",
      "ls_p1_9_monthly_asp",
      "ls_p1_4_category_dow_heat",
      "ls_p1_5_top20_products_by_qty",
      "ls_p3_rfm",
      "ls_v_order_lines",
      "ls_v_orders_ext",
      "v_daily_order_stats",
      "v_customer_rfm",
      "view_customer_brand",
      "view_customer_primary_brand",
      "mv_monthly_sales",
      "ls_v_order_lines_ext",
    ],
    planned_views: [],
  },
  charts: [
    {
      chart_id: "01",
      name: "本月每日銷售趨勢",
      status: "ready",
      category: "executive",
      source: { type: "VIEW", name: "ls_v_daily_sales_trend_this_month" },
      chart_type: "time_series_line",
      dimensions: [{ field: "order_date", type: "DATE" }],
      metrics: [{ field: "revenue", type: "NUMERIC", agg: "SUM" }],
      filters: [{ field: "order_date", op: ">=", value: "DATE_TRUNC(CURRENT_DATE('Asia/Taipei'), MONTH)" }],
      required_fields: ["order_date", "revenue"],
    },
    {
      chart_id: "02",
      name: "昨日銷售 Top 10 品牌",
      status: "ready",
      category: "brand",
      source: { type: "VIEW", name: "ls_v_02_top_10_brands_yesterday" },
      chart_type: "bar_topn",
      dimensions: [{ field: "brand_name", type: "STRING" }],
      metrics: [{ field: "revenue", type: "NUMERIC", agg: "SUM" }],
      required_fields: ["brand_name", "revenue"],
    },
    {
      chart_id: "03",
      name: "月度營收累積曲線",
      status: "ready",
      category: "executive",
      source: { type: "VIEW", name: "ls_v_03_monthly_revenue_accumulation" },
      chart_type: "time_series_area",
      dimensions: [{ field: "order_date", type: "DATE" }],
      metrics: [{ field: "cumulative_revenue", type: "NUMERIC", agg: "MAX" }],
      required_fields: ["order_date", "cumulative_revenue"],
    },
    {
      chart_id: "04",
      name: "前日營收達成率",
      status: "ready",
      category: "executive",
      source: { type: "VIEW", name: "ls_v_01_today_revenue_achievement" },
      chart_type: "scorecard_gauge",
      dimensions: [],
      metrics: [
        { field: "actual_revenue", type: "NUMERIC" },
        { field: "target_revenue", type: "NUMERIC" },
        { field: "achievement_rate", type: "NUMERIC" },
      ],
      required_fields: ["actual_revenue", "target_revenue", "achievement_rate"],
    },
    {
      chart_id: "05",
      name: "通路貢獻度趨勢",
      status: "ready",
      category: "channel",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "VIEW", name: "ls_v_order_lines_ext" },
      chart_type: "time_series_stacked_area",
      dimensions: [
        { field: "order_date", type: "DATE" },
        { field: "channel_name", type: "STRING" },
      ],
      metrics: [
        { field: "order_count", type: "INT64", formula: "COUNT(DISTINCT order_code)" },
        { field: "revenue_sum", type: "NUMERIC", formula: "SUM(subtotal)" },
      ],
      required_fields: ["order_date", "channel_name", "order_code", "subtotal"],
    },
    {
      chart_id: "06",
      name: "訂單平均單價 (AOV)",
      status: "ready",
      category: "executive",
      source: { type: "TABLE", name: "fact_orders" },
      chart_type: "scorecard",
      dimensions: [],
      metrics: [
        {
          field: "aov",
          type: "NUMERIC",
          formula: "SAFE_DIVIDE(SUM(order_amount), COUNT(DISTINCT order_code))",
        },
      ],
      required_fields: ["order_code", "order_amount"],
    },
    {
      chart_id: "11",
      name: "通路活動號碼成效排行（活動/促銷 proxy）",
      status: "ready",
      category: "channel",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "bar_topn",
      required_fields: [
        "order_date",
        "order_code",
        "subtotal",
        "channel_campaign_no1",
        "channel_campaign_no2",
        "channel_campaign_no3",
        "channel_campaign_no4",
        "channel_campaign_no5",
      ],
    },
    {
      chart_id: "13",
      name: "每日商品銷量趨勢",
      status: "ready",
      category: "product",
      source: { type: "VIEW", name: "ls_p1_1_daily_product_quantity" },
      chart_type: "time_series_line",
      dimensions: [
        { field: "order_date", type: "DATE" },
        { field: "brand_name", type: "STRING" },
      ],
      metrics: [{ field: "quantity_sum", type: "NUMERIC" }],
      required_fields: ["order_date", "brand_name", "quantity_sum"],
    },
    {
      chart_id: "14",
      name: "熱銷商品 Top 20 排行",
      status: "ready",
      category: "product",
      source: { type: "VIEW", name: "ls_p1_5_top20_products_by_qty" },
      chart_type: "bar_topn",
      dimensions: [{ field: "product_name", type: "STRING" }],
      metrics: [{ field: "quantity_sum", type: "NUMERIC" }],
      required_fields: ["product_name", "quantity_sum"],
    },
    {
      chart_id: "19",
      name: "RFM 客戶分群分布",
      status: "ready",
      category: "customer",
      source: { type: "VIEW", name: "ls_p3_rfm" },
      chart_type: "bubble",
      dimensions: [
        { field: "recency_days", type: "INT64" },
        { field: "frequency", type: "INT64" },
      ],
      metrics: [
        { field: "monetary", type: "NUMERIC" },
        { field: "customer_count", type: "INT64", agg: "COUNT" },
      ],
      required_fields: ["customer_code", "recency_days", "frequency", "monetary"],
    },
    {
      chart_id: "21",
      name: "客戶獲取月份同期群（首購月 proxy）",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "fact_orders" },
      chart_type: "cohort_matrix",
      required_fields: ["customer_code", "order_date", "order_amount"],
    },
    {
      chart_id: "22",
      name: "沉睡客戶預警 (120d+)",
      status: "ready",
      category: "customer",
      source: { type: "VIEW", name: "v_customer_rfm" },
      chart_type: "table",
      required_fields: ["customer_code", "recency_days", "frequency", "monetary"],
    },
    {
      chart_id: "23",
      name: "客戶地理銷售分布",
      status: "ready",
      category: "customer",
      source: { type: "VIEW", name: "ls_v_orders_ext" },
      chart_type: "treemap",
      dimensions: [
        { field: "city", type: "STRING" },
        { field: "district", type: "STRING" },
      ],
      metrics: [{ field: "order_amount", type: "NUMERIC", agg: "SUM" }],
      required_fields: ["city", "district", "order_amount"],
    },
    {
      chart_id: "24",
      name: "平均回購週期分布",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "fact_orders" },
      chart_type: "histogram",
      required_fields: ["customer_code", "order_date"],
    },
    {
      chart_id: "25",
      name: "通路支付方式結構",
      status: "ready",
      category: "channel",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "VIEW", name: "ls_v_order_lines_ext" },
      chart_type: "stacked_bar",
      dimensions: [
        { field: "channel_name", type: "STRING" },
        { field: "payment_method", type: "STRING" },
      ],
      metrics: [{ field: "order_count", type: "INT64", formula: "COUNT(DISTINCT order_code)" }],
      required_fields: ["channel_name", "payment_method", "order_code"],
    },
    {
      chart_id: "28",
      name: "每筆訂單平均物流成本（proxy）",
      status: "ready",
      category: "operations",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "VIEW", name: "ls_v_order_lines_ext" },
      chart_type: "time_series_line",
      required_fields: ["order_date", "order_code", "shipping_income", "amount_paid", "amount_with_shipping"],
    },
    {
      chart_id: "37",
      name: "品牌營收貢獻佔比",
      status: "ready",
      category: "brand",
      source: { type: "VIEW", name: "ls_p1_2_brand_revenue_share" },
      chart_type: "donut",
      dimensions: [{ field: "brand_name", type: "STRING" }],
      metrics: [{ field: "revenue_sum", type: "NUMERIC" }],
      required_fields: ["brand_name", "revenue_sum"],
    },
    {
      chart_id: "38",
      name: "各品牌平均單價波動",
      status: "ready",
      category: "brand",
      source: { type: "VIEW", name: "ls_p1_9_monthly_asp" },
      chart_type: "time_series_line",
      dimensions: [{ field: "order_month", type: "DATE" }],
      metrics: [{ field: "asp", type: "NUMERIC" }],
      required_fields: ["order_month", "asp"],
    },
    {
      chart_id: "39",
      name: "品類銷售高峰熱圖",
      status: "ready",
      category: "product",
      source: { type: "VIEW", name: "ls_p1_4_category_dow_heat" },
      chart_type: "heatmap",
      required_fields: ["category", "day_of_week", "order_count", "quantity_sum", "revenue_sum"],
    },
    {
      chart_id: "42",
      name: "產品類別成長趨勢矩陣（proxy）",
      status: "ready",
      category: "product",
      source: { type: "QUERY", base: "ls_v_order_lines" },
      chart_type: "treemap",
      required_fields: ["order_date", "product_series", "subtotal"],
    },
    {
      chart_id: "44",
      name: "商品折扣與銷量相關性（discount proxy）",
      status: "ready",
      category: "product",
      source: { type: "QUERY", base: "ls_v_order_lines" },
      chart_type: "scatter",
      required_fields: ["unit_price", "quantity", "subtotal"],
    },
    {
      chart_id: "45",
      name: "產品合購關聯分析",
      status: "ready",
      category: "product",
      source: { type: "QUERY", base: "fact_order_details" },
      chart_type: "heatmap",
      required_fields: ["order_code", "product_code", "quantity"],
    },
    {
      chart_id: "48",
      name: "首購品牌佔比分布",
      status: "ready",
      category: "brand",
      source: { type: "VIEW", name: "view_customer_primary_brand" },
      chart_type: "donut",
      required_fields: ["customer_code", "primary_brand", "order_count", "total_amount"],
    },
    {
      chart_id: "52",
      name: "客戶生日月份銷售貢獻（首購月份 proxy）",
      status: "ready",
      category: "customer",
      source: { type: "VIEW", name: "v_customer_birth_month" },
      chart_type: "bar",
      required_fields: ["customer_code", "birth_month"],
    },
    {
      chart_id: "55",
      name: "數據清洗規則觸發統計",
      status: "ready",
      source: { type: "VIEW", name: "v_rule_stats" },
      chart_type: "bar",
      required_fields: ["rule_id", "rule_name", "category", "severity", "total_violations"],
    },
    {
      chart_id: "56",
      name: "資料備份同步健康度",
      status: "ready",
      source: { type: "TABLE", name: "backup_logs" },
      chart_type: "table",
      required_fields: ["backup_date", "backup_time", "sheet_code", "status", "duration_seconds", "records_fetched"],
    },
    {
      chart_id: "59",
      name: "資料清洗後欄位填充率",
      status: "ready",
      source: { type: "QUERY", base: "fill_results" },
      chart_type: "table",
      required_fields: ["table_code", "field_name", "status", "before_value", "after_value", "fixed_at"],
    },
    {
      chart_id: "60",
      name: "跨通路購買轉移矩陣",
      status: "ready",
      category: "channel",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "heatmap",
      required_fields: ["customer_code", "order_date", "channel_name", "order_code"],
    },
    {
      chart_id: "NEW-01",
      name: "80/20 Pareto（客戶/商品/品牌貢獻）",
      status: "ready",
      category: "executive",
      source: { type: "QUERY", base: "fact_orders|ls_v_order_lines" },
      chart_type: "pareto",
      required_fields: ["customer_code", "order_amount", "product_code", "subtotal", "brand_name"],
    },
    {
      chart_id: "NEW-02",
      name: "Basket size 分布（每單品項數/件數）",
      status: "ready",
      category: "product",
      source: { type: "QUERY", base: "fact_order_details" },
      chart_type: "histogram",
      required_fields: ["order_code", "product_code", "quantity"],
    },
    {
      chart_id: "NEW-03",
      name: "回購率（30/60/90 天）趨勢",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "fact_orders" },
      chart_type: "time_series_line",
      required_fields: ["customer_code", "order_date"],
    },
    {
      chart_id: "NEW-04",
      name: "通路 x 品牌 交叉矩陣",
      status: "ready",
      category: "channel",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "heatmap",
      required_fields: ["channel_name", "brand_name", "subtotal"],
    },
    {
      chart_id: "NEW-05",
      name: "訂單狀態分佈",
      status: "ready",
      category: "operations",
      source: { type: "QUERY", base: "v_orders" },
      chart_type: "donut",
      required_fields: ["status", "order_code", "order_date"],
    },
    {
      chart_id: "NEW-06",
      name: "每日客戶數 vs 訂單數散點",
      status: "ready",
      category: "executive",
      source: { type: "VIEW", name: "v_daily_order_stats" },
      chart_type: "scatter",
      required_fields: ["order_date", "customer_count", "order_count"],
    },
    {
      chart_id: "NEW-07",
      name: "訂單金額分布/分位數",
      status: "ready",
      category: "executive",
      source: { type: "QUERY", base: "v_orders" },
      chart_type: "histogram",
      required_fields: ["order_date", "order_amount"],
    },
    {
      chart_id: "NEW-08",
      name: "每日活躍客戶數",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "view_order_customer" },
      chart_type: "time_series_line",
      required_fields: ["order_date", "customer_code"],
    },
    {
      chart_id: "NEW-09",
      name: "每日新客數",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "view_order_customer" },
      chart_type: "time_series_line",
      required_fields: ["order_date", "customer_code"],
    },
    {
      chart_id: "NEW-10",
      name: "新客 vs 回購客營收佔比",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "view_order_customer" },
      chart_type: "stacked_area",
      required_fields: ["order_date", "customer_code", "order_amount"],
    },
    {
      chart_id: "NEW-11",
      name: "客戶購買頻次分布",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "view_order_customer" },
      chart_type: "histogram",
      required_fields: ["customer_code", "order_code"],
    },
    {
      chart_id: "NEW-12",
      name: "多品牌客比例",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "view_customer_brand" },
      chart_type: "donut",
      required_fields: ["customer_code", "is_multi_brand_customer"],
    },
    {
      chart_id: "NEW-13",
      name: "客戶購買品牌數分布",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "view_customer_brand" },
      chart_type: "histogram",
      required_fields: ["customer_code", "total_brands"],
    },
    {
      chart_id: "NEW-14",
      name: "品牌交叉購買矩陣",
      status: "ready",
      category: "brand",
      source: { type: "QUERY", base: "view_customer_brand" },
      chart_type: "heatmap",
      required_fields: ["customer_code", "brand_code", "brand_rank"],
    },
    {
      chart_id: "NEW-15",
      name: "發票開立率",
      status: "ready",
      category: "operations",
      source: { type: "QUERY", base: "ls_v_orders_ext" },
      chart_type: "scorecard",
      required_fields: ["order_date", "order_code", "invoice_flag"],
    },
    {
      chart_id: "NEW-16",
      name: "平台單佔比",
      status: "ready",
      category: "channel",
      source: { type: "QUERY", base: "ls_v_orders_ext" },
      chart_type: "scorecard",
      required_fields: ["order_date", "order_code", "platform_order_no"],
    },
    {
      chart_id: "NEW-17",
      name: "Top 城市營收排行",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "ls_v_orders_ext" },
      chart_type: "bar_topn",
      required_fields: ["order_date", "city", "order_amount"],
    },
    {
      chart_id: "NEW-18",
      name: "城市營收月趨勢",
      status: "ready",
      category: "customer",
      source: { type: "QUERY", base: "ls_v_orders_ext" },
      chart_type: "time_series_line",
      required_fields: ["order_date", "city", "order_amount"],
    },
    {
      chart_id: "NEW-19",
      name: "週末 vs 平日營收/銷量對比",
      status: "ready",
      category: "executive",
      source: { type: "VIEW", name: "ls_p1_10_weekend_weekday_qty" },
      chart_type: "bar",
      required_fields: ["day_type", "quantity_sum", "revenue_sum"],
    },
    {
      chart_id: "NEW-20",
      name: "月度客戶營收分布",
      status: "ready",
      category: "customer",
      source: { type: "VIEW", name: "mv_monthly_sales" },
      chart_type: "histogram",
      required_fields: ["month", "customer_code", "total_revenue"],
    },
    {
      chart_id: "NEW-21",
      name: "物流方式佔比",
      status: "ready",
      category: "operations",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "donut",
      required_fields: ["order_date", "order_code", "logistics_name", "logistics_vendor", "logistics_temp_layer"],
    },
    {
      chart_id: "NEW-22",
      name: "運費收入趨勢",
      status: "ready",
      category: "operations",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "time_series_line",
      required_fields: ["order_date", "order_code", "shipping_income"],
    },
    {
      chart_id: "NEW-23",
      name: "含運實收 vs 訂單實收差額分布",
      status: "ready",
      category: "operations",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "histogram",
      required_fields: ["order_date", "order_code", "amount_paid", "amount_with_shipping"],
    },
    {
      chart_id: "NEW-24",
      name: "COD 佔比",
      status: "ready",
      category: "operations",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "donut",
      required_fields: ["order_date", "order_code", "cod_flag"],
    },
    {
      chart_id: "NEW-25",
      name: "希望配達時段分布",
      status: "ready",
      category: "operations",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "bar",
      required_fields: ["order_date", "order_code", "desired_delivery_timeslot"],
    },
    {
      chart_id: "NEW-27",
      name: "通路訂單數趨勢",
      status: "ready",
      category: "channel",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "time_series_line",
      dimensions: [
        { field: "order_date", type: "DATE" },
        { field: "channel_name", type: "STRING" },
      ],
      metrics: [{ field: "order_count", type: "INT64", formula: "COUNT(DISTINCT order_code)" }],
      required_fields: ["order_date", "channel_name", "order_code"],
    },
    {
      chart_id: "NEW-28",
      name: "通路客單價比較",
      status: "ready",
      category: "channel",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "bar",
      dimensions: [{ field: "channel_name", type: "STRING" }],
      metrics: [{ field: "aov", type: "NUMERIC", formula: "SAFE_DIVIDE(SUM(subtotal), COUNT(DISTINCT order_code))" }],
      required_fields: ["channel_name", "subtotal", "order_code"],
    },
    {
      chart_id: "NEW-31",
      name: "通路新客佔比",
      status: "ready",
      category: "channel",
      depends_on: ["ls_v_order_lines_ext"],
      source: { type: "QUERY", base: "ls_v_order_lines_ext" },
      chart_type: "stacked_bar",
      dimensions: [{ field: "channel_name", type: "STRING" }],
      metrics: [
        { field: "new_customer_count", type: "INT64" },
        { field: "returning_customer_count", type: "INT64" },
      ],
      required_fields: ["channel_name", "customer_code", "order_date"],
    },
  ],
};

/**
 * 從圖表 metric 欄位推導顯示單位
 */
const CHART_UNIT_MAP: Record<string, string> = {
  "01": "元", "02": "元", "03": "元", "04": "%",
  "06": "元/筆", "13": "件", "14": "件",
  "19": "", "21": "人", "22": "", "23": "元", "24": "天",
  "30": "", "37": "%", "38": "元/件", "39": "筆",
  "42": "元", "44": "", "45": "次", "48": "%",
  "55": "次", "56": "", "59": "",
  "NEW-01": "元", "NEW-02": "件", "NEW-03": "%",
  "NEW-05": "筆", "NEW-06": "", "NEW-07": "元",
  "NEW-08": "人", "NEW-09": "人", "NEW-10": "元",
  "NEW-11": "人", "NEW-12": "%", "NEW-13": "人",
  "NEW-14": "人", "NEW-15": "%", "NEW-16": "%",
  "NEW-17": "元", "NEW-18": "元", "NEW-19": "件",
  "NEW-20": "元",
  "NEW-27": "筆", "NEW-28": "元/筆", "NEW-31": "人",
};

export function getChartUnit(chartId: string): string {
  const spec = getChartSpec(chartId);
  if (!spec) return "";
  if (spec.unit) return spec.unit;
  return CHART_UNIT_MAP[chartId] ?? "";
}

/**
 * 取得完整的 ChartSpec 規格
 */
export function getChartRegistrySpec(): ChartRegistrySpec {
  return CHART_SPEC;
}

/**
 * 依 chart_id 查詢圖表規格
 */
export function getChartSpec(chartId: string): ChartSpecV0 | undefined {
  return CHART_SPEC.charts.find((c) => c.chart_id === chartId);
}

/**
 * 列出所有圖表（可依 status 篩選）
 */
export function listCharts(options?: { status?: ChartStatus }): ChartSpecV0[] {
  if (!options?.status) return CHART_SPEC.charts;
  return CHART_SPEC.charts.filter((c) => c.status === options.status);
}

/**
 * 列出所有 ready 的圖表（可直接建立）
 */
export function listReadyCharts(): ChartSpecV0[] {
  return listCharts({ status: "ready" });
}

/**
 * 依分類列出圖表
 */
export function listChartsByCategory(category: ChartCategory): ChartSpecV0[] {
  return CHART_SPEC.charts.filter((c) => c.category === category);
}

/**
 * 取得所有分類
 */
export function getChartCategories(): { id: ChartCategory; name: string }[] {
  return [
    { id: "executive", name: "Executive" },
    { id: "product", name: "Product" },
    { id: "brand", name: "Brand" },
    { id: "channel", name: "Channel" },
    { id: "customer", name: "Customer" },
    { id: "operations", name: "Operations" },
  ];
}

/**
 * 列出所有 needs_new_view 的圖表（需要先建立 view）
 */
export function listPendingCharts(): ChartSpecV0[] {
  return listCharts({ status: "needs_new_view" });
}

/**
 * 檢查圖表是否存在
 */
export function hasChart(chartId: string): boolean {
  return CHART_SPEC.charts.some((c) => c.chart_id === chartId);
}

/**
 * 取得圖表總數統計
 */
export function getChartStats(): {
  total: number;
  ready: number;
  needsNewView: number;
} {
  const ready = CHART_SPEC.charts.filter((c) => c.status === "ready").length;
  const needsNewView = CHART_SPEC.charts.filter((c) => c.status === "needs_new_view").length;
  return {
    total: CHART_SPEC.charts.length,
    ready,
    needsNewView,
  };
}

/**
 * 驗證 required_fields 是否包含指定欄位
 *
 * 用於 Phase 2 時驗證 INFORMATION_SCHEMA.COLUMNS 是否包含圖表所需欄位
 */
export function validateRequiredFields(chartId: string, availableFields: string[]): {
  valid: boolean;
  missingFields: string[];
} {
  const spec = getChartSpec(chartId);
  if (!spec) return { valid: false, missingFields: [] };

  const missingFields = spec.required_fields.filter((field) => !availableFields.includes(field));
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
