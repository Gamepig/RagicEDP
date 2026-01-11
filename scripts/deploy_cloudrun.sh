#!/bin/bash
#
# Cloud Run 部署腳本
# 部署資料修正介面到 GCP
#
# 安全注意事項：
# - 使用 IAM 認證（內部服務）或 IAP（外部存取）
# - 使用專用 Service Account
# - 使用 Artifact Registry（非 Container Registry）
#

set -euo pipefail

# 錯誤處理
trap 'echo "錯誤發生在第 $LINENO 行"; exit 1' ERR

# 配置
PROJECT_ID="${GCP_PROJECT_ID:-b25h01-ragic}"
REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="data-correction-app"
# 使用 Artifact Registry（非 gcr.io）
REPO_NAME="ragic-edp"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}"
MEMORY="512Mi"
CPU="1"
MAX_INSTANCES=3
MIN_INSTANCES=0
# 專用 Service Account
SERVICE_ACCOUNT="${CLOUDRUN_SA:-cloudrun-app@${PROJECT_ID}.iam.gserviceaccount.com}"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cloud Run 部署 - 資料修正介面${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo "Image: $IMAGE_NAME"
echo ""

# 確認目錄
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_DIR="$PROJECT_ROOT/data-correction-app"

# 檢查必要檔案
if [[ ! -f "$APP_DIR/Dockerfile" ]]; then
    echo -e "${RED}錯誤：找不到 Dockerfile${NC}"
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
echo -e "${YELLOW}步驟 1: 確認 Artifact Registry 存在...${NC}"

# 建立 Artifact Registry（如果不存在）
if ! gcloud artifacts repositories describe "$REPO_NAME" \
    --project="$PROJECT_ID" \
    --location="$REGION" &>/dev/null; then
    echo -e "${YELLOW}建立 Artifact Registry...${NC}"
    gcloud artifacts repositories create "$REPO_NAME" \
        --project="$PROJECT_ID" \
        --location="$REGION" \
        --repository-format=docker \
        --description="RagicEDP Docker images"
fi

echo ""
echo -e "${YELLOW}步驟 2: 確認 Service Account 存在...${NC}"

# 檢查 Service Account
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" --project="$PROJECT_ID" &>/dev/null; then
    echo -e "${YELLOW}建立 Service Account...${NC}"
    gcloud iam service-accounts create "cloudrun-app" \
        --project="$PROJECT_ID" \
        --display-name="Cloud Run App SA"

    # 授予必要權限
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/bigquery.dataViewer"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/bigquery.jobUser"
fi

echo ""
echo -e "${YELLOW}步驟 3: 建置 Docker 映像檔...${NC}"

# 建置並推送映像檔
cd "$APP_DIR"
gcloud builds submit --tag "$IMAGE_NAME" .

echo ""
echo -e "${YELLOW}步驟 4: 部署到 Cloud Run...${NC}"

# 選擇認證模式（支援環境變數 ALLOW_UNAUTHENTICATED=true 跳過互動）
if [[ "${ALLOW_UNAUTHENTICATED:-}" == "true" ]]; then
    AUTH_FLAG="--allow-unauthenticated"
    echo -e "${GREEN}ALLOW_UNAUTHENTICATED=true，服務將可公開存取${NC}"
else
    read -p "允許未認證存取（公開網頁）? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        AUTH_FLAG="--allow-unauthenticated"
        echo -e "${YELLOW}警告：服務將可公開存取${NC}"
    else
        AUTH_FLAG="--no-allow-unauthenticated"
        echo "服務將需要 IAM 認證"
    fi
fi

# 部署 Cloud Run
gcloud run deploy "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --image="$IMAGE_NAME" \
    --platform=managed \
    $AUTH_FLAG \
    --service-account="$SERVICE_ACCOUNT" \
    --memory="$MEMORY" \
    --cpu="$CPU" \
    --max-instances="$MAX_INSTANCES" \
    --min-instances="$MIN_INSTANCES" \
    --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID,BQ_DATASET=erp_backup"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成${NC}"
echo -e "${GREEN}========================================${NC}"

# 取得 URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format="value(status.url)")

echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "健康檢查："
echo "  curl '$SERVICE_URL/health'"
