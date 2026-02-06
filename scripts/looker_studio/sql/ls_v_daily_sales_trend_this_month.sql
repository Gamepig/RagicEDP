CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_daily_sales_trend_this_month` AS
SELECT
  order_date AS order_date,
  order_date AS date,
  SUM(order_amount) AS revenue
FROM `b25h01-ragic.erp_backup.fact_orders`
WHERE order_date >= DATE_TRUNC(CURRENT_DATE('Asia/Taipei'), MONTH)
GROUP BY 1
ORDER BY 1;
