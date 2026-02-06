CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_u_pie_poc` AS
SELECT
  '25-支付方式佔比' AS `分析主題`,
  '信用卡' AS `分析維度`,
  50.0 AS `成效指標`
UNION ALL
SELECT
  '25-支付方式佔比' AS `分析主題`,
  'ATM轉帳' AS `分析維度`,
  30.0 AS `成效指標`

UNION ALL

SELECT
  '37-品牌營收貢獻佔比' AS `分析主題`,
  COALESCE(brand_name, '其他') AS `分析維度`,
  SUM(subtotal) AS `成效指標`
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
GROUP BY 1, 2
