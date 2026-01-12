"""
資料操作 API

處理待處理記錄查詢、統計等功能
"""
from typing import Optional, List, Dict, Any, Tuple
import logging
import time

from fastapi import APIRouter, HTTPException, Query

from ..services.bigquery import BigQueryService
from ..models.correction import (
    PendingRecord,
    RecordDetail,
    PaginatedResponse,
    Statistics,
    TABLE_INFO,
    TableInfo,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/data", tags=["data"])

# BigQuery 服務（延後初始化）
_bq_service: Optional[BigQueryService] = None

# 統計資訊快取（TTL: 60 秒）
_stats_cache: Tuple[float, Optional[Dict[str, Any]]] = (0.0, None)
STATS_CACHE_TTL = 60  # 秒


def get_bq_service() -> BigQueryService:
    """取得 BigQuery 服務"""
    global _bq_service
    if _bq_service is None:
        _bq_service = BigQueryService()
    return _bq_service


def get_cached_statistics() -> Dict[str, Any]:
    """取得快取的統計資訊（60 秒 TTL）"""
    global _stats_cache
    now = time.time()
    cache_time, cached_data = _stats_cache

    # 如果快取有效，直接返回
    if cached_data is not None and (now - cache_time) < STATS_CACHE_TTL:
        logger.debug(f"使用統計快取（剩餘 {STATS_CACHE_TTL - (now - cache_time):.1f} 秒）")
        return cached_data

    # 快取過期或不存在，重新查詢
    bq = get_bq_service()
    stats = bq.get_statistics()
    _stats_cache = (now, stats)
    logger.debug("統計資訊已更新快取")
    return stats


@router.get("/pending", response_model=PaginatedResponse)
async def list_pending_records(
    table_code: Optional[str] = Query(None, description="表格代碼"),
    limit: int = Query(20, ge=1, le=100, description="每頁筆數"),
    offset: int = Query(0, ge=0, description="偏移量"),
):
    """
    取得待處理記錄列表

    - **table_code**: 篩選特定表格（可選）
    - **limit**: 每頁筆數（1-100）
    - **offset**: 分頁偏移量
    """
    try:
        bq = get_bq_service()
        result = bq.get_pending_records(
            table_code=table_code,
            limit=limit,
            offset=offset,
        )
        return PaginatedResponse(
            records=[PendingRecord(**r) for r in result['records']],
            total=result['total'],
            limit=result['limit'],
            offset=result['offset'],
        )
    except Exception as e:
        logger.exception("取得待處理記錄失敗")
        raise HTTPException(status_code=500, detail="內部錯誤，請稍後再試")


@router.get("/pending/{record_id}", response_model=RecordDetail)
async def get_record_detail(record_id: str):
    """
    取得記錄詳情

    - **record_id**: 記錄 ID
    """
    try:
        bq = get_bq_service()
        record = bq.get_record_detail(record_id)
        if not record:
            raise HTTPException(status_code=404, detail="記錄不存在")
        return RecordDetail(**record)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("取得記錄詳情失敗")
        raise HTTPException(status_code=500, detail="內部錯誤，請稍後再試")


@router.get("/statistics", response_model=Statistics)
async def get_statistics():
    """取得統計資訊（60 秒快取）"""
    try:
        stats = get_cached_statistics()
        return Statistics(**stats)
    except Exception as e:
        logger.exception("取得統計資訊失敗")
        raise HTTPException(status_code=500, detail="內部錯誤，請稍後再試")


@router.get("/tables", response_model=List[TableInfo])
async def list_tables():
    """取得表格列表"""
    return list(TABLE_INFO.values())
