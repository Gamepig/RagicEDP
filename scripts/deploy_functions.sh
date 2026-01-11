#!/bin/bash
#
# Cloud Functions 部署腳本
# 部署資料清洗系統到 GCP
#
# 安全注意事項：
# - 使用 IAM 認證（非公開存取）
# - 使用專用 Service Account
# - 密鑰透過 Secret Manager 管理
#

set -euo pipefail

# 錯誤處理
trap 'echo "錯誤發生在第 $LINENO 行"; exit 1' ERR

# 配置
PROJECT_ID="${GCP_PROJECT_ID:-b25h01-ragic}"
REGION="${GCP_REGION:-asia-east1}"
FUNCTION_NAME="backup-erp-data"
RUNTIME="python311"
ENTRY_POINT="backup_erp_data"
MEMORY="512MB"
TIMEOUT="540s"
MAX_INSTANCES=1
# 專用 Service Account（需預先建立）
SERVICE_ACCOUNT="${FUNCTION_SA:-backup-function@${PROJECT_ID}.iam.gserviceaccount.com}"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cloud Functions 部署${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Function: $FUNCTION_NAME"
echo ""

# 確認目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 檢查必要檔案
if [[ ! -f "$PROJECT_ROOT/app/backup/main.py" ]]; then
    echo -e "${RED}錯誤：找不到 app/backup/main.py${NC}"
    exit 1
fi

if [[ ! -f "$PROJECT_ROOT/requirements.txt" ]]; then
    echo -e "${RED}錯誤：找不到 requirements.txt${NC}"
    exit 1
fi

# 檢查 gcloud 登入狀態
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [[ -z "$CURRENT_PROJECT" ]]; then
    echo -e "${RED}錯誤：請先執行 gcloud auth login 並設定專案${NC}"
    exit 1
fi

echo "目前 gcloud 專案: $CURRENT_PROJECT"
echo "目標部署專案: $PROJECT_ID"

# 確認部署
read -p "確定要部署到 $PROJECT_ID? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "取消部署"
    exit 0
fi

echo ""
echo -e "${YELLOW}步驟 1: 確認 Service Account 存在...${NC}"

# 檢查 Service Account
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" --project="$PROJECT_ID" &>/dev/null; then
    echo -e "${YELLOW}建立 Service Account...${NC}"
    gcloud iam service-accounts create "backup-function" \
        --project="$PROJECT_ID" \
        --display-name="Backup Function SA"

    # 授予必要權限
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/bigquery.dataEditor"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/bigquery.jobUser"
fi

echo ""
echo -e "${YELLOW}步驟 2: 部署 Cloud Function（IAM 認證）...${NC}"

# 部署 Cloud Function（Gen1，使用 IAM 認證）
# 注意：--source 指向專案根目錄，入口點在 app/backup/main.py
# 若使用 Gen2，需改用 --gen2 並確認 invoker 權限
gcloud functions deploy "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --runtime="$RUNTIME" \
    --source="$PROJECT_ROOT" \
    --entry-point="$ENTRY_POINT" \
    --trigger-http \
    --no-allow-unauthenticated \
    --service-account="$SERVICE_ACCOUNT" \
    --memory="$MEMORY" \
    --timeout="$TIMEOUT" \
    --max-instances="$MAX_INSTANCES" \
    --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID,BQ_DATASET=erp_backup"

# 注意：如果部署為 Gen2，需要額外授予 run.invoker 權限給呼叫方
# gcloud run services add-iam-policy-binding "$FUNCTION_NAME" \
#     --project="$PROJECT_ID" \
#     --region="$REGION" \
#     --member="serviceAccount:scheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com" \
#     --role="roles/run.invoker"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成${NC}"
echo -e "${GREEN}========================================${NC}"

# 取得 URL
FUNCTION_URL=$(gcloud functions describe "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format="value(httpsTrigger.url)")

echo ""
echo "Function URL: $FUNCTION_URL"
echo ""
echo "測試命令："
echo "  curl -X POST '$FUNCTION_URL' -H 'Content-Type: application/json' -d '{}'"
