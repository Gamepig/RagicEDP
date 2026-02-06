-- 01: 本月每日銷售趨勢
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_test_01_monthly_trend` AS
SELECT order_date AS date, SUM(order_amount) AS revenue 
FROM `b25h01-ragic.erp_backup.fact_orders`
WHERE order_date >= DATE_TRUNC(CURRENT_DATE('Asia/Taipei'), MONTH)
GROUP BY 1 ORDER BY 1;

-- 02: 品牌營收排名
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_test_02_brand_ranking` AS
SELECT COALESCE(brand_name, '未知品牌') AS brand, SUM(subtotal) AS revenue
FROM `b25h01-ragic.erp_backup.ls_v_order_lines`
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

-- 03: 通路訂單佔比
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_test_03_channel_share` AS
SELECT '官網' AS channel, COUNT(*) AS orders -- 暫時模擬通路
FROM `b25h01-ragic.erp_backup.fact_orders`
GROUP BY 1;
