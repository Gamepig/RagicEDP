-- GA4 Flattened Events View (Multi-Brand)
-- 打平 event_params 的主要事件表，供所有 GA4 圖表使用
-- 5 個品牌 UNION ALL，加入 brand_code 識別
CREATE OR REPLACE VIEW `b25h01.ga4_analytics.ga4_flat_events` AS

WITH brand_events AS (
  SELECT 'GMK' AS brand_code, * FROM `b25h01.analytics_256904630.events_*`
  UNION ALL
  SELECT 'HYA' AS brand_code, * FROM `b25h01.analytics_292905234.events_*`
  UNION ALL
  SELECT 'BDF' AS brand_code, * FROM `b25h01.analytics_302926150.events_*`
  UNION ALL
  SELECT 'YAS' AS brand_code, * FROM `b25h01.analytics_345730410.events_*`
  UNION ALL
  SELECT 'HHH' AS brand_code, * FROM `b25h01.analytics_490276594.events_*`
)
SELECT
  brand_code,
  PARSE_DATE('%Y%m%d', event_date) AS event_date,
  event_timestamp,
  event_name,
  user_pseudo_id,
  stream_id,
  platform,
  device.category AS device_category,
  device.operating_system AS device_os,
  geo.country AS geo_country,
  geo.city AS geo_city,
  traffic_source.source AS traffic_source,
  traffic_source.medium AS traffic_medium,
  traffic_source.name AS traffic_campaign,
  collected_traffic_source.manual_campaign_name AS utm_campaign,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_number') AS ga_session_number,
  COALESCE(
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_engaged'),
    CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'session_engaged') AS STRING)
  ) AS session_engaged,
  COALESCE(
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec'),
    CAST((SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec') AS INT64),
    CAST((SELECT value.float_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec') AS INT64)
  ) AS engagement_time_msec,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_title') AS page_title,
  COALESCE(
    (SELECT value.double_value FROM UNNEST(event_params) WHERE key = 'value'),
    CAST((SELECT value.float_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64),
    CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'value') AS FLOAT64)
  ) AS event_value,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'currency') AS currency,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'customer_type') AS customer_type
FROM brand_events;
