-- GA4 x ERP Cross Analysis Views (Core 14)
-- 交叉分析第一階段正式交付版本
-- 原則:
-- 1. 全部建立於 b25h01-ragic.erp_backup
-- 2. 只覆蓋縮減後 14 張核心圖表
-- 3. View 輸出語意化欄位名稱，直接給 Looker Studio 使用

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_traffic_sales_daily` AS
SELECT
  COALESCE(g.brand_code, e.brand_code) AS brand_code,
  COALESCE(bm.brand_name, COALESCE(g.brand_code, e.brand_code)) AS brand_name,
  COALESCE(g.date, e.date) AS date,
  COALESCE(g.sessions, 0) AS sessions,
  COALESCE(g.users, 0) AS users,
  COALESCE(g.new_users, 0) AS new_visitors,
  COALESCE(g.engaged_rate, 0) AS engaged_rate,
  COALESCE(g.avg_engagement_sec, 0) AS avg_engagement_sec,
  COALESCE(g.cvr, 0) AS cvr,
  COALESCE(e.revenue, 0) AS revenue,
  COALESCE(e.orders, 0) AS orders,
  COALESCE(e.customers, 0) AS customers,
  COALESCE(e.aov, 0) AS aov,
  COALESCE(e.new_customers, 0) AS new_customers,
  CASE WHEN EXTRACT(DAYOFWEEK FROM COALESCE(g.date, e.date)) IN (1, 7) THEN '週末' ELSE '平日' END AS day_type
FROM `b25h01-ragic.erp_backup.mat_ga4_daily_traffic` g
FULL OUTER JOIN `b25h01-ragic.erp_backup.erp_daily_sales` e
  ON g.brand_code = e.brand_code
 AND g.date = e.date
LEFT JOIN `b25h01-ragic.erp_backup.dim_brand_ga4_mapping` bm
  ON COALESCE(g.brand_code, e.brand_code) = bm.brand_code;

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_cart_vs_order_daily` AS
WITH ga4_cart AS (
  SELECT
    brand_code,
    event_date AS date,
    COUNT(DISTINCT CASE WHEN event_name = 'add_to_cart' THEN CONCAT(user_pseudo_id, ':', COALESCE(CAST(ga_session_id AS STRING), '')) END) AS add_to_cart_count,
    COUNTIF(event_name = 'begin_checkout') AS begin_checkout_count
  FROM `b25h01-ragic.erp_backup.mat_ga4_flat_events`
  GROUP BY brand_code, event_date
)
SELECT
  COALESCE(c.brand_code, e.brand_code) AS brand_code,
  COALESCE(bm.brand_name, COALESCE(c.brand_code, e.brand_code)) AS brand_name,
  COALESCE(c.date, e.date) AS date,
  COALESCE(c.add_to_cart_count, 0) AS add_to_cart_count,
  COALESCE(c.begin_checkout_count, 0) AS begin_checkout_count,
  COALESCE(e.orders, 0) AS order_count
FROM ga4_cart c
FULL OUTER JOIN `b25h01-ragic.erp_backup.erp_daily_sales` e
  ON c.brand_code = e.brand_code
 AND c.date = e.date
