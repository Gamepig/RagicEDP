# Cloud Functions 部署規劃書

**建立日期**: 2026-01-07
**版本**: v1.0
**狀態**: 待執行

---

## 1. 部署概述

### 1.1 目標

將 Ragic ERP 增量備份系統部署到 Google Cloud Functions，並設定 Cloud Scheduler 每日自動執行。

### 1.2 系統架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        GCP 架構                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Cloud Scheduler          Cloud Functions          BigQuery    │
│   ┌─────────────┐         ┌──────────────┐       ┌──────────┐  │
│   │ 每日 00:00  │ ──────> │ backup-erp   │ ────> │ erp_     │  │
│   │ 觸發備份    │   HTTP  │ -incremental │ Write │ backup   │  │
│   └─────────────┘         └──────────────┘       └──────────┘  │
│                                  │                              │
│                                  │ 失敗時                       │
│                                  ↓                              │
│                           ┌──────────────┐                      │
│                           │ Email 通知   │                      │
│                           └──────────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 GCP 資源現況

| 資源 | 狀態 | 說明 |
|------|------|------|
| 專案 | ✅ 已建立 | `b25h01-ragic` |
| BigQuery Dataset | ✅ 已建立 | `erp_backup` (asia-east1) |
| BQ 資料表 | ✅ 已建立 | 12 個表（10 個資料表 + 2 個管理表） |
| Cloud Functions | ❌ 待部署 | 無 Gen2 函數 |
| Cloud Scheduler | ⏸️ 待更新 | 有舊排程（已暫停） |
| Secret Manager | ❓ 待確認 | 儲存 API Key |

---

## 2. 部署前準備：本地資料上傳 BQ

### 2.1 現況分析

**本地資料（已清洗）**:

| 表格代碼 | 名稱 | 本地記錄數 | BQ 記錄數 | 差異 |
|---------|------|-----------|----------|------|
| 10 | 品牌管理 | 6 | 7 | -1 |
| 20 | 通路管理 | 408 | 0 | +408 |
| 30 | 金流管理 | 8 | 0 | +8 |
| 40 | 物流管理 | 32 | 0 | +32 |
| 41 | 郵遞區號 | 369 | 0 | +369 |
| 50 | 訂單管理 | 59,812 | 133 | +59,679 |
| 60 | 客戶管理 | 40,009 | 71 | +39,938 |
| 70 | 商品管理 | 840 | 0 | +840 |
| 80 | 活動管理 | 42 | 0 | +42 |
| 99 | 訂單明細 | 175,674 | 417 | +175,257 |
| **合計** | | **277,200** | **628** | **+276,572** |

### 2.2 上傳策略

由於本地資料與 BQ 差異很大，採用「清空後重建」策略：

```
Step 1: 清空 BQ 表格（僅資料表，保留 backup_logs）
        ↓
Step 2: 使用 full_backup.py 上傳本地資料
        ↓
Step 3: 驗證資料數量
```

### 2.3 上傳指令

```bash
# Step 1: 確認要上傳的本地檔案
ls -la data/cleaned_backup/*.json

# Step 2: 執行全量上傳（會清空後重建）
export $(grep -v '^#' .env | xargs)
uv run python src/full_backup.py --source local --confirm

# Step 3: 驗證 BQ 資料數量
bq query --use_legacy_sql=false \
  "SELECT 'sheet_50_order' as table_name, COUNT(*) as cnt FROM \`b25h01-ragic.erp_backup.sheet_50_order\`
   UNION ALL
   SELECT 'sheet_60_customer', COUNT(*) FROM \`b25h01-ragic.erp_backup.sheet_60_customer\`
   UNION ALL
   SELECT 'sheet_99_order_detail', COUNT(*) FROM \`b25h01-ragic.erp_backup.sheet_99_order_detail\`"
```

### 2.4 預估時間

| 表格 | 記錄數 | 預估上傳時間 |
|------|--------|-------------|
| 小型表（10,20,30,40,41,70,80） | ~1,700 | < 30 秒 |
| 表50 訂單管理 | 59,812 | ~2-3 分鐘 |
| 表60 客戶管理 | 40,009 | ~1-2 分鐘 |
| 表99 訂單明細 | 175,674 | ~5-8 分鐘 |
| **合計** | **277,200** | **~10-15 分鐘** |

---

## 3. Cloud Functions 部署

### 3.1 函數規格

| 項目 | 設定值 |
|------|--------|
| **函數名稱** | `backup-erp-incremental` |
| **執行環境** | Gen2 (Cloud Run) |
| **區域** | asia-east1 (台灣) |
| **執行時間** | Python 3.11 |
| **記憶體** | 512 MB |
| **逾時** | 540 秒 (9 分鐘) |
| **進入點** | `backup_erp_data` |
| **觸發方式** | HTTP |

### 3.2 部署檔案結構

```
RagicEDP/
├── src/
│   ├── __init__.py
│   ├── config.py
│   ├── incremental.py
│   ├── main.py              ← Cloud Function 進入點
│   └── utils/
│       ├── __init__.py
│       ├── logger.py
│       └── email.py
├── requirements.txt          ← Cloud Function 依賴
└── .gcloudignore            ← 排除不必要的檔案
```

