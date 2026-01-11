# Quickstart: 資料清洗系統 v2

**Date**: 2026-01-11
**Feature**: 001-data-cleaning-v2

## Prerequisites

- Python 3.11+
- UV (Python package manager)
- GCP 專案存取權限 (b25h01-ragic)
- Node.js 18+ (前端開發)

## 1. 環境設定

### 1.1 Clone 並切換分支

```bash
git checkout 001-data-cleaning-v2
```

### 1.2 安裝 Python 依賴

```bash
uv sync
```

### 1.3 設定環境變數

```bash
# 建立本地環境檔
cp .env.example .env

# 編輯環境變數
export GCP_PROJECT_ID=b25h01-ragic
export BQ_DATASET=erp_backup
export OPENROUTER_API_KEY=<your-key>
```

### 1.4 GCP 認證

```bash
gcloud auth application-default login
```

## 2. 本地開發

### 2.1 執行清洗引擎 (本地測試)

```bash
# 執行單次清洗
uv run python -m app.cleaning.engine

# 指定日期
uv run python -m app.cleaning.engine --date 2026-01-10
```

### 2.2 執行資料修正介面 (本地)

```bash
# 啟動後端
cd data-correction-app/backend
uv run uvicorn app.main:app --reload --port 8000

# 啟動前端 (另一個終端)
cd data-correction-app/frontend
npm install
npm run dev
```

### 2.3 執行測試

```bash
# 單元測試
uv run pytest _local/tests/unit -v

# 整合測試 (需要 GCP 連線)
uv run pytest _local/tests/integration -v
```

## 3. 部署

### 3.1 部署前驗證

```bash
# 驗證符號和規則
uv run python scripts/deploy/validate.py
```

### 3.2 部署清洗函數

```bash
./scripts/deploy/deploy_cleaning.sh
```

### 3.3 部署資料修正介面

```bash
./scripts/deploy/deploy_correction_app.sh
```

## 4. 驗證

### 4.1 觸發清洗 (手動)

```bash
# 呼叫 Cloud Function
curl -X POST \
  -H "Authorization: bearer $(gcloud auth print-identity-token)" \
  https://asia-east1-b25h01-ragic.cloudfunctions.net/clean-erp-data
```

### 4.2 檢查清洗結果

```sql
-- BigQuery 查詢
SELECT
  table_code,
  COUNT(*) as total,
  COUNTIF(status = 'completed') as completed,
  COUNTIF(status = 'manual') as manual
FROM `b25h01-ragic.erp_backup.cleaning_results`
WHERE DATE(processed_at) = CURRENT_DATE()
GROUP BY table_code;
```

### 4.3 訪問資料修正介面

```
https://data-correction-app-xxx.asia-east1.run.app
```

## 5. 常見問題

### Q: OpenRouter API 錯誤

```bash
# 檢查 API Key 是否正確
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

### Q: BigQuery 權限錯誤

```bash
# 確認服務帳號權限
gcloud projects get-iam-policy b25h01-ragic
```

### Q: 清洗規則未載入

```bash
# 驗證 YAML 格式
uv run python -c "from app.cleaning.rule_registry import RuleRegistry; RuleRegistry().load_all_rules()"
```

## 6. 目錄結構

```
app/
├── cleaning/          # 清洗引擎
├── ai/               # AI 模組
└── notification/     # 通知模組

rules/                # YAML 規則配置
data-correction-app/  # 資料修正介面
scripts/deploy/       # 部署腳本
_local/tests/         # 測試
```

## 7. 相關文件

- [spec.md](./spec.md) - 功能規格
- [data-model.md](./data-model.md) - 資料模型
- [contracts/api.yaml](./contracts/api.yaml) - API 契約
- [research.md](./research.md) - 技術研究
