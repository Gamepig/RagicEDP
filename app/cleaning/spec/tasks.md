# RagicEDP 資料清洗系統 - 任務清單

> **版本**: v1.0
> **建立日期**: 2026-01-11
> **關聯憲章**: charter.md
> **關聯用戶故事**: user-stories.md

---

## 任務標記說明

| 標記 | 說明 |
|------|------|
| `[P]` | 可並行執行 |
| `[CLAUDE]` | Claude Code 執行 |
| `[GEMINI]` | Gemini CLI 執行 |
| `[CODEX]` | Codex CLI 執行 |
| `[USx]` | 關聯用戶故事 |

---

## Phase 1: Setup (專案初始化)

> **預估工時**: 2h
> **依賴**: 無

| ID | 狀態 | 任務 | 執行者 | 輸出 |
|----|------|------|--------|------|
| T001 | [ ] | 建立符號配置載入器 | CLAUDE | `app/utils/symbol_config.py` |
| T002 | [ ] | 更新 config.py 整合符號配置 | CLAUDE | `app/backup/config.py` 更新 |
| T003 | [ ] | 建立 OpenRouter Secret | CLAUDE | `gcloud secrets create` |

### T001 詳情
```python
# 建立 app/utils/symbol_config.py
# 功能: 載入 .claude/symbols/index.yaml
# 提供: get_table_name(), get_field_name(), get_secret_name()
```

### T002 詳情
```python
# 更新 app/backup/config.py
# 整合 SymbolConfig
# 使用符號索引取得正確名稱
```

### T003 詳情
```bash
# 建立 Secret
echo -n "$OPENROUTER_API_KEY" | gcloud secrets create openrouter-api-key --data-file=-

# 授予存取權限
gcloud secrets add-iam-policy-binding openrouter-api-key \
  --member="serviceAccount:..." \
  --role="roles/secretmanager.secretAccessor"
```

---

## Phase 2: Foundational (基礎建設)

> **預估工時**: 4h
> **依賴**: Phase 1

| ID | 狀態 | 任務 | 執行者 | 輸出 |
|----|------|------|--------|------|
| T004 | [ ] | 建立規則註冊表 | CLAUDE | `app/cleaning/rule_registry.py` |
| T005 | [ ] | 建立規則 YAML 驗證腳本 | CLAUDE | `scripts/deploy/validate_rules.py` |
| T006 | [ ] | 建立 BigQuery 清洗相關表格 DDL | CLAUDE | `scripts/cleaning_ddl.sql` |

### T004 詳情
```python
# app/cleaning/rule_registry.py
class RuleRegistry:
    """規則註冊表 - 載入並管理所有 YAML 規則"""

    def load_rules(self, rules_dir: str) -> None
    def get_rules_by_table(self, table_code: str) -> List[Rule]
    def get_rules_by_type(self, rule_type: str) -> List[Rule]
```

### T005 詳情
```python
# scripts/deploy/validate_rules.py
# 驗證:
# 1. YAML 語法正確
# 2. 規則 ID 唯一
# 3. 必填欄位完整
# 4. 規則數量符合預期 (169 條)
```

### T006 詳情
```sql
-- scripts/cleaning_ddl.sql
-- 建立表格:
-- 1. cleaning_violations - 違規記錄
-- 2. cleaning_history - 修正歷史
-- 3. cleaning_ai_results - AI 分析結果
```

---

## Phase 3: User Story 1 - 基礎清洗 [P1]

> **預估工時**: 8h
> **依賴**: Phase 2
> **關聯**: US1

| ID | 狀態 | 任務 | 執行者 | 輸出 |
|----|------|------|--------|------|
| T007 | [ ] | [P] 建立 SQL 清洗器 | CLAUDE | `app/cleaning/sql_cleaner.py` |
| T008 | [ ] | [P] 建立欄位修正器 | CLAUDE | `app/cleaning/field_fixer.py` |
| T009 | [ ] | [P] 建立結果寫入器 | CLAUDE | `app/cleaning/result_writer.py` |
| T010 | [ ] | 建立清洗引擎 | CLAUDE | `app/cleaning/engine.py` |
| T011 | [ ] | 建立 Cloud Function 入口 | CLAUDE | `app/backup/main.py` 更新 |
| T012 | [ ] | 整合測試 Phase 3 | CLAUDE | 測試報告 |

### T007 詳情 (可並行)
```python
# app/cleaning/sql_cleaner.py
class SQLCleaner:
    """SQL 規則檢查器"""

    def check_record(self, table_code: str, record: Dict) -> List[Violation]
    def check_format(self, rule: Rule, value: Any) -> Optional[Violation]
    def check_fk(self, rule: Rule, value: Any) -> Optional[Violation]
    def check_numeric(self, rule: Rule, value: Any) -> Optional[Violation]
```

### T008 詳情 (可並行)
```python
# app/cleaning/field_fixer.py
class FieldFixer:
    """欄位修正器"""

    def fix_record(self, record: Dict, violations: List[Violation]) -> Dict
    def apply_format_fix(self, value: Any, rule: Rule) -> Any
    def apply_default_fix(self, rule: Rule) -> Any
```

### T009 詳情 (可並行)
```python
# app/cleaning/result_writer.py
class ResultWriter:
    """結果寫入器"""

    def write_violations(self, violations: List[Violation]) -> None
    def write_history(self, record: Dict, changes: List[Change]) -> None
    def update_status(self, record_id: str, status: str) -> None
```

### T010 詳情
```python
# app/cleaning/engine.py
class CleaningEngine:
    """清洗引擎 - 整合所有元件"""

    def run(self, backup_date: str) -> CleaningResult
    def process_table(self, table_code: str) -> TableResult
    def process_record(self, record: Dict) -> RecordResult
```

