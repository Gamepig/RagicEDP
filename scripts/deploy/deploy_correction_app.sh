#!/bin/bash
# =============================================================================
# Data Correction App Deployment Script
# Deploys the data correction interface to Cloud Run
# =============================================================================

set -euo pipefail

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-b25h01-ragic}"
REGION="${GCP_REGION:-asia-east1}"
SERVICE_NAME="${SERVICE_NAME:-data-correction-app}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Main Functions
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI not found. Please install Google Cloud SDK."
        exit 1
    fi

    # Check docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi

    # Check project configuration
    CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
        log_warn "Current project ($CURRENT_PROJECT) differs from target ($PROJECT_ID)"
        log_info "Setting project to $PROJECT_ID..."
        gcloud config set project "$PROJECT_ID"
    fi

    log_info "Prerequisites check passed."
}

build_image() {
    log_info "Building Docker image..."

    cd "$(dirname "$0")/../../data-correction-app"

    # Build with Cloud Build for better caching
    if [ "${USE_CLOUD_BUILD:-false}" == "true" ]; then
        log_info "Using Cloud Build..."
        gcloud builds submit --tag "$IMAGE_NAME:latest" .
    else
        log_info "Using local Docker build..."
        docker build -t "$IMAGE_NAME:latest" .
        docker push "$IMAGE_NAME:latest"
    fi

    log_info "Image built: $IMAGE_NAME:latest"
}

deploy_service() {
    log_info "Deploying to Cloud Run..."

    gcloud run deploy "$SERVICE_NAME" \
        --image "$IMAGE_NAME:latest" \
        --platform managed \
        --region "$REGION" \
        --allow-unauthenticated \
        --memory 512Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 3 \
        --timeout 300 \
        --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,BQ_DATASET=erp_backup,ENV=development"

    log_info "Service deployed successfully!"
}

get_service_url() {
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
        --platform managed \
        --region "$REGION" \
        --format 'value(status.url)')

    log_info "Service URL: $SERVICE_URL"
    echo "$SERVICE_URL"
}

verify_deployment() {
    log_info "Verifying deployment..."

    SERVICE_URL=$(get_service_url)

    # Health check
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health")

    if [ "$HTTP_CODE" == "200" ]; then
        log_info "Health check passed (HTTP $HTTP_CODE)"
    else
        log_error "Health check failed (HTTP $HTTP_CODE)"
        exit 1
    fi
}

# =============================================================================
# Script Entry Point
# =============================================================================

usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy     Full deployment (build + deploy + verify)"
    echo "  build      Build Docker image only"
    echo "  push       Deploy existing image"
    echo "  verify     Verify deployment health"
    echo "  url        Get service URL"
    echo ""
    echo "Environment variables:"
    echo "  GCP_PROJECT_ID   GCP project (default: b25h01-ragic)"
    echo "  GCP_REGION       Cloud Run region (default: asia-east1)"
    echo "  SERVICE_NAME     Service name (default: data-correction-app)"
    echo "  USE_CLOUD_BUILD  Use Cloud Build instead of local Docker (default: false)"
}

main() {
    local command="${1:-deploy}"

    case "$command" in
        deploy)
            check_prerequisites
            build_image
            deploy_service
            verify_deployment
            ;;
        build)
            check_prerequisites
            build_image
            ;;
        push)
            check_prerequisites
            deploy_service
            ;;
        verify)
            verify_deployment
            ;;
        url)
            get_service_url
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
