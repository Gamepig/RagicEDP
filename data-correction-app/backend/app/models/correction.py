"""
修正相關資料模型

Pydantic 模型定義
"""
from datetime import datetime
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class Violation(BaseModel):
    """違規資訊"""
    rule_id: str
    rule_type: str
    field: str
    before: Optional[str] = None
    after: Optional[str] = None
    severity: str
    reason: str
    auto_fixable: bool


class PendingRecord(BaseModel):
    """待處理記錄"""
    record_id: str
    table_code: str
    ragic_id: Optional[str] = None
    original_values: Optional[Dict[str, Any]] = None
    fixed_values: Optional[Dict[str, Any]] = None
    violation_count: int = 0
    ai_suggestion: Optional[str] = None
    confidence_score: Optional[float] = None
    cleaned_at: Optional[str] = None


class RecordDetail(PendingRecord):
    """記錄詳情（含狀態與違規詳情）"""
    status: str
    violations: Optional[List[Violation]] = None


class CorrectionRequest(BaseModel):
    """修正請求"""
    record_id: str
    fixed_values: Dict[str, Any]
    corrected_by: Optional[str] = "user"


class CorrectionResponse(BaseModel):
    """修正回應"""
    success: bool
    record_id: str
    message: Optional[str] = None
    corrected_at: Optional[str] = None


class CorrectionHistory(BaseModel):
    """修正歷史"""
    record_id: str
    table_code: str
    original_values: Optional[Dict[str, Any]] = None
    fixed_values: Optional[Dict[str, Any]] = None
    corrected_at: Optional[str] = None
    corrected_by: Optional[str] = None


class PaginatedResponse(BaseModel):
    """分頁回應"""
    records: List[PendingRecord]
    total: int
    limit: int
    offset: int


class Statistics(BaseModel):
    """統計資訊"""
    pending: int = 0
    manual: int = 0
    completed: int = 0
    auto_fixed: int = 0
    ai_fixed: int = 0


class TableInfo(BaseModel):
    """表格資訊"""
    code: str
    name: str
    bq_table: str


# 表格資訊
TABLE_INFO = {
    '10': TableInfo(code='10', name='品牌表', bq_table='dim_brand'),
    '20': TableInfo(code='20', name='通路表', bq_table='dim_channel'),
    '30': TableInfo(code='30', name='金流表', bq_table='dim_payment'),
    '40': TableInfo(code='40', name='物流表', bq_table='dim_logistics'),
    '41': TableInfo(code='41', name='郵遞區號表', bq_table='dim_postal'),
    '50': TableInfo(code='50', name='訂單表', bq_table='fact_orders'),
    '60': TableInfo(code='60', name='客戶表', bq_table='dim_customer'),
    '70': TableInfo(code='70', name='商品表', bq_table='dim_product'),
    '80': TableInfo(code='80', name='活動管理表', bq_table='dim_campaign'),
    '99': TableInfo(code='99', name='訂單明細表', bq_table='fact_order_details'),
}
