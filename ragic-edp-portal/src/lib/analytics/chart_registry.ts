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

export type DashboardId = "erp" | "ga4_basic" | "ga4_cross" | "ga4";

export type ChartCategory =
  | "executive" | "product" | "channel" | "customer" | "operations"
  | "cross_brand"
  | "ga4_traffic" | "ga4_engagement" | "ga4_conversion"
  | "ga4_cross_trend" | "ga4_cross_roi" | "ga4_cross_campaign";

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
  dashboard?: DashboardId;
  source: ChartSource;
  chart_type: string;
  dimensions?: ChartDimension[];
  metrics?: ChartMetric[];
  filters?: ChartFilter[];
  required_fields: string[];
  depends_on?: string[];
  unit?: string;
  description?: string;
  supportsBrandFilter?: boolean; // undefined = true (default), false = does not support
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
      category: "cross_brand",
      supportsBrandFilter: false,
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
      category: "cross_brand",
      supportsBrandFilter: false,
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
      category: "cross_brand",
      supportsBrandFilter: false,
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
      category: "cross_brand",
      supportsBrandFilter: false,
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
      category: "cross_brand",
      supportsBrandFilter: false,
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
      category: "cross_brand",
      supportsBrandFilter: false,
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
      category: "cross_brand",
      supportsBrandFilter: false,
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
      category: "cross_brand",
      supportsBrandFilter: false,
      source: { type: "QUERY", base: "view_customer_brand" },
      chart_type: "donut",
      required_fields: ["customer_code", "is_multi_brand_customer"],
    },
    {
      chart_id: "NEW-13",
      name: "客戶購買品牌數分布",
      status: "ready",
      category: "cross_brand",
      supportsBrandFilter: false,
      source: { type: "QUERY", base: "view_customer_brand" },
      chart_type: "histogram",
      required_fields: ["customer_code", "total_brands"],
    },
    {
      chart_id: "NEW-14",
      name: "品牌交叉購買矩陣",
      status: "ready",
      category: "cross_brand",
      supportsBrandFilter: false,
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
    {
      chart_id: "NEW-32",
      name: "品牌月營收趨勢",
      status: "ready",
      category: "cross_brand",
      supportsBrandFilter: false,
      source: { type: "QUERY", base: "ls_v_order_lines" },
      chart_type: "time_series_line",
      dimensions: [
        { field: "order_date", type: "DATE" },
        { field: "brand_name", type: "STRING" },
      ],
      metrics: [{ field: "revenue", type: "NUMERIC", agg: "SUM" }],
      required_fields: ["order_date", "brand_name", "subtotal"],
    },
    {
      chart_id: "NEW-33",
      name: "品牌銷量排行",
      status: "ready",
      category: "cross_brand",
      supportsBrandFilter: false,
      source: { type: "QUERY", base: "ls_v_order_lines" },
      chart_type: "bar_topn",
      dimensions: [{ field: "brand_name", type: "STRING" }],
      metrics: [{ field: "quantity", type: "NUMERIC", agg: "SUM" }],
      required_fields: ["order_date", "brand_name", "quantity"],
    },
    {
      chart_id: "NEW-34",
      name: "品牌客戶數排行",
      status: "ready",
      category: "cross_brand",
      supportsBrandFilter: false,
      source: { type: "QUERY", base: "view_customer_brand" },
      chart_type: "bar_topn",
      dimensions: [{ field: "brand_code", type: "STRING" }],
      metrics: [{ field: "customer_count", type: "INT64", agg: "COUNT" }],
      required_fields: ["brand_code", "customer_code"],
    },
    // ── GA4 基礎監測 (13 張) ──
    {
      chart_id: "GA4-01",
      name: "流量來源分布",
      status: "ready",
      category: "ga4_traffic",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_sessions" },
      chart_type: "donut",
      required_fields: ["medium", "session_count"],
    },
    {
      chart_id: "GA4-02",
      name: "每日用戶數趨勢（新客 vs 回訪）",
      status: "ready",
      category: "ga4_traffic",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_flat_events" },
      chart_type: "time_series_stacked_area",
      dimensions: [{ field: "event_date", type: "DATE" }],
      required_fields: ["event_date", "user_pseudo_id", "ga_session_number"],
    },
    {
      chart_id: "GA4-03",
      name: "每日 Session 數趨勢",
      status: "ready",
      category: "ga4_traffic",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_sessions" },
      chart_type: "time_series_line",
      dimensions: [{ field: "event_date", type: "DATE" }],
      required_fields: ["event_date", "ga_session_id"],
    },
    {
      chart_id: "GA4-04",
      name: "熱門頁面 Top 20",
      status: "ready",
      category: "ga4_engagement",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_flat_events" },
      chart_type: "bar_topn",
      required_fields: ["page_location", "event_name"],
    },
    {
      chart_id: "GA4-05",
      name: "裝置類型分布",
      status: "ready",
      category: "ga4_engagement",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_flat_events" },
      chart_type: "donut",
      required_fields: ["device_category", "user_pseudo_id"],
    },
    {
      chart_id: "GA4-06",
      name: "Landing Page 成效排行",
      status: "ready",
      category: "ga4_engagement",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_sessions" },
      chart_type: "table",
      required_fields: ["landing_page", "sessions", "bounce_rate", "avg_engagement_time"],
    },
    {
      chart_id: "GA4-07",
      name: "電商轉換漏斗",
      status: "ready",
      category: "ga4_conversion",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_ecommerce" },
      chart_type: "bar",
      required_fields: ["event_name", "user_pseudo_id"],
    },
    {
      chart_id: "GA4-08",
      name: "購物車放棄率趨勢",
      status: "ready",
      category: "ga4_conversion",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_ecommerce" },
      chart_type: "time_series_line",
      dimensions: [{ field: "event_date", type: "DATE" }],
      required_fields: ["event_date", "event_name", "user_pseudo_id"],
    },
    {
      chart_id: "GA4-09",
      name: "轉換率日趨勢",
      status: "ready",
      category: "ga4_conversion",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_ecommerce" },
      chart_type: "time_series_line",
      dimensions: [{ field: "event_date", type: "DATE" }],
      required_fields: ["event_date", "event_name", "user_pseudo_id"],
    },
    {
      chart_id: "GA4-10",
      name: "商品銷售排行（GA4 側）",
      status: "ready",
      category: "ga4_conversion",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_ecommerce" },
      chart_type: "bar_topn",
      required_fields: ["item_name", "item_revenue", "item_quantity"],
    },
    {
      chart_id: "GA4-11",
      name: "表單轉換漏斗",
      status: "ready",
      category: "ga4_conversion",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_flat_events" },
      chart_type: "bar",
      required_fields: ["event_name", "user_pseudo_id"],
    },
    {
      chart_id: "GA4-12",
      name: "Google Ads vs Facebook 流量對比",
      status: "ready",
      category: "ga4_conversion",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_source_daily" },
      chart_type: "bar",
      required_fields: ["source", "medium", "sessions"],
    },
    {
      chart_id: "GA4-13",
      name: "新客 vs 回購客營收佔比",
      status: "ready",
      category: "ga4_conversion",
      dashboard: "ga4_basic",
      source: { type: "VIEW", name: "ga4_ecommerce" },
      chart_type: "donut",
      required_fields: ["customer_type", "value"],
    },
    // ── GA4 交叉分析：趨勢與異常 (7 張) ──
    {
      chart_id: "GA4-14",
      name: "流量-營收同步性趨勢",
      status: "ready",
      category: "ga4_cross_trend",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_daily_traffic|erp_daily_sales" },
      chart_type: "dual_axis_line",
      dimensions: [{ field: "date", type: "DATE" }],
      required_fields: ["date", "sessions", "revenue"],
    },
    {
      chart_id: "GA4-15",
      name: "流量營收偏離警報",
      status: "ready",
      category: "ga4_cross_trend",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_daily_traffic|erp_daily_sales" },
      chart_type: "scatter_alert",
      required_fields: ["date", "session_delta_pct", "revenue_delta_pct"],
    },
    {
      chart_id: "GA4-16",
      name: "時段投放效率熱力圖",
      status: "ready",
      category: "ga4_cross_trend",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_flat_events|fact_orders" },
      chart_type: "heatmap",
      required_fields: ["hour", "day_of_week", "sessions", "orders"],
    },
    {
      chart_id: "GA4-17",
      name: "週末平日轉換效率",
      status: "ready",
      category: "ga4_cross_trend",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_daily_traffic|erp_daily_sales" },
      chart_type: "stacked_bar",
      required_fields: ["day_type", "sessions", "revenue", "orders"],
    },
    {
      chart_id: "GA4-18",
      name: "購物意圖 vs 成交落差",
      status: "ready",
      category: "ga4_cross_trend",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_daily_traffic|erp_daily_sales" },
      chart_type: "dual_axis_line",
      dimensions: [{ field: "date", type: "DATE" }],
      required_fields: ["date", "add_to_cart_count", "order_count"],
    },
    {
      chart_id: "GA4-19",
      name: "每日流量品質評分",
      status: "ready",
      category: "ga4_cross_trend",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_daily_traffic|erp_daily_sales" },
      chart_type: "time_series_line",
      dimensions: [{ field: "date", type: "DATE" }],
      required_fields: ["date", "quality_score"],
    },
    {
      chart_id: "GA4-20",
      name: "新客流量 vs 新客訂單趨勢",
      status: "ready",
      category: "ga4_cross_trend",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_daily_traffic|erp_daily_sales" },
      chart_type: "dual_axis_line",
      dimensions: [{ field: "date", type: "DATE" }],
      required_fields: ["date", "new_visitors", "new_customers"],
    },
    // ── GA4 交叉分析：通路 ROI (8 張) ──
    {
      chart_id: "GA4-21",
      name: "廣告通路成效總覽表",
      status: "ready",
      category: "ga4_cross_roi",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_source_daily|erp_daily_sales" },
      chart_type: "table",
      required_fields: ["source", "medium", "sessions", "engaged_rate", "cvr", "revenue", "aov"],
    },
    {
      chart_id: "GA4-22",
      name: "付費 vs 自然流量 ROI",
      status: "needs_new_view",
      category: "ga4_cross_roi",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_source_daily|erp_daily_sales" },
      chart_type: "stacked_bar",
      required_fields: ["month", "paid_sessions", "organic_sessions", "revenue"],
    },
    {
      chart_id: "GA4-23",
      name: "Google Ads 流量轉營收效率",
      status: "ready",
      category: "ga4_cross_roi",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_source_daily|erp_daily_sales" },
      chart_type: "dual_axis_line",
      dimensions: [{ field: "date", type: "DATE" }],
      required_fields: ["date", "google_cpc_sessions", "revenue"],
    },
    {
      chart_id: "GA4-24",
      name: "Facebook 廣告流量轉營收效率",
      status: "ready",
      category: "ga4_cross_roi",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_source_daily|erp_daily_sales" },
      chart_type: "dual_axis_line",
      dimensions: [{ field: "date", type: "DATE" }],
      required_fields: ["date", "fb_paid_sessions", "revenue"],
    },
    {
      chart_id: "GA4-25",
      name: "LINE (Omnichat) 導購成效",
      status: "ready",
      category: "ga4_cross_roi",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_source_daily|erp_daily_sales" },
      chart_type: "line_annotation",
      dimensions: [{ field: "date", type: "DATE" }],
      required_fields: ["date", "omnichat_sessions", "revenue"],
    },
    {
      chart_id: "GA4-26",
      name: "通路流量品質排行",
      status: "ready",
      category: "ga4_cross_roi",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_source_daily|erp_daily_sales" },
      chart_type: "table",
      required_fields: ["source", "sessions", "engaged_rate", "cvr", "revenue_per_session"],
    },
    {
      chart_id: "GA4-27",
      name: "通路新客獲取效率",
      status: "ready",
      category: "ga4_cross_roi",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_source_daily|erp_daily_sales" },
      chart_type: "bar",
      required_fields: ["source", "first_visit_count", "new_customer_count"],
    },
    {
      chart_id: "GA4-28",
      name: "Referral 流量商業價值",
      status: "needs_new_view",
      category: "ga4_cross_roi",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_source_daily|erp_daily_sales" },
      chart_type: "table",
      required_fields: ["referral_source", "sessions", "engaged_rate", "cvr", "revenue_impact"],
    },
    // ── GA4 交叉分析：活動動能 (7 張) ──
    {
      chart_id: "GA4-29",
      name: "活動營收拉動力分析",
      status: "ready",
      category: "ga4_cross_campaign",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_campaign_daily|erp_daily_sales" },
      chart_type: "line_annotation",
      dimensions: [{ field: "date", type: "DATE" }],
      required_fields: ["date", "campaign_sessions", "revenue", "campaign_name"],
    },
    {
      chart_id: "GA4-30",
      name: "活動新客獲取 vs 老客回購",
      status: "needs_new_view",
      category: "ga4_cross_campaign",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_campaign_daily|erp_daily_sales" },
      chart_type: "stacked_bar",
      required_fields: ["campaign_name", "new_visitors", "returning_visitors", "new_customers", "repeat_customers"],
    },
    {
      chart_id: "GA4-31",
      name: "活動商品關注 vs 銷量",
      status: "ready",
      category: "ga4_cross_campaign",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_ecommerce|fact_order_details" },
      chart_type: "scatter",
      required_fields: ["item_name", "view_count", "sold_quantity"],
    },
    {
      chart_id: "GA4-32",
      name: "素材疲乏偵測",
      status: "ready",
      category: "ga4_cross_campaign",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_campaign_daily|erp_daily_sales" },
      chart_type: "time_series_line",
      dimensions: [{ field: "date", type: "DATE" }],
      required_fields: ["date", "campaign_name", "cvr"],
    },
    {
      chart_id: "GA4-33",
      name: "跨平台活動成效矩陣",
      status: "ready",
      category: "ga4_cross_campaign",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_campaign_daily|erp_daily_sales" },
      chart_type: "heatmap",
      required_fields: ["source", "campaign_name", "sessions", "cvr"],
    },
    {
      chart_id: "GA4-34",
      name: "活動 Landing Page 效率",
      status: "needs_new_view",
      category: "ga4_cross_campaign",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_campaign_daily|erp_daily_sales" },
      chart_type: "table",
      required_fields: ["landing_page", "campaign_name", "sessions", "cvr", "revenue_per_session"],
    },
    {
      chart_id: "GA4-35",
      name: "月度行銷效率儀表板",
      status: "ready",
      category: "ga4_cross_campaign",
      dashboard: "ga4_cross",
      source: { type: "QUERY", base: "ga4_daily_traffic|erp_daily_sales" },
      chart_type: "kpi_tiles_sparkline",
      required_fields: ["month", "sessions", "cvr", "engagement_rate", "revenue", "orders", "aov"],
    },
  ],
};

