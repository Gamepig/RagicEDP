#!/bin/bash

# ============================================================================
# Gateway 啟動腳本
# ============================================================================

GATEWAY_DIR="/Users/gamepig/projects/MCP_Servers/HTTP-MCP-Gateway"
LOG_FILE="/tmp/gateway.log"
PID_FILE="/tmp/gateway.pid"

echo "=== Gateway 啟動腳本 ==="
echo "目錄: $GATEWAY_DIR"
echo "日誌: $LOG_FILE"
echo ""

# 檢查目錄
if [ ! -d "$GATEWAY_DIR" ]; then
    echo "❌ Gateway 目錄不存在: $GATEWAY_DIR"
    exit 1
fi

# 檢查虛擬環境
if [ ! -d "$GATEWAY_DIR/.venv" ]; then
    echo "❌ 虛擬環境不存在"
    exit 1
fi

# 檢查是否已運行
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        echo "⚠️  Gateway 已在運行 (PID: $OLD_PID)"
        echo "✓ 停止舊進程..."
        kill "$OLD_PID"
        sleep 2
    fi
fi

# 啟動 Gateway
echo "✓ 啟動 Gateway..."
cd "$GATEWAY_DIR"
nohup .venv/bin/python3 -m gateway.server > "$LOG_FILE" 2>&1 &
GATEWAY_PID=$!
echo "$GATEWAY_PID" > "$PID_FILE"

# 等待啟動
sleep 3

# 檢查進程
if ps -p "$GATEWAY_PID" > /dev/null 2>&1; then
    echo "✅ Gateway 已啟動 (PID: $GATEWAY_PID)"
    
    # 檢查健康狀態
    sleep 2
    HEALTH=$(curl -s http://127.0.0.1:4269/health 2>&1)
    if echo "$HEALTH" | grep -q '"status".*"healthy"'; then
        echo "✅ Gateway 健康狀態: 正常"
        echo ""
        echo "📊 Gateway 信息:"
        echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
    else
        echo "⚠️  Gateway 啟動但狀態未知"
        echo "詳情: $HEALTH"
    fi
else
    echo "❌ Gateway 啟動失敗"
    echo "日誌內容:"
    tail -30 "$LOG_FILE"
    exit 1
fi

