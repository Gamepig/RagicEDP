SELECT
  product_code,
  COALESCE(product_name, product_code) AS product_name,
  SUM(quantity) AS quantity_sum
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
GROUP BY 1, 2
ORDER BY quantity_sum DESC
LIMIT 20;
