CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_u_bar_poc` AS
SELECT
  '02-昨日銷售Top10品牌' AS `分析主題`,
  COALESCE(brand_name, '未知品牌') AS `分析維度`,
  SUM(subtotal) AS `成效指標`
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
WHERE order_date = DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 1 DAY)
GROUP BY 1, 2

UNION ALL

SELECT
  '05-通路貢獻度排行' AS `分析主題`,
  '官網' AS `分析維度`, -- POC 模擬
  120.0 AS `成效指標`
