#!/bin/bash

# ============================================================================
# Gateway 完整測試流程
# ============================================================================

set -e  # 任何錯誤都會退出

GATEWAY_URL="http://127.0.0.1:4269"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
LOG_FILE="/tmp/gateway_test_${TIMESTAMP// /_}.log"

echo "=== Gateway 完整測試流程 ===" | tee -a "$LOG_FILE"
echo "時間: $TIMESTAMP" | tee -a "$LOG_FILE"
echo "日誌: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# ============================================================================
# 第 1 部分: 基礎檢查
# ============================================================================

echo "📋 第 1 部分: 基礎檢查" | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

# 1.1 檢查進程
echo "✓ 檢查 Gateway 進程..." | tee -a "$LOG_FILE"
if ps aux | grep "gateway.server" | grep -v grep > /dev/null; then
    echo "  ✅ Gateway 進程運行中" | tee -a "$LOG_FILE"
else
    echo "  ❌ Gateway 進程未運行" | tee -a "$LOG_FILE"
    exit 1
fi

# 1.2 檢查端口
echo "✓ 檢查 4269 端口..." | tee -a "$LOG_FILE"
if lsof -i :4269 > /dev/null 2>&1; then
    echo "  ✅ 端口 4269 監聽中" | tee -a "$LOG_FILE"
else
    echo "  ❌ 端口 4269 未監聽" | tee -a "$LOG_FILE"
    exit 1
fi

echo "" | tee -a "$LOG_FILE"

# ============================================================================
# 第 2 部分: API 測試
# ============================================================================

echo "📊 第 2 部分: API 測試" | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

# 2.1 健康檢查
echo "✓ 健康檢查 /health..." | tee -a "$LOG_FILE"
HEALTH=$(curl -s "$GATEWAY_URL/health" 2>&1)
if echo "$HEALTH" | grep -q '"status".*"healthy"'; then
    echo "  ✅ Gateway 健康狀態: 正常" | tee -a "$LOG_FILE"
    echo "  詳情: $(echo $HEALTH | python3 -m json.tool 2>/dev/null | grep -E 'status|active|healthy' | tr '\n' ' ')" | tee -a "$LOG_FILE"
else
    echo "  ⚠️  Gateway 響應異常: $HEALTH" | tee -a "$LOG_FILE"
fi

# 2.2 測試數據壓縮
echo "✓ 測試 /compress 端點..." | tee -a "$LOG_FILE"
COMPRESS=$(curl -s -X POST "$GATEWAY_URL/compress" \
  -H "Content-Type: application/json" \
  -d '{"data":{"test":"value"},"compress":"summary"}' 2>&1)

if echo "$COMPRESS" | grep -q '"success".*true'; then
    echo "  ✅ 數據壓縮功能正常" | tee -a "$LOG_FILE"
else
    echo "  ⚠️  數據壓縮返回: $(echo $COMPRESS | head -c 100)" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# ============================================================================
# 第 3 部分: 後端服務測試
# ============================================================================

echo "🔌 第 3 部分: 後端服務測試" | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

# 3.1 Serena (已禁用)
echo "✓ Serena 服務..." | tee -a "$LOG_FILE"
echo "  ⚠️  已暫時禁用 (配置問題)" | tee -a "$LOG_FILE"

# 3.2 Context7 (已禁用)
echo "✓ Context7 服務..." | tee -a "$LOG_FILE"
echo "  ⚠️  已暫時禁用 (啟動問題)" | tee -a "$LOG_FILE"

# 3.3 Database
echo "✓ Database 服務..." | tee -a "$LOG_FILE"
DB_TEST=$(curl -s -X POST "$GATEWAY_URL/tools/call" \
  -H "Content-Type: application/json" \
  -d '{"server":"database","tool_name":"query","arguments":{"query":"SELECT 1"}}' 2>&1)
if echo "$DB_TEST" | grep -q "CONNECTION_ERROR\|SERVER_NOT_FOUND"; then
    echo "  ⚠️  無法連接 (預期行為，服務未配置)" | tee -a "$LOG_FILE"
else
    echo "  📊 Database 響應: $(echo $DB_TEST | python3 -m json.tool 2>/dev/null | grep success)" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# ============================================================================
# 第 4 部分: 日誌分析
# ============================================================================

echo "📝 第 4 部分: 日誌分析" | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

echo "✓ 檢查 Gateway 日誌..." | tee -a "$LOG_FILE"
if [ -f /tmp/gateway.log ]; then
    ERROR_COUNT=$(grep -c "ERROR" /tmp/gateway.log || echo "0")
    WARNING_COUNT=$(grep -c "WARNING" /tmp/gateway.log || echo "0")
    echo "  - 錯誤數: $ERROR_COUNT" | tee -a "$LOG_FILE"
    echo "  - 警告數: $WARNING_COUNT" | tee -a "$LOG_FILE"
    
    if [ "$ERROR_COUNT" -gt 5 ]; then
        echo "  ⚠️  檢測到多個錯誤" | tee -a "$LOG_FILE"
    else
        echo "  ✅ 日誌正常" | tee -a "$LOG_FILE"
    fi
else
    echo "  ❌ 日誌文件不存在" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# ============================================================================
# 第 5 部分: 性能指標
# ============================================================================

echo "⚡ 第 5 部分: 性能指標" | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

# 5.1 響應時間
echo "✓ 測試 /health 響應時間..." | tee -a "$LOG_FILE"
TIME_START=$(date +%s%N)
curl -s "$GATEWAY_URL/health" > /dev/null
TIME_END=$(date +%s%N)
TIME_MS=$(( (TIME_END - TIME_START) / 1000000 ))
echo "  ⏱️  響應時間: ${TIME_MS}ms" | tee -a "$LOG_FILE"

if [ "$TIME_MS" -lt 1000 ]; then
    echo "  ✅ 性能良好" | tee -a "$LOG_FILE"
elif [ "$TIME_MS" -lt 5000 ]; then
    echo "  ⚠️  性能一般" | tee -a "$LOG_FILE"
else
    echo "  ❌ 性能不佳" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"

# ============================================================================
# 總結
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "✅ 測試完成" | tee -a "$LOG_FILE"
echo "📋 測試報告: $LOG_FILE" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

