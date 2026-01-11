# RagicEDP 資料清洗系統 - 專案憲章

> **版本**: v1.0
> **建立日期**: 2026-01-11
> **狀態**: 核准待執行

---

## 1. 專案概述

### 1.1 專案名稱
**RagicEDP 自動化資料清洗系統 v2**

### 1.2 專案代號
`CLEANING-V2`

### 1.3 專案簡述
建立自動化資料清洗系統，在每日增量備份完成後，自動執行 169 條清洗規則，
結合 AI 智能分析，處理 Ragic ERP 資料品質問題，並提供人工修正介面。

---

## 2. 商業背景

### 2.1 問題陳述
- Ragic ERP 資料存在格式不一致、缺失值、重複記錄等品質問題
- 人工檢查資料費時且容易遺漏
- 問題資料影響後續分析與報表準確性
- 缺乏系統化的資料修正流程

### 2.2 解決方案
- 自動化規則引擎執行 SQL 檢查與修正
- AI 輔助判斷複雜問題
- 自動補足缺失欄位
- Web 介面進行人工修正
- 通知系統即時告警

### 2.3 預期效益
| 效益 | 目標 |
|------|------|
| 自動修正率 | > 80% |
| 人工處理時間 | 減少 70% |
| 資料品質分數 | > 95% |
| 處理時效 | 當日完成 |

---

## 3. 專案範圍

### 3.1 包含範圍 (In Scope)

| 功能 | 說明 |
|------|------|
| SQL 規則清洗 | 144 條基礎規則 + 4 條活動規則 |
| 自動補足 | 20 條 FILL-* 規則 |
| AI 分析 | OpenRouter (Claude/Gemini) 智能判斷 |
| 通知系統 | Email + LINE 告警 |
| 資料修正介面 | React + FastAPI Web 應用 |
| 部署配置 | Cloud Functions + Cloud Run |

### 3.2 排除範圍 (Out of Scope)

| 項目 | 原因 |
|------|------|
| 歷史資料回溯清洗 | 另案處理 |
| Ragic 源頭修正 | 需人工操作 Ragic |
| 即時清洗 | 採用批次處理 |
| 多語言支援 | 僅支援繁體中文 |

### 3.3 依賴項目

| 依賴 | 狀態 | 說明 |
|------|------|------|
| 增量備份系統 v3 | ✅ 已完成 | `app/backup/` |
| BigQuery 資料集 | ✅ 已建立 | `erp_backup` |
| GCP 專案 | ✅ 已配置 | `b25h01-ragic` |
| OpenRouter 帳戶 | ⏳ 待設定 | API Key |

---

## 4. 利害關係人

| 角色 | 人員/系統 | 職責 |
|------|----------|------|
| 專案發起人 | 系統管理員 | 核准需求、驗收成果 |
| 開發團隊 | Claude Code | 程式開發、測試 |
| AI 協作 | Gemini/Codex | 文件、Code Review |
| 終端使用者 | 操作人員 | 使用資料修正介面 |
| 資料來源 | Ragic ERP | 提供原始資料 |
| 資料儲存 | BigQuery | 儲存清洗結果 |

---

## 5. 技術架構

### 5.1 技術棧

| 層級 | 技術 |
|------|------|
| 語言 | Python 3.11+ |
| 套件管理 | UV |
| 規則配置 | YAML |
| 資料庫 | BigQuery |
| AI Provider | OpenRouter (Claude/Gemini) |
| 後端框架 | FastAPI |
| 前端框架 | React + Ant Design |
| 雲端平台 | GCP (Cloud Functions, Cloud Run) |
| 通知 | SMTP, LINE Notify |

### 5.2 目錄結構

```
app/
├── cleaning/           # 清洗模組
│   ├── spec/           # Speckit 規劃文件
│   ├── engine.py       # 清洗引擎
│   ├── rule_registry.py
│   ├── sql_cleaner.py
│   ├── field_fixer.py
│   ├── auto_filler.py
│   └── result_writer.py
├── ai/                 # AI 模組
│   ├── openrouter_client.py
│   ├── analyzer.py
│   └── prompts.py
├── notification/       # 通知模組
│   ├── notifier.py
│   ├── email_sender.py
│   └── line_sender.py
└── utils/              # 工具
    └── symbol_config.py

rules/                  # 規則配置
├── format_rules.yaml
├── fk_rules.yaml
├── numeric_rules.yaml
├── required_rules.yaml
├── unique_rules.yaml
├── fill_rules.yaml
└── association_rules.yaml

data-correction-app/    # 資料修正介面
├── backend/
└── frontend/
```

---

## 6. 開發階段

| 階段 | 名稱 | 任務數 | 依賴 |
|------|------|--------|------|
| Phase 1 | Setup (專案初始化) | 3 | - |
| Phase 2 | Foundational (基礎建設) | 3 | Phase 1 |
| Phase 3 | 基礎清洗 [P1] | 6 | Phase 2 |
| Phase 4 | 自動補足 [P2] | 4 | Phase 3 |
| Phase 5 | AI 判斷 [P3] | 5 | Phase 3 |
| Phase 6 | 通知功能 [P4] | 5 | Phase 3 |
| Phase 7 | 資料修正介面 [P5] | 9 | Phase 3 |
| Phase 8 | Polish & Review | 5 | All |

**MVP 範圍**: Phase 1 ~ Phase 4 (基礎清洗 + 自動補足)

---

## 7. 成功標準

### 7.1 功能驗收

- [ ] 每日自動執行清洗（00:30 觸發）
- [ ] 169 條規則全部載入並執行
- [ ] AI 信心度 > 0.9 自動修正
- [ ] 人工處理項目發送通知
- [ ] 資料修正介面可正常操作

### 7.2 效能驗收

| 指標 | 目標 |
|------|------|
| 單日處理 10,000 筆 | < 10 分鐘 |
| AI 單次呼叫 | < 5 秒 |
| 介面響應時間 | < 2 秒 |

### 7.3 品質驗收

| 指標 | 目標 |
|------|------|
| 單元測試覆蓋率 | > 80% |
| Code Review | 通過 |
| 文件完整性 | 100% |

---

## 8. 風險管理

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|---------|
| OpenRouter API 限制 | 中 | 高 | 使用快取、降級策略 |
| 規則衝突 | 低 | 中 | 規則優先級設計 |
| BigQuery 費用超支 | 低 | 中 | 查詢優化、監控 |
| 部署失敗 | 低 | 高 | 驗證腳本、回滾機制 |

---

## 9. 相關文件

| 文件 | 位置 |
|------|------|
| 開發規劃 v2 | `_docs/planning/資料清洗/資料清洗程式開發規劃_v2.md` |
| 規則手冊 v2 | `_docs/planning/資料清洗/自動化清洗規則完整手冊_v2.md` |
| 符號索引表 | `.claude/symbols/index.yaml` |
| 自動補足規則 | `rules/fill_rules.yaml` |

---

## 10. 核准

| 項目 | 狀態 |
|------|------|
| 專案憲章 | ⏳ 待核准 |
| 技術架構 | ⏳ 待核准 |
| 開發階段 | ⏳ 待核准 |
| 資源配置 | ⏳ 待核准 |

---

*建立日期: 2026-01-11*
*版本: v1.0*
