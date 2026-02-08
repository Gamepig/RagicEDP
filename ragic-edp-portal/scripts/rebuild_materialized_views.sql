-- ============================================================
-- 重建失效的 Materialized Views
-- 原因: 源表 sheet_99_order_detail / sheet_50_order 被刪除後重建，
--       導致引用它們的 MV 失效
-- 執行方式: 在 BigQuery Console 或 bq CLI 逐段執行
-- 日期: 2026-02-08
-- ============================================================

-- 1. 刪除失效的 MV
DROP MATERIALIZED VIEW IF EXISTS `b25h01-ragic.erp_backup.mv_brand_sales`;
DROP MATERIALIZED VIEW IF EXISTS `b25h01-ragic.erp_backup.mv_customer_rfm`;
DROP MATERIALIZED VIEW IF EXISTS `b25h01-ragic.erp_backup.mv_data_quality_stats`;

-- 2. 重建 mv_brand_sales (品牌銷售統計)
CREATE MATERIALIZED VIEW `b25h01-ragic.erp_backup.mv_brand_sales`
OPTIONS (description = '品牌銷售統計 Materialized View')
AS
SELECT
  JSON_VALUE(d.data, '$.品牌編號') AS brand_code,
  DATE_TRUNC(SAFE.PARSE_DATE('%Y/%m/%d', JSON_VALUE(d.data, '$.訂單成立日期')), MONTH) AS month,
  SUM(SAFE_CAST(JSON_VALUE(d.data, '$.商品常態售價小計') AS FLOAT64)) AS revenue,
  SUM(SAFE_CAST(JSON_VALUE(d.data, '$.數量') AS INT64)) AS units_sold,
  APPROX_COUNT_DISTINCT(JSON_VALUE(d.data, '$.客戶編號')) AS unique_customers,
  COUNT(*) AS order_count
FROM `b25h01-ragic.erp_backup.sheet_99_order_detail` d
WHERE JSON_VALUE(d.data, '$.品牌編號') IS NOT NULL
  AND JSON_VALUE(d.data, '$.訂單成立日期') IS NOT NULL
GROUP BY 1, 2;

-- 3. 重建 mv_customer_rfm (客戶 RFM 分析)
CREATE MATERIALIZED VIEW `b25h01-ragic.erp_backup.mv_customer_rfm`
OPTIONS (description = '客戶 RFM 分析 Materialized View')
AS
SELECT
  JSON_VALUE(data, '$.客戶編號') AS customer_code,
  MAX(SAFE.PARSE_DATE('%Y/%m/%d', JSON_VALUE(data, '$.訂單成立日期'))) AS last_order_date,
  APPROX_COUNT_DISTINCT(JSON_VALUE(data, '$.訂單編號')) AS frequency,
  SUM(SAFE_CAST(JSON_VALUE(data, '$.商品常態售價小計') AS FLOAT64)) AS monetary,
  AVG(SAFE_CAST(JSON_VALUE(data, '$.商品常態售價小計') AS FLOAT64)) AS avg_item_value,
  MIN(SAFE.PARSE_DATE('%Y/%m/%d', JSON_VALUE(data, '$.訂單成立日期'))) AS first_order_date
FROM `b25h01-ragic.erp_backup.sheet_99_order_detail`
WHERE JSON_VALUE(data, '$.客戶編號') IS NOT NULL
GROUP BY JSON_VALUE(data, '$.客戶編號');

-- 4. 重建 mv_data_quality_stats (資料品質統計)
CREATE MATERIALIZED VIEW `b25h01-ragic.erp_backup.mv_data_quality_stats`
OPTIONS (description = '資料品質統計 Materialized View')
AS
SELECT
  DATE(backup_time) AS backup_date,
  COUNT(*) AS total_records,
  COUNTIF(order_code IS NULL) AS null_order_code,
  COUNTIF(customer_code IS NULL) AS null_customer_code,
  COUNTIF(order_amount IS NULL) AS null_order_amount,
  COUNTIF(order_amount < 0) AS negative_order_amount
FROM `b25h01-ragic.erp_backup.sheet_50_order`
GROUP BY 1;
