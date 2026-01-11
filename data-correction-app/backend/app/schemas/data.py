"""
Data schemas for pending records and violations.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ViolationDetail(BaseModel):
    """Violation detail for a single field."""

    id: str
    rule_id: str
    field_name: str
    before_value: Any | None = None
    after_value: Any | None = None
    severity: str
    status: str
    ai_suggestion: str | None = None
    ai_confidence: float | None = None
    ai_reasoning: str | None = None
    detected_at: datetime


class PendingRecord(BaseModel):
    """Summary of a pending record."""

    record_id: str
    table_code: str
    table_name: str
    violation_count: int
    severity: str  # highest severity
    detected_at: datetime
    ai_suggestions_count: int = 0


class PendingRecordList(BaseModel):
    """Paginated list of pending records."""

    items: list[PendingRecord]
    total: int
    page: int = 1
    page_size: int = 20
    has_more: bool = False


class RecordDetail(BaseModel):
    """Full detail of a record with violations."""

    record_id: str
    table_code: str
    table_name: str
    violations: list[ViolationDetail]
    record_data: dict[str, Any] = Field(default_factory=dict)


class DashboardStats(BaseModel):
    """Dashboard statistics."""

    total_pending: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    by_table: dict[str, int] = Field(default_factory=dict)
    ai_suggestions_count: int = 0
    overdue_count: int = 0
