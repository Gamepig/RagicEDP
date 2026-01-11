#!/bin/bash
# =============================================================================
# RagicEDP Cloud Function 部署腳本（整合驗證版）
# =============================================================================
# 使用方式:
#   ./scripts/deploy-function.sh                        # 部署 backup-erp-incremental
#   ./scripts/deploy-function.sh clean-erp-data         # 部署指定函數
#   ./scripts/deploy-function.sh --validate-only        # 只執行驗證
#   ./scripts/deploy-function.sh --show-args            # 顯示部署參數
# =============================================================================

set -euo pipefail

# 載入共用函數
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/deploy-common.sh"

# 預設函數名稱
DEFAULT_FUNCTION="backup-erp-incremental"

# 解析參數
FUNCTION_NAME=""
VALIDATE_ONLY=false
SHOW_ARGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        --show-args)
            SHOW_ARGS=true
            shift
            ;;
        -*)
            log_error "未知選項: $1"
            exit 1
            ;;
        *)
            FUNCTION_NAME="$1"
            shift
            ;;
    esac
done

# 使用預設函數名稱
FUNCTION_NAME="${FUNCTION_NAME:-$DEFAULT_FUNCTION}"

# 顯示標題
log_section "RagicEDP Cloud Function 部署"
echo "函數名稱: $FUNCTION_NAME"
echo "專案根目錄: $PROJECT_ROOT"

# 如果只是顯示參數
if [[ "$SHOW_ARGS" == "true" ]]; then
    log_section "部署參數"
    uv run python "$VALIDATE_SCRIPT" --generate-deploy-args="$FUNCTION_NAME"
    exit 0
fi

# 執行驗證
if ! validate_before_deploy "$FUNCTION_NAME"; then
    exit 1
fi

# 如果只是驗證
if [[ "$VALIDATE_ONLY" == "true" ]]; then
    log_success "驗證完成（未執行部署）"
    exit 0
fi

# 確認繼續
if ! confirm_continue "確定要部署 $FUNCTION_NAME 嗎?"; then
    exit 0
fi

# 取得部署參數
log_section "開始部署"
DEPLOY_ARGS=$(uv run python "$VALIDATE_SCRIPT" --generate-deploy-args="$FUNCTION_NAME")

# 執行部署
log_info "執行 gcloud functions deploy..."
eval "gcloud functions deploy $FUNCTION_NAME \
    --source=$PROJECT_ROOT \
    $DEPLOY_ARGS"

# 部署後驗證
verify_function_deployment "$FUNCTION_NAME"

log_section "部署完成"

# 顯示測試命令
FUNCTION_URL=$(gcloud functions describe "$FUNCTION_NAME" \
    --project="$(get_config_value 'gcp.project_id')" \
    --region="$(get_config_value 'gcp.region')" \
    --gen2 \
    --format="value(serviceConfig.uri)")

echo ""
echo "Function URL: $FUNCTION_URL"
echo ""
echo "測試命令:"
echo "  TOKEN=\$(gcloud auth print-identity-token)"
echo "  curl -X POST '$FUNCTION_URL' -H \"Authorization: Bearer \$TOKEN\" -H 'Content-Type: application/json'"
