#!/bin/bash

# ============================================================================
# Gateway 停止腳本
# ============================================================================

echo "=== Gateway 停止腳本 ==="
echo ""

# 查找 Gateway 進程
PIDS=$(pgrep -f "gateway.server" || true)

if [ -z "$PIDS" ]; then
    echo "⚠️  Gateway 未運行"
    exit 0
fi

echo "✓ 發現 Gateway 進程: $PIDS"
echo "✓ 停止進程..."

# 優雅停止
for PID in $PIDS; do
    kill "$PID" 2>/dev/null || true
done

sleep 2

# 檢查是否停止
REMAINING=$(pgrep -f "gateway.server" || true)
if [ -z "$REMAINING" ]; then
    echo "✅ Gateway 已停止"
    rm -f /tmp/gateway.pid
else
    echo "⚠️  進程仍在運行，強制終止..."
    pkill -9 -f "gateway.server"
    sleep 1
    echo "✅ Gateway 已強制停止"
fi

