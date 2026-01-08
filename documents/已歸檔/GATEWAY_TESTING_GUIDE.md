# Gateway 完整測試與部署指南

**版本**: 1.0  
**日期**: 2025-12-26  
**狀態**: ✅ 可用

---

## 📋 目錄

1. [快速開始](#快速開始)
2. [測試流程](#測試流程)
3. [故障排除](#故障排除)
4. [性能調優](#性能調優)
5. [監控與維護](#監控與維護)

---

## 🚀 快速開始

### 啟動 Gateway

```bash
# 自動啟動（推薦）
/Users/gamepig/projects/RagicEDP/scripts/start_gateway.sh

# 或手動啟動
cd /Users/gamepig/projects/MCP_Servers/HTTP-MCP-Gateway
.venv/bin/python3 -m gateway.server &
```

### 停止 Gateway

```bash
# 自動停止（推薦）
/Users/gamepig/projects/RagicEDP/scripts/stop_gateway.sh

# 或手動停止
pkill -f "gateway.server"
```

### 驗證運行狀態

```bash
# 檢查進程
ps aux | grep "gateway.server" | grep -v grep

# 健康檢查
curl http://127.0.0.1:4269/health | python3 -m json.tool

# 查看日誌
tail -50 /tmp/gateway.log
```

---

## 📊 測試流程

### 自動化測試

```bash
# 運行完整測試套件
/Users/gamepig/projects/RagicEDP/scripts/test_gateway.sh

# 測試輸出示例
=== Gateway 完整測試流程 ===
📋 第 1 部分: 基礎檢查
  ✅ Gateway 進程運行中
  ✅ 端口 4269 監聽中

📊 第 2 部分: API 測試
  ✅ Gateway 健康狀態: 正常
  ✅ 數據壓縮功能正常

🔌 第 3 部分: 後端服務測試
  ⚠️  Serena: 已暫時禁用 (配置問題)
  ⚠️  Context7: 已暫時禁用 (啟動問題)

📝 第 4 部分: 日誌分析
  ✅ 日誌正常（錯誤數 < 5）

⚡ 第 5 部分: 性能指標
  ✅ 響應時間: 10ms (性能良好)
```

### 手動測試

#### 1. 健康檢查

```bash
curl -s http://127.0.0.1:4269/health | python3 -m json.tool
```

**預期響應**:
```json
{
  "status": "healthy",
  "version": "0.1a0",
  "uptime_seconds": 100,
  "connections": {
    "active": 1,
    "total": 50,
    "healthy": 1
  }
}
```

#### 2. 數據壓縮測試

```bash
curl -X POST http://127.0.0.1:4269/compress \
  -H "Content-Type: application/json" \
  -d '{"data":{"key":"value"},"compress":"summary"}'
```

**預期**: 返回 TOON 格式的壓縮數據

#### 3. 工具調用測試（當前不可用）

```bash
# Serena (已禁用)
curl -X POST http://127.0.0.1:4269/tools/call \
  -H "Content-Type: application/json" \
  -d '{"server":"serena","tool_name":"get_symbols_overview","arguments":{"relative_path":"."}}'

# Context7 (已禁用)
curl -X POST http://127.0.0.1:4269/tools/call \
  -H "Content-Type: application/json" \
  -d '{"server":"context7","tool_name":"resolve-library-id","arguments":{"libraryName":"pandas"}}'
```

---

## 🔧 故障排除

### 問題 1: Gateway 無法啟動

**症狀**: 進程無法啟動或立即退出

**解決步驟**:

```bash
# 1. 檢查虛擬環境
cd /Users/gamepig/projects/MCP_Servers/HTTP-MCP-Gateway
source .venv/bin/activate

# 2. 驗證依賴
pip list | grep -E "fastapi|uvicorn|pydantic"

# 3. 檢查配置
cat config/global.yaml | head -20

# 4. 查看詳細日誌
tail -100 /tmp/gateway.log

# 5. 手動啟動查看錯誤
.venv/bin/python3 -m gateway.server
```

### 問題 2: 端口已被占用

**症狀**: `Address already in use` 錯誤

**解決**:

```bash
# 查看占用端口的進程
lsof -i :4269

# 終止舊進程
kill -9 <PID>

# 重啟 Gateway
/Users/gamepig/projects/RagicEDP/scripts/start_gateway.sh
```

### 問題 3: 服務連接失敗

**症狀**: `CONNECTION_ERROR` 或 `SERVER_NOT_FOUND`

**解決**:

```bash
# 檢查哪些服務已啟用
grep "enabled: true" /Users/gamepig/projects/MCP_Servers/HTTP-MCP-Gateway/config/global.yaml

# 查看連接日誌
grep -i "connection\|error" /tmp/gateway.log | tail -20

# 檢查特定服務配置
grep -A 5 "serena:" /Users/gamepig/projects/MCP_Servers/HTTP-MCP-Gateway/config/global.yaml
```

### 問題 4: 高延遲或超時

**症狀**: 工具調用超過 17 秒

**解決**:

```bash
# 增加超時時間
# 編輯 config/global.yaml 中的 tool_call_timeout
vi /Users/gamepig/projects/MCP_Servers/HTTP-MCP-Gateway/config/global.yaml

# 調整為:
# gateway:
#   tool_call_timeout: 240  # 從 120 改為 240

# 重啟 Gateway
/Users/gamepig/projects/RagicEDP/scripts/stop_gateway.sh
/Users/gamepig/projects/RagicEDP/scripts/start_gateway.sh
```

---

## ⚡ 性能調優

### 1. 連接池優化

```yaml
# config/global.yaml
gateway:
  connection_pool:
    max_concurrent_connections: 100  # 從 50 增加
    idle_timeout: 600                # 增加空閒超時
```

### 2. 緩存優化

```python
# gateway/cache.py 中的配置
self.cache = GatewayCache(
    tool_def_ttl=3600,    # 工具定義緩存 1 小時
    response_ttl=300,     # 響應緩存 5 分鐘
    connection_ttl=30     # 連接緩存 30 秒
)
```

### 3. 日誌優化

```yaml
# config/global.yaml
gateway:
  log_level: WARNING  # 從 INFO 改為 WARNING（減少 I/O）
```

### 4. 監視連接池狀態

```bash
# 檢查實時統計
curl -s http://127.0.0.1:4269/health | python3 -c "
import json, sys
data = json.load(sys.stdin)
pool = data.get('pool', {})
print(f'已創建: {pool.get(\"total_created\")}')
print(f'已重用: {pool.get(\"reused\")}')
print(f'失敗: {pool.get(\"failed\")}')
"
```

---

## 📈 監控與維護

### 自動化監控腳本

```bash
#!/bin/bash

# 每 5 分鐘檢查一次 Gateway 狀態
while true; do
    if ! curl -s http://127.0.0.1:4269/health | grep -q '"status".*"healthy"'; then
        echo "Gateway 不健康，重啟中..."
        /Users/gamepig/projects/RagicEDP/scripts/stop_gateway.sh
        sleep 2
        /Users/gamepig/projects/RagicEDP/scripts/start_gateway.sh
    fi
    sleep 300
done
```

### 日誌輪轉

```bash
# 每週清理舊日誌
0 0 * * 0 find /tmp -name "gateway*.log" -mtime +7 -delete
```

### 性能基準

| 指標 | 目標 | 當前 |
|------|------|------|
| 啟動時間 | < 10s | ~5s ✅ |
| 響應時間 (/health) | < 100ms | ~10ms ✅ |
| 連接成功率 | > 95% | ~80% ⚠️ |
| 內存占用 | < 200MB | ~60MB ✅ |

---

## 📋 故障排除檢查清單

- [ ] Gateway 進程運行中
- [ ] 端口 4269 監聽中
- [ ] 健康檢查返回 `"status": "healthy"`
- [ ] 數據壓縮功能正常
- [ ] 日誌中無異常錯誤
- [ ] 響應時間 < 100ms
- [ ] 虛擬環境依賴完整
- [ ] 配置文件語法正確

---

## 🎯 下一步

### 短期 (1-2 週)
- [ ] 解決 Serena MCP 配置問題
- [ ] 修復 Context7 啟動問題
- [ ] 進行負載測試

### 中期 (1 個月)
- [ ] 啟用 Prometheus 指標監控
- [ ] 建立自動化監控告警
- [ ] 部署到生產環境

### 長期 (1-3 個月)
- [ ] 支持更多後端服務
- [ ] 實現服務自動故障轉移
- [ ] 建立完整的文檔和教程

---

## 📞 支持

遇到問題？

1. 查看此文檔的故障排除部分
2. 檢查 `/tmp/gateway.log` 日誌
3. 運行 `test_gateway.sh` 進行診斷
4. 參考 `REPAIR_COMPLETION_REPORT.md`

---

*此指南最後更新: 2025-12-26*
