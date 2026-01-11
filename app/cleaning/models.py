"""
Data Models for 資料清洗系統 v2.

Defines Pydantic models for cleaning entities.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


# =============================================================================
# Enums
# =============================================================================


class CleaningStatus(str, Enum):
    """Status values for cleaning results."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    AUTO_FIXED = "auto_fixed"
    AI_FIXED = "ai_fixed"
    MANUAL = "manual"
    FAILED = "failed"


class ViolationStatus(str, Enum):
    """Status values for violations."""

    PENDING = "pending"
    AUTO_FIXED = "auto_fixed"
    AI_FIXED = "ai_fixed"
    MANUAL_FIXED = "manual_fixed"
    IGNORED = "ignored"


class Severity(str, Enum):
    """Severity levels for violations."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ActionType(str, Enum):
    """Action types for cleaning history."""

    AUTO_FIX = "auto_fix"
    AUTO_FILL = "auto_fill"
    AI_FIX = "ai_fix"
    MANUAL_FIX = "manual_fix"
    REVERT = "revert"


class RuleType(str, Enum):
    """Types of cleaning rules."""

    VALIDATION = "validation"
    AUTO_FILL = "auto_fill"
    DERIVED = "derived"


class RuleCategory(str, Enum):
    """Categories of cleaning rules."""

    FORMAT = "format"
    FK = "fk"
    NUMERIC = "numeric"
    REQUIRED = "required"
    UNIQUE = "unique"
    TEMPORAL = "temporal"
    ASSOCIATION = "association"
    FILL = "fill"


# =============================================================================
# Models
# =============================================================================


class Violation(BaseModel):
    """Violation record for a single data issue."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    table_code: str
    record_id: str
    rule_id: str
    field_name: str
    before_value: str | None = None
    after_value: str | None = None
    severity: Severity
    status: ViolationStatus = ViolationStatus.PENDING
    ai_suggestion: str | None = None
    ai_confidence: float | None = None
    detected_at: datetime = Field(default_factory=datetime.utcnow)
    fixed_at: datetime | None = None
    fixed_by: str | None = None

    @field_validator("ai_confidence")
    @classmethod
    def validate_confidence(cls, v: float | None) -> float | None:
        if v is not None and (v < 0.0 or v > 1.0):
            raise ValueError("ai_confidence must be between 0.0 and 1.0")
        return v

    def to_bq_row(self) -> dict[str, Any]:
        """Convert to BigQuery row format."""
        return {
            "id": self.id,
            "table_code": self.table_code,
            "record_id": self.record_id,
            "rule_id": self.rule_id,
            "field_name": self.field_name,
            "before_value": self.before_value,
            "after_value": self.after_value,
            "severity": self.severity.value,
            "status": self.status.value,
            "ai_suggestion": self.ai_suggestion,
            "ai_confidence": self.ai_confidence,
            "detected_at": self.detected_at.isoformat(),
            "fixed_at": self.fixed_at.isoformat() if self.fixed_at else None,
            "fixed_by": self.fixed_by,
        }


class CleaningResult(BaseModel):
    """Summary result for a single record's cleaning."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    table_code: str
    record_id: str
    batch_id: str
    status: CleaningStatus = CleaningStatus.PENDING
    violation_count: int = 0
    fixed_count: int = 0
    pending_count: int = 0
    processed_at: datetime = Field(default_factory=datetime.utcnow)
    processed_by: str = "system"

    def to_bq_row(self) -> dict[str, Any]:
        """Convert to BigQuery row format."""
        return {
            "id": self.id,
            "table_code": self.table_code,
            "record_id": self.record_id,
            "batch_id": self.batch_id,
            "status": self.status.value,
            "violation_count": self.violation_count,
            "fixed_count": self.fixed_count,
            "pending_count": self.pending_count,
            "processed_at": self.processed_at.isoformat(),
            "processed_by": self.processed_by,
        }


class CleaningHistory(BaseModel):
    """History record for a data modification."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    table_code: str
    record_id: str
    action: ActionType
    field_name: str
    before_value: str | None = None
    after_value: str | None = None
    rule_id: str | None = None
    ai_confidence: float | None = None
    modified_by: str = "system"
    modified_at: datetime = Field(default_factory=datetime.utcnow)
    notes: str | None = None

    @field_validator("ai_confidence")
    @classmethod
    def validate_confidence(cls, v: float | None) -> float | None:
        if v is not None and (v < 0.0 or v > 1.0):
            raise ValueError("ai_confidence must be between 0.0 and 1.0")
        return v

    def to_bq_row(self) -> dict[str, Any]:
        """Convert to BigQuery row format."""
        return {
            "id": self.id,
            "table_code": self.table_code,
            "record_id": self.record_id,
            "action": self.action.value,
            "field_name": self.field_name,
            "before_value": self.before_value,
            "after_value": self.after_value,
            "rule_id": self.rule_id,
            "ai_confidence": self.ai_confidence,
            "modified_by": self.modified_by,
            "modified_at": self.modified_at.isoformat(),
            "notes": self.notes,
        }


