-- GA4 Ecommerce View (Multi-Brand)
-- 電商事件 + items 打平，用於 GA4-07~10, 13
-- 5 個品牌 UNION ALL，加入 brand_code 識別
CREATE OR REPLACE VIEW `b25h01.ga4_analytics.ga4_ecommerce` AS

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
  PARSE_DATE('%Y%m%d', e.event_date) AS event_date,
  e.event_name,
  e.user_pseudo_id,
  (SELECT value.string_value FROM UNNEST(e.event_params) WHERE key = 'transaction_id') AS transaction_id,
  COALESCE(
    (SELECT value.double_value FROM UNNEST(e.event_params) WHERE key = 'value'),
    CAST((SELECT value.float_value FROM UNNEST(e.event_params) WHERE key = 'value') AS FLOAT64),
    CAST((SELECT value.int_value FROM UNNEST(e.event_params) WHERE key = 'value') AS FLOAT64)
  ) AS event_value,
  (SELECT value.string_value FROM UNNEST(e.event_params) WHERE key = 'currency') AS currency,
  (SELECT value.string_value FROM UNNEST(e.event_params) WHERE key = 'customer_type') AS customer_type,
  item.item_id,
  item.item_name,
  item.item_brand,
  item.item_category,
  item.price AS item_price,
  item.quantity AS item_quantity,
  (item.price * item.quantity) AS item_revenue
FROM brand_events e,
UNNEST(e.items) AS item
WHERE e.event_name IN ('view_item', 'add_to_cart', 'begin_checkout', 'purchase');
