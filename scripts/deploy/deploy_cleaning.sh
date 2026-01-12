#!/bin/bash
# =============================================================================
# 部署清洗函數腳本
# =============================================================================
# 部署 clean-erp-data Cloud Function (Gen2)
# 使用方式: ./scripts/deploy/deploy_cleaning.sh [--dry-run]
# =============================================================================

set -e

# Configuration
PROJECT_ID="b25h01-ragic"
REGION="asia-east1"
FUNCTION_NAME="clean-erp-data"
ENTRY_POINT="clean_erp_data"
RUNTIME="python311"
MEMORY="512MB"
TIMEOUT="900s"
MAX_INSTANCES="1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Parse arguments
DRY_RUN=""
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN="--dry-run"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
done

echo -e "${GREEN}=== 部署清洗函數 ===${NC}"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Function: $FUNCTION_NAME"
echo ""

# Validate
echo -e "${YELLOW}[1/4] 驗證配置...${NC}"
cd "$(dirname "$0")/../.."

# Check if validate.py exists
if [ -f "scripts/deploy/validate.py" ]; then
    uv run python scripts/deploy/validate.py || {
        echo -e "${RED}驗證失敗，請修復問題後重試${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}警告: validate.py 不存在，跳過驗證${NC}"
fi

# Load environment variables from .env
echo -e "${YELLOW}[2/4] 載入環境變數...${NC}"
if [ -f ".env" ]; then
    # shellcheck disable=SC1091
    source .env
    echo -e "${GREEN}✓${NC} 已載入 .env"
else
    echo -e "${RED}錯誤: .env 文件不存在${NC}"
    exit 1
fi

# Validate required env vars
for var in OPENROUTER_API_KEY LINE_MESSAGING_CHANNEL_ACCESS_TOKEN LINE_MESSAGING_USER_ID; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}錯誤: $var 未設定${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓${NC} 環境變數驗證通過"

# Build requirements.txt from pyproject.toml
echo -e "${YELLOW}[3/4] 準備依賴...${NC}"
if command -v uv &> /dev/null; then
    uv pip compile pyproject.toml -o requirements.txt --quiet || {
        echo -e "${YELLOW}使用 pip freeze 代替${NC}"
        uv pip freeze > requirements.txt
    }
fi

# Deploy
echo -e "${YELLOW}[4/4] 部署函數...${NC}"

# 使用環境變數而非 Secret Manager（避免權限問題）
gcloud functions deploy "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --runtime="$RUNTIME" \
    --entry-point="$ENTRY_POINT" \
    --source="." \
    --memory="$MEMORY" \
    --timeout="$TIMEOUT" \
    --max-instances="$MAX_INSTANCES" \
    --trigger-http \
    --gen2 \
    --no-allow-unauthenticated \
    --clear-secrets \
    --set-env-vars="GCP_PROJECT_ID=$PROJECT_ID,BQ_DATASET=erp_backup,BIGQUERY_LOCATION=asia-east1,RULES_DIR=rules,LOG_LEVEL=INFO,ENABLE_AI_ANALYSIS=true,ENABLE_AUTO_FILL=true,ENABLE_NOTIFICATIONS=true,OPENROUTER_API_KEY=${OPENROUTER_API_KEY},OPENROUTER_PRIMARY_MODEL=${OPENROUTER_PRIMARY_MODEL:-meta-llama/llama-3.3-70b-instruct:free},OPENROUTER_FALLBACK_MODEL=${OPENROUTER_FALLBACK_MODEL:-meta-llama/llama-3.2-3b-instruct:free},LINE_MESSAGING_CHANNEL_ACCESS_TOKEN=${LINE_MESSAGING_CHANNEL_ACCESS_TOKEN},LINE_MESSAGING_USER_ID=${LINE_MESSAGING_USER_ID}" \
    $DRY_RUN

if [ -z "$DRY_RUN" ]; then
    echo ""
    echo -e "${GREEN}=== 部署完成 ===${NC}"
    echo "函數 URL:"
    gcloud functions describe "$FUNCTION_NAME" \
        --project="$PROJECT_ID" \
        --region="$REGION" \
        --gen2 \
        --format='value(serviceConfig.uri)'
else
    echo ""
    echo -e "${YELLOW}=== Dry Run 完成 (未實際部署) ===${NC}"
fi
