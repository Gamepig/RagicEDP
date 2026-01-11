# RagicEDP 專案配置

> v2.0 | 2026-01-11 | 精簡版（繼承上層配置）

---

## 目錄結構

```
RagicEDP/
├── app/                    # 程式碼 (✅ Git)
│   ├── backup/             # 備份模組 (v3)
│   ├── cleaning/           # 清洗模組 (v2 待開發)
│   ├── ai/                 # AI 分析 (v2 待開發)
│   ├── etl/                # ETL 轉換
│   ├── notification/       # 通知系統
│   └── utils/              # 工具函數
├── scripts/                # 部署腳本 (✅ Git)
├── rules/                  # 清洗規則 YAML (✅ Git)
├── data-correction-app/    # 資料修正介面 (✅ Git)
├── _archived/              # 備份 (❌ Git)
├── _docs/                  # 文件 (❌ Git)
│   ├── official/           # 正式文件
│   ├── planning/           # 規劃文件
│   └── reference/          # 參考文件
└── _local/                 # 本地資料 (❌ Git)
    ├── data/               # 資料檔案
    ├── logs/               # 日誌
    └── tests/              # 測試程式
```

---

## 符號引用規則（防止名稱錯誤）

**在使用任何名稱前，必須先查閱符號索引表**：`.claude/symbols/index.yaml`

### 快速對照表

| 類別 | 命名規範 | 範例 |
|------|---------|------|
| GCP Secrets | 小寫+連字號 | `ragic-api-key` |
| 環境變數 | 大寫+底線 | `RAGIC_API_KEY` |
| Cloud Functions | 小寫+連字號 | `backup-erp-incremental` |
| Python 函數 | 小寫+底線 | `backup_erp_data` |
| BigQuery 表格 | 小寫+底線 | `sheet_10_brand` |

### 關鍵映射

```yaml
# Secret 部署格式
--set-secrets=RAGIC_API_KEY=ragic-api-key:latest

# 函數名稱 vs 入口點
backup-erp-incremental → backup_erp_data
clean-erp-data → clean_erp_data

# BigQuery 表格格式
sheet_{代碼}_{英文名稱}  # 例: sheet_50_order
```

---

## 專案概述

Ragic ERP 資料平台 - 整合資料備份、清理、分析與視覺化功能。

**技術**: Python 3.11+ | UV | BigQuery | Ragic REST API | 正體中文

**開發準則**: `_docs/official/開發準則_v1.md`

---

## 系統模組狀態

### 已完成 ✅

| 模組 | 路徑 | 說明 |
|------|------|------|
| 增量備份核心 | `app/backup/incremental.py` | v3 簡化版 |
| Cloud Function 入口 | `app/backup/main.py` | HTTP 入口點 |
| 全量備份 | `app/backup/full_backup.py` | 手動執行 |
| 手動補抓 | `app/backup/manual_backup.py` | 指定日期 |
| BQ 上傳 | `app/backup/bigquery_uploader.py` | BigQuery 上傳 |
| 配置管理 | `app/backup/config.py` | 環境變數配置 |

### 待開發 ⏳

| 模組 | 路徑 | 說明 |
|------|------|------|
| 清洗引擎 v2 | `app/cleaning/` | YAML 配置化規則 |
| AI 分析 v2 | `app/ai/` | OpenRouter 整合 |
| 資料修正介面 | `data-correction-app/` | Cloud Run 應用 |

---

## 常用命令

```bash
# Python 執行
uv run python -m app.backup.main

# 測試
uv run pytest _local/tests/ -v

# Ragic API
curl -H "Authorization: Basic $RAGIC_API_KEY" \
  "https://ap6.ragic.com/grefun/forms8/17?api&v=3&limit=10"

# BigQuery
bq query --use_legacy_sql=false \
  "SELECT * FROM \`b25h01-ragic.erp_backup.xxx\` LIMIT 10"

# 部署驗證
uv run python scripts/deploy/validate.py
```

---

## 文件查詢

**三階段**: `_docs/README.md` → 分類目錄 → 目標文件

| 類別 | 路徑 | 說明 |
|------|------|------|
| 正式文件 | `_docs/official/` | 核心規劃、確定設計 |
| 規劃文件 | `_docs/planning/` | 開發規劃、待確認 |
| 參考文件 | `_docs/reference/` | 技術研究、知識庫 |

---

## Todo List 防遺漏規則

每個需報告結果的任務，**必須拆分為兩個 Todo**：
- `執行 XXX` → 實際執行
- `報告 XXX 結果` → 向用戶輸出

Context > 70% 時：立即輸出未報告的結果。

---

## 專案規則

### Always
- 任務前先讀取 `_docs/README.md`
- 查詢資料前先確認資料量
- **引用任何名稱前先查閱 `.claude/symbols/index.yaml`**
- **部署前執行驗證腳本**

### Ask First
- 修改資料表結構
- 大規模資料變更（>1000 筆）

### Never
- 絕不跳過索引直接讀取大文件
- **絕不猜測名稱，必須查閱符號索引表**

---

## Ragic API

```yaml
帳號: grefun
伺服器: ap6.ragic.com
端點: https://ap6.ragic.com/grefun/{tab}/{sheet_index}
認證: Authorization: Basic {API_KEY}
每頁: 1000 | 最大頁數: 50
```

### Sheet 對照

| Code | Path | 名稱 |
|------|------|------|
| 10 | forms8/5 | 品牌表 |
| 20 | forms8/4 | 通路表 |
| 30 | forms8/7 | 金流表 |
| 40 | forms8/1 | 物流表 |
| 41 | forms8/6 | 郵遞區號表 |
| 50 | forms8/17 | 訂單表 |
| 60 | forms8/2 | 客戶表 |
| 70 | forms8/9 | 商品表 |
| 80 | forms8/10 | 活動管理表 |
| 99 | forms8/3 | 訂單明細表 |

---

## BigQuery

```yaml
專案: b25h01-ragic
Dataset: erp_backup
位置: asia-east1
```

---

## UMS

```bash
alias ums='/Users/gamepig/projects/Unified-Memory-System/.venv/bin/ums'
ums status | ums memory record "..." | ums memory search "..."
```

---
*繼承自 ~/projects/CLAUDE.md 和 ~/.claude/CLAUDE.md*
