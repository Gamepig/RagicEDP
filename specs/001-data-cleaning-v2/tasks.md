# Tasks: 資料清洗系統 v2

**Input**: Design documents from `/specs/001-data-cleaning-v2/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md

**Tests**: 測試任務已包含，可依需求調整。

**Organization**: 任務依 User Story 分組，支援獨立實作和測試。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無依賴）
- **[Story]**: 所屬 User Story（US1, US2, US3, US4, US5）
- 所有路徑皆為絕對路徑或相對於專案根目錄

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 專案初始化與基礎結構

- [ ] T001 Create project structure per implementation plan (`app/`, `rules/`, `data-correction-app/`, `scripts/`)
- [ ] T002 Initialize Python project with UV and dependencies in `pyproject.toml`
- [ ] T003 [P] Create BigQuery DDL scripts in `scripts/setup/create_bq_tables.sql`
- [ ] T004 [P] Configure linting (ruff) and formatting tools in `pyproject.toml`
- [ ] T005 [P] Create `.env.example` with required environment variables
- [ ] T006 [P] Setup pytest configuration in `pyproject.toml` and `_local/tests/conftest.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有 User Story 共用的核心基礎設施

**CRITICAL**: 此階段必須完成後，任何 User Story 才能開始

### 2.1 符號與配置系統

- [ ] T007 [P] Create symbol configuration loader in `app/utils/symbol_config.py`
- [ ] T008 [P] Create YAML rule schema definition in `rules/schema.yaml`
- [ ] T009 Implement rule registry (load YAML rules) in `app/cleaning/rule_registry.py`

### 2.2 BigQuery 連線與基礎模型

- [ ] T010 [P] Create BigQuery client wrapper in `app/utils/bq_client.py`
- [ ] T011 [P] Create base model classes (CleaningRule, Violation, CleaningResult) in `app/cleaning/models.py`
- [ ] T012 Create result writer for BigQuery in `app/cleaning/result_writer.py`

### 2.3 共用工具

- [ ] T013 [P] Create logging configuration in `app/utils/logging_config.py`
- [ ] T014 [P] Create error handling utilities in `app/utils/errors.py`
- [ ] T015 Deploy validation script in `scripts/deploy/validate.py`

### 2.4 符號驗證 (Constitution §II)

- [ ] T015a Verify all system names against `.claude/symbols/index.yaml` (Cloud Functions, Secrets, BigQuery tables)

**Checkpoint**: Foundation ready - User Story implementation can now begin

---

## Phase 3: User Story 1 - 自動化 SQL 規則清洗 (Priority: P1) MVP

**Goal**: 系統能自動執行 SQL 規則清洗，處理格式錯誤、外鍵缺失、數值異常等問題

**Independent Test**: 手動觸發清洗流程，驗證 SQL 規則正確識別問題並自動修正

### 3.1 YAML 清洗規則配置

- [ ] T016 [P] [US1] Create format validation rules in `rules/format_rules.yaml` (電話、Email、日期)
- [ ] T017 [P] [US1] Create foreign key rules in `rules/fk_rules.yaml` (品牌、通路、客戶編號)
- [ ] T018 [P] [US1] Create numeric range rules in `rules/numeric_rules.yaml` (金額、數量、折扣)
- [ ] T019 [P] [US1] Create required field rules in `rules/required_rules.yaml`
- [ ] T020 [P] [US1] Create uniqueness rules in `rules/unique_rules.yaml`
- [ ] T021 [P] [US1] Create temporal rules in `rules/temporal_rules.yaml` (日期順序)
- [ ] T022 [P] [US1] Create association rules in `rules/association_rules.yaml` (品牌-商品關聯)

### 3.2 清洗引擎核心

- [ ] T023 [US1] Implement SQL cleaner (execute SQL validation rules) in `app/cleaning/sql_cleaner.py`
- [ ] T024 [US1] Implement field fixer (auto-fix known patterns) in `app/cleaning/field_fixer.py`
- [ ] T025 [US1] Implement cleaning engine main orchestrator in `app/cleaning/engine.py`

### 3.3 Cloud Functions 入口

