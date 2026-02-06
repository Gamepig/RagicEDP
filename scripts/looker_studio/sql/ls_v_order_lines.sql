-- Base view: order line joined with order header + customer + product + brand.
-- This is the primary source for most sales/product charts.

WITH product_ext AS (
  SELECT
    product_code,
    product_name,
    SAFE_CAST(JSON_VALUE(SAFE.PARSE_JSON(data), '$."品牌編號"') AS STRING) AS brand_code,
    SAFE_CAST(JSON_VALUE(SAFE.PARSE_JSON(data), '$."品牌名稱"') AS STRING) AS brand_name_raw,
    SAFE_CAST(JSON_VALUE(SAFE.PARSE_JSON(data), '$."商品系列"') AS STRING) AS product_series,
    SAFE_CAST(JSON_VALUE(SAFE.PARSE_JSON(data), '$."商品結構"') AS STRING) AS product_structure
  FROM `b25h01-ragic.erp_backup.sheet_70_product`
  WHERE is_filtered IS NOT TRUE
)
SELECT
  d.order_code,
  o.order_date,
  o.customer_code,
  c.customer_name,
  d.product_code,
  COALESCE(p.product_name, px.product_name) AS product_name,
  COALESCE(b.brand_code, px.brand_code) AS brand_code,
  COALESCE(b.brand_name, px.brand_name_raw) AS brand_name,
  px.product_series,
  px.product_structure,
  d.quantity,
  d.unit_price,
  d.subtotal,
  o.order_amount,
  d.ragic_created AS line_created_at,
  o.ragic_created AS order_created_at
FROM `b25h01-ragic.erp_backup.fact_order_details` d
LEFT JOIN `b25h01-ragic.erp_backup.fact_orders` o
  USING (order_code)
LEFT JOIN `b25h01-ragic.erp_backup.dim_customer` c
  USING (customer_code)
LEFT JOIN `b25h01-ragic.erp_backup.dim_product` p
  USING (product_code)
LEFT JOIN product_ext px
  USING (product_code)
LEFT JOIN `b25h01-ragic.erp_backup.dim_brand` b
  ON b.brand_code = px.brand_code
;
