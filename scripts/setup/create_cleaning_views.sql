-- ============================================================
-- RagicEDP 資料清洗系統 - Views
-- Version: 1.0.0
-- Date: 2026-01-14
-- ============================================================

-- ============================================================
-- 1. v_pending_violations (待處理違規)
-- 用途：查詢所有待處理的違規記錄，用於人工修正介面
-- ============================================================
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.v_pending_violations` AS
SELECT
    v.id,
    v.table_code,
    v.record_id,
    v.rule_id,
    v.field_name,
    v.before_value,
    v.after_value,
    v.severity,
    v.status,
    v.ai_suggestion,
    v.ai_confidence,
    v.detected_at,
    v.fixed_at,
    v.fixed_by,
    -- 額外資訊
    CASE v.table_code
        WHEN '10' THEN '品牌表'
        WHEN '20' THEN '通路表'
        WHEN '30' THEN '金流表'
        WHEN '40' THEN '物流表'
        WHEN '41' THEN '郵遞區號表'
        WHEN '50' THEN '訂單表'
        WHEN '60' THEN '客戶表'
        WHEN '70' THEN '商品表'
        WHEN '80' THEN '活動管理表'
        WHEN '99' THEN '訂單明細表'
        ELSE '未知'
    END AS table_name,
    -- 優先級排序
    CASE v.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
    END AS severity_order
FROM `b25h01-ragic.erp_backup.violations` v
WHERE v.status = 'pending'
ORDER BY severity_order, v.detected_at ASC;


-- ============================================================
-- 2. v_daily_cleaning_stats (每日清洗統計)
-- 用途：提供每日清洗執行統計，用於監控和報表
-- ============================================================
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.v_daily_cleaning_stats` AS
SELECT
    DATE(cr.cleaned_at) AS cleaning_date,
    cr.table_code,
    CASE cr.table_code
        WHEN '10' THEN '品牌表'
        WHEN '20' THEN '通路表'
        WHEN '30' THEN '金流表'
        WHEN '40' THEN '物流表'
        WHEN '41' THEN '郵遞區號表'
        WHEN '50' THEN '訂單表'
        WHEN '60' THEN '客戶表'
        WHEN '70' THEN '商品表'
        WHEN '80' THEN '活動管理表'
        WHEN '99' THEN '訂單明細表'
        ELSE '未知'
    END AS table_name,
    COUNT(*) AS total_records,
    COUNTIF(cr.status = 'completed') AS completed_count,
    COUNTIF(cr.status = 'auto_fixed') AS auto_fixed_count,
    COUNTIF(cr.status = 'ai_fixed') AS ai_fixed_count,
    COUNTIF(cr.status = 'manual') AS manual_count,
    COUNTIF(cr.status = 'failed') AS failed_count,
    SUM(cr.violation_count) AS total_violations,
    -- 自動化率 (auto_fixed + ai_fixed) / total
    SAFE_DIVIDE(
        COUNTIF(cr.status IN ('auto_fixed', 'ai_fixed')),
        COUNT(*)
    ) * 100 AS auto_rate_percent,
    -- 時間統計
    MIN(cr.cleaned_at) AS first_cleaned_at,
    MAX(cr.cleaned_at) AS last_cleaned_at
FROM `b25h01-ragic.erp_backup.cleaning_results` cr
GROUP BY
    DATE(cr.cleaned_at),
    cr.table_code
ORDER BY
    cleaning_date DESC,
    cr.table_code;


-- ============================================================
-- 3. v_rule_stats (規則統計)
-- 用途：統計各規則的觸發次數和修正成功率
-- 需要先建立 cleaning_rules 表
-- ============================================================
CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.v_rule_stats` AS
SELECT
    v.rule_id,
    r.name AS rule_name,
    r.category,
    r.type AS rule_type,
    r.severity AS rule_severity,
    r.auto_fixable,
    COUNT(*) AS total_triggers,
    COUNTIF(v.status = 'pending') AS pending_count,
    COUNTIF(v.status = 'auto_fixed') AS auto_fixed_count,
    COUNTIF(v.status = 'ai_fixed') AS ai_fixed_count,
    COUNTIF(v.status = 'manual_fixed') AS manual_fixed_count,
    COUNTIF(v.status = 'ignored') AS ignored_count,
    -- 修正率
    SAFE_DIVIDE(
        COUNTIF(v.status IN ('auto_fixed', 'ai_fixed', 'manual_fixed')),
        COUNT(*)
    ) * 100 AS fix_rate_percent,
    -- 自動修正率 (針對可自動修正的規則)
    SAFE_DIVIDE(
        COUNTIF(v.status = 'auto_fixed'),
        COUNTIF(r.auto_fixable = TRUE)
    ) * 100 AS auto_fix_rate_percent,
    -- AI 信心度統計
    AVG(v.ai_confidence) AS avg_ai_confidence,
    -- 時間統計
    MIN(v.detected_at) AS first_detected,
    MAX(v.detected_at) AS last_detected
FROM `b25h01-ragic.erp_backup.violations` v
LEFT JOIN `b25h01-ragic.erp_backup.cleaning_rules` r
    ON v.rule_id = r.id
GROUP BY
    v.rule_id,
    r.name,
    r.category,
    r.type,
    r.severity,
    r.auto_fixable
ORDER BY
    total_triggers DESC;


-- ============================================================
-- 執行說明
-- ============================================================
-- 1. 先執行 sync_cleaning_rules.py 同步規則到 BigQuery
-- 2. 再執行此 SQL 建立 Views
--
-- 執行命令:
-- bq query --use_legacy_sql=false < scripts/setup/create_cleaning_views.sql
-- ============================================================
