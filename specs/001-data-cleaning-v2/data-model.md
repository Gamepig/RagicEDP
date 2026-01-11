# Data Model: 資料清洗系統 v2

**Date**: 2026-01-11
**Feature**: 001-data-cleaning-v2

## Entities

### 1. CleaningRule (清洗規則)

定義資料驗證與修正邏輯的規則配置。

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | string | 規則唯一識別碼 | PK, format: `{TYPE}-{NNN}` (e.g., FMT-001) |
| name | string | 規則名稱 | Required |
| type | enum | 規則類型 | validation, auto_fill, derived |
| category | enum | 規則分類 | format, fk, numeric, required, unique, temporal, association, fill |
| tables | array[string] | 適用表格代碼 | e.g., ["50", "60"] |
| field | string | 目標欄位名稱 | Required |
| trigger_condition | string | 觸發條件 SQL | Optional |
| fix_logic | object | 修正邏輯 | Optional |
| auto_fixable | boolean | 是否可自動修正 | Default: false |
| severity | enum | 嚴重程度 | critical, high, medium, low |
| priority | enum | 執行優先級 | P1, P2, P3 |
| enabled | boolean | 是否啟用 | Default: true |
| version | string | 規則版本 | Semantic version |

**State Transitions**: N/A (Configuration entity)

---

### 2. Violation (違規記錄)

記錄單筆資料的違規詳情。

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | string | 違規記錄 ID | PK, UUID |
| table_code | string | 資料表代碼 | FK → sheets, Required |
| record_id | string | Ragic 記錄 ID | Required |
| rule_id | string | 違反的規則 ID | FK → CleaningRule |
| field_name | string | 違規欄位名稱 | Required |
| before_value | string | 原始值 | Nullable |
| after_value | string | 建議修正值 | Nullable |
| severity | enum | 嚴重程度 | critical, high, medium, low |
| status | enum | 處理狀態 | pending, auto_fixed, ai_fixed, manual_fixed, ignored |
| ai_suggestion | string | AI 建議 | Nullable |
| ai_confidence | float | AI 信心度 | 0.0-1.0, Nullable |
| detected_at | timestamp | 偵測時間 | Required |
| fixed_at | timestamp | 修正時間 | Nullable |
| fixed_by | string | 修正者 | Nullable |

**Indexes**:
- (table_code, record_id) - 查詢特定記錄的違規
- (status, detected_at) - 查詢待處理項目
- (rule_id) - 規則統計

**State Transitions**:
```
pending → auto_fixed (自動修正成功)
pending → ai_fixed (AI 修正，信心度 > 90%)
pending → manual_fixed (人工修正)
pending → ignored (標記忽略)
```

---

### 3. CleaningResult (清洗結果)

記錄單筆資料的清洗結果摘要。

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | string | 結果 ID | PK, UUID |
| table_code | string | 資料表代碼 | Required |
| record_id | string | Ragic 記錄 ID | Required |
| batch_id | string | 清洗批次 ID | Required |
| status | enum | 清洗狀態 | pending, processing, completed, auto_fixed, ai_fixed, manual, failed |
| violation_count | int | 違規數量 | Default: 0 |
| fixed_count | int | 已修正數量 | Default: 0 |
| pending_count | int | 待處理數量 | Default: 0 |
| processed_at | timestamp | 處理時間 | Required |
| processed_by | string | 處理者 | system, ai, user_email |

**Indexes**:
- (table_code, record_id) - 查詢特定記錄
- (batch_id) - 批次查詢
- (status, processed_at) - 狀態統計

**State Transitions**:
```
pending → processing (開始處理)
processing → completed (無違規或全部修正)
processing → auto_fixed (有違規，全自動修正)
processing → ai_fixed (有違規，AI 修正)
processing → manual (有違規，需人工處理)
processing → failed (處理失敗)
```

---

### 4. CleaningHistory (修正歷史)

記錄資料修正的完整軌跡。

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | string | 歷史記錄 ID | PK, UUID |
| table_code | string | 資料表代碼 | Required |
| record_id | string | Ragic 記錄 ID | Required |
| action | enum | 修正動作 | auto_fix, ai_fix, manual_fix, revert |
| field_name | string | 修改欄位 | Required |
| before_value | string | 修改前值 | Nullable |
| after_value | string | 修改後值 | Nullable |
| rule_id | string | 觸發規則 | Nullable |
| ai_confidence | float | AI 信心度 | Nullable |
| modified_by | string | 修改者 | system, ai, user_email |
| modified_at | timestamp | 修改時間 | Required |
| notes | string | 備註 | Nullable |

**Indexes**:
- (table_code, record_id, modified_at) - 記錄歷史查詢
- (modified_by, modified_at) - 操作者統計

---

### 5. CleaningBatch (清洗批次)

記錄每次清洗執行的批次資訊。

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | string | 批次 ID | PK, format: `batch_{date}_{seq}` |
| trigger_type | enum | 觸發類型 | scheduled, manual, retry |
| started_at | timestamp | 開始時間 | Required |
| completed_at | timestamp | 完成時間 | Nullable |
| status | enum | 批次狀態 | running, completed, failed |
| total_records | int | 總記錄數 | Default: 0 |
| processed_records | int | 已處理數 | Default: 0 |
| auto_fixed_count | int | 自動修正數 | Default: 0 |
| ai_fixed_count | int | AI 修正數 | Default: 0 |
| manual_count | int | 需人工處理數 | Default: 0 |
| error_message | string | 錯誤訊息 | Nullable |

---

## Relationships

```
CleaningRule (1) ←── (*) Violation
    │
    └── rules 定義哪些欄位需要驗證

CleaningBatch (1) ←── (*) CleaningResult
    │
    └── 每次清洗產生一個批次，包含多筆結果

CleaningResult (1) ←── (*) Violation
    │
    └── 一筆記錄可能有多個違規

CleaningResult (1) ←── (*) CleaningHistory
    │
    └── 一筆記錄可能有多次修正歷史
```

## Enums

### CleaningStatus
```
pending        # 待處理
processing     # 處理中
completed      # 已完成（無違規）
auto_fixed     # 自動修正
ai_fixed       # AI 修正
manual         # 需人工處理
failed         # 失敗
```

### RuleCategory
```
format         # 格式驗證 (FMT-*)
fk             # 外鍵參照 (FK-*)
numeric        # 數值範圍 (NUM-*)
required       # 必填欄位 (REQ-*)
unique         # 唯一性 (UNQ-*)
temporal       # 時序驗證 (TEMP-*)
association    # 關聯驗證 (ASSOC-*)
fill           # 自動補足 (FILL-*)
```

### Severity
```
critical       # 嚴重：必須立即處理
high           # 高：應優先處理
medium         # 中：一般處理
low            # 低：可延後處理
```

## Validation Rules

1. **Violation.after_value**: 若 status 為 `auto_fixed` 或 `ai_fixed`，則必須有值
2. **Violation.ai_confidence**: 若有 AI 建議，信心度必須在 0.0-1.0 之間
3. **CleaningHistory.before_value/after_value**: 至少一個必須有值
4. **CleaningBatch.completed_at**: 若 status 為 `completed` 或 `failed`，必須有值