LEFT JOIN `b25h01-ragic.erp_backup.dim_brand_ga4_mapping` bm
  ON COALESCE(c.brand_code, e.brand_code) = bm.brand_code;

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_daily` AS
WITH source_base AS (
  SELECT
    g.brand_code,
    COALESCE(bm.brand_name, g.brand_code) AS brand_name,
    g.event_date AS date,
    g.source,
    g.medium,
    g.sessions,
    g.users,
    g.first_visit_count,
    g.engaged_rate,
    g.avg_engagement_sec,
    g.cvr,
    SUM(g.sessions) OVER (
      PARTITION BY g.brand_code, g.event_date
    ) AS brand_day_sessions
  FROM `b25h01-ragic.erp_backup.mat_ga4_source_daily` g
  LEFT JOIN `b25h01-ragic.erp_backup.dim_brand_ga4_mapping` bm
    ON g.brand_code = bm.brand_code
),
sales_base AS (
  SELECT
    brand_code,
    date,
    revenue,
    orders,
    aov
  FROM `b25h01-ragic.erp_backup.erp_daily_sales`
),
fallback_rows AS (
  SELECT
    e.brand_code,
    COALESCE(bm.brand_name, e.brand_code) AS brand_name,
    e.date,
    '(direct)' AS source,
    '(none)' AS medium,
    0 AS sessions,
    0 AS users,
    0 AS first_visit_count,
    0 AS engaged_rate,
    0 AS avg_engagement_sec,
    0 AS cvr,
    0 AS brand_day_sessions
  FROM sales_base e
  LEFT JOIN `b25h01-ragic.erp_backup.dim_brand_ga4_mapping` bm
    ON e.brand_code = bm.brand_code
  WHERE NOT EXISTS (
    SELECT 1
    FROM source_base s
    WHERE s.brand_code = e.brand_code
      AND s.date = e.date
      AND s.brand_day_sessions > 0
  )
)
SELECT * FROM (
  SELECT
    s.brand_code,
    s.brand_name,
    s.date,
    s.source,
    s.medium,
    s.sessions,
    s.users,
    s.first_visit_count,
    s.engaged_rate,
    s.avg_engagement_sec,
    s.cvr,
    CASE
      WHEN s.brand_day_sessions > 0 THEN COALESCE(e.revenue, 0) * SAFE_DIVIDE(s.sessions, s.brand_day_sessions)
      ELSE 0
    END AS revenue,
    CASE
      WHEN s.brand_day_sessions > 0 THEN COALESCE(e.orders, 0) * SAFE_DIVIDE(s.sessions, s.brand_day_sessions)
      ELSE 0
    END AS orders,
    CASE
      WHEN s.brand_day_sessions > 0 THEN COALESCE(e.aov, 0)
      ELSE 0
    END AS aov,
    SAFE_DIVIDE(
      CASE
        WHEN s.brand_day_sessions > 0 THEN COALESCE(e.revenue, 0) * SAFE_DIVIDE(s.sessions, s.brand_day_sessions)
        ELSE 0
      END,
      NULLIF(s.sessions, 0)
    ) AS revenue_per_session
  FROM source_base s
  LEFT JOIN sales_base e
    ON s.brand_code = e.brand_code
   AND s.date = e.date

  UNION ALL

  SELECT
    f.brand_code,
    f.brand_name,
    f.date,
    f.source,
    f.medium,
    f.sessions,
    f.users,
    f.first_visit_count,
    f.engaged_rate,
    f.avg_engagement_sec,
    f.cvr,
    COALESCE(e.revenue, 0) AS revenue,
    COALESCE(e.orders, 0) AS orders,
    COALESCE(e.aov, 0) AS aov,
    0 AS revenue_per_session
  FROM fallback_rows f
  LEFT JOIN sales_base e
    ON f.brand_code = e.brand_code
   AND f.date = e.date
);

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_summary` AS
SELECT
  brand_code,
  brand_name,
  source,
  medium,
  SUM(sessions) AS sessions,
  AVG(engaged_rate) AS engaged_rate,
  SAFE_DIVIDE(SUM(cvr * sessions), NULLIF(SUM(sessions), 0)) AS cvr,
  SUM(revenue) AS revenue,
  SUM(orders) AS orders,
  SAFE_DIVIDE(SUM(revenue), NULLIF(SUM(orders), 0)) AS aov,
  SAFE_DIVIDE(SUM(revenue), NULLIF(SUM(sessions), 0)) AS revenue_per_session
