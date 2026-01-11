-- ============================================================
-- RagicEDP 資料清洗系統 - BigQuery DDL
-- Version: 1.0.0
-- Date: 2026-01-08
-- ============================================================

-- 設定變數（請依實際環境修改）
-- project_id: b25h01-ragic
-- dataset: erp_backup

-- ============================================================
-- 1. 清洗結果表 (cleaning_results)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.cleaning_results` (
    -- 主鍵
    record_id STRING NOT NULL,              -- 原始記錄 ID (_ragicId)
    table_code STRING NOT NULL,             -- 表格代碼

    -- 清洗狀態
    status STRING NOT NULL,                 -- pending, processing, auto_fixed, ai_fixed, manual, completed, failed
    original_values STRING,                 -- JSON 格式的原始值
    fixed_values STRING,                    -- JSON 格式的修正後值

    -- 違規統計
    violation_count INT64 DEFAULT 0,        -- 違規數量

    -- AI 相關
    ai_suggestion STRING,                   -- AI 修正建議
    confidence_score FLOAT64,               -- 信心度 (0-1)

    -- 清洗資訊
    cleaned_at TIMESTAMP NOT NULL,          -- 清洗時間
    cleaned_by STRING NOT NULL,             -- 清洗者 (system/ai/user)
    cleaning_version STRING,                -- 清洗版本

    -- 元資料
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
)
PARTITION BY DATE(cleaned_at)
CLUSTER BY table_code, status
OPTIONS(
    description = '資料清洗結果表，記錄每筆資料的清洗結果'
);


-- ============================================================
-- 2. 清洗異常記錄表 (cleaning_anomalies)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.cleaning_anomalies` (
    -- 關聯
    record_id STRING NOT NULL,              -- 原始記錄 ID (_ragicId)
    table_code STRING NOT NULL,             -- 表格代碼

    -- 違規詳情
    violations STRING,                      -- JSON 格式的違規列表
    rule_hits STRING,                       -- JSON 格式的命中規則列表

    -- 狀態
    status STRING NOT NULL,                 -- pending, auto_fixed, ai_fixed, manual, resolved

    -- 時間戳
    detected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,

    -- 元資料
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
PARTITION BY DATE(detected_at)
CLUSTER BY table_code, status
OPTIONS(
    description = '資料清洗異常記錄表，記錄發現的資料品質問題'
);


-- ============================================================
-- 3. 修正歷史表 (cleaning_history)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.cleaning_history` (
    -- 歷史 ID
    history_id STRING NOT NULL,             -- UUID

    -- 關聯
    record_id STRING NOT NULL,              -- 原始記錄 ID
    table_code STRING NOT NULL,             -- 表格代碼

    -- 修正內容
    action STRING NOT NULL,                 -- 動作類型
    original_values STRING,                 -- JSON 格式的修正前值
    fixed_values STRING,                    -- JSON 格式的修正後值
    rule_hits STRING,                       -- JSON 格式的命中規則

    -- 修正資訊
    cleaned_by STRING NOT NULL,             -- 修正者
    cleaning_version STRING,                -- 清洗版本

    -- 時間戳
    cleaned_at TIMESTAMP NOT NULL,

    -- 元資料
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
PARTITION BY DATE(cleaned_at)
CLUSTER BY table_code, record_id
OPTIONS(
    description = '資料修正歷史表，完整記錄所有修正操作'
);


-- ============================================================
-- 4. 清洗問題明細表 (cleaning_issues)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.cleaning_issues` (
    -- 問題 ID
    issue_id STRING NOT NULL,               -- UUID

    -- 關聯
    record_id STRING NOT NULL,              -- 原始記錄 ID (_ragicId)
    table_code STRING NOT NULL,             -- 表格代碼

    -- 問題資訊
    rule_id STRING,                         -- 規則 ID (FMT-001, FK-002...)
    rule_type STRING,                       -- 規則類型 (format, required, range, fk)
    field_name STRING,                      -- 問題欄位
    original_value STRING,                  -- 原始值
    issue_description STRING,               -- 問題描述
    severity STRING,                        -- 嚴重程度 (critical, high, medium, low)

    -- 處理狀態
    status STRING DEFAULT 'pending',        -- pending, auto_fixed, ai_fixed, manual_fixed, skipped
    fixed_value STRING,                     -- 修正後值
    fixed_by STRING,                        -- 修正者 (system, ai, user:{email})
    fixed_at TIMESTAMP,                     -- 修正時間

    -- AI 資訊
    ai_suggestion STRING,                   -- AI 修正建議
    ai_confidence FLOAT64,                  -- AI 信心度
    ai_reasoning STRING,                    -- AI 推理過程

    -- 元資料
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
)
PARTITION BY DATE(created_at)
CLUSTER BY table_code, status, rule_type
OPTIONS(
    description = '資料清洗問題明細表，記錄每個具體的資料品質問題'
);


-- ============================================================
-- 5. 清洗執行日誌表 (cleaning_logs)
-- ============================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.cleaning_logs` (
    -- 日誌 ID
    log_id STRING NOT NULL,                 -- UUID
    run_date DATE NOT NULL,                 -- 執行日期

    -- 執行統計
    total_processed INT64,                  -- 總處理筆數
    auto_fixed INT64,                       -- 自動修正數
    ai_fixed INT64,                         -- AI 修正數
    manual_required INT64,                  -- 需人工處理數
    completed INT64,                        -- 直接完成數
    errors INT64,                           -- 錯誤數

    -- 各表統計 (JSON)
    table_stats STRING,                     -- JSON 格式的各表統計

    -- 執行資訊
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds FLOAT64,
    status STRING,                          -- success, partial, failed
    error_message STRING,
    cleaning_version STRING,

    -- 元資料
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
PARTITION BY run_date
OPTIONS(
    description = '清洗執行日誌表，記錄每次清洗的執行統計'
);


-- ============================================================
-- 6. 原始表新增清洗欄位 (ALTER TABLE)
-- 注意：請依序對每個原始表執行
-- ============================================================

-- 範本：為 dim_brand 表新增清洗欄位
ALTER TABLE `b25h01-ragic.erp_backup.dim_brand`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;

-- dim_channel
ALTER TABLE `b25h01-ragic.erp_backup.dim_channel`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;

-- dim_payment
ALTER TABLE `b25h01-ragic.erp_backup.dim_payment`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;

-- dim_logistics
ALTER TABLE `b25h01-ragic.erp_backup.dim_logistics`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;

-- dim_postal
ALTER TABLE `b25h01-ragic.erp_backup.dim_postal`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;

-- dim_customer
ALTER TABLE `b25h01-ragic.erp_backup.dim_customer`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;

-- dim_product
ALTER TABLE `b25h01-ragic.erp_backup.dim_product`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;

-- dim_campaign
ALTER TABLE `b25h01-ragic.erp_backup.dim_campaign`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;

-- fact_orders
ALTER TABLE `b25h01-ragic.erp_backup.fact_orders`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;

-- fact_order_details
ALTER TABLE `b25h01-ragic.erp_backup.fact_order_details`
ADD COLUMN IF NOT EXISTS _cleaning_status STRING,
ADD COLUMN IF NOT EXISTS _cleaned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS _cleaned_by STRING,
ADD COLUMN IF NOT EXISTS _issue_count INT64,
ADD COLUMN IF NOT EXISTS _has_manual_issues BOOL,
ADD COLUMN IF NOT EXISTS _cleaning_version STRING,
ADD COLUMN IF NOT EXISTS _cleaning_updated_at TIMESTAMP;


-- ============================================================
-- 7. 建立視圖（合併原始與清洗資料）
-- ============================================================

-- 訂單視圖範例
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.v_orders` AS
SELECT
    o.*,
    cr.fixed_values,
    cr.violations,
    COALESCE(cr.status, 'not_processed') AS cleaning_status
FROM `b25h01-ragic.erp_backup.fact_orders` o
LEFT JOIN `b25h01-ragic.erp_backup.cleaning_results` cr
    ON o._ragicId = cr.record_id
    AND cr.table_code = '50';


-- ============================================================
-- 執行說明
-- ============================================================
-- 1. 先執行 CREATE TABLE 語句建立新表
-- 2. 再執行 ALTER TABLE 語句為原始表新增欄位
-- 3. 最後執行 CREATE VIEW 建立視圖
--
-- 注意：ALTER TABLE 需要對應表已存在
-- ============================================================
