#!/bin/bash
#
# Cloud Scheduler 設定腳本 - 資料清洗
# 設定每日資料清洗排程
#
# 安全注意事項：
# - 使用 OIDC 認證呼叫 Cloud Function
# - 使用專用 Service Account
#

set -euo pipefail

# 錯誤處理
trap 'echo "錯誤發生在第 $LINENO 行"; exit 1' ERR

# 配置
PROJECT_ID="${GCP_PROJECT_ID:-b25h01-ragic}"
REGION="${GCP_REGION:-asia-east1}"
JOB_NAME="trigger-erp-cleaning"
SCHEDULE="0 6 * * *"  # 每天早上 6 點執行（備份後 4 小時）
TIMEZONE="Asia/Taipei"
SCHEDULER_SA="${SCHEDULER_SA:-scheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com}"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cloud Scheduler 設定 - 資料清洗${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Project: $PROJECT_ID"
echo "Job: $JOB_NAME"
echo "Schedule: $SCHEDULE ($TIMEZONE)"
echo ""

# 取得 Cloud Function URL
FUNCTION_URL=$(gcloud functions describe "clean-erp-data" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format="value(httpsTrigger.url)" 2>/dev/null || echo "")

if [[ -z "$FUNCTION_URL" ]]; then
    echo -e "${RED}錯誤：找不到 Cloud Function 'clean-erp-data'${NC}"
    echo -e "${RED}請先執行 deploy_cleaning_function.sh${NC}"
    exit 1
fi

echo "Target URL: $FUNCTION_URL"
echo ""

# 確認設定
read -p "確定要建立排程? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "取消設定"
    exit 0
fi

echo ""
echo -e "${YELLOW}步驟 1: 確認 Scheduler Service Account 存在...${NC}"

# 檢查 Service Account
if ! gcloud iam service-accounts describe "$SCHEDULER_SA" --project="$PROJECT_ID" &>/dev/null; then
    echo -e "${YELLOW}建立 Scheduler Service Account...${NC}"
    gcloud iam service-accounts create "scheduler-invoker" \
        --project="$PROJECT_ID" \
        --display-name="Scheduler Invoker SA"
fi

# 授予 Scheduler Service Agent OIDC 代簽權限
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SCHEDULER_AGENT="service-${PROJECT_NUMBER}@gcp-sa-cloudscheduler.iam.gserviceaccount.com"

# [P1 Fix] 不吞錯，IAM 綁定失敗要明確記錄並中止
echo -e "${YELLOW}授予 OIDC 代簽權限...${NC}"
if ! gcloud iam service-accounts add-iam-policy-binding "$SCHEDULER_SA" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:$SCHEDULER_AGENT" \
    --role="roles/iam.serviceAccountTokenCreator" 2>&1; then
    echo -e "${RED}錯誤：OIDC 代簽權限綁定失敗${NC}"
    echo -e "${RED}Scheduler 將無法使用 OIDC 認證呼叫 Function${NC}"
    echo -e "${YELLOW}請確認帳號有 IAM Admin 權限，或手動執行此綁定${NC}"
    exit 1
fi

# 授予呼叫 Cloud Function 的權限
echo -e "${YELLOW}授予 Function Invoker 權限...${NC}"
if ! gcloud functions add-iam-policy-binding "clean-erp-data" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --member="serviceAccount:$SCHEDULER_SA" \
    --role="roles/cloudfunctions.invoker"; then
    echo -e "${RED}錯誤：Function Invoker 權限綁定失敗${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}步驟 2: 建立 Cloud Scheduler Job...${NC}"

# 檢查是否已存在
EXISTING=$(gcloud scheduler jobs list \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --filter="name:$JOB_NAME" \
    --format="value(name)" 2>/dev/null || echo "")

if [[ -n "$EXISTING" ]]; then
    echo -e "${YELLOW}Job 已存在，更新設定...${NC}"
    gcloud scheduler jobs update http "$JOB_NAME" \
        --project="$PROJECT_ID" \
        --location="$REGION" \
        --schedule="$SCHEDULE" \
        --time-zone="$TIMEZONE" \
        --uri="$FUNCTION_URL" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{"send_notification": true}' \
        --oidc-service-account-email="$SCHEDULER_SA" \
        --oidc-token-audience="$FUNCTION_URL" \
        --attempt-deadline="600s" \
        --max-retry-attempts=3 \
        --min-backoff="30s" \
        --max-backoff="300s"
else
    echo -e "${YELLOW}建立新 Job...${NC}"
    gcloud scheduler jobs create http "$JOB_NAME" \
        --project="$PROJECT_ID" \
        --location="$REGION" \
        --schedule="$SCHEDULE" \
        --time-zone="$TIMEZONE" \
        --uri="$FUNCTION_URL" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{"send_notification": true}' \
        --oidc-service-account-email="$SCHEDULER_SA" \
        --oidc-token-audience="$FUNCTION_URL" \
        --attempt-deadline="600s" \
        --max-retry-attempts=3 \
        --min-backoff="30s" \
        --max-backoff="300s"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}設定完成${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "排程資訊："
gcloud scheduler jobs describe "$JOB_NAME" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --format="table(name,schedule,timeZone,state)"

echo ""
echo "手動觸發測試："
echo "  gcloud scheduler jobs run $JOB_NAME --project=$PROJECT_ID --location=$REGION"
