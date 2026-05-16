-- Ragic vs BQ 銷售總額比對（全品牌 + 各品牌）
-- 口徑：
--   Ragic：view_order_customer.order_amount_with_shipping, status='toggle-on'
--   BQ：erp_daily_sales.revenue

-- 1) 指定日期逐日逐品牌比對（請依需求修改日期）
WITH d AS (
  SELECT DATE '2026-02-23' AS date UNION ALL
  SELECT DATE '2026-02-24' UNION ALL
  SELECT DATE '2026-02-25' UNION ALL
  SELECT DATE '2026-03-31'
),
ragic AS (
  SELECT o.order_date AS date, COALESCE(ob.brand_code,'UNKNOWN') AS brand_code,
         SUM(o.order_amount_with_shipping) AS revenue
  FROM `b25h01-ragic.erp_backup.view_order_customer` o
  LEFT JOIN (
    SELECT order_code, ANY_VALUE(brand_code) AS brand_code
    FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
    WHERE brand_code IS NOT NULL
    GROUP BY order_code
  ) ob ON o.order_code=ob.order_code
  WHERE o.order_date IN (SELECT date FROM d)
    AND LOWER(o.status)='toggle-on'
  GROUP BY 1,2
),
bq AS (
  SELECT date, COALESCE(brand_code,'UNKNOWN') AS brand_code, SUM(revenue) AS revenue
  FROM `b25h01-ragic.erp_backup.erp_daily_sales`
  WHERE date IN (SELECT date FROM d)
  GROUP BY 1,2
),
base AS (
  SELECT k.date, k.brand_code,
         COALESCE(r.revenue,0) AS ragic_revenue,
         COALESCE(b.revenue,0) AS bq_revenue
  FROM (
    SELECT date, brand_code FROM ragic
    UNION DISTINCT
    SELECT date, brand_code FROM bq
  ) k
  LEFT JOIN ragic r USING(date, brand_code)
  LEFT JOIN bq b USING(date, brand_code)
)
SELECT
  CAST(date AS STRING) AS date,
  brand_code,
  ROUND(ragic_revenue,2) AS ragic_revenue,
  ROUND(bq_revenue,2) AS bq_revenue,
  ROUND(ragic_revenue-bq_revenue,2) AS diff,
  ROUND(SAFE_DIVIDE(ragic_revenue-bq_revenue,NULLIF(ragic_revenue,0))*100,4) AS diff_pct
FROM base
UNION ALL
SELECT
  CAST(date AS STRING) AS date,
  'ALL_BRANDS' AS brand_code,
  ROUND(SUM(ragic_revenue),2),
  ROUND(SUM(bq_revenue),2),
  ROUND(SUM(ragic_revenue)-SUM(bq_revenue),2),
  ROUND(SAFE_DIVIDE(SUM(ragic_revenue)-SUM(bq_revenue),NULLIF(SUM(ragic_revenue),0))*100,4)
FROM base
GROUP BY date
ORDER BY date, brand_code;

-- 2) 區間彙總（2/23~2/25）逐品牌 + 全品牌
WITH d AS (
  SELECT DATE '2026-02-23' AS date UNION ALL
  SELECT DATE '2026-02-24' UNION ALL
  SELECT DATE '2026-02-25'
),
ragic AS (
  SELECT COALESCE(ob.brand_code,'UNKNOWN') AS brand_code,
         SUM(o.order_amount_with_shipping) AS revenue
  FROM `b25h01-ragic.erp_backup.view_order_customer` o
  LEFT JOIN (
    SELECT order_code, ANY_VALUE(brand_code) AS brand_code
    FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
    WHERE brand_code IS NOT NULL
    GROUP BY order_code
  ) ob ON o.order_code=ob.order_code
  WHERE o.order_date IN (SELECT date FROM d)
    AND LOWER(o.status)='toggle-on'
  GROUP BY 1
),
bq AS (
  SELECT COALESCE(brand_code,'UNKNOWN') AS brand_code,
         SUM(revenue) AS revenue
  FROM `b25h01-ragic.erp_backup.erp_daily_sales`
  WHERE date IN (SELECT date FROM d)
  GROUP BY 1
)
SELECT
  brand_code,
  ROUND(COALESCE(r.revenue,0),2) AS ragic_revenue,
  ROUND(COALESCE(b.revenue,0),2) AS bq_revenue,
  ROUND(COALESCE(r.revenue,0)-COALESCE(b.revenue,0),2) AS diff,
  ROUND(SAFE_DIVIDE(COALESCE(r.revenue,0)-COALESCE(b.revenue,0),NULLIF(COALESCE(r.revenue,0),0))*100,4) AS diff_pct
FROM (
  SELECT brand_code FROM ragic
  UNION DISTINCT SELECT brand_code FROM bq
) k
LEFT JOIN ragic r USING(brand_code)
LEFT JOIN bq b USING(brand_code)
UNION ALL
SELECT
  'ALL_BRANDS',
  ROUND((SELECT SUM(revenue) FROM ragic),2),
  ROUND((SELECT SUM(revenue) FROM bq),2),
  ROUND((SELECT SUM(revenue) FROM ragic)-(SELECT SUM(revenue) FROM bq),2),
  ROUND(SAFE_DIVIDE((SELECT SUM(revenue) FROM ragic)-(SELECT SUM(revenue) FROM bq),NULLIF((SELECT SUM(revenue) FROM ragic),0))*100,4)
ORDER BY brand_code;
