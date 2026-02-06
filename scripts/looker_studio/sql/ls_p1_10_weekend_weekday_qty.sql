SELECT
  CASE
    WHEN EXTRACT(DAYOFWEEK FROM order_date) IN (1, 7) THEN 'Weekend'
    ELSE 'Weekday'
  END AS day_type,
  SUM(quantity) AS quantity_sum,
  SUM(subtotal) AS revenue_sum
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
GROUP BY 1
ORDER BY 1;
