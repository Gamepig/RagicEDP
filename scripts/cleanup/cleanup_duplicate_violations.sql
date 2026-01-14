-- ============================================================
-- 清理重複 violations 腳本
--
-- 問題：同一記錄多次清洗時，會產生重複的 violation 記錄
-- 解決：保留每組 (table_code, record_id, rule_id) 最新的一筆
--
-- 執行方式：
--   bq query --use_legacy_sql=false < scripts/cleanup/cleanup_duplicate_violations.sql
--
-- Date: 2026-01-14
-- ============================================================

-- Step 1: 檢查重複數量（預覽）
SELECT
    table_code,
    record_id,
    rule_id,
    COUNT(*) as duplicate_count
FROM `b25h01-ragic.erp_backup.violations`
GROUP BY table_code, record_id, rule_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: 檢視將被刪除的記錄數量（預覽）
SELECT COUNT(*) as records_to_delete
FROM (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY table_code, record_id, rule_id
            ORDER BY detected_at DESC
        ) as rn
    FROM `b25h01-ragic.erp_backup.violations`
)
WHERE rn > 1;

-- Step 3: 刪除重複記錄（保留最新）
-- ⚠️ 執行前請先執行 Step 1 和 Step 2 確認影響範圍
DELETE FROM `b25h01-ragic.erp_backup.violations`
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY table_code, record_id, rule_id
                ORDER BY detected_at DESC
            ) as rn
        FROM `b25h01-ragic.erp_backup.violations`
    )
    WHERE rn > 1
);

-- Step 4: 驗證清理結果
SELECT
    'Total violations' as metric,
    COUNT(*) as count
FROM `b25h01-ragic.erp_backup.violations`
UNION ALL
SELECT
    'Remaining duplicates',
    COUNT(*)
FROM (
    SELECT table_code, record_id, rule_id
    FROM `b25h01-ragic.erp_backup.violations`
    GROUP BY table_code, record_id, rule_id
    HAVING COUNT(*) > 1
);
