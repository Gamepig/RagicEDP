"""
Correction schemas.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class CorrectionStatus(str, Enum):
    """Status of a correction."""

    APPROVED = "approved"
    REJECTED = "rejected"


class CorrectionCreate(BaseModel):
    """Request to create a correction."""

    violation_id: str
    new_value: Any
    status: CorrectionStatus = CorrectionStatus.APPROVED
    comment: str | None = None


class CorrectionResponse(BaseModel):
    """Response after creating a correction."""

    id: str
    violation_id: str
    record_id: str
    table_code: str
    field_name: str
    before_value: Any | None = None
    after_value: Any
    corrected_by: str
    corrected_at: datetime


class BulkCorrectionCreate(BaseModel):
    """Request for bulk corrections."""

    corrections: list[CorrectionCreate] = Field(..., min_length=1)


class AISuggestionApply(BaseModel):
    """Request to apply AI suggestion."""

    violation_id: str
    apply: bool = True
    comment: str | None = None
