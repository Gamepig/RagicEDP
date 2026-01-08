# GCP & Ragic 設定總覽

> **來源**: `/Users/gamepig/projects/RagicDataBackup`
> **記錄日期**: 2025-12-29
> **狀態**: 待確認

---

## 1. Ragic API 配置

### 基本設定

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `RAGIC_API_KEY` | `cmtrUVI5WkZxZXgvL283bGZneU9wMGxmcDV6LzFObHdVeWlpQXJxMncxVG5uOWFFVHU1K09zU2c1UXg3UUJLKw==` | Base64 編碼 |
| `RAGIC_ACCOUNT` | `grefun` | 帳戶名稱 |
| `RAGIC_API_ENDPOINT` | `https://ap6.ragic.com/{account}` | API 端點格式 |
| `RAGIC_MAX_PAGES` | `50` | 最大分頁數 |
| `RAGIC_PAGE_SIZE` | `1000` | 每頁筆數 |
| `RAGIC_TIMEOUT` | `180` | 連線逾時 (秒) |
| `RAGIC_MAX_RETRIES` | `5` | 重試次數 |

### 表單映射 (SHEET_MAP_JSON)

| 代碼 | Sheet ID | 表單名稱 | 資料量 |
|-----|----------|---------|--------|
| 10 | forms8/5 | 品牌管理 | 7 筆 |
| 20 | forms8/4 | 通路管理 | 393 筆 |
| 30 | forms8/7 | 金流管理 | 8 筆 |
| 40 | forms8/1 | 物流管理 | 28 筆 |
| 41 | forms8/6 | 縣市郵遞區號 | 369 筆 |
| 50 | forms8/17 | 訂單管理 | 84,498 筆 |
| 60 | forms8/2 | 客戶管理 | 59,044 筆 |
| 70 | forms8/9 | 商品管理 | 1,192 筆 |
| 80 | forms8/10 | 活動管理 | - |
| 99 | forms8/3 | 銷售總表 | 295,700 筆 |

```json
{
  "10": "forms8/5",
  "20": "forms8/4",
  "30": "forms8/7",
  "40": "forms8/1",
  "41": "forms8/6",
  "50": "forms8/17",
  "60": "forms8/2",
  "70": "forms8/9",
  "80": "forms8/10",
  "99": "forms8/3"
}
```

---

## 2. Google Cloud Platform 配置

### 專案基本設定

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `GCP_PROJECT_ID` | `b25h01-ragic` | GCP 專案 ID |
| `REGION` | `asia-east1` | 資源區域 (台灣) |

### BigQuery

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `BIGQUERY_DATASET` | `erp_backup` | Dataset 名稱 |
| `BIGQUERY_TABLE` | `ragic_data` | 主資料表 |
| `BIGQUERY_LOCATION` | `asia-east1` | 資料位置 |

**配置表**:
- `backup_config` - 9 個表單的 Ragic API 配置
- `field_mappings` - 中英文欄位對照
- `unknown_fields` - 未知欄位記錄
- `sheet_sync_state` - 各表單最後同步時間
- `invalid_records` - 無效記錄日誌

### Cloud Functions

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `FUNCTION_NAME` | `erp-backup` | 函數名稱 |
| `ENTRY_POINT` | `backup_erp_data` | 入口點 |
| `MEMORY` | `512Mi` | 記憶體 |
| `RUNTIME` | `python311` | 執行環境 |
| `GCF_URL` | `https://asia-east1-b25h01-ragic.cloudfunctions.net/erp-backup` | 函數 URL |

### Cloud Scheduler

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `SCHEDULE_CRON` | `0 3 * * 1` | 每週一 03:00 |
| `JOB_NAME` | `erp-backup-weekly` | 排程名稱 |
| `SCHEDULER_SA_EMAIL` | `b25h01-ragic@appspot.gserviceaccount.com` | Service Account |

### 已啟用的 GCP API

```
- bigquery.googleapis.com
- cloudfunctions.googleapis.com
- cloudscheduler.googleapis.com
- logging.googleapis.com
```

---

## 3. Service Accounts

