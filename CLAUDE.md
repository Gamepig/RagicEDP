# RagicEDP 專案配置

> v1.0 | 2025-12-30 | 精簡版（繼承上層配置）

---

## 專案概述

Ragic ERP 資料平台 - 整合資料備份、清理、分析與視覺化功能。

**技術**: Python 3.11+ | UV | BigQuery | Ragic REST API | 正體中文

---

## 常用命令

```bash
uv run python analysis/xxx.py           # Python 執行
uv run pytest -v                        # 測試
curl -H "Authorization: Basic $RAGIC_API_KEY" "https://ap6.ragic.com/grefun/forms8/17?api&v=3&limit=10"
bq query --use_legacy_sql=false "SELECT * FROM \`b25h01-ragic.erp_backup.xxx\` LIMIT 10"
```

---

## 文件查詢

**三階段**: `index.md` → `文件摘要.md` → 目標文件

| 目錄 | 索引 |
|------|------|
| `documents/` | `documents/index.md` |
| `參考資料/` | `參考資料/index.md` |

---

## Todo List 防遺漏規則

每個需報告結果的任務，**必須拆分為兩個 Todo**：
- `執行 XXX` → 實際執行
- `報告 XXX 結果` → 向用戶輸出

Context > 70% 時：立即輸出未報告的結果。

---

## 專案規則

### Always
- 任務前先讀取 index.md
- 查詢資料前先確認資料量

### Ask First
- 修改資料表結構
- 大規模資料變更（>1000 筆）

### Never
- 絕不跳過索引直接讀取大文件

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

## 目錄結構

```
RagicEDP/
├── documents/       # 專案文件
├── 參考資料/         # 技術參考
├── src/             # 程式碼
├── scripts/         # 正式腳本（✅ Git）
├── test_workspace/  # 測試程式（❌ Git）
└── data/            # 資料檔案（❌ Git）
```

---

## UMS

```bash
alias ums='/Users/gamepig/projects/Unified-Memory-System/.venv/bin/ums'
ums status | ums memory record "..." | ums memory search "..."
```

---
*繼承自 ~/projects/CLAUDE.md 和 ~/.claude/CLAUDE.md*
