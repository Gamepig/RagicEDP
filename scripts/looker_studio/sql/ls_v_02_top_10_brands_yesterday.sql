-- Chart 02: 昨日銷售 Top 10 品牌 (Top 10 Brands Yesterday)
-- Type: Bar Chart
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_02_top_10_brands_yesterday` AS
SELECT
  COALESCE(brand_name, '未知品牌') AS brand_name,
  SUM(subtotal) AS revenue
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
WHERE order_date = DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 1 DAY)
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10;