### 3.3 建立 .gcloudignore

```bash
cat > .gcloudignore << 'EOF'
# Git
.git
.gitignore

# Python
__pycache__
*.pyc
.venv
.env

# IDE
.vscode
.idea

# Data
data/
*.json

# Documents
documents/
*.md

# Tests
tests/
test_workspace/

# Others
*.log
.DS_Store
EOF
```

### 3.4 部署指令

```bash
# Step 1: 設定環境變數（從 Secret Manager 或直接設定）
gcloud functions deploy backup-erp-incremental \
  --gen2 \
  --runtime=python311 \
  --region=asia-east1 \
  --source=. \
  --entry-point=backup_erp_data \
  --trigger-http \
  --memory=512MB \
  --timeout=540s \
  --set-env-vars="RAGIC_API_KEY=<YOUR_API_KEY>" \
  --set-env-vars="GCP_PROJECT_ID=b25h01-ragic" \
  --set-env-vars="BIGQUERY_DATASET=erp_backup" \
  --set-env-vars="SMTP_FROM_PASSWORD=<YOUR_SMTP_PASSWORD>" \
  --allow-unauthenticated

# Step 2: 取得函數 URL
gcloud functions describe backup-erp-incremental \
  --gen2 \
  --region=asia-east1 \
  --format='value(serviceConfig.uri)'
```

### 3.5 使用 Secret Manager（建議）

```bash
# 建立 Secret
echo -n "<YOUR_RAGIC_API_KEY>" | gcloud secrets create ragic-api-key --data-file=-
echo -n "<YOUR_SMTP_PASSWORD>" | gcloud secrets create smtp-password --data-file=-

# 授權 Cloud Function 存取 Secret
gcloud secrets add-iam-policy-binding ragic-api-key \
  --member="serviceAccount:b25h01-ragic@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 部署時使用 Secret
gcloud functions deploy backup-erp-incremental \
  --gen2 \
  --runtime=python311 \
  --region=asia-east1 \
  --source=. \
  --entry-point=backup_erp_data \
  --trigger-http \
  --memory=512MB \
  --timeout=540s \
  --set-secrets="RAGIC_API_KEY=ragic-api-key:latest,SMTP_FROM_PASSWORD=smtp-password:latest" \
  --set-env-vars="GCP_PROJECT_ID=b25h01-ragic,BIGQUERY_DATASET=erp_backup"
```

---

## 4. Cloud Scheduler 設定

### 4.1 排程規格

| 項目 | 設定值 |
|------|--------|
| **任務名稱** | `erp-backup-daily` |
| **區域** | asia-east1 |
| **排程** | `0 0 * * *` (每日 00:00) |
| **時區** | Asia/Taipei |
| **目標類型** | HTTP |
| **HTTP 方法** | POST |

### 4.2 建立排程

```bash
# 取得 Cloud Function URL
FUNCTION_URL=$(gcloud functions describe backup-erp-incremental \
  --gen2 \
  --region=asia-east1 \
  --format='value(serviceConfig.uri)')

# 建立 Scheduler Job
gcloud scheduler jobs create http erp-backup-daily \
  --location=asia-east1 \
  --schedule="0 0 * * *" \
  --time-zone="Asia/Taipei" \
  --uri="${FUNCTION_URL}" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{}' \
  --attempt-deadline=600s \
  --oidc-service-account-email="b25h01-ragic@appspot.gserviceaccount.com"
```

### 4.3 清理舊排程（可選）

```bash
# 刪除舊的暫停排程
for job in erp-backup-10-weekly erp-backup-20-weekly erp-backup-30-weekly \
           erp-backup-40-weekly erp-backup-41-weekly erp-backup-50-weekly \
           erp-backup-60-weekly erp-backup-70-weekly erp-backup-99-weekly \
           erp-backup-agg-weekly erp-backup-weekly; do
  gcloud scheduler jobs delete $job --location=asia-east1 --quiet
done
```

---

## 5. 測試計劃

### 5.1 本地測試（已完成）

| 測試項目 | 狀態 | 結果 |
|---------|------|------|
| 增量抓取 | ✅ | 成功抓取 286 筆 |
| 資料過濾 | ✅ | 正確過濾 127 筆 |
| BQ 上傳 | ✅ | 成功寫入 159 筆 |

### 5.2 雲端測試流程

