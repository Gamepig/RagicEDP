-- BigQuery DDL: 資料清洗系統 v2
-- Dataset: b25h01-ragic.erp_backup
-- Location: asia-east1
-- Generated: 2026-01-11

-- =============================================================================
-- Table: cleaning_rules (清洗規則配置)
-- 注意: 規則主要存放在 YAML，此表用於執行時載入和統計
-- =============================================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.cleaning_rules` (
  id STRING NOT NULL,                           -- 規則 ID, e.g., FMT-001
  name STRING NOT NULL,                         -- 規則名稱
  type STRING NOT NULL,                         -- validation, auto_fill, derived
  category STRING NOT NULL,                     -- format, fk, numeric, required, unique, temporal, association, fill
  tables ARRAY<STRING>,                         -- 適用表格代碼, e.g., ["50", "60"]
  field STRING NOT NULL,                        -- 目標欄位名稱
  trigger_condition STRING,                     -- 觸發條件 SQL
  fix_logic STRING,                             -- 修正邏輯 JSON
  auto_fixable BOOL DEFAULT FALSE,              -- 是否可自動修正
  severity STRING NOT NULL,                     -- critical, high, medium, low
  priority STRING DEFAULT 'P3',                 -- P1, P2, P3
  enabled BOOL DEFAULT TRUE,                    -- 是否啟用
  version STRING DEFAULT '1.0.0',               -- 規則版本
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(created_at)
CLUSTER BY category, type;

-- =============================================================================
-- Table: cleaning_batches (清洗批次)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.cleaning_batches` (
  id STRING NOT NULL,                           -- 批次 ID, e.g., batch_20260111_001
  trigger_type STRING NOT NULL,                 -- scheduled, manual, retry
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status STRING NOT NULL DEFAULT 'running',     -- running, completed, failed
  total_records INT64 DEFAULT 0,
  processed_records INT64 DEFAULT 0,
  auto_fixed_count INT64 DEFAULT 0,
  ai_fixed_count INT64 DEFAULT 0,
  manual_count INT64 DEFAULT 0,
  error_message STRING
)
PARTITION BY DATE(started_at)
CLUSTER BY status;

-- =============================================================================
-- Table: cleaning_results (清洗結果摘要)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.cleaning_results` (
  id STRING NOT NULL,                           -- 結果 ID (UUID)
  table_code STRING NOT NULL,                   -- 資料表代碼
  record_id STRING NOT NULL,                    -- Ragic 記錄 ID
  batch_id STRING NOT NULL,                     -- 清洗批次 ID
  status STRING NOT NULL DEFAULT 'pending',     -- pending, processing, completed, auto_fixed, ai_fixed, manual, failed
  violation_count INT64 DEFAULT 0,
  fixed_count INT64 DEFAULT 0,
  pending_count INT64 DEFAULT 0,
  processed_at TIMESTAMP NOT NULL,
  processed_by STRING DEFAULT 'system'          -- system, ai, user_email
)
PARTITION BY DATE(processed_at)
CLUSTER BY table_code, status;

-- =============================================================================
-- Table: violations (違規記錄)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.violations` (
  id STRING NOT NULL,                           -- 違規記錄 ID (UUID)
  table_code STRING NOT NULL,                   -- 資料表代碼
  record_id STRING NOT NULL,                    -- Ragic 記錄 ID
  rule_id STRING NOT NULL,                      -- 違反的規則 ID
  field_name STRING NOT NULL,                   -- 違規欄位名稱
  before_value STRING,                          -- 原始值
  after_value STRING,                           -- 建議修正值
  severity STRING NOT NULL,                     -- critical, high, medium, low
  status STRING NOT NULL DEFAULT 'pending',     -- pending, auto_fixed, ai_fixed, manual_fixed, ignored
  ai_suggestion STRING,                         -- AI 建議
  ai_confidence FLOAT64,                        -- AI 信心度 0.0-1.0
  detected_at TIMESTAMP NOT NULL,
  fixed_at TIMESTAMP,
  fixed_by STRING
)
PARTITION BY DATE(detected_at)
CLUSTER BY table_code, status, rule_id;

-- =============================================================================
-- Table: cleaning_history (修正歷史)
-- =============================================================================
CREATE TABLE IF NOT EXISTS `b25h01-ragic.erp_backup.cleaning_history` (
  id STRING NOT NULL,                           -- 歷史記錄 ID (UUID)
  table_code STRING NOT NULL,                   -- 資料表代碼
  record_id STRING NOT NULL,                    -- Ragic 記錄 ID
  action STRING NOT NULL,                       -- auto_fix, ai_fix, manual_fix, revert
  field_name STRING NOT NULL,                   -- 修改欄位
  before_value STRING,                          -- 修改前值
  after_value STRING,                           -- 修改後值
  rule_id STRING,                               -- 觸發規則
  ai_confidence FLOAT64,                        -- AI 信心度
  modified_by STRING NOT NULL DEFAULT 'system', -- system, ai, user_email
  modified_at TIMESTAMP NOT NULL,
  notes STRING
)
PARTITION BY DATE(modified_at)
CLUSTER BY table_code, action;

-- =============================================================================
-- Views: 常用查詢視圖
-- =============================================================================

-- 待處理違規統計
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.v_pending_violations` AS
SELECT
  table_code,
  rule_id,
  severity,
  COUNT(*) as count,
  MIN(detected_at) as earliest_detected
FROM `b25h01-ragic.erp_backup.violations`
WHERE status = 'pending'
GROUP BY table_code, rule_id, severity
ORDER BY
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  count DESC;

-- 每日清洗統計
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.v_daily_cleaning_stats` AS
SELECT
  DATE(processed_at) as cleaning_date,
  COUNT(*) as total_records,
  COUNTIF(status = 'completed') as completed,
  COUNTIF(status = 'auto_fixed') as auto_fixed,
  COUNTIF(status = 'ai_fixed') as ai_fixed,
  COUNTIF(status = 'manual') as manual,
  COUNTIF(status = 'failed') as failed,
  ROUND(COUNTIF(status IN ('completed', 'auto_fixed', 'ai_fixed')) / COUNT(*) * 100, 2) as auto_rate_pct
FROM `b25h01-ragic.erp_backup.cleaning_results`
GROUP BY cleaning_date
ORDER BY cleaning_date DESC;

-- 規則觸發統計
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.v_rule_stats` AS
SELECT
  v.rule_id,
  r.name as rule_name,
  r.category,
  r.severity,
  COUNT(*) as total_violations,
  COUNTIF(v.status = 'auto_fixed') as auto_fixed,
  COUNTIF(v.status = 'ai_fixed') as ai_fixed,
  COUNTIF(v.status = 'manual_fixed') as manual_fixed,
  COUNTIF(v.status = 'pending') as pending,
  ROUND(COUNTIF(v.status IN ('auto_fixed', 'ai_fixed')) / COUNT(*) * 100, 2) as auto_fix_rate_pct
FROM `b25h01-ragic.erp_backup.violations` v
LEFT JOIN `b25h01-ragic.erp_backup.cleaning_rules` r ON v.rule_id = r.id
GROUP BY v.rule_id, r.name, r.category, r.severity
ORDER BY total_violations DESC;
