-- GA4 Source Daily View (Multi-Brand)
-- 來源 × 日流量聚合，用於 GA4-21~28 交叉分析 Phase 2
-- brand_code 從 ga4_sessions 繼承
CREATE OR REPLACE VIEW `b25h01.ga4_analytics.ga4_source_daily` AS
SELECT
  brand_code,
  event_date AS date,
  source,
  medium,
  COUNT(DISTINCT CONCAT(user_pseudo_id, CAST(ga_session_id AS STRING))) AS sessions,
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNTIF(ga_session_number = 1) AS first_visit_count,
  SAFE_DIVIDE(COUNTIF(session_engaged = 1), COUNT(*)) AS engaged_rate,
  AVG(total_engagement_time_msec) / 1000 AS avg_engagement_sec,
  COUNTIF(purchase_count > 0) AS purchasers,
  SAFE_DIVIDE(COUNTIF(purchase_count > 0), COUNT(DISTINCT user_pseudo_id)) AS cvr
FROM `b25h01.ga4_analytics.ga4_sessions`
GROUP BY brand_code, event_date, source, medium;