| 帳號 | 用途 |
|------|------|
| `b25h01-ragic@appspot.gserviceaccount.com` | App Engine 預設 SA |
| `b25h01-ragic@appspot.iam.gserviceaccount.com` | Cloud Scheduler OIDC 認證 |

---

## 4. 郵件通知配置

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `NOTIFICATION_EMAIL` | `it.ps@grefun.com.tw, gamepig1976@gmail.com` | 通知收件人 |
| `SMTP_FROM_EMAIL` | `gcp.ops.notifications@gmail.com` | 寄件地址 |
| `SMTP_FROM_PASSWORD` | `sjeahwlikrcwtcyj` | SMTP 應用程式密碼 |

---

## 5. 上傳配置

| 變數名稱 | 值 | 說明 |
|---------|-----|------|
| `UPLOAD_MODE` | `auto` | 上傳模式 (auto/staging_sp/direct) |
| `BATCH_THRESHOLD` | `5000` | 批次閾值 |

**策略**:
- 小批次 (< 5000): 直接 MERGE
- 大批次 (>= 5000): Staging Table + Stored Procedure

---

## 6. 時間欄位配置

| 變數名稱 | 值 |
|---------|-----|
| `LAST_MODIFIED_FIELD_NAMES` | `最後修改日期, 最後修改時間, 更新時間, 最後更新時間, _ragicModified` |

---

## 7. 環境變數檔案對照

| 檔案 | 用途 |
|------|------|
| `env_vars.yaml` | 主設定檔 (預設) |
| `.env.deploy.yaml` | 部署環境 (含 TIMEOUT/RETRIES) |
| `.env.all.yaml` | 完整配置 (所有表單) |
| `.env.complete.yaml` | 完整版 (含表單 80) |
| `.env.smtp.yaml` | SMTP 郵件配置 |

---

## 8. 部署命令

### Cloud Function 部署

```bash
gcloud functions deploy erp-backup \
  --runtime python311 \
  --trigger-topic cloud-scheduler \
  --entry-point backup_erp_data \
  --memory 512Mi \
  --region asia-east1 \
  --project b25h01-ragic \
  --set-env-vars="RAGIC_API_KEY=...,BIGQUERY_DATASET=erp_backup,..."
```

### Cloud Scheduler 建立

```bash
gcloud scheduler jobs create http erp-backup-weekly \
  --schedule="0 3 * * 1" \
  --uri="https://asia-east1-b25h01-ragic.cloudfunctions.net/erp-backup" \
  --http-method=POST \
  --oidc-service-account-email="b25h01-ragic@appspot.gserviceaccount.com" \
  --location=asia-east1 \
  --project=b25h01-ragic
```

---

## 9. 快速測試命令

### Ragic API 測試

```bash
# 取得訂單表前 10 筆
curl -H "Authorization: Basic $RAGIC_API_KEY" \
  "https://ap6.ragic.com/grefun/forms8/17?api&v=3&limit=10"
```

### BigQuery 測試

```bash
# 查詢訂單表
bq query --use_legacy_sql=false \
  "SELECT * FROM \`b25h01-ragic.erp_backup.ragic_data\` WHERE sheet_code='50' LIMIT 10"

# 查看同步狀態
bq query --use_legacy_sql=false \
  "SELECT * FROM \`b25h01-ragic.erp_backup.sheet_sync_state\`"
```

---

## 10. 架構說明

### 執行流程

```
main.py (Cloud Function 入口)
└── erp_backup_main.py (業務邏輯)
    ├── config_loader.py → BigQuery backup_config
    ├── ragic_client.py → Ragic API (ap6.ragic.com)
    ├── data_transformer.py → 欄位轉換
    ├── bigquery_uploader.py → BigQuery 上傳
    └── email_notifier.py → 日誌通知
```

### 三層欄位映射

1. **Layer 1**: Python 硬編碼 (`config_field_mapping.py`)
2. **Layer 2**: BigQuery 動態對照 (`field_mappings` 表)
3. **Layer 3**: 自動拼音轉換

### 增量備份機制

- 基於 `sheet_sync_state` 表的最後同步時間
- 時區統一使用 `Asia/Taipei`

---

*最後更新: 2025-12-29*