/**
 * 從圖表 metric 欄位推導顯示單位
 */
const CHART_UNIT_MAP: Record<string, string> = {
  "01": "元", "02": "元", "03": "元",
  "06": "元/筆", "13": "件", "14": "件",
  "19": "", "21": "人", "22": "", "23": "元", "24": "天",
  "30": "", "37": "%", "38": "元/件", "39": "筆",
  "42": "元", "44": "", "45": "次", "48": "%",
  "NEW-01": "元", "NEW-02": "件", "NEW-03": "%",
  "NEW-05": "筆", "NEW-06": "", "NEW-07": "元",
  "NEW-08": "人", "NEW-09": "人", "NEW-10": "元",
  "NEW-11": "人", "NEW-12": "%", "NEW-13": "人",
  "NEW-14": "人", "NEW-15": "%", "NEW-16": "%",
  "NEW-17": "元", "NEW-18": "元", "NEW-19": "件",
  "NEW-20": "元",
  "NEW-27": "筆", "NEW-28": "元/筆", "NEW-31": "人",
  "NEW-32": "元", "NEW-33": "件", "NEW-34": "人",
  // GA4 基礎監測
  "GA4-01": "%", "GA4-02": "人", "GA4-03": "次",
  "GA4-04": "次", "GA4-05": "%", "GA4-06": "",
  "GA4-07": "人", "GA4-08": "%", "GA4-09": "%",
  "GA4-10": "元", "GA4-11": "人", "GA4-12": "次", "GA4-13": "%",
  // GA4 交叉：趨勢與異常
  "GA4-14": "次/元", "GA4-15": "%", "GA4-16": "次",
  "GA4-17": "次/元", "GA4-18": "次", "GA4-19": "分", "GA4-20": "人",
  // GA4 交叉：通路 ROI
  "GA4-21": "", "GA4-22": "%", "GA4-23": "次/元",
  "GA4-24": "次/元", "GA4-25": "次/元", "GA4-26": "",
  "GA4-27": "人", "GA4-28": "",
  // GA4 交叉：活動動能
  "GA4-29": "元", "GA4-30": "人", "GA4-31": "次/個",
  "GA4-32": "%", "GA4-33": "次/%", "GA4-34": "", "GA4-35": "",
};

