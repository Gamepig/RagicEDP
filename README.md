# RagicEDP

Ragic ERP 資料平台 - 整合資料備份、清洗、分析與視覺化功能。

## 功能

- **自動備份**: 每日增量備份 Ragic ERP 資料到 BigQuery
- **資料清洗**: 169 條規則自動清洗與驗證
- **AI 分析**: OpenRouter 整合，智能異常檢測
- **資料修正**: Web 介面進行資料修正

## 目錄結構

```
RagicEDP/
├── app/                    # 核心程式碼
│   ├── backup/             # 備份模組
│   ├── cleaning/           # 清洗模組
│   ├── ai/                 # AI 分析
│   ├── etl/                # ETL 轉換
│   ├── notification/       # 通知系統
│   └── utils/              # 工具
├── scripts/                # 部署腳本
├── rules/                  # 清洗規則 (YAML)
└── data-correction-app/    # 資料修正介面
```

## 快速開始

### 安裝依賴

```bash
# 使用 UV
uv sync

# 或 pip
pip install -r requirements.txt
```

### 本地測試

```bash
# 執行增量備份
uv run python -m app.backup.main

# 執行清洗
uv run python -m app.cleaning.engine
```

### 部署

```bash
# 驗證配置
uv run python scripts/deploy/validate.py

# 部署 Cloud Functions
./scripts/deploy/deploy_functions.sh
```

## 技術棧

- **語言**: Python 3.11+
- **套件管理**: UV
- **雲端**: GCP (Cloud Functions, BigQuery, Cloud Run)
- **資料來源**: Ragic ERP

## 配置

環境變數:

```bash
RAGIC_API_KEY=your_api_key
GCP_PROJECT_ID=b25h01-ragic
BIGQUERY_DATASET=erp_backup
```

## 授權

私有專案
