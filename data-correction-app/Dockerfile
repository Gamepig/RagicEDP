# 多階段構建

# 階段 1: 前端構建
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# 階段 2: 後端
FROM python:3.11-slim

WORKDIR /app

# 安裝依賴
RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml ./
RUN uv pip install --system .

# 複製後端程式碼
COPY backend/app ./app

# 複製前端構建產物
COPY --from=frontend-builder /app/frontend/dist ./static

# 設定環境變數
ENV STATIC_DIR=/app/static
ENV PORT=8080

# 暴露埠號
EXPOSE 8080

# 啟動命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
