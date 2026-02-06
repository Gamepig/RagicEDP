SELECT
  COALESCE(product_series, 'Unknown') AS category,
  EXTRACT(DAYOFWEEK FROM order_date) AS day_of_week,
  COUNT(DISTINCT order_code) AS order_count,
  SUM(quantity) AS quantity_sum,
  SUM(subtotal) AS revenue_sum
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
GROUP BY 1, 2
ORDER BY 1, 2;
