-- Brand ↔ GA4 Dataset Mapping Table
-- 品牌與 GA4 Property 對照表
CREATE OR REPLACE TABLE `b25h01-ragic.erp_backup.dim_brand_ga4_mapping` AS
SELECT * FROM UNNEST([
  STRUCT('GMK' AS brand_code, '菜市仔嬤' AS brand_name, 'analytics_256904630' AS ga4_dataset, 'grandmakuo.com.tw' AS website),
  STRUCT('HYA', 'HOYA', 'analytics_292905234', 'hoyavegan.com'),
  STRUCT('BDF', '寶島鮮', 'analytics_302926150', 'bdf.com.tw'),
  STRUCT('YAS', '有樹食', 'analytics_345730410', 'yasai.com.tw'),
  STRUCT('HHH', 'HH-Life', 'analytics_490276594', 'shop.hh-life.com.tw')
]);
