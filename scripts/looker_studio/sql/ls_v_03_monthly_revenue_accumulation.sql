-- Chart 03: 月度營收累積曲線 (Monthly Revenue Accumulation)
-- Type: Area Chart
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_03_monthly_revenue_accumulation` AS
SELECT
  order_date,
  SUM(order_amount) OVER (PARTITION BY DATE_TRUNC(order_date, MONTH) ORDER BY order_date) AS cumulative_revenue
FROM `b25h01-ragic.erp_backup.fact_orders`
WHERE order_date >= DATE_TRUNC(CURRENT_DATE('Asia/Taipei'), MONTH);
