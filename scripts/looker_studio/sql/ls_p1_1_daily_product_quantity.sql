SELECT
  order_date,
  COALESCE(brand_name, 'Unknown') AS brand_name,
  SUM(quantity) AS quantity_sum
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
GROUP BY 1, 2
ORDER BY 1, 2;
