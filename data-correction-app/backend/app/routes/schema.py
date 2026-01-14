"""
星狀模型 API（動態版本）

提供 Mermaid 圖表和統計資訊，支持 TTL 快取
"""
from typing import Dict, Literal, Optional, Tuple
import logging
import time

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from ..services.schema_generator import StarSchemaGenerator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/schema", tags=["schema"])

# 使用 Literal 型別約束 level 參數
Level = Literal["overview", "detailed"]

# TTL 快取配置
SCHEMA_CACHE_TTL = 300  # 5 分鐘

# 快取：(timestamp, generator)
_schema_cache: Tuple[float, Optional[StarSchemaGenerator]] = (0.0, None)


def get_generator(force_refresh: bool = False) -> StarSchemaGenerator:
    """
    取得星狀模型生成器（TTL 快取）

    Args:
        force_refresh: 強制重新創建

    Returns:
        StarSchemaGenerator
    """
    global _schema_cache
    now = time.time()
    cache_time, cached_generator = _schema_cache

    # 檢查快取是否有效
    if not force_refresh and cached_generator is not None:
        if (now - cache_time) < SCHEMA_CACHE_TTL:
            logger.debug(f"使用 Schema 快取（剩餘 {SCHEMA_CACHE_TTL - (now - cache_time):.1f} 秒）")
            return cached_generator

    # 快取過期或不存在，創建新實例
    logger.info("創建新的 StarSchemaGenerator 實例...")
    generator = StarSchemaGenerator()
    # 預熱元數據
    generator.get_metadata(force_refresh=True)
    _schema_cache = (now, generator)
    logger.info("Schema 快取已更新")
    return generator


def clear_schema_cache() -> None:
    """清除 Schema 快取"""
    global _schema_cache
    _schema_cache = (0.0, None)
    logger.info("Schema 快取已清除")


# ============ Response Models ============

class MermaidResponse(BaseModel):
    """Mermaid 回應"""
    mermaid: str
    level: str
    last_updated_at: Optional[float] = None


class TableStats(BaseModel):
    """表格統計"""
    name: str
    count: int
    error: Optional[str] = None


class SchemaStats(BaseModel):
    """星狀模型統計"""
    fact_tables: Dict[str, TableStats]
    dim_tables: Dict[str, TableStats]
    total_records: int
    total_tables: int
    last_updated_at: Optional[float] = None


class CacheStatus(BaseModel):
    """快取狀態"""
    cached: bool
    age_seconds: Optional[float] = None
    ttl_seconds: int = SCHEMA_CACHE_TTL
    last_updated_at: Optional[float] = None


class RefreshResponse(BaseModel):
    """刷新回應"""
    success: bool
    message: str
    last_updated_at: float


# ============ API Endpoints ============

@router.get("/mermaid", response_model=MermaidResponse)
async def get_mermaid_code(
    level: Level = Query("overview", description="詳細程度: overview 或 detailed"),
):
    """
    取得 Mermaid 程式碼

    - **level**: overview（概覽）或 detailed（詳細）
    """
    try:
        generator = get_generator()
        mermaid_code = generator.generate_mermaid(level)
        return MermaidResponse(
            mermaid=mermaid_code,
            level=level,
            last_updated_at=generator.last_updated_at,
        )
    except Exception:
        logger.exception("生成 Mermaid 失敗")
        raise HTTPException(status_code=503, detail="BigQuery 服務暫時無法使用")


@router.get("/stats", response_model=SchemaStats)
async def get_schema_stats():
    """取得星狀模型統計資訊"""
    try:
        generator = get_generator()
        stats = generator.generate_stats()
        return SchemaStats(
            fact_tables={k: TableStats(**v) for k, v in stats["fact_tables"].items()},
            dim_tables={k: TableStats(**v) for k, v in stats["dim_tables"].items()},
            total_records=stats["total_records"],
            total_tables=stats["total_tables"],
            last_updated_at=stats.get("last_updated_at"),
        )
    except Exception:
        logger.exception("取得統計失敗")
        raise HTTPException(status_code=503, detail="BigQuery 統計服務暫時無法使用")


@router.get("/cache", response_model=CacheStatus)
async def get_cache_status():
    """取得快取狀態"""
    cache_time, cached_generator = _schema_cache
    now = time.time()

    if cached_generator is None:
        return CacheStatus(cached=False)

    return CacheStatus(
        cached=True,
        age_seconds=round(now - cache_time, 1),
        ttl_seconds=SCHEMA_CACHE_TTL,
        last_updated_at=cached_generator.last_updated_at,
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_schema():
    """
    強制刷新 Schema（清除快取並重新獲取）

    用於 BigQuery 表結構變更後手動觸發更新
    """
    try:
        clear_schema_cache()
        generator = get_generator(force_refresh=True)
        return RefreshResponse(
            success=True,
            message="Schema 已刷新",
            last_updated_at=generator.last_updated_at or time.time(),
        )
    except Exception as e:
        logger.exception("刷新 Schema 失敗")
        raise HTTPException(status_code=503, detail=f"刷新失敗: {str(e)}")


@router.get("/diagram", response_class=HTMLResponse)
async def get_diagram_html(
    level: Level = Query("overview", description="詳細程度"),
):
    """
    取得互動式圖表 HTML 頁面

    可直接在瀏覽器中開啟查看星狀模型圖
    """
    try:
        generator = get_generator()
        html = generator.generate_html(level)
        return HTMLResponse(content=html)
    except Exception:
        logger.exception("生成 HTML 失敗")
        raise HTTPException(status_code=503, detail="BigQuery 服務暫時無法使用")
