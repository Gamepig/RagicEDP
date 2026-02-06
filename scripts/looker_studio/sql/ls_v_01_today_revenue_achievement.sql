-- Chart 01: 今日營收達成率 (Today's Revenue Achievement)
-- Type: KPI Tile
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_01_today_revenue_achievement` AS
WITH daily_stats AS (
  SELECT
    SUM(order_amount) AS actual_revenue
  FROM `b25h01-ragic.erp_backup.fact_orders`
  WHERE order_date = CURRENT_DATE('Asia/Taipei')
)
SELECT
  actual_revenue,
  50000 AS target_revenue, -- 暫定預算
  SAFE_DIVIDE(actual_revenue, 50000) AS achievement_rate
FROM daily_stats;
