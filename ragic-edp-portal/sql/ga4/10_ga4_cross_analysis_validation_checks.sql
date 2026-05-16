-- GA4 x ERP Cross Analysis 驗收抽查 SQL（核心 14 圖）
-- 執行方式：
-- bq query --use_legacy_sql=false < ragic-edp-portal/sql/ga4/10_ga4_cross_analysis_validation_checks.sql

DECLARE brand_filter STRING DEFAULT NULL; -- 例如 'B01'；NULL 代表全部品牌
DECLARE start_date DATE DEFAULT DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);
DECLARE end_date DATE DEFAULT CURRENT_DATE();

-- 1) View 存在性與最後更新時間
SELECT
  table_name AS view_name,
  creation_time,
  table_type
FROM `b25h01-ragic.erp_backup.INFORMATION_SCHEMA.TABLES`
WHERE table_name IN (
  'vw_ls_ga4_traffic_sales_daily',
  'vw_ls_ga4_cart_vs_order_daily',
  'vw_ls_ga4_source_sales_daily',
  'vw_ls_ga4_source_sales_summary',
  'vw_ls_ga4_paid_organic_monthly',
  'vw_ls_ga4_campaign_sales_daily',
  'vw_ls_ga4_item_attention_vs_sales',
  'vw_ls_ga4_marketing_efficiency_monthly'
)
ORDER BY table_name;

-- 2) 欄位契約抽查（關鍵欄位）
SELECT table_name, column_name
FROM `b25h01-ragic.erp_backup.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name IN (
  'vw_ls_ga4_traffic_sales_daily',
  'vw_ls_ga4_cart_vs_order_daily',
  'vw_ls_ga4_source_sales_daily',
  'vw_ls_ga4_source_sales_summary',
  'vw_ls_ga4_paid_organic_monthly',
  'vw_ls_ga4_campaign_sales_daily',
  'vw_ls_ga4_item_attention_vs_sales',
  'vw_ls_ga4_marketing_efficiency_monthly'
)
ORDER BY table_name, ordinal_position;

-- 3) 逐圖資料可用性抽查（最近 30 天）
WITH
q14 AS (
  SELECT 'GA4-14' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_traffic_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q17 AS (
  SELECT 'GA4-17' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_traffic_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND day_type IN ('平日','週末')
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q18 AS (
  SELECT 'GA4-18' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_cart_vs_order_daily`
  WHERE date BETWEEN start_date AND end_date
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q20 AS (
  SELECT 'GA4-20' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_traffic_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q21 AS (
  SELECT 'GA4-21' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_summary`
  WHERE (brand_filter IS NULL OR brand_code = brand_filter)
),
q22 AS (
  SELECT 'GA4-22' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_paid_organic_monthly`
  WHERE month BETWEEN DATE_TRUNC(start_date, MONTH) AND DATE_TRUNC(end_date, MONTH)
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q23 AS (
  SELECT 'GA4-23' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND source = 'google' AND medium = 'cpc'
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q24 AS (
  SELECT 'GA4-24' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND source = 'facebook' AND medium IN ('paid','paidmedia')
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q26 AS (
  SELECT 'GA4-26' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q29 AS (
  SELECT 'GA4-29' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_campaign_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q31 AS (
  SELECT 'GA4-31' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_item_attention_vs_sales`
  WHERE date BETWEEN start_date AND end_date
),
q32 AS (
  SELECT 'GA4-32' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_campaign_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q33 AS (
  SELECT 'GA4-33' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_campaign_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND (brand_filter IS NULL OR brand_code = brand_filter)
),
q35 AS (
  SELECT 'GA4-35' AS chart_id, COUNT(*) AS row_cnt
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_marketing_efficiency_monthly`
  WHERE month BETWEEN DATE_TRUNC(start_date, MONTH) AND DATE_TRUNC(end_date, MONTH)
    AND (brand_filter IS NULL OR brand_code = brand_filter)
)
SELECT chart_id, row_cnt, IF(row_cnt > 0, 'PASS', 'FAIL') AS availability
FROM (
  SELECT * FROM q14 UNION ALL SELECT * FROM q17 UNION ALL SELECT * FROM q18 UNION ALL
  SELECT * FROM q20 UNION ALL SELECT * FROM q21 UNION ALL SELECT * FROM q22 UNION ALL
  SELECT * FROM q23 UNION ALL SELECT * FROM q24 UNION ALL SELECT * FROM q26 UNION ALL
  SELECT * FROM q29 UNION ALL SELECT * FROM q31 UNION ALL SELECT * FROM q32 UNION ALL
  SELECT * FROM q33 UNION ALL SELECT * FROM q35
)
ORDER BY chart_id;

-- 4) 核心數值合理性（簡易）
SELECT
  'vw_ls_ga4_traffic_sales_daily' AS view_name,
  COUNTIF(sessions < 0) AS bad_sessions,
  COUNTIF(revenue < 0) AS bad_revenue,
  COUNTIF(cvr < 0 OR cvr > 1) AS bad_cvr,
  COUNTIF(engaged_rate < 0 OR engaged_rate > 1) AS bad_engaged_rate
FROM `b25h01-ragic.erp_backup.vw_ls_ga4_traffic_sales_daily`
WHERE date BETWEEN start_date AND end_date
  AND (brand_filter IS NULL OR brand_code = brand_filter);

-- 5) 通路歸因營收加總合理性
WITH source_daily_sum AS (
  SELECT
    brand_code,
    date,
    ROUND(SUM(revenue), 2) AS attributed_revenue
  FROM `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_daily`
  WHERE date BETWEEN start_date AND end_date
    AND (brand_filter IS NULL OR brand_code = brand_filter)
  GROUP BY brand_code, date
),
erp_daily_sum AS (
  SELECT
    brand_code,
    date,
    ROUND(SUM(revenue), 2) AS total_revenue
  FROM `b25h01-ragic.erp_backup.erp_daily_sales`
  WHERE date BETWEEN start_date AND end_date
    AND (brand_filter IS NULL OR brand_code = brand_filter)
  GROUP BY brand_code, date
)
SELECT
  COUNTIF(ABS(COALESCE(s.attributed_revenue, 0) - COALESCE(e.total_revenue, 0)) > 0.01) AS bad_brand_day_revenue,
  COUNT(*) AS checked_brand_days
FROM source_daily_sum s
FULL OUTER JOIN erp_daily_sum e
  USING (brand_code, date);
