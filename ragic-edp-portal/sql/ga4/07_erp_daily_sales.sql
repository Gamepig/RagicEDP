-- ERP Daily Sales View (Multi-Brand)
-- ERP 每日銷售聚合，用於所有交叉分析
-- 從 fact_orders JOIN ls_v_order_lines 取 brand_code
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.erp_daily_sales` AS
WITH order_brand AS (
  SELECT order_code, ANY_VALUE(brand_code) AS brand_code
  FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
  WHERE brand_code IS NOT NULL
  GROUP BY order_code
),
first_buy AS (
  SELECT
    customer_code,
    MIN(order_date) AS first_order_date
  FROM `b25h01-ragic.erp_backup.fact_orders`
  WHERE customer_code IS NOT NULL
    AND order_date IS NOT NULL
  GROUP BY customer_code
)
SELECT
  ob.brand_code,
  o.order_date AS date,
  SUM(o.order_amount) AS revenue,
  COUNT(DISTINCT o.order_code) AS orders,
  COUNT(DISTINCT o.customer_code) AS customers,
  SAFE_DIVIDE(SUM(o.order_amount), COUNT(DISTINCT o.order_code)) AS aov,
  COUNT(DISTINCT CASE WHEN fb.first_order_date = o.order_date THEN o.customer_code END) AS new_customers
FROM `b25h01-ragic.erp_backup.fact_orders` o
LEFT JOIN order_brand ob ON o.order_code = ob.order_code
LEFT JOIN first_buy fb ON o.customer_code = fb.customer_code
WHERE o.order_date IS NOT NULL
GROUP BY ob.brand_code, o.order_date;
