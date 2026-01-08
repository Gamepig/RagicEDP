-- Ragic ERP Backup System v2
-- BigQuery 表結構建立腳本
-- 建立日期: 2025-12-30

-- ============================================================
-- 1. 管理表：backup_status (備份狀態追蹤)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.backup_status` (
  sheet_code        STRING NOT NULL,      -- 表格代碼 (10, 20, 99...)
  sheet_name        STRING,               -- 表格名稱
  bq_table_name     STRING,               -- BQ 表名
  ragic_path        STRING,               -- Ragic API 路徑
  last_backup_time  TIMESTAMP,            -- 最後備份執行時間
  last_record_time  TIMESTAMP,            -- 最後一筆資料的修改時間
  total_records     INT64,                -- 該表總資料量
  last_fetch_count  INT64,                -- 上次抓取筆數
  status            STRING DEFAULT 'active',  -- 狀態
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 2. 管理表：backup_logs (備份日誌)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.backup_logs` (
  id                STRING NOT NULL,      -- UUID
  backup_date       DATE,                 -- 備份日期
  backup_time       TIMESTAMP,            -- 備份時間
  sheet_code        STRING NOT NULL,      -- 表格代碼
  sheet_name        STRING,               -- 表格名稱
  records_fetched   INT64 DEFAULT 0,      -- 從 API 抓取筆數
  records_inserted  INT64 DEFAULT 0,      -- 新增筆數
  records_updated   INT64 DEFAULT 0,      -- 更新筆數
  records_filtered  INT64 DEFAULT 0,      -- 過濾掉的筆數
  status            STRING,               -- success/failed/skipped
  error_message     STRING,               -- 錯誤訊息
  duration_seconds  FLOAT64,              -- 執行時間
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 3. 資料表：sheet_10_brand (品牌管理)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_10_brand` (
  ragic_id          STRING NOT NULL,      -- Ragic 記錄 ID (_ragicId)
  data              STRING,               -- JSON 格式的完整資料
  brand_code        STRING,               -- 品牌編號 (1000942)
  brand_name        STRING,               -- 品牌名稱
  status            STRING,               -- 使用狀態
  ragic_created     TIMESTAMP,            -- Ragic 建立時間
  ragic_modified    TIMESTAMP,            -- Ragic 修改時間
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 4. 資料表：sheet_20_channel (通路管理)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_20_channel` (
  ragic_id          STRING NOT NULL,
  data              STRING,
  channel_code      STRING,               -- 通路編號 (1000921)
  channel_name      STRING,               -- 通路名稱
  status            STRING,
  ragic_created     TIMESTAMP,
  ragic_modified    TIMESTAMP,
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 5. 資料表：sheet_30_payment (金流管理)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_30_payment` (
  ragic_id          STRING NOT NULL,
  data              STRING,
  payment_code      STRING,               -- 金流編號 (1000954)
  payment_name      STRING,               -- 金流名稱
  status            STRING,
  ragic_created     TIMESTAMP,
  ragic_modified    TIMESTAMP,
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 6. 資料表：sheet_40_logistics (物流管理)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_40_logistics` (
  ragic_id          STRING NOT NULL,
  data              STRING,
  logistics_code    STRING,               -- 物流編號 (1000736)
  logistics_name    STRING,               -- 物流名稱
  status            STRING,
  ragic_created     TIMESTAMP,
  ragic_modified    TIMESTAMP,
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 7. 資料表：sheet_41_zipcode (郵遞區號)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_41_zipcode` (
  ragic_id          STRING NOT NULL,
  data              STRING,
  zipcode           STRING,               -- 郵遞區號 (1000964)
  city              STRING,               -- 縣市
  district          STRING,               -- 區域
  status            STRING,
  ragic_created     TIMESTAMP,
  ragic_modified    TIMESTAMP,
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 8. 資料表：sheet_50_order (訂單管理)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_50_order` (
  ragic_id          STRING NOT NULL,
  data              STRING,
  order_code        STRING,               -- 訂單編號 (1000976)
  customer_code     STRING,               -- 客戶編號
  order_date        DATE,                 -- 訂單日期
  order_amount      FLOAT64,              -- 訂單金額
  status            STRING,
  ragic_created     TIMESTAMP,
  ragic_modified    TIMESTAMP,
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 9. 資料表：sheet_60_customer (客戶管理)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_60_customer` (
  ragic_id          STRING NOT NULL,
  data              STRING,
  customer_code     STRING,               -- 客戶編號 (1000710)
  customer_name     STRING,               -- 客戶名稱
  phone             STRING,               -- 電話
  email             STRING,               -- Email
  status            STRING,
  ragic_created     TIMESTAMP,
  ragic_modified    TIMESTAMP,
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 10. 資料表：sheet_70_product (商品管理)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_70_product` (
  ragic_id          STRING NOT NULL,
  data              STRING,
  product_code      STRING,               -- 商品編號 (1000998)
  product_name      STRING,               -- 商品名稱
  price             FLOAT64,              -- 單價
  status            STRING,
  ragic_created     TIMESTAMP,
  ragic_modified    TIMESTAMP,
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 11. 資料表：sheet_80_campaign (活動管理)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_80_campaign` (
  ragic_id          STRING NOT NULL,
  data              STRING,
  campaign_code     STRING,               -- 活動編號 (1001019)
  campaign_name     STRING,               -- 活動名稱
  start_date        DATE,                 -- 開始日期
  end_date          DATE,                 -- 結束日期
  status            STRING,
  ragic_created     TIMESTAMP,
  ragic_modified    TIMESTAMP,
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 12. 資料表：sheet_99_order_detail (訂單明細)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.sheet_99_order_detail` (
  ragic_id          STRING NOT NULL,
  data              STRING,
  order_code        STRING,               -- 訂單編號 (1000781)
  product_code      STRING,               -- 商品編號 (1000811)
  order_amount      FLOAT64,              -- 訂單實收 (1000785)
  quantity          INT64,                -- 數量
  unit_price        FLOAT64,              -- 單價
  status            STRING,
  ragic_created     TIMESTAMP,
  ragic_modified    TIMESTAMP,
  backup_time       TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
