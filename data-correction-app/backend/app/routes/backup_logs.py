"""
備份日誌 API

處理每日備份記錄查詢功能
"""
from typing import Optional, List
import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..services.bigquery import BigQueryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/backup-logs", tags=["backup-logs"])


# ========================================
# Pydantic 模型定義
# ========================================

class DailyBackupSummary(BaseModel):
    """每日備份摘要"""
    backup_date: str
    total_fetched: int = Field(description="總抓取筆數")
    auto_fixed: int = Field(default=0, description="自動修正數")
    ai_fixed: int = Field(default=0, description="AI 修正數")
    manual_required: int = Field(default=0, description="需人工處理數")
    success_count: int = Field(default=0, description="備份成功表數")
    failed_count: int = Field(default=0, description="備份失敗表數")


class DailyBackupListResponse(BaseModel):
    """每日備份列表回應"""
    records: List[DailyBackupSummary]
    total: int
    limit: int
    offset: int


class SheetBackupDetail(BaseModel):
    """單表備份詳情"""
    sheet_code: str
    sheet_name: str
    records_fetched: int
    records_inserted: int
    records_updated: int
    records_filtered: int
    status: str
    error_message: Optional[str] = None
    duration_seconds: float
    backup_time: Optional[str] = None


class CleaningStatsByTable(BaseModel):
    """單表清洗統計"""
    table_code: str
    table_name: str
    total_records: int
    auto_fixed: int
    ai_fixed: int
    manual: int
    completed: int
    failed: int


class FixedRecordSummary(BaseModel):
    """修正記錄摘要"""
    record_id: str
    table_code: str
    status: str
    violation_count: int
    confidence_score: Optional[float] = None
    cleaned_at: Optional[str] = None


class DailyBackupDetailResponse(BaseModel):
    """每日備份詳情回應"""
    backup_date: str
    summary: DailyBackupSummary
    sheet_logs: List[SheetBackupDetail]
    cleaning_stats: List[CleaningStatsByTable]
    fixed_records: List[FixedRecordSummary]
    fixed_records_total: int


# ========================================
# BigQuery 服務（延後初始化）
# ========================================

_bq_service: Optional[BigQueryService] = None


def get_bq_service() -> BigQueryService:
    """取得 BigQuery 服務"""
    global _bq_service
    if _bq_service is None:
        _bq_service = BigQueryService()
    return _bq_service


# ========================================
# API 端點
# ========================================

@router.get("/daily", response_model=DailyBackupListResponse)
async def list_daily_backups(
    date_from: Optional[str] = Query(None, description="開始日期 (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="結束日期 (YYYY-MM-DD)"),
    limit: int = Query(20, ge=1, le=100, description="每頁筆數"),
    offset: int = Query(0, ge=0, description="偏移量"),
):
    """
    取得每日備份記錄列表

    整合 backup_logs 和 cleaning_results 資料
    """
    try:
        bq = get_bq_service()
        result = bq.get_daily_backup_list(
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )
        return DailyBackupListResponse(**result)
    except Exception as e:
        logger.exception("取得每日備份列表失敗")
        raise HTTPException(status_code=500, detail="內部錯誤，請稍後再試")


@router.get("/daily/{backup_date}", response_model=DailyBackupDetailResponse)
async def get_daily_backup_detail(
    backup_date: str,
    records_limit: int = Query(50, ge=1, le=200, description="修正記錄限制"),
    records_offset: int = Query(0, ge=0, description="修正記錄偏移"),
):
    """
    取得特定日期的備份詳情

    包含：
    - 備份摘要統計
    - 各表備份日誌
    - 各表清洗統計
    - 修正記錄列表（可分頁）
    """
    try:
        bq = get_bq_service()
        result = bq.get_daily_backup_detail(
            backup_date=backup_date,
            records_limit=records_limit,
            records_offset=records_offset,
        )
        if not result:
            raise HTTPException(status_code=404, detail="該日期無備份記錄")
        return DailyBackupDetailResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("取得備份詳情失敗")
        raise HTTPException(status_code=500, detail="內部錯誤，請稍後再試")
