-- =============================================================================
-- Schema 變更腳本：新增過濾相關欄位
-- =============================================================================
-- 日期：2026-01-17
-- 目的：為所有 sheet 表新增 is_filtered, filter_reason, cleaning_batch_id 欄位
-- 執行方式：bq query --use_legacy_sql=false < add_filter_columns.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- sheet_10_brand (品牌表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_10_brand`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- -----------------------------------------------------------------------------
-- sheet_20_channel (通路表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_20_channel`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- -----------------------------------------------------------------------------
-- sheet_30_payment (金流表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_30_payment`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- -----------------------------------------------------------------------------
-- sheet_40_logistics (物流表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_40_logistics`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- -----------------------------------------------------------------------------
-- sheet_41_zipcode (郵遞區號表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_41_zipcode`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- -----------------------------------------------------------------------------
-- sheet_50_order (訂單表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_50_order`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- -----------------------------------------------------------------------------
-- sheet_60_customer (客戶表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_60_customer`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- -----------------------------------------------------------------------------
-- sheet_70_product (商品表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_70_product`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- -----------------------------------------------------------------------------
-- sheet_80_campaign (活動管理表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_80_campaign`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- -----------------------------------------------------------------------------
-- sheet_99_order_detail (訂單明細表)
-- -----------------------------------------------------------------------------
ALTER TABLE `b25h01-ragic.erp_backup.sheet_99_order_detail`
ADD COLUMN IF NOT EXISTS is_filtered BOOL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS filter_reason STRING,
ADD COLUMN IF NOT EXISTS cleaning_batch_id STRING;

-- =============================================================================
-- 驗證查詢（執行後確認欄位已新增）
-- =============================================================================
-- SELECT table_name, column_name, data_type
-- FROM `b25h01-ragic.erp_backup.INFORMATION_SCHEMA.COLUMNS`
-- WHERE column_name IN ('is_filtered', 'filter_reason', 'cleaning_batch_id')
-- ORDER BY table_name, column_name;
