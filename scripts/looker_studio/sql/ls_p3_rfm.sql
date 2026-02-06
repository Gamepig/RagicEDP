-- RFM derived from fact_orders.
-- Note: Uses CURRENT_DATE() as the reference date for Recency.

WITH base AS (
  SELECT
    customer_code,
    MAX(order_date) AS last_order_date,
    MIN(order_date) AS first_order_date,
    COUNT(DISTINCT order_code) AS order_count,
    SUM(order_amount) AS total_revenue
  FROM `b25h01-ragic.erp_backup.fact_orders`
  WHERE customer_code IS NOT NULL
  GROUP BY 1
)
SELECT
  b.customer_code,
  c.customer_name,
  b.first_order_date,
  b.last_order_date,
  DATE_DIFF(CURRENT_DATE(), b.last_order_date, DAY) AS recency_days,
  b.order_count AS frequency,
  b.total_revenue AS monetary
FROM base b
LEFT JOIN `b25h01-ragic.erp_backup.dim_customer` c
  USING (customer_code)
;