---

## Phase 4: User Story 2 - 自動補足 [P2]

> **預估工時**: 6h
> **依賴**: Phase 3
> **關聯**: US2

| ID | 狀態 | 任務 | 執行者 | 輸出 |
|----|------|------|--------|------|
| T013 | [ ] | [P] 建立自動補足執行器 | CLAUDE | `app/cleaning/auto_filler.py` |
| T014 | [ ] | [P] 建立衍生欄位計算器 | CLAUDE | `app/cleaning/derived_calculator.py` |
| T015 | [ ] | 整合 fill_rules.yaml 到引擎 | CLAUDE | `engine.py` 更新 |
| T016 | [ ] | 整合測試 Phase 4 | CLAUDE | 測試報告 |

### T013 詳情 (可並行)
```python
# app/cleaning/auto_filler.py
class AutoFiller:
    """自動補足執行器"""

    def fill_from_relation(self, record: Dict, rule: FillRule) -> Dict
    def fill_customer_stats(self, customer_code: str) -> Dict
    def create_campaign_record(self, order: Dict) -> Optional[Dict]
```

### T014 詳情 (可並行)
```python
# app/cleaning/derived_calculator.py
class DerivedCalculator:
    """衍生欄位計算器"""

    def calculate_rfm(self, customer_code: str) -> RFMScore
    def calculate_dormancy(self, customer_code: str) -> DormancyStatus
    def calculate_first_purchase(self, customer_code: str) -> bool
```

---

## Phase 5: User Story 3 - AI 判斷 [P3]

> **預估工時**: 6h
> **依賴**: Phase 3
> **關聯**: US3

| ID | 狀態 | 任務 | 執行者 | 輸出 |
|----|------|------|--------|------|
| T017 | [ ] | 建立 OpenRouter 客戶端 | CLAUDE | `app/ai/openrouter_client.py` |
| T018 | [ ] | 建立 AI 分析器 | CLAUDE | `app/ai/analyzer.py` |
| T019 | [ ] | 建立 Prompt 模板 | CLAUDE | `app/ai/prompts.py` |
| T020 | [ ] | 整合 AI 到清洗引擎 | CLAUDE | `engine.py` 更新 |
| T021 | [ ] | 整合測試 Phase 5 | CLAUDE | 測試報告 |

---

## Phase 6: User Story 4 - 通知功能 [P4]

> **預估工時**: 4h
> **依賴**: Phase 3
> **關聯**: US4

| ID | 狀態 | 任務 | 執行者 | 輸出 |
|----|------|------|--------|------|
| T022 | [ ] | [P] 建立通知調度器 | CLAUDE | `app/notification/notifier.py` |
| T023 | [ ] | [P] 建立 Email 發送器 | CLAUDE | `app/notification/email_sender.py` |
| T024 | [ ] | [P] 建立 LINE 發送器 | CLAUDE | `app/notification/line_sender.py` |
| T025 | [ ] | 整合通知到清洗流程 | CLAUDE | `engine.py` 更新 |
| T026 | [ ] | 建立通知 Cloud Function | CLAUDE | `main.py` 更新 |

---

## Phase 7: User Story 5 - 資料修正介面 [P5]

> **預估工時**: 16h
> **依賴**: Phase 3
> **關聯**: US5

| ID | 狀態 | 任務 | 執行者 | 輸出 |
|----|------|------|--------|------|
| T027 | [ ] | 初始化 React 專案 | CLAUDE | `data-correction-app/frontend/` |
| T028 | [ ] | 初始化 FastAPI 專案 | CLAUDE | `data-correction-app/backend/` |
| T029 | [ ] | [P] 建立資料 API | CLAUDE | `backend/app/routes/data.py` |
| T030 | [ ] | [P] 建立修正 API | CLAUDE | `backend/app/routes/correction.py` |
| T031 | [ ] | [P] 建立 AI API | CLAUDE | `backend/app/routes/ai.py` |
| T032 | [ ] | 建立前端頁面 | CLAUDE | `frontend/src/pages/` |
| T033 | [ ] | 建立 Dockerfile | CLAUDE | `Dockerfile` |
| T034 | [ ] | 建立 Cloud Build 配置 | CLAUDE | `cloudbuild.yaml` |
| T035 | [ ] | 整合測試 Phase 7 | CLAUDE | 測試報告 |

---

## Phase 8: Polish & Cross-Cutting

> **預估工時**: 4h
> **依賴**: All Phases

| ID | 狀態 | 任務 | 執行者 | 輸出 |
|----|------|------|--------|------|
| T036 | [ ] | 建立部署腳本 | CLAUDE | `scripts/deploy_cleaning_function.sh` |
| T037 | [ ] | 建立排程腳本 | CLAUDE | `scripts/setup_cleaning_scheduler.sh` |
| T038 | [ ] | 更新文件 | GEMINI | `_docs/` 更新 |
| T039 | [ ] | Code Review 全部程式碼 | CODEX | Review 報告 |
| T040 | [ ] | 修復 Review 發現的問題 | CLAUDE | 程式碼修正 |

---

## 任務統計

| 執行者 | 任務數 | 並行任務 | 順序任務 |
|--------|--------|---------|---------|
| CLAUDE | 37 | 12 | 25 |
| GEMINI | 1 | 0 | 1 |
| CODEX | 1 | 0 | 1 |
| **總計** | **40** | **12** | **28** |

---

## 執行命令

### Claude 任務
```bash
# 直接在 Claude Code 中執行
```

### Gemini 任務
```bash
gemini -m gemini-2.0-flash -y "<task_description>" 2>&1
```

### Codex 任務
```bash
~/.claude/scripts/ai-invoke.sh "<task_description>" codex
```

---

*建立日期: 2026-01-11*
*版本: v1.0*
