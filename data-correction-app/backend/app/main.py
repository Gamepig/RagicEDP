"""
資料修正介面後端主程式

FastAPI 應用程式入口
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .routes import data, corrections, schema, backup_logs
from .services.bigquery import BigQueryService

# 設定 logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# 全域 BigQuery 服務實例
bq_service: BigQueryService = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """應用程式生命週期管理"""
    global bq_service

    # 啟動時初始化
    logger.info("初始化 BigQuery 服務...")
    bq_service = BigQueryService()
    logger.info("BigQuery 服務已初始化")

    yield

    # 關閉時清理
    logger.info("應用程式關閉")


def create_app() -> FastAPI:
    """建立 FastAPI 應用程式"""
    app = FastAPI(
        title="RagicEDP 資料修正介面",
        description="資料清洗結果人工修正系統",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS 設定
    cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 註冊路由
    app.include_router(data.router)
    app.include_router(corrections.router)
    app.include_router(schema.router)
    app.include_router(backup_logs.router)

    # 健康檢查端點
    @app.get("/health")
    async def health_check():
        """健康檢查"""
        return {"status": "healthy", "service": "data-correction-backend"}

    # 靜態檔案（生產環境）
    static_dir = os.getenv("STATIC_DIR", "./static")
    if os.path.exists(static_dir):
        app.mount("/assets", StaticFiles(directory=f"{static_dir}/assets"), name="assets")

        @app.get("/")
        async def serve_spa():
            """提供 SPA 首頁"""
            return FileResponse(f"{static_dir}/index.html")

        @app.get("/{path:path}")
        async def serve_spa_routes(path: str):
            """處理 SPA 路由"""
            file_path = f"{static_dir}/{path}"
            if os.path.exists(file_path) and os.path.isfile(file_path):
                return FileResponse(file_path)
            return FileResponse(f"{static_dir}/index.html")

    return app


app = create_app()


def get_bq_service() -> BigQueryService:
    """取得 BigQuery 服務實例"""
    global bq_service
    if bq_service is None:
        bq_service = BigQueryService()
    return bq_service
