-- Base view: order header + customer + common location fields from raw JSON.

SELECT
  o.order_code,
  o.order_date,
  o.customer_code,
  c.customer_name,
  o.order_amount,
  SAFE_CAST(JSON_VALUE(SAFE.PARSE_JSON(s.data), '$."郵遞區號"') AS STRING) AS postal_code,
  SAFE_CAST(JSON_VALUE(SAFE.PARSE_JSON(s.data), '$."縣市"') AS STRING) AS city,
  SAFE_CAST(JSON_VALUE(SAFE.PARSE_JSON(s.data), '$."鄉鎮市區"') AS STRING) AS district,
  SAFE_CAST(JSON_VALUE(SAFE.PARSE_JSON(s.data), '$."平台訂單號碼"') AS STRING) AS platform_order_no,
  SAFE_CAST(JSON_VALUE(SAFE.PARSE_JSON(s.data), '$."開立發票與否"') AS STRING) AS invoice_flag,
  o.ragic_created AS order_created_at
FROM `b25h01-ragic.erp_backup.fact_orders` o
LEFT JOIN `b25h01-ragic.erp_backup.dim_customer` c
  USING (customer_code)
LEFT JOIN `b25h01-ragic.erp_backup.sheet_50_order` s
  USING (order_code)
;
