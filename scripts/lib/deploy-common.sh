#!/bin/bash
# =============================================================================
# RagicEDP 部署共用函數庫
# =============================================================================
# 使用方式: source "$(dirname "$0")/lib/deploy-common.sh"
# =============================================================================

# 顏色定義
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m'

# 路徑定義
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export LIB_DIR="$SCRIPT_DIR"
export SCRIPTS_DIR="$(dirname "$LIB_DIR")"
export PROJECT_ROOT="$(dirname "$SCRIPTS_DIR")"
export CONFIG_FILE="$SCRIPTS_DIR/deploy/config.yaml"
export VALIDATE_SCRIPT="$SCRIPTS_DIR/deploy/validate.py"

# =============================================================================
# 日誌函數
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# =============================================================================
# 驗證函數
# =============================================================================

# 執行完整部署前驗證
# 用法: validate_before_deploy [function_name]
validate_before_deploy() {
    local function_name="${1:-}"

    log_section "部署前驗證"

    # 檢查配置文件
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_error "配置文件不存在: $CONFIG_FILE"
        return 1
    fi

    # 檢查驗證腳本
    if [[ ! -f "$VALIDATE_SCRIPT" ]]; then
        log_error "驗證腳本不存在: $VALIDATE_SCRIPT"
        return 1
    fi

    # 執行 Python 驗證
    local validate_args="--project-root=$PROJECT_ROOT"
    if [[ -n "$function_name" ]]; then
        validate_args="$validate_args --function=$function_name"
    fi

    if ! python3 "$VALIDATE_SCRIPT" $validate_args; then
        log_error "驗證失敗，請修正上述問題後再部署"
        return 1
    fi

    log_success "驗證通過"
    return 0
}

# 取得函數的部署參數
# 用法: deploy_args=$(get_deploy_args "function-name")
get_deploy_args() {
    local function_name="$1"
    python3 "$VALIDATE_SCRIPT" --generate-deploy-args="$function_name"
}

# 驗證單一 Secret
# 用法: check_secret_exists "secret-name"
check_secret_exists() {
    local secret_name="$1"
    local project_id="${GCP_PROJECT_ID:-b25h01-ragic}"

    if gcloud secrets describe "$secret_name" --project="$project_id" &>/dev/null; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# 部署後驗證
# =============================================================================

# 驗證函數部署狀態
# 用法: verify_function_deployment "function-name"
verify_function_deployment() {
    local function_name="$1"
    local project_id="${GCP_PROJECT_ID:-b25h01-ragic}"
    local region="${GCP_REGION:-asia-east1}"

    log_section "部署後驗證: $function_name"

    # 檢查函數狀態
    local status
    status=$(gcloud functions describe "$function_name" \
        --project="$project_id" \
        --region="$region" \
        --gen2 \
        --format="value(state)" 2>/dev/null)

    if [[ "$status" == "ACTIVE" ]]; then
        log_success "函數狀態: ACTIVE"
    else
        log_error "函數狀態異常: $status"
        return 1
    fi

    # 檢查 Secret 注入
    log_info "檢查 Secret 配置..."
    local secrets
    secrets=$(gcloud functions describe "$function_name" \
        --project="$project_id" \
        --region="$region" \
        --gen2 \
        --format="yaml(serviceConfig.secretEnvironmentVariables)" 2>/dev/null)

    if [[ -n "$secrets" && "$secrets" != "null" ]]; then
        log_success "Secret 已注入"
        echo "$secrets" | head -10
    else
        log_warn "未檢測到 Secret 配置"
    fi

    # 顯示環境變數
    log_info "環境變數配置..."
    gcloud functions describe "$function_name" \
        --project="$project_id" \
        --region="$region" \
        --gen2 \
        --format="yaml(serviceConfig.environmentVariables)" 2>/dev/null | head -10

    return 0
}

# =============================================================================
# 互動函數
# =============================================================================

# 確認繼續
# 用法: confirm_continue "確定要部署嗎?"
confirm_continue() {
    local message="${1:-確定要繼續嗎?}"

    echo ""
    read -p "$message (y/N) " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warn "操作已取消"
        return 1
    fi
    return 0
}

# =============================================================================
# 配置讀取函數（使用 Python）
# =============================================================================

# 從配置文件讀取值
# 用法: value=$(get_config_value "gcp.project_id")
get_config_value() {
    local key_path="$1"
    python3 -c "
import yaml
with open('$CONFIG_FILE') as f:
    config = yaml.safe_load(f)
keys = '$key_path'.split('.')
value = config
for key in keys:
    value = value.get(key, '')
print(value if value else '')
"
}

# =============================================================================
# 初始化檢查
# =============================================================================

# 檢查必要工具
check_prerequisites() {
    local missing=()

    if ! command -v gcloud &>/dev/null; then
        missing+=("gcloud")
    fi

    if ! command -v python3 &>/dev/null; then
        missing+=("python3")
    fi

    if ! python3 -c "import yaml" 2>/dev/null; then
        missing+=("pyyaml (pip install pyyaml)")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "缺少必要工具: ${missing[*]}"
        return 1
    fi

    return 0
}

# 自動檢查（載入時執行）
if [[ "${DEPLOY_SKIP_PREREQ_CHECK:-}" != "1" ]]; then
    check_prerequisites || exit 1
fi