FROM `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_daily`
GROUP BY brand_code, brand_name, source, medium;

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_paid_organic_monthly` AS
WITH source_monthly AS (
  SELECT
    brand_code,
    FORMAT_DATE('%Y-%m-01', event_date) AS month_key,
    CASE
      WHEN LOWER(medium) IN ('cpc', 'paid', 'paidmedia') THEN 'paid'
      WHEN LOWER(medium) = 'organic' THEN 'organic'
      ELSE 'other'
    END AS traffic_group,
    SUM(sessions) AS sessions
  FROM `b25h01-ragic.erp_backup.mat_ga4_source_daily`
  GROUP BY brand_code, month_key, traffic_group
),
erp_monthly AS (
  SELECT
    brand_code,
    FORMAT_DATE('%Y-%m-01', date) AS month_key,
    SUM(revenue) AS revenue
  FROM `b25h01-ragic.erp_backup.erp_daily_sales`
  GROUP BY brand_code, month_key
)
SELECT
  s.brand_code,
  COALESCE(bm.brand_name, s.brand_code) AS brand_name,
  PARSE_DATE('%Y-%m-%d', s.month_key) AS month,
  SUM(CASE WHEN traffic_group = 'paid' THEN sessions ELSE 0 END) AS paid_sessions,
  SUM(CASE WHEN traffic_group = 'organic' THEN sessions ELSE 0 END) AS organic_sessions,
  COALESCE(MAX(e.revenue), 0) AS revenue
FROM source_monthly s
LEFT JOIN `b25h01-ragic.erp_backup.dim_brand_ga4_mapping` bm
  ON s.brand_code = bm.brand_code
LEFT JOIN erp_monthly e
  ON s.brand_code = e.brand_code
 AND s.month_key = e.month_key
GROUP BY s.brand_code, bm.brand_name, s.month_key;

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_campaign_sales_daily` AS
WITH campaign_base AS (
  SELECT
    g.brand_code,
    COALESCE(bm.brand_name, g.brand_code) AS brand_name,
    g.date,
    g.source,
    g.medium,
    g.campaign_name,
    g.sessions AS campaign_sessions,
    g.new_visitors,
    g.returning_visitors,
    g.engaged_rate,
    g.avg_engagement_sec,
    g.cvr,
    SUM(g.sessions) OVER (PARTITION BY g.brand_code, g.date) AS brand_day_campaign_sessions
  FROM `b25h01-ragic.erp_backup.mat_ga4_campaign_daily` g
  LEFT JOIN `b25h01-ragic.erp_backup.dim_brand_ga4_mapping` bm
    ON g.brand_code = bm.brand_code
)
SELECT
  c.brand_code,
  c.brand_name,
  c.date,
  c.source,
  c.medium,
  c.campaign_name,
  c.campaign_sessions,
  c.new_visitors,
  c.returning_visitors,
  c.engaged_rate,
  c.avg_engagement_sec,
  c.cvr,
  CASE
    WHEN c.brand_day_campaign_sessions > 0 THEN COALESCE(e.revenue, 0) * SAFE_DIVIDE(c.campaign_sessions, c.brand_day_campaign_sessions)
    ELSE 0
  END AS revenue,
  CASE
    WHEN c.brand_day_campaign_sessions > 0 THEN COALESCE(e.orders, 0) * SAFE_DIVIDE(c.campaign_sessions, c.brand_day_campaign_sessions)
    ELSE 0
  END AS orders