- [ ] T026 [US1] Create Cloud Functions entry point in `app/cleaning/__init__.py`
- [ ] T027 [US1] Create deployment script in `scripts/deploy/deploy_cleaning.sh`

### 3.4 測試

- [ ] T028 [P] [US1] Unit tests for rule_registry in `_local/tests/unit/test_rule_registry.py`
- [ ] T029 [P] [US1] Unit tests for sql_cleaner in `_local/tests/unit/test_sql_cleaner.py`
- [ ] T030 [P] [US1] Unit tests for field_fixer in `_local/tests/unit/test_field_fixer.py`
- [ ] T031 [US1] Integration test for cleaning engine in `_local/tests/integration/test_cleaning_engine.py`

**Checkpoint**: User Story 1 完成 - 可獨立測試 SQL 規則清洗功能

---

## Phase 4: User Story 2 - 自動補足缺失欄位 (Priority: P2)

**Goal**: 系統能自動從關聯表計算並補足缺失欄位（客戶統計、首購品牌、RFM 分數）

**Independent Test**: 針對特定客戶執行補足，驗證計算邏輯正確

### 4.1 YAML 補足規則配置

- [ ] T032 [P] [US2] Create fill rules in `rules/fill_rules.yaml` (客戶統計、關聯補足、衍生欄位)

### 4.2 自動補足引擎

- [ ] T033 [US2] Implement auto filler executor in `app/cleaning/auto_filler.py`
- [ ] T034 [US2] Implement derived field calculator (RFM, 首購標記) in `app/cleaning/derived_calculator.py`
- [ ] T035 [US2] Integrate auto_filler into cleaning engine in `app/cleaning/engine.py`

### 4.3 測試

- [ ] T036 [P] [US2] Unit tests for auto_filler in `_local/tests/unit/test_auto_filler.py`
- [ ] T037 [P] [US2] Unit tests for derived_calculator in `_local/tests/unit/test_derived_calculator.py`
- [ ] T038 [US2] Integration test for auto fill flow in `_local/tests/integration/test_auto_fill.py`

**Checkpoint**: User Story 2 完成 - 可獨立測試自動補足功能

---

## Phase 5: User Story 3 - AI 智能判斷與修正 (Priority: P3)

**Goal**: 對無法自動修正的複雜問題，使用 AI 進行語義分析並提供修正建議

**Independent Test**: 針對特定問題記錄呼叫 AI 分析，驗證建議品質與信心度

### 5.1 AI 模組

- [ ] T039 [P] [US3] Create OpenRouter API client in `app/ai/openrouter_client.py`
- [ ] T040 [P] [US3] Create prompt templates in `app/ai/prompts.py`
- [ ] T041 [US3] Implement AI analyzer (analyze violations, return suggestions) in `app/ai/analyzer.py`
- [ ] T042 [US3] Create AI module entry point in `app/ai/__init__.py`

### 5.2 整合清洗引擎

- [ ] T043 [US3] Integrate AI analyzer into cleaning engine in `app/cleaning/engine.py`
- [ ] T044 [US3] Implement confidence threshold logic (>90% auto-apply) in `app/cleaning/engine.py`

### 5.3 測試

- [ ] T045 [P] [US3] Unit tests for openrouter_client in `_local/tests/unit/test_openrouter_client.py`
- [ ] T046 [P] [US3] Unit tests for analyzer in `_local/tests/unit/test_analyzer.py`
- [ ] T047 [US3] Integration test for AI flow in `_local/tests/integration/test_ai_flow.py`

**Checkpoint**: User Story 3 完成 - 可獨立測試 AI 分析功能

---

## Phase 6: User Story 4 - 異常通知 (Priority: P4)

**Goal**: 當清洗發現需人工處理的資料時，主動發送 Email 通知

**Independent Test**: 手動觸發一筆需人工處理的記錄，驗證通知正確發送

### 6.1 通知模組

- [ ] T048 [P] [US4] Create email sender in `app/notification/email_sender.py`
- [ ] T049 [US4] Implement notifier dispatcher (check conditions, send alerts) in `app/notification/notifier.py`
- [ ] T050 [US4] Create notification module entry point in `app/notification/__init__.py`