export function getChartUnit(chartId: string): string {
  const spec = getChartSpec(chartId);
  if (!spec) return "";
  if (spec.unit) return spec.unit;
  return CHART_UNIT_MAP[chartId] ?? "";
}

/**
 * 圖表說明（tooltip 用）— 資料來源、用途
 */
const CHART_DESC_MAP: Record<string, string> = {
  "01": "資料來源：view_order_customer (order_date, order_amount)\n用途：追蹤當期每日營收走勢，觀察銷售節奏",
  "02": "資料來源：ls_v_order_lines (brand_name, subtotal)\n用途：檢視指定期間各品牌銷售排行，找出主力品牌",
  "03": "資料來源：view_order_customer (order_date, order_amount)\n用途：累積營收曲線，評估月度目標達成進度",
  "05": "資料來源：view_order_customer (channel_name, order_date)\n用途：各通路每日營收趨勢，觀察通路消長",
  "06": "資料來源：view_order_customer (order_amount / 訂單數)\n用途：訂單平均單價 (AOV) 趨勢，衡量客戶消費力變化",
  "11": "資料來源：ls_v_order_lines (活動號碼, subtotal)\n用途：活動/促銷成效排行，評估行銷投資報酬",
  "13": "資料來源：ls_v_order_lines (order_date, quantity)\n用途：每日商品銷量趨勢，追蹤出貨量波動",
  "14": "資料來源：ls_v_order_lines (product_name, quantity)\n用途：熱銷商品排行 Top 20，掌握暢銷品項",
  "19": "資料來源：view_order_customer (RFM 計算)\n用途：RFM 客戶分群分布，識別高價值/流失客戶。全時段快照",
  "21": "資料來源：view_order_customer (首購月份)\n用途：客戶獲取同期群分析，觀察不同月份新客數",
  "22": "資料來源：view_order_customer (最後購買距今天數)\n用途：120 天以上未購買的沉睡客戶預警。全時段快照",
  "23": "資料來源：view_order_customer (配送地址, order_amount)\n用途：客戶地理分布熱圖，輔助區域行銷決策",
  "24": "資料來源：view_order_customer (回購間隔天數)\n用途：平均回購週期分布，了解客戶購買節奏。全時段快照",
  "25": "資料來源：view_order_customer (payment_method, channel_name)\n用途：各通路支付方式結構，優化金流配置",
  "28": "資料來源：view_order_customer (運費 / 訂單數)\n用途：每筆訂單平均物流成本，控制出貨費用",
  "37": "資料來源：ls_v_order_lines (brand_name, subtotal)\n用途：各品牌營收佔比，掌握品牌組合健康度",
  "38": "資料來源：ls_v_order_lines (brand_name, unit_price)\n用途：各品牌平均單價波動趨勢，監控定價策略",
  "39": "資料來源：ls_v_order_lines (brand, order_date 月份)\n用途：品牌 × 月份銷售熱圖，辨識季節性高峰",
  "42": "資料來源：ls_v_order_lines (product_series, order_date)\n用途：產品類別成長趨勢矩陣，找出成長/衰退品類",
  "44": "資料來源：ls_v_order_lines (unit_price vs quantity)\n用途：折扣與銷量相關性散點圖，優化定價策略",
  "45": "資料來源：ls_v_order_lines (同訂單不同商品)\n用途：商品合購關聯分析，輔助交叉銷售推薦",
  "48": "資料來源：view_order_customer (首購品牌)\n用途：首購品牌佔比分布，了解入門品牌吸引力。全時段快照",
  "52": "資料來源：view_order_customer (首購月份)\n用途：客戶生日月份（首購 proxy）銷售貢獻分布",
  "60": "資料來源：view_order_customer (通路轉移)\n用途：跨通路購買轉移矩陣，分析客戶通路遷移",
  "NEW-01": "資料來源：view_order_customer / ls_v_order_lines\n用途：80/20 Pareto 分析，找出關鍵少數客戶/商品",
  "NEW-02": "資料來源：ls_v_order_lines (每單品項數)\n用途：Basket size 分布，了解客戶購物籃深度",
  "NEW-03": "資料來源：view_order_customer (回購間隔)\n用途：30/60/90 天回購率趨勢，衡量客戶黏著度",
  "NEW-04": "資料來源：ls_v_order_lines (channel × brand)\n用途：通路 × 品牌交叉矩陣，找出通路品牌適配度",
  "NEW-05": "資料來源：view_order_customer (訂單狀態)\n用途：訂單狀態分佈（完成/取消/退貨），監控異常率",
  "NEW-06": "資料來源：view_order_customer (每日客戶數 vs 訂單數)\n用途：客戶數與訂單數相關性散點圖",
  "NEW-07": "資料來源：view_order_customer (order_amount 分布)\n用途：訂單金額分位數分布，了解消費結構",
  "NEW-08": "資料來源：view_order_customer (每日不重複客戶)\n用途：每日活躍客戶數趨勢，追蹤平台活躍度",
  "NEW-09": "資料來源：view_order_customer (首購日期)\n用途：每日新客數趨勢，衡量客戶獲取效率",
  "NEW-10": "資料來源：view_order_customer (新客 vs 回購客)\n用途：新客與回購客營收佔比，評估成長結構",
  "NEW-11": "資料來源：view_order_customer (購買頻次)\n用途：客戶購買頻次分布，識別忠誠客群",
  "NEW-12": "資料來源：ls_v_order_lines (跨品牌購買)\n用途：多品牌客比例，衡量品牌交叉滲透。全時段快照",
  "NEW-13": "資料來源：ls_v_order_lines (客戶品牌數)\n用途：客戶購買品牌數分布。全時段快照",
  "NEW-14": "資料來源：ls_v_order_lines (品牌交叉)\n用途：品牌交叉購買矩陣，分析品牌間關聯。全時段快照",
  "NEW-15": "資料來源：view_order_customer (發票欄位)\n用途：發票開立率，監控稅務合規",
  "NEW-16": "資料來源：view_order_customer (平台單標記)\n用途：平台單佔比（蝦皮/momo 等），追蹤平台依賴度",
  "NEW-17": "資料來源：view_order_customer (配送城市)\n用途：Top 城市營收排行，輔助區域策略",
  "NEW-18": "資料來源：view_order_customer (城市 × 月份)\n用途：城市營收月趨勢，追蹤區域成長",
  "NEW-19": "資料來源：view_order_customer (weekday/weekend)\n用途：週末 vs 平日營收/銷量對比",
  "NEW-20": "資料來源：view_order_customer (客戶月營收)\n用途：月度客戶營收分布，了解消費集中度",
  "NEW-21": "資料來源：view_order_customer (物流方式)\n用途：物流方式佔比，優化物流配置",
  "NEW-22": "資料來源：view_order_customer (運費收入)\n用途：運費收入趨勢，追蹤物流營收",
  "NEW-23": "資料來源：view_order_customer (含運實收 - 訂單實收)\n用途：運費差額分布，分析運費補貼情況",
  "NEW-24": "資料來源：view_order_customer (貨到付款標記)\n用途：COD（貨到付款）佔比，評估金流風險",
  "NEW-25": "資料來源：view_order_customer (希望配達時段)\n用途：配達時段分布，優化配送排程",
  "NEW-27": "資料來源：view_order_customer (channel, order_date)\n用途：各通路每日訂單數趨勢",
  "NEW-28": "資料來源：view_order_customer (channel, AOV)\n用途：各通路客單價比較，評估通路品質",
  "NEW-31": "資料來源：view_order_customer (channel, 新客)\n用途：各通路新客佔比，衡量通路拉新能力",
  "NEW-32": "資料來源：ls_v_order_lines (brand_name, subtotal)\n用途：Top 5 品牌按月營收折線圖，觀察品牌營收趨勢",
  "NEW-33": "資料來源：ls_v_order_lines (brand_name, quantity)\n用途：各品牌總銷量排行，掌握品牌出貨力",
  "NEW-34": "資料來源：view_customer_brand + dim_brand\n用途：各品牌不重複客戶數排行，衡量品牌客群廣度",
  // GA4 基礎監測
  "GA4-01": "資料來源：ga4_sessions (medium)\n用途：各流量來源 Session 佔比",
  "GA4-02": "資料來源：ga4_flat_events (ga_session_number)\n用途：每日新客 vs 回訪用戶數趨勢",
  "GA4-03": "資料來源：ga4_sessions\n用途：每日 Session 數量趨勢",
  "GA4-04": "資料來源：ga4_flat_events (page_view)\n用途：熱門頁面排行 Top 20",
  "GA4-05": "資料來源：ga4_flat_events (device.category)\n用途：裝置類型用戶佔比",
  "GA4-06": "資料來源：ga4_sessions (landing_page)\n用途：Landing Page 成效排行",
  "GA4-07": "資料來源：ga4_ecommerce\n用途：view_item → add_to_cart → checkout → purchase 漏斗",
  "GA4-08": "資料來源：ga4_ecommerce\n用途：每日購物車放棄率趨勢",
  "GA4-09": "資料來源：ga4_ecommerce\n用途：每日電商轉換率趨勢",
  "GA4-10": "資料來源：ga4_ecommerce (items)\n用途：GA4 側商品銷售排行",
  "GA4-11": "資料來源：ga4_flat_events\n用途：form_start → form_submit 表單轉換漏斗",
  "GA4-12": "資料來源：ga4_source_daily\n用途：Google Ads vs Facebook 付費流量直接比較",
  "GA4-13": "資料來源：ga4_ecommerce (customer_type)\n用途：新客 vs 回購客營收佔比",
  // GA4 交叉：趨勢與異常
  "GA4-14": "資料來源：ga4_daily_traffic + erp_daily_sales\n用途：流量-營收同步性（Date JOIN）",
  "GA4-15": "資料來源：ga4_daily_traffic + erp_daily_sales\n用途：Sessions↑ Revenue↓ 偏離警報",
  "GA4-16": "資料來源：ga4_flat_events + fact_orders\n用途：Hour × DOW 流量與訂單熱力圖",
  "GA4-17": "資料來源：ga4_daily_traffic + erp_daily_sales\n用途：週末 vs 平日轉換效率比較",
  "GA4-18": "資料來源：ga4_daily_traffic + erp_daily_sales\n用途：加購物車數 vs 實際成交數落差",
  "GA4-19": "資料來源：ga4_daily_traffic + erp_daily_sales\n用途：每日流量品質綜合評分 (0-100)",
  "GA4-20": "資料來源：ga4_daily_traffic + erp_daily_sales\n用途：新客流量 vs 新客訂單趨勢對比",
  // GA4 交叉：通路 ROI
  "GA4-21": "資料來源：ga4_source_daily + erp_daily_sales\n用途：廣告通路綜合成效表",
  "GA4-22": "資料來源：ga4_source_daily + erp_daily_sales\n用途：付費 vs 自然流量 ROI 趨勢",
  "GA4-23": "資料來源：ga4_source_daily + erp_daily_sales\n用途：Google CPC 流量轉營收效率",
  "GA4-24": "資料來源：ga4_source_daily + erp_daily_sales\n用途：Facebook 廣告流量轉營收效率",
  "GA4-25": "資料來源：ga4_source_daily + erp_daily_sales\n用途：LINE (Omnichat) 導購成效分析",
  "GA4-26": "資料來源：ga4_source_daily + erp_daily_sales\n用途：各通路流量品質排行",
  "GA4-27": "資料來源：ga4_source_daily + erp_daily_sales\n用途：各通路新客獲取效率比較",
  "GA4-28": "資料來源：ga4_source_daily + erp_daily_sales\n用途：Referral 流量商業價值評估",
  // GA4 交叉：活動動能
  "GA4-29": "資料來源：ga4_campaign_daily + erp_daily_sales\n用途：促銷活動營收拉動力分析",
  "GA4-30": "資料來源：ga4_campaign_daily + erp_daily_sales\n用途：活動帶來新客 vs 老客回購比例",
  "GA4-31": "資料來源：ga4_ecommerce + fact_order_details\n用途：商品瀏覽次數 vs 實際銷量散佈",
  "GA4-32": "資料來源：ga4_campaign_daily + erp_daily_sales\n用途：Campaign CVR 衰減偵測",
  "GA4-33": "資料來源：ga4_campaign_daily + erp_daily_sales\n用途：Source × Campaign 成效交叉矩陣",
  "GA4-34": "資料來源：ga4_campaign_daily + erp_daily_sales\n用途：活動 Landing Page 轉換效率排行",
  "GA4-35": "資料來源：ga4_daily_traffic + erp_daily_sales\n用途：月度行銷綜合效率 KPI 儀表板",
};