FROM campaign_base c
LEFT JOIN `b25h01-ragic.erp_backup.erp_daily_sales` e
  ON c.brand_code = e.brand_code
 AND c.date = e.date;

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_item_attention_vs_sales` AS
WITH item_views AS (
  SELECT
    brand_code,
    event_date AS date,
    item_name,
    COUNTIF(event_name = 'view_item') AS view_count
  FROM `b25h01-ragic.erp_backup.mat_ga4_ecommerce`
  WHERE item_name IS NOT NULL
  GROUP BY brand_code, event_date, item_name
),
item_sales AS (
  SELECT
    COALESCE(p.brand_code, SUBSTR(l.product_code, 4, 3)) AS brand_code,
    DATE(o.order_date) AS date,
    COALESCE(p.product_name, l.product_code) AS item_name,
    SUM(l.quantity) AS sold_quantity
  FROM `b25h01-ragic.erp_backup.fact_order_details` l
  JOIN `b25h01-ragic.erp_backup.view_order_customer` o
    ON l.order_code = o.order_code
  LEFT JOIN `b25h01-ragic.erp_backup.dim_product` p
    ON l.product_code = p.product_code
  WHERE o.order_date IS NOT NULL
  GROUP BY
    COALESCE(p.brand_code, SUBSTR(l.product_code, 4, 3)),
    DATE(o.order_date),
    COALESCE(p.product_name, l.product_code)
)
SELECT
  COALESCE(v.brand_code, s.brand_code) AS brand_code,
  COALESCE(bm.brand_name, COALESCE(v.brand_code, s.brand_code)) AS brand_name,
  COALESCE(v.date, s.date) AS date,
  COALESCE(v.item_name, s.item_name) AS item_name,
  COALESCE(v.view_count, 0) AS view_count,
  COALESCE(s.sold_quantity, 0) AS sold_quantity
FROM item_views v
FULL OUTER JOIN item_sales s
  ON v.brand_code = s.brand_code
 AND v.date = s.date
 AND v.item_name = s.item_name
LEFT JOIN `b25h01-ragic.erp_backup.dim_brand_ga4_mapping` bm
  ON COALESCE(v.brand_code, s.brand_code) = bm.brand_code;

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_marketing_efficiency_monthly` AS
SELECT
  brand_code,
  COALESCE(MAX(brand_name), brand_code) AS brand_name,
  DATE_TRUNC(date, MONTH) AS month,
  SUM(sessions) AS sessions,
  SAFE_DIVIDE(SUM(cvr * sessions), NULLIF(SUM(sessions), 0)) AS cvr,
  SAFE_DIVIDE(SUM(engaged_rate * sessions), NULLIF(SUM(sessions), 0)) AS engagement_rate,
  SUM(revenue) AS revenue,
  SUM(orders) AS orders,
  SAFE_DIVIDE(SUM(revenue), NULLIF(SUM(orders), 0)) AS aov
FROM `b25h01-ragic.erp_backup.vw_ls_ga4_traffic_sales_daily`
GROUP BY brand_code, DATE_TRUNC(date, MONTH);

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_23_google_ads_efficiency_daily` AS
SELECT
  brand_code,
  brand_name,
  date,
  source,
  medium,
  sessions,
  sessions AS google_cpc_sessions,
  revenue
FROM `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_daily`
WHERE LOWER(source) = 'google'
  AND LOWER(medium) = 'cpc';

CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.vw_ls_ga4_24_facebook_ads_efficiency_daily` AS
SELECT
  brand_code,
  COALESCE(MAX(brand_name), brand_code) AS brand_name,
  date,
  'facebook' AS source,
  SUM(sessions) AS sessions,
  SUM(sessions) AS fb_paid_sessions,
  SUM(CASE WHEN LOWER(medium) = 'paidmedia' THEN sessions ELSE 0 END) AS paidmedia_sessions,
  CASE
    WHEN SUM(CASE WHEN LOWER(medium) = 'paidmedia' THEN sessions ELSE 0 END) > 0 THEN 'paidmedia'
    ELSE 'paid'
  END AS paidmedia,
  STRING_AGG(DISTINCT LOWER(medium), ', ' ORDER BY LOWER(medium)) AS medium_values,
  SUM(revenue) AS revenue
FROM `b25h01-ragic.erp_backup.vw_ls_ga4_source_sales_daily`
WHERE LOWER(source) = 'facebook'
  AND LOWER(medium) IN ('paid', 'paidmedia')
GROUP BY brand_code, date;
