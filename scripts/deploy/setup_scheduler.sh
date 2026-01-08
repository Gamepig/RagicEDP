#!/bin/bash
# Ragic ERP Backup System v2 - Cloud Scheduler 設定腳本

set -e

# 配置
PROJECT_ID="b25h01-ragic"
REGION="asia-east1"
SA_EMAIL="${PROJECT_ID}@appspot.gserviceaccount.com"
BASE_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=================================================="
echo "Ragic ERP Backup System v2 - Scheduler 設定"
echo "=================================================="

# 刪除舊的排程（如果存在）
echo -e "${YELLOW}清理舊排程...${NC}"
gcloud scheduler jobs delete ragic-daily-backup-v2 \
    --location=$REGION \
    --project=$PROJECT_ID \
    --quiet 2>/dev/null || true

gcloud scheduler jobs delete ragic-weekly-report-v2 \
    --location=$REGION \
    --project=$PROJECT_ID \
    --quiet 2>/dev/null || true

echo -e "${GREEN}✓ 舊排程已清理${NC}"

# 建立每日備份排程
echo ""
echo -e "${YELLOW}建立每日備份排程...${NC}"
gcloud scheduler jobs create http ragic-daily-backup-v2 \
    --schedule="0 0 * * *" \
    --uri="${BASE_URL}/erp-backup-v2" \
    --http-method=POST \
    --oidc-service-account-email=$SA_EMAIL \
    --location=$REGION \
    --project=$PROJECT_ID \
    --time-zone="Asia/Taipei" \
    --description="Ragic ERP 每日備份 (v2)"

echo -e "${GREEN}✓ 每日備份排程已建立 (每天 00:00)${NC}"

# 建立週報排程
echo ""
echo -e "${YELLOW}建立週報排程...${NC}"
gcloud scheduler jobs create http ragic-weekly-report-v2 \
    --schedule="0 3 * * 1" \
    --uri="${BASE_URL}/erp-backup-report-v2" \
    --http-method=POST \
    --oidc-service-account-email=$SA_EMAIL \
    --location=$REGION \
    --project=$PROJECT_ID \
    --time-zone="Asia/Taipei" \
    --description="Ragic ERP 週報 (v2)"

echo -e "${GREEN}✓ 週報排程已建立 (每週一 03:00)${NC}"

echo ""
echo "=================================================="
echo -e "${GREEN}Scheduler 設定完成！${NC}"
echo "=================================================="
echo ""
echo "排程列表:"
gcloud scheduler jobs list --location=$REGION --project=$PROJECT_ID
