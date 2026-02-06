-- Chart 05: 通路貢獻度趨勢 (Channel Contribution Trend)
-- Type: Column Chart
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_05_channel_contribution_trend` AS
SELECT
  order_date,
  '官網' AS channel_name, -- 暫定模擬數據，待 Channel 欄位修復
  COUNT(DISTINCT order_code) AS order_count
FROM `b25h01-ragic.erp_backup.fact_orders`
GROUP BY 1, 2;