```
Phase A: 資料準備
┌─────────────────────────────────────────────────────────────┐
│ A1. 執行本地資料上傳 BQ                                       │
│ A2. 驗證 BQ 資料數量                                         │
│ A3. 記錄基準資料量                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
Phase B: Cloud Functions 部署
┌─────────────────────────────────────────────────────────────┐
│ B1. 建立 .gcloudignore                                       │
│ B2. 部署 Cloud Function                                      │
│ B3. 取得函數 URL                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
Phase C: 手動觸發測試
┌─────────────────────────────────────────────────────────────┐
│ C1. 使用 curl 手動呼叫函數                                   │
│ C2. 檢查執行日誌                                             │
│ C3. 驗證 BQ 資料變化                                         │
│ C4. 檢查 backup_logs 記錄                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
Phase D: Scheduler 測試
┌─────────────────────────────────────────────────────────────┐
│ D1. 建立 Scheduler Job                                       │
│ D2. 手動執行一次 Scheduler                                   │
│ D3. 驗證執行結果                                             │
│ D4. 啟用自動排程                                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
Phase E: 監控確認
┌─────────────────────────────────────────────────────────────┐
│ E1. 等待隔日自動執行                                         │
│ E2. 檢查執行日誌和結果                                       │
│ E3. 確認系統穩定運行                                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 測試指令

```bash
# C1. 手動觸發測試
curl -X POST "${FUNCTION_URL}" \
  -H "Content-Type: application/json" \
  -d '{}'

# C2. 查看執行日誌
gcloud functions logs read backup-erp-incremental \
  --gen2 \
  --region=asia-east1 \
  --limit=50

# C3. 驗證 BQ 資料
bq query --use_legacy_sql=false \
  "SELECT * FROM \`b25h01-ragic.erp_backup.backup_logs\`
   ORDER BY backup_time DESC LIMIT 5"

# D2. 手動執行 Scheduler
gcloud scheduler jobs run erp-backup-daily --location=asia-east1
```

---

## 6. 完整執行檢查清單

### Phase A: 資料準備

- [ ] A1. 確認 .env 檔案包含所有必要環境變數
- [ ] A2. 執行 `full_backup.py` 上傳本地資料到 BQ
- [ ] A3. 驗證 BQ 各表資料數量正確
- [ ] A4. 記錄基準資料量

### Phase B: Cloud Functions 部署

- [ ] B1. 建立 `.gcloudignore` 檔案
- [ ] B2. 確認 `requirements.txt` 包含所有依賴
- [ ] B3. 設定 Secret Manager（API Key, SMTP Password）
- [ ] B4. 部署 Cloud Function
- [ ] B5. 記錄函數 URL

### Phase C: 手動測試

- [ ] C1. 使用 curl 呼叫函數
- [ ] C2. 確認函數成功執行（HTTP 200）
- [ ] C3. 檢查 Cloud Functions 日誌
- [ ] C4. 驗證 BQ backup_logs 有新記錄
- [ ] C5. 確認無錯誤通知郵件

### Phase D: Scheduler 設定

- [ ] D1. 建立 `erp-backup-daily` Scheduler Job
- [ ] D2. 手動執行一次 Scheduler
- [ ] D3. 驗證執行結果
- [ ] D4. 刪除舊的暫停排程（可選）
- [ ] D5. 確認 Scheduler 狀態為 ENABLED

### Phase E: 監控確認

- [ ] E1. 等待隔日 00:00 自動執行
- [ ] E2. 檢查執行日誌
- [ ] E3. 驗證 BQ 資料正確更新
- [ ] E4. 確認系統穩定運行

---

## 7. 環境變數清單

| 變數名稱 | 說明 | 來源 |
|---------|------|------|
| `RAGIC_API_KEY` | Ragic API 金鑰 | Secret Manager |
| `GCP_PROJECT_ID` | GCP 專案 ID | 環境變數 |
| `BIGQUERY_DATASET` | BigQuery Dataset | 環境變數 |
| `SMTP_FROM_EMAIL` | 寄件人 Email | 環境變數 |
| `SMTP_FROM_PASSWORD` | SMTP 密碼 | Secret Manager |
| `NOTIFICATION_EMAIL` | 通知收件人 | 環境變數 |

---

## 8. 故障排除

### 8.1 常見問題

| 問題 | 可能原因 | 解決方案 |
|------|---------|---------|
| API Key 無效 | Secret 未正確設定 | 檢查 Secret Manager 權限 |
| 函數逾時 | 資料量過大 | 增加逾時設定或分批處理 |
| BQ 寫入失敗 | 權限不足 | 檢查服務帳戶 IAM 角色 |
| Scheduler 未觸發 | 時區設定錯誤 | 確認使用 Asia/Taipei |

### 8.2 日誌查詢

```bash
# Cloud Functions 日誌
gcloud functions logs read backup-erp-incremental \
  --gen2 \
  --region=asia-east1 \
  --limit=100

# 過濾錯誤日誌
gcloud functions logs read backup-erp-incremental \
  --gen2 \
  --region=asia-east1 \
  --filter="severity>=ERROR"

# Cloud Scheduler 執行歷史
gcloud scheduler jobs describe erp-backup-daily \
  --location=asia-east1
```

---

## 9. 預估成本

| 資源 | 用量預估 | 月費用估計 |
|------|---------|-----------|
| Cloud Functions | 30 次/月 x 10 秒 | < $0.10 |
| BigQuery Storage | ~1 GB | < $0.02 |
| BigQuery Query | ~10 GB/月 | < $0.05 |
| Cloud Scheduler | 30 次/月 | 免費 |
| **合計** | | **< $0.20/月** |

---

**文件建立時間**: 2026-01-07 04:30
**待用戶確認後開始執行**