export function getChartDescription(chartId: string): string | undefined {
  return CHART_DESC_MAP[chartId];
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
    { id: "channel", name: "Channel" },
    { id: "customer", name: "Customer" },
    { id: "operations", name: "Operations" },
    { id: "cross_brand", name: "Cross-Brand" },
  ];
}

export function getGA4BasicCategories(): { id: ChartCategory; name: string }[] {
  return [
    { id: "ga4_traffic", name: "流量獲取" },
    { id: "ga4_engagement", name: "互動轉換" },
    { id: "ga4_conversion", name: "行為洞察" },
  ];
}

export function getGA4CrossCategories(): { id: ChartCategory; name: string }[] {
  return [
    { id: "ga4_cross_trend", name: "趨勢異常" },
    { id: "ga4_cross_roi", name: "通路 ROI" },
    { id: "ga4_cross_campaign", name: "活動動能" },
  ];
}

/** Unified GA4 categories (merged basic + cross) */
export function getGA4AllCategories(): { id: ChartCategory; name: string }[] {
  return [
    ...getGA4BasicCategories(),
    ...getGA4CrossCategories(),
  ];
}

export function listChartsByDashboard(dashboardId: DashboardId): ChartSpecV0[] {
  if (dashboardId === "ga4") {
    return CHART_SPEC.charts.filter((c) => c.dashboard === "ga4_basic" || c.dashboard === "ga4_cross");
  }
  return CHART_SPEC.charts.filter((c) => c.dashboard === dashboardId);
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
 * 不支援日期範圍篩選的圖表（快照型數據）
 */
const NO_DATE_FILTER_CHARTS = new Set([
  "02",      // 昨日銷售 Top 10 品牌 — 永遠取最新一天
  "19",      // RFM 客戶分群 — RFM 快照
  "22",      // 沉睡客戶預警 — RFM 快照
  "24",      // 平均回購週期 — 需全部歷史
  "48",      // 首購品牌佔比 — 快照
  "NEW-12",  // 多品牌客比例 — 快照
  "NEW-13",  // 客戶購買品牌數 — 快照
  "NEW-14",  // 品牌交叉購買 — 快照
]);

export function chartSupportsDateFilter(chartId: string): boolean {
  return !NO_DATE_FILTER_CHARTS.has(chartId);
}

/**
 * GA4 圖表中不支援品牌篩選的（跨品牌 JOIN，無法用單一 brand_code 篩選）
 */
const GA4_NO_BRAND_FILTER = new Set([
  "GA4-31", // 活動商品關注 vs 銷量 — 需跨品牌 JOIN ga4_ecommerce ↔ ERP
]);

/**
 * 判斷圖表是否支援品牌篩選
 * - cross_brand 圖表不支援（跨品牌分析）
 * - 明確標記 supportsBrandFilter: false 的不支援
 * - GA4-31 等特定圖表不支援
 */
export function chartSupportsBrandFilter(chartId: string): boolean {
  const spec = getChartSpec(chartId);
  if (!spec) return false;
  if (spec.supportsBrandFilter === false) return false;
  if (GA4_NO_BRAND_FILTER.has(chartId)) return false;
  return true;
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
