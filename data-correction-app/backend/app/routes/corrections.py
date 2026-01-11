"""
修正操作 API

處理修正提交、歷史查詢等功能
"""
from typing import Optional, List
import logging
import os
import re
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Depends, Header

from ..services.bigquery import BigQueryService
from ..models.correction import (
    CorrectionRequest,
    CorrectionResponse,
    CorrectionHistory,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/corrections", tags=["corrections"])


# [P0 Fix] 認證機制
# 正式環境應使用 JWT/OIDC，這裡先用 API Key 作為 MVP
API_KEY = os.getenv("CORRECTION_API_KEY")
# [P0 Fix] 處理空白並過濾空字串
ALLOWED_USERS = [u.strip() for u in os.getenv("ALLOWED_USERS", "admin,operator").split(",") if u.strip()]


async def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
) -> str:
    """
    驗證 API Key 並取得使用者身分

    Args:
        x_api_key: API Key (Header)
        x_user_id: 使用者 ID (Header)

    Returns:
        驗證後的使用者 ID

    Raises:
        HTTPException: 認證失敗
    """
    # 開發環境可跳過認證（僅限本地開發）
    if os.getenv("ENV", "production") == "development" and not API_KEY:
        return x_user_id or "dev-user"

    # 生產環境必須有 API Key
    if not API_KEY:
        logger.error("CORRECTION_API_KEY 未設定")
        raise HTTPException(status_code=500, detail="伺服器配置錯誤")

    if not x_api_key:
        raise HTTPException(status_code=401, detail="缺少認證資訊")

    if x_api_key != API_KEY:
        logger.warning(f"API Key 驗證失敗: user={x_user_id}")
        raise HTTPException(status_code=401, detail="認證失敗")

    # 驗證使用者 ID
    if not x_user_id:
        raise HTTPException(status_code=401, detail="缺少使用者身分")

    if x_user_id not in ALLOWED_USERS:
        logger.warning(f"使用者 {x_user_id} 不在允許清單中")
        raise HTTPException(status_code=403, detail="權限不足")

    return x_user_id


# [P0 Fix] 日期格式驗證
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_date(date_str: Optional[str], field_name: str) -> Optional[str]:
    """驗證日期格式"""
    if not date_str:
        return None

    if not DATE_PATTERN.match(date_str):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} 格式錯誤，應為 YYYY-MM-DD"
        )

    # 驗證日期有效性
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} 不是有效日期"
        )

    return date_str

# BigQuery 服務（延後初始化）
_bq_service: Optional[BigQueryService] = None


def get_bq_service() -> BigQueryService:
    """取得 BigQuery 服務"""
    global _bq_service
    if _bq_service is None:
        _bq_service = BigQueryService()
    return _bq_service


@router.post("/submit", response_model=CorrectionResponse)
async def submit_correction(
    request: CorrectionRequest,
    user_id: str = Depends(verify_api_key),  # [P0 Fix] 加入認證
):
    """
    提交修正

    - **record_id**: 記錄 ID
    - **fixed_values**: 修正後的值

    需要認證 Header:
    - X-API-Key: API 金鑰
    - X-User-ID: 使用者 ID
    """
    try:
        bq = get_bq_service()

        # 驗證 fixed_values 不為空
        if not request.fixed_values:
            raise HTTPException(status_code=400, detail="修正值不可為空")

        # 限制 fixed_values 大小（防止 DoS）
        import json
        if len(json.dumps(request.fixed_values)) > 10000:
            raise HTTPException(status_code=400, detail="修正值過大")

        # [P0 Fix] 記錄操作日誌（不含敏感資料）
        logger.info(
            f"修正提交: user={user_id}, record_id={request.record_id}, "
            f"fields={list(request.fixed_values.keys())}"
        )

        # 套用修正（使用認證後的 user_id）
        result = bq.apply_correction(
            record_id=request.record_id,
            fixed_values=request.fixed_values,
            corrected_by=user_id,  # [P0 Fix] 使用認證的使用者 ID
        )

        return CorrectionResponse(
            success=True,
            record_id=request.record_id,
            message="修正已儲存",
            corrected_at=result.get('corrected_at'),
        )
    except HTTPException:
        raise
    except ValueError as e:
        # 記錄不存在或狀態不正確
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.exception("提交修正失敗")
        # 不洩漏內部錯誤訊息
        raise HTTPException(status_code=500, detail="內部錯誤，請稍後再試")


@router.get("/history", response_model=List[CorrectionHistory])
async def list_correction_history(
    table_code: Optional[str] = Query(None, description="表格代碼"),
    date_from: Optional[str] = Query(None, description="開始日期 (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="結束日期 (YYYY-MM-DD)"),
    limit: int = Query(100, ge=1, le=1000, description="限制筆數"),
    _: str = Depends(verify_api_key),  # [P0 Fix] 加入認證
):
    """
    取得修正歷史

    - **table_code**: 篩選特定表格（可選）
    - **date_from**: 開始日期（可選）
    - **date_to**: 結束日期（可選）
    - **limit**: 限制筆數（1-1000）

    需要認證 Header:
    - X-API-Key: API 金鑰
    - X-User-ID: 使用者 ID
    """
    # [P0 Fix] 驗證日期格式
    validated_date_from = validate_date(date_from, "date_from")
    validated_date_to = validate_date(date_to, "date_to")

    try:
        bq = get_bq_service()
        history = bq.get_correction_history(
            table_code=table_code,
            date_from=validated_date_from,
            date_to=validated_date_to,
            limit=limit,
        )
        return [CorrectionHistory(**h) for h in history]
    except Exception:
        logger.exception("取得修正歷史失敗")
        raise HTTPException(status_code=500, detail="內部錯誤，請稍後再試")
