-- GA4 Sessions View (Multi-Brand)
-- Session 粒度彙總，用於 GA4-01~03, 06
-- brand_code 從 ga4_flat_events 繼承
CREATE OR REPLACE VIEW `b25h01.ga4_analytics.ga4_sessions` AS
SELECT
  brand_code,
  event_date,
  ga_session_id,
  user_pseudo_id,
  MIN(ga_session_number) AS ga_session_number,
  ANY_VALUE(traffic_source) AS source,
  ANY_VALUE(traffic_medium) AS medium,
  ANY_VALUE(utm_campaign) AS campaign,
  ANY_VALUE(device_category) AS device_category,
  MAX(CASE WHEN event_name = 'session_start' THEN page_location END) AS landing_page,
  MAX(CAST(session_engaged AS INT64)) AS session_engaged,
  SUM(engagement_time_msec) AS total_engagement_time_msec,
  COUNTIF(event_name = 'purchase') AS purchase_count,
  COUNT(*) AS event_count
FROM `b25h01.ga4_analytics.ga4_flat_events`
WHERE ga_session_id IS NOT NULL
GROUP BY brand_code, event_date, ga_session_id, user_pseudo_id;