class CleaningBatch(BaseModel):
    """Batch record for a cleaning run."""

    id: str  # format: batch_{date}_{seq}
    trigger_type: str = "scheduled"  # scheduled, manual, retry
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    status: str = "running"  # running, completed, failed
    total_records: int = 0
    processed_records: int = 0
    auto_fixed_count: int = 0
    ai_fixed_count: int = 0
    manual_count: int = 0
    error_message: str | None = None

    @classmethod
    def create(cls, trigger_type: str = "scheduled") -> "CleaningBatch":
        """Create a new batch with auto-generated ID."""
        now = datetime.utcnow()
        batch_id = f"batch_{now.strftime('%Y%m%d')}_{now.strftime('%H%M%S')}"
        return cls(id=batch_id, trigger_type=trigger_type, started_at=now)

    def complete(self, error: str | None = None) -> None:
        """Mark batch as complete or failed."""
        self.completed_at = datetime.utcnow()
        self.status = "failed" if error else "completed"
        self.error_message = error

    def to_bq_row(self) -> dict[str, Any]:
        """Convert to BigQuery row format."""
        return {
            "id": self.id,
            "trigger_type": self.trigger_type,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": self.status,
            "total_records": self.total_records,
            "processed_records": self.processed_records,
            "auto_fixed_count": self.auto_fixed_count,
            "ai_fixed_count": self.ai_fixed_count,
            "manual_count": self.manual_count,
            "error_message": self.error_message,
        }


class FillResult(BaseModel):
    """Result of an auto-fill operation."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    table_code: str
    record_id: str
    field_name: str
    rule_id: str
    before_value: Any | None = None
    after_value: Any | None = None
    status: ViolationStatus = ViolationStatus.PENDING
    batch_id: str | None = None
    fixed_at: datetime | None = None

    def to_bq_row(self) -> dict[str, Any]:
        """Convert to BigQuery row format."""
        return {
            "id": self.id,
            "table_code": self.table_code,
            "record_id": self.record_id,
            "field_name": self.field_name,
            "rule_id": self.rule_id,
            "before_value": str(self.before_value) if self.before_value else None,
            "after_value": str(self.after_value) if self.after_value else None,
            "status": self.status.value,
            "batch_id": self.batch_id,
            "fixed_at": self.fixed_at.isoformat() if self.fixed_at else None,
        }


# =============================================================================
# Request/Response Models for API
# =============================================================================


class ViolationListRequest(BaseModel):
    """Request for listing violations."""

    table_code: str | None = None
    status: ViolationStatus | None = None
    severity: Severity | None = None
    rule_id: str | None = None
    limit: int = 100
    offset: int = 0


class ViolationFixRequest(BaseModel):
    """Request to fix a violation."""

    violation_id: str
    new_value: str
    notes: str | None = None


class BatchFixRequest(BaseModel):
    """Request to fix multiple violations."""

    fixes: list[ViolationFixRequest]


class CleaningStatsResponse(BaseModel):
    """Response for cleaning statistics."""

    total_records: int
    pending_count: int
    auto_fixed_count: int
    ai_fixed_count: int
    manual_count: int
    failed_count: int
    auto_rate_percent: float
    by_table: dict[str, int]
    by_severity: dict[str, int]