### 6.2 整合清洗引擎

- [ ] T051 [US4] Integrate notifier into cleaning engine in `app/cleaning/engine.py`
- [ ] T052 [US4] Implement escalation logic (3-day reminder) in `app/notification/notifier.py`

### 6.3 測試

- [ ] T053 [P] [US4] Unit tests for email_sender in `_local/tests/unit/test_email_sender.py`
- [ ] T054 [P] [US4] Unit tests for notifier in `_local/tests/unit/test_notifier.py`
- [ ] T055 [US4] Integration test for notification flow in `_local/tests/integration/test_notification.py`

**Checkpoint**: User Story 4 完成 - 可獨立測試通知功能

---

## Phase 7: User Story 5 - 資料修正介面 (Priority: P5)

**Goal**: Web 介面可瀏覽待處理資料、查看 AI 建議、進行人工修正

**Independent Test**: 登入介面，查看待處理清單，完成一筆資料修正

### 7.1 後端 API (FastAPI)

- [ ] T056 [P] [US5] Create FastAPI project structure in `data-correction-app/backend/app/`
- [ ] T057 [P] [US5] Implement Google OAuth authentication in `data-correction-app/backend/app/auth/google_oauth.py`
- [ ] T058 [P] [US5] Implement data routes (GET /pending, GET /records) in `data-correction-app/backend/app/routes/data.py`
- [ ] T059 [P] [US5] Implement correction routes (POST /corrections) in `data-correction-app/backend/app/routes/correction.py`
- [ ] T060 [P] [US5] Implement AI suggestion routes (POST /ai/suggest, POST /ai/apply) in `data-correction-app/backend/app/routes/ai.py`
- [ ] T061 [US5] Create FastAPI main entry point in `data-correction-app/backend/app/main.py`

### 7.2 前端 (React + Vite)

- [ ] T062 [P] [US5] Create React project structure in `data-correction-app/frontend/`
- [ ] T063 [P] [US5] Setup Tailwind CSS and base styles in `data-correction-app/frontend/`
- [ ] T064 [P] [US5] Create API service layer in `data-correction-app/frontend/src/services/api.ts`
- [ ] T065 [P] [US5] Create dashboard page (stats overview) in `data-correction-app/frontend/src/pages/Dashboard.tsx`
- [ ] T066 [P] [US5] Create pending list page in `data-correction-app/frontend/src/pages/PendingList.tsx`
- [ ] T067 [P] [US5] Create record detail page (with AI suggestions) in `data-correction-app/frontend/src/pages/RecordDetail.tsx`
- [ ] T068 [US5] Create correction form component in `data-correction-app/frontend/src/components/CorrectionForm.tsx`
- [ ] T069 [US5] Integrate all pages with React Router in `data-correction-app/frontend/src/App.tsx`

### 7.3 部署

- [ ] T070 [US5] Create Dockerfile for Cloud Run in `data-correction-app/Dockerfile`
- [ ] T071 [US5] Create deployment script in `scripts/deploy/deploy_correction_app.sh`

### 7.4 測試

- [ ] T072 [P] [US5] Contract tests for API endpoints in `_local/tests/contract/test_correction_api.py`
- [ ] T073 [US5] Integration test for correction flow in `_local/tests/integration/test_correction_app.py`

**Checkpoint**: User Story 5 完成 - 可獨立測試資料修正介面

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的優化與完善

- [ ] T074 [P] Update quickstart.md with actual commands in `specs/001-data-cleaning-v2/quickstart.md`
- [ ] T075 [P] Add comprehensive logging across all modules
- [ ] T076 [P] Performance optimization for batch processing (>10,000 records)
- [ ] T077 [P] Security hardening (input validation, SQL injection prevention)
- [ ] T078 Run full validation with `scripts/deploy/validate.py`
- [ ] T079 End-to-end integration test in `_local/tests/integration/test_e2e.py`
- [ ] T080 Sync rule documentation to `_docs/planning/資料清洗/自動化清洗規則完整手冊_v2.md` (Constitution §VII)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup (T001-T006)
    ↓
