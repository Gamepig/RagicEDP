"""
資料操作 API

處理待處理記錄查詢、統計等功能
"""
from typing import Optional, List
import logging

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


def get_bq_service() -> BigQueryService:
    """取得 BigQuery 服務"""
    global _bq_service
    if _bq_service is None:
        _bq_service = BigQueryService()
    return _bq_service


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
    """取得統計資訊"""
    try:
        bq = get_bq_service()
        stats = bq.get_statistics()
        return Statistics(**stats)
    except Exception as e:
        logger.exception("取得統計資訊失敗")
        raise HTTPException(status_code=500, detail="內部錯誤，請稍後再試")


@router.get("/tables", response_model=List[TableInfo])
async def list_tables():
    """取得表格列表"""
    return list(TABLE_INFO.values())
