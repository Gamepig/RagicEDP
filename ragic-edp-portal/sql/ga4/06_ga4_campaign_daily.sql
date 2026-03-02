-- GA4 Campaign Daily View (Multi-Brand)
-- Campaign × 日流量聚合，用於 GA4-29~35 交叉分析 Phase 3
-- brand_code 從 ga4_sessions 繼承
CREATE OR REPLACE VIEW `b25h01.ga4_analytics.ga4_campaign_daily` AS
SELECT
  brand_code,
  event_date AS date,
  source,
  medium,
  campaign AS campaign_name,
  COUNT(DISTINCT CONCAT(user_pseudo_id, CAST(ga_session_id AS STRING))) AS sessions,
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNTIF(ga_session_number = 1) AS new_visitors,
  COUNTIF(ga_session_number > 1) AS returning_visitors,
  SAFE_DIVIDE(COUNTIF(session_engaged = 1), COUNT(*)) AS engaged_rate,
  AVG(total_engagement_time_msec) / 1000 AS avg_engagement_sec,
  COUNTIF(purchase_count > 0) AS purchasers,
  SAFE_DIVIDE(COUNTIF(purchase_count > 0), COUNT(DISTINCT user_pseudo_id)) AS cvr
FROM `b25h01.ga4_analytics.ga4_sessions`
WHERE campaign IS NOT NULL AND campaign != '(not set)'
GROUP BY brand_code, event_date, source, medium, campaign;
