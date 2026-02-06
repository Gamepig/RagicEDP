CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_u_kpi_poc` AS
SELECT
  '01-今日營收達成率' AS `分析主題`,
  SUM(order_amount) AS `成效指標`
FROM `b25h01-ragic.erp_backup.fact_orders`
WHERE order_date = CURRENT_DATE('Asia/Taipei')

UNION ALL

SELECT
  '06-訂單平均單價(AOV)' AS `分析主題`,
  SAFE_DIVIDE(SUM(order_amount), COUNT(DISTINCT order_code)) AS `成效指標`
FROM `b25h01-ragic.erp_backup.fact_orders`