Phase 2: Foundational (T007-T015) - BLOCKS all user stories
    ↓
┌───────────┬───────────┬───────────┬───────────┐
│           │           │           │           │
v           v           v           v           v
Phase 3     Phase 4     Phase 5     Phase 6     Phase 7
US1 (P1)    US2 (P2)    US3 (P3)    US4 (P4)    US5 (P5)
SQL規則     自動補足     AI判斷      通知        修正介面
    │           │           │           │           │
    └───────────┴───────────┴───────────┴───────────┘
                            ↓
                    Phase 8: Polish
```

### User Story Dependencies

| Story | 依賴 | 說明 |
|-------|------|------|
| US1 (SQL 規則) | Phase 2 | 獨立，不依賴其他 Story |
| US2 (自動補足) | Phase 2 | 獨立，但建議在 US1 後執行 |
| US3 (AI 判斷) | Phase 2 | 獨立，處理 US1 無法修正的記錄 |
| US4 (通知) | Phase 2 | 獨立，但需要清洗結果才有意義 |
| US5 (修正介面) | Phase 2 | 獨立，讀取清洗結果並寫回 |

### Within Each User Story

1. YAML 規則/配置 → 可平行
2. 核心邏輯實作 → 依序
3. 整合到清洗引擎 → 依序
4. 測試 → 可平行

---

## Parallel Opportunities

### Phase 2 (Foundational)

```bash
# 可同時執行:
T007 symbol_config.py
T008 schema.yaml
T010 bq_client.py
T011 models.py
T013 logging_config.py
T014 errors.py
```

### Phase 3 (US1 - SQL 規則)

```bash
# YAML 規則可同時執行:
T016 format_rules.yaml
T017 fk_rules.yaml
T018 numeric_rules.yaml
T019 required_rules.yaml
T020 unique_rules.yaml
T021 temporal_rules.yaml
T022 association_rules.yaml

# 測試可同時執行:
T028 test_rule_registry.py
T029 test_sql_cleaner.py
T030 test_field_fixer.py
```

### Phase 7 (US5 - 修正介面)

```bash
# 後端路由可同時執行:
T057 google_oauth.py
T058 data.py
T059 correction.py
T060 ai.py

# 前端頁面可同時執行:
T065 Dashboard.tsx
T066 PendingList.tsx
T067 RecordDetail.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T015)
3. Complete Phase 3: User Story 1 (T016-T031)
4. **STOP and VALIDATE**: 測試 SQL 規則清洗功能
5. Deploy/demo if ready

**MVP 交付**: 自動化 SQL 規則清洗，覆蓋約 80% 的資料問題

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. Add US1 (SQL 規則) → 測試 → 部署 (MVP!)
3. Add US2 (自動補足) → 測試 → 部署
4. Add US3 (AI 判斷) → 測試 → 部署
5. Add US4 (通知) → 測試 → 部署
6. Add US5 (修正介面) → 測試 → 部署

### Parallel Team Strategy

```
Developer A: US1 (SQL 規則) + US2 (自動補足)
Developer B: US3 (AI 判斷) + US4 (通知)
Developer C: US5 (修正介面)
```

---

## AI Assignment Labels

依據 Spec-Kit AI 分配規則：

| 任務類型 | AI | 說明 |
|---------|-----|------|
| 後端開發 (T007-T055, T015a) | [CLAUDE] | Python, FastAPI, BigQuery |
| 前端開發 (T062-T069) | [CLAUDE] | React, TypeScript |
| YAML 配置 (T016-T022, T032) | [CLAUDE] | 規則配置 |
| 測試 (T028-T031, T036-T038...) | [CLAUDE] | pytest |
| 文件更新 (T074, T080) | [GEMINI] | Documentation |
| 效能優化 (T076) | [CODEX] | Performance tuning |
| Code Review | [CODEX] | 程式碼審查 |

---

## Notes

- [P] tasks = 不同檔案，無依賴
- [Story] label 對應 spec.md 中的 User Story
- 每個 User Story 應可獨立完成和測試
- 每個任務或邏輯群組完成後 commit
- 在任何 Checkpoint 可暫停驗證功能
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨 Story 依賴
