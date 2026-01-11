# Scripts 腳本目錄

> **更新日期**: 2026-01-11
> **用途**: 部署腳本、資料處理腳本、SQL 腳本

---

## 目錄結構

```
scripts/
├── README.md                       # 本檔案
│
├── deploy/                         # 部署腳本
│   ├── deploy_functions.sh         # Cloud Functions 部署
│   ├── setup_scheduler.sh          # 排程設定
│   ├── config.yaml                 # 部署配置
│   └── validate.py                 # 部署前驗證
│
├── sql/                            # SQL 腳本
│   ├── 01_create_tables.sql        # 建立資料表
│   └── 02_init_backup_status.sql   # 初始化備份狀態
│
├── lib/                            # 共用函式庫
│   └── deploy-common.sh            # 部署共用函數
│
├── [部署腳本]
├── [資料處理腳本]
└── [工具腳本]
```

---

## 腳本分類

### 部署腳本

| 腳本 | 說明 | 使用方式 |
|------|------|---------|
| `deploy/deploy_functions.sh` | Cloud Functions 部署 | `./scripts/deploy/deploy_functions.sh` |
| `deploy/setup_scheduler.sh` | Cloud Scheduler 設定 | `./scripts/deploy/setup_scheduler.sh` |
| `deploy/validate.py` | 部署前驗證 | `uv run python scripts/deploy/validate.py` |
| `deploy_cloudrun.sh` | Cloud Run 部署 | `./scripts/deploy_cloudrun.sh` |
| `deploy_cleaning_function.sh` | 清洗函數部署 | `./scripts/deploy_cleaning_function.sh` |
| `deploy_functions.sh` | 函數部署 (舊) | `./scripts/deploy_functions.sh` |
| `deploy-function.sh` | 單一函數部署 | `./scripts/deploy-function.sh` |

### 資料處理腳本

| 腳本 | 說明 | 使用方式 |
|------|------|---------|
| `clean_by_brand.py` | 按品牌清洗資料 | `uv run python scripts/clean_by_brand.py` |
| `clean_for_marketing.py` | 行銷資料清洗 | `uv run python scripts/clean_for_marketing.py` |
| `incremental_fetch.py` | 增量抓取 | `uv run python scripts/incremental_fetch.py` |
| `merge_incremental.py` | 合併增量資料 | `uv run python scripts/merge_incremental.py` |
| `upload_local_to_bq.py` | 本地資料上傳 BQ | `uv run python scripts/upload_local_to_bq.py` |
| `fix_phone_format.py` | 修正電話格式 | `uv run python scripts/fix_phone_format.py` |
| `analyze_cleaned_data.py` | 分析清洗結果 | `uv run python scripts/analyze_cleaned_data.py` |

### 設定腳本

| 腳本 | 說明 | 使用方式 |
|------|------|---------|
| `setup_scheduler.sh` | 設定排程 | `./scripts/setup_scheduler.sh` |
| `setup_cleaning_scheduler.sh` | 設定清洗排程 | `./scripts/setup_cleaning_scheduler.sh` |
| `setup_monitoring.sh` | 設定監控 | `./scripts/setup_monitoring.sh` |

### 工具腳本

| 腳本 | 說明 | 使用方式 |
|------|------|---------|
| `start_gateway.sh` | 啟動 MCP Gateway | `./scripts/start_gateway.sh` |
| `stop_gateway.sh` | 停止 MCP Gateway | `./scripts/stop_gateway.sh` |
| `test_gateway.sh` | 測試 MCP Gateway | `./scripts/test_gateway.sh` |
| `verify_fixes.sh` | 驗證修復 | `./scripts/verify_fixes.sh` |

### SQL 腳本

| 腳本 | 說明 |
|------|------|
| `sql/01_create_tables.sql` | 建立 BigQuery 資料表 |
| `sql/02_init_backup_status.sql` | 初始化備份狀態表 |
| `cleaning_ddl.sql` | 清洗表 DDL |

---

## 使用說明

### 部署前驗證

在部署前務必執行驗證腳本：

```bash
# 驗證符號名稱正確性
uv run python scripts/deploy/validate.py
```

### 常用部署流程

```bash
# 1. 驗證
uv run python scripts/deploy/validate.py

# 2. 部署 Cloud Functions
./scripts/deploy/deploy_functions.sh

# 3. 設定排程
./scripts/deploy/setup_scheduler.sh
```

### 資料處理流程

```bash
# 按品牌清洗
uv run python scripts/clean_by_brand.py --brand GMK

# 上傳到 BigQuery
uv run python scripts/upload_local_to_bq.py --file data/cleaned.json
```

---

## 注意事項

1. **執行權限**: Shell 腳本需要執行權限 (`chmod +x`)
2. **符號索引**: 部署前務必查閱 `.claude/symbols/index.yaml`
3. **環境變數**: 確保 GCP 認證已設定

---

*最後更新: 2026-01-11*
