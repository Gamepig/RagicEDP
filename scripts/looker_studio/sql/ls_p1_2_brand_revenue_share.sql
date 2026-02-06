SELECT
  COALESCE(brand_name, 'Unknown') AS brand_name,
  SUM(subtotal) AS revenue_sum
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
GROUP BY 1
ORDER BY revenue_sum DESC;
