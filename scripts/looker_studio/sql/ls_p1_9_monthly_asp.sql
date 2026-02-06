SELECT
  DATE_TRUNC(order_date, MONTH) AS order_month,
  SAFE_DIVIDE(SUM(subtotal), NULLIF(SUM(quantity), 0)) AS asp
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
GROUP BY 1
ORDER BY 1;
