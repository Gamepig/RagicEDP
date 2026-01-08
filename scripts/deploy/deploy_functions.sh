#!/bin/bash
# Ragic ERP Backup System v2 - Cloud Function 部署腳本

set -e

# 配置
PROJECT_ID="b25h01-ragic"
REGION="asia-east1"
RUNTIME="python311"
MEMORY="512Mi"
TIMEOUT="540s"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "Ragic ERP Backup System v2 - 部署腳本"
echo "=================================================="

# 檢查是否有 .env 檔案
if [ ! -f .env ]; then
    echo -e "${RED}錯誤: .env 檔案不存在${NC}"
    echo "請複製 .env.example 為 .env 並填入實際值"
    exit 1
fi

# 載入環境變數
source .env

# 檢查必要的環境變數
if [ -z "$RAGIC_API_KEY" ]; then
    echo -e "${RED}錯誤: RAGIC_API_KEY 未設定${NC}"
    exit 1
fi

if [ -z "$SMTP_FROM_PASSWORD" ]; then
    echo -e "${RED}錯誤: SMTP_FROM_PASSWORD 未設定${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 環境變數檢查通過${NC}"

# 構建環境變數字串
ENV_VARS="RAGIC_API_KEY=${RAGIC_API_KEY},"
ENV_VARS+="RAGIC_ACCOUNT=${RAGIC_ACCOUNT:-grefun},"
ENV_VARS+="RAGIC_SERVER=${RAGIC_SERVER:-ap6.ragic.com},"
ENV_VARS+="RAGIC_PAGE_SIZE=${RAGIC_PAGE_SIZE:-1000},"
ENV_VARS+="RAGIC_MAX_PAGES=${RAGIC_MAX_PAGES:-50},"
ENV_VARS+="RAGIC_TIMEOUT=${RAGIC_TIMEOUT:-180},"
ENV_VARS+="RAGIC_MAX_RETRIES=${RAGIC_MAX_RETRIES:-5},"
ENV_VARS+="GCP_PROJECT_ID=${GCP_PROJECT_ID:-b25h01-ragic},"
ENV_VARS+="BIGQUERY_DATASET=${BIGQUERY_DATASET:-erp_backup},"
ENV_VARS+="BIGQUERY_LOCATION=${BIGQUERY_LOCATION:-asia-east1},"
ENV_VARS+="SMTP_SERVER=${SMTP_SERVER:-smtp.gmail.com},"
ENV_VARS+="SMTP_PORT=${SMTP_PORT:-587},"
ENV_VARS+="SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL},"
ENV_VARS+="SMTP_FROM_PASSWORD=${SMTP_FROM_PASSWORD},"
ENV_VARS+="NOTIFICATION_EMAIL=${NOTIFICATION_EMAIL:-gamepig1976@gmail.com}"

# 部署備份函數
echo ""
echo -e "${YELLOW}部署 erp-backup-v2...${NC}"
gcloud functions deploy erp-backup-v2 \
    --gen2 \
    --runtime=$RUNTIME \
    --region=$REGION \
    --source=. \
    --entry-point=backup_erp_data \
    --trigger-http \
    --allow-unauthenticated \
    --memory=$MEMORY \
    --timeout=$TIMEOUT \
    --set-env-vars="$ENV_VARS" \
    --project=$PROJECT_ID

echo -e "${GREEN}✓ erp-backup-v2 部署完成${NC}"

# 部署週報函數
echo ""
echo -e "${YELLOW}部署 erp-backup-report-v2...${NC}"
gcloud functions deploy erp-backup-report-v2 \
    --gen2 \
    --runtime=$RUNTIME \
    --region=$REGION \
    --source=. \
    --entry-point=send_weekly_report \
    --trigger-http \
    --allow-unauthenticated \
    --memory=$MEMORY \
    --timeout=$TIMEOUT \
    --set-env-vars="$ENV_VARS" \
    --project=$PROJECT_ID

echo -e "${GREEN}✓ erp-backup-report-v2 部署完成${NC}"

echo ""
echo "=================================================="
echo -e "${GREEN}所有函數部署完成！${NC}"
echo "=================================================="
echo ""
echo "函數 URL:"
echo "  備份: https://${REGION}-${PROJECT_ID}.cloudfunctions.net/erp-backup-v2"
echo "  週報: https://${REGION}-${PROJECT_ID}.cloudfunctions.net/erp-backup-report-v2"
