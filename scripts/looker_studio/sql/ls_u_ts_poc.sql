CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_u_ts_poc` AS
SELECT
  '03-月度營收累積' AS `分析主題`,
  order_date AS `時間維度`,
  SUM(subtotal) OVER (ORDER BY order_date) AS `成效指標`
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`

UNION ALL

SELECT
  '13-每日商品銷量趨勢' AS `分析主題`,
  order_date AS `時間維度`,
  SUM(quantity) AS `成效指標`
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
GROUP BY 1, 2
