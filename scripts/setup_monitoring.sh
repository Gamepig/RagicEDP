#!/bin/bash
#
# 監控與告警設定腳本
# 設定 GCP 監控儀表板和告警策略
#

set -e

# 配置
PROJECT_ID="${GCP_PROJECT_ID:-b25h01-ragic}"
NOTIFICATION_CHANNEL="${NOTIFICATION_EMAIL:-}"

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}監控與告警設定${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Project: $PROJECT_ID"
echo ""

# 建立告警策略 JSON
cat > /tmp/alert-policy-function-error.json << 'EOF'
{
  "displayName": "Cloud Function 錯誤告警 - 備份系統",
  "conditions": [
    {
      "displayName": "backup-erp-data 執行錯誤",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_function\" AND resource.labels.function_name=\"backup-erp-data\" AND metric.type=\"cloudfunctions.googleapis.com/function/execution_count\" AND metric.labels.status!=\"ok\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ],
  "combiner": "OR",
  "enabled": true
}
EOF

# 清洗系統告警
cat > /tmp/alert-policy-cleaning-error.json << 'EOF'
{
  "displayName": "Cloud Function 錯誤告警 - 清洗系統",
  "conditions": [
    {
      "displayName": "clean-erp-data 執行錯誤",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_function\" AND resource.labels.function_name=\"clean-erp-data\" AND metric.type=\"cloudfunctions.googleapis.com/function/execution_count\" AND metric.labels.status!=\"ok\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ],
  "combiner": "OR",
  "enabled": true
}
EOF

cat > /tmp/alert-policy-cloudrun-error.json << 'EOF'
{
  "displayName": "Cloud Run 錯誤告警",
  "conditions": [
    {
      "displayName": "data-correction-app 5xx 錯誤",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"data-correction-app\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 5,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ],
  "combiner": "OR",
  "enabled": true
}
EOF

echo -e "${YELLOW}步驟 1: 檢查現有告警策略...${NC}"

# 列出現有告警
gcloud alpha monitoring policies list \
    --project="$PROJECT_ID" \
    --format="table(displayName,enabled)" 2>/dev/null || echo "無現有告警策略"

echo ""
echo -e "${YELLOW}步驟 2: 建立/更新告警策略...${NC}"

# 注意：需要先設定通知管道（Email/SMS/PagerDuty 等）
# 這裡只建立策略框架

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}監控設定說明${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "1. Cloud Function 監控："
echo "   - 執行次數、錯誤率、延遲"
echo "   - 記憶體使用量"
echo ""
echo "2. Cloud Run 監控："
echo "   - 請求數、錯誤率、延遲"
echo "   - CPU/記憶體使用量"
echo "   - 容器實例數"
echo ""
echo "3. BigQuery 監控："
echo "   - 查詢數、掃描量"
echo "   - 費用追蹤"
echo ""
echo "4. 建議操作："
echo "   a. 前往 GCP Console > Monitoring > Alerting"
echo "   b. 建立通知管道（Email）"
echo "   c. 建立告警策略"
echo ""
echo "監控儀表板："
echo "  https://console.cloud.google.com/monitoring/dashboards?project=$PROJECT_ID"
echo ""
echo "告警策略："
echo "  https://console.cloud.google.com/monitoring/alerting?project=$PROJECT_ID"
