# Implementation Plan: 資料清洗系統 v2

**Branch**: `001-data-cleaning-v2` | **Date**: 2026-01-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-data-cleaning-v2/spec.md`

## Summary

建立自動化資料清洗系統，在每日增量備份完成後執行 SQL 規則清洗、自動補足缺失欄位、AI 智能判斷，並透過通知系統和 Web 介面處理需人工處理的資料。採用分層架構：SQL 規則層 → 自動補足層 → AI 判斷層 → 人工處理層。

## Technical Context

**Language/Version**: Python 3.11+ (GCP Cloud Functions 原生支援)
**Primary Dependencies**: google-cloud-bigquery, httpx (OpenRouter), pydantic, PyYAML
**Storage**: BigQuery (asia-east1, dataset: erp_backup)
**Testing**: pytest
**Target Platform**: GCP Cloud Functions Gen2 (清洗引擎), Cloud Run (資料修正介面)
**Project Type**: web (backend: Cloud Functions/Run, frontend: React SPA)
**Performance Goals**: 10,000 筆/15 分鐘清洗, AI 單次 < 5 秒, UI 響應 < 2 秒
**Constraints**: 增量處理、原始值保留、修改可追溯
**Scale/Scope**: 每日約 500-1000 筆新增資料, 10 張資料表

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Data Integrity First | FR-004 保留原始值、FR-005/FR-025 記錄修改歷史 | [x] |
| II. Symbol Verification | 使用 `.claude/symbols/index.yaml` 符號索引表 | [x] |
| III. Incremental Processing | FR-003 僅處理當日新增資料（增量模式） | [x] |
| IV. Layered Data Processing | SQL → 自動補足 → AI → 人工 四層架構 | [x] |
| V. Configuration-Driven Rules | FR-002 規則使用 YAML 配置 (`rules/` 目錄) | [x] |
| VI. Fail-Safe Notification | FR-018/019 異常主動通知、Edge Cases 定義重試 | [x] |
| VII. Documentation Sync | 規則手冊、符號索引表需同步更新 | [x] |

**Gate Status**: ✅ PASS - 所有原則符合

## Project Structure

### Documentation (this feature)

```text
specs/001-data-cleaning-v2/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── cleaning/                    # 清洗引擎 (Cloud Functions)
│   ├── __init__.py
│   ├── engine.py                # 清洗引擎主程式
│   ├── sql_cleaner.py           # SQL 規則執行器
│   ├── rule_registry.py         # 規則註冊表 (載入 YAML)
│   ├── field_fixer.py           # 欄位自動修正器
│   ├── auto_filler.py           # 自動補足執行器
│   ├── derived_calculator.py    # 衍生欄位計算器
│   └── result_writer.py         # 結果寫入器
│
├── ai/                          # AI 分析模組
│   ├── __init__.py
│   ├── openrouter_client.py     # OpenRouter API 客戶端
│   ├── analyzer.py              # AI 分析器
│   └── prompts.py               # Prompt 模板
│
├── notification/                # 通知模組
│   ├── __init__.py
│   ├── notifier.py              # 通知調度器
│   └── email_sender.py          # Email 發送器
│
└── utils/
    └── symbol_config.py         # 符號配置載入器

rules/                           # 清洗規則 YAML
├── format_rules.yaml
├── fk_rules.yaml
├── numeric_rules.yaml
├── required_rules.yaml
├── unique_rules.yaml
├── temporal_rules.yaml
├── association_rules.yaml
└── fill_rules.yaml

data-correction-app/             # 資料修正介面 (Cloud Run)
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── routes/
│   │   │   ├── data.py          # 資料 API
│   │   │   ├── correction.py    # 修正 API
│   │   │   └── ai.py            # AI 建議 API
│   │   └── auth/
│   │       └── google_oauth.py  # Google OAuth
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/
│   └── tests/
│
└── Dockerfile

scripts/
├── deploy/
│   ├── validate.py              # 符號驗證腳本
│   ├── deploy_cleaning.sh       # 清洗函數部署
│   └── deploy_correction_app.sh # 修正介面部署
└── setup/
    └── create_bq_tables.sql     # BigQuery 表格 DDL

_local/tests/                    # 本地測試
├── unit/
├── integration/
└── contract/
```

**Structure Decision**: 採用 Web 應用結構，將清洗引擎 (`app/cleaning/`) 與資料修正介面 (`data-correction-app/`) 分離。清洗引擎以 Cloud Functions 運行，修正介面以 Cloud Run 運行。

## Complexity Tracking

> 無違規項目，不需要額外說明。
