-- Chart 04: 全通路 ROAS 總覽 (Omni-channel ROAS Overview)
-- Type: Gauge
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_04_omnichannel_roas_overview` AS
SELECT
  SUM(order_amount) AS total_revenue,
  10000 AS total_ad_spend, -- 暫定支出
  SAFE_DIVIDE(SUM(order_amount), 10000) AS roas
FROM `b25h01-ragic.erp_backup.fact_orders`;
