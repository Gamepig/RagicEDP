"""
Error Handling Utilities for 資料清洗系統 v2.

Provides custom exceptions and error handling utilities.
"""

from typing import Any


# =============================================================================
# Base Exceptions
# =============================================================================


class CleaningError(Exception):
    """Base exception for cleaning system errors."""

    def __init__(
        self,
        message: str,
        code: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code or "CLEANING_ERROR"
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "error": self.code,
            "message": self.message,
            "details": self.details,
        }


# =============================================================================
# Rule Exceptions
# =============================================================================


class RuleError(CleaningError):
    """Error related to cleaning rules."""

    def __init__(self, message: str, rule_id: str | None = None, **kwargs):
        super().__init__(message, code="RULE_ERROR", **kwargs)
        self.rule_id = rule_id
        if rule_id:
            self.details["rule_id"] = rule_id


class RuleNotFoundError(RuleError):
    """Rule not found in registry."""

    def __init__(self, rule_id: str):
        super().__init__(f"Rule not found: {rule_id}", rule_id=rule_id)
        self.code = "RULE_NOT_FOUND"


class RuleValidationError(RuleError):
    """Rule validation failed."""

    def __init__(self, rule_id: str, validation_errors: list[str]):
        super().__init__(
            f"Rule validation failed: {rule_id}",
            rule_id=rule_id,
            details={"validation_errors": validation_errors},
        )
        self.code = "RULE_VALIDATION_ERROR"


class RuleLoadError(RuleError):
    """Failed to load rules from file."""

    def __init__(self, file_path: str, error: str):
        super().__init__(
            f"Failed to load rules from {file_path}: {error}",
            details={"file_path": file_path, "error": error},
        )
        self.code = "RULE_LOAD_ERROR"


# =============================================================================
# Data Exceptions
# =============================================================================


class DataError(CleaningError):
    """Error related to data processing."""

    def __init__(
        self,
        message: str,
        table_code: str | None = None,
        record_id: str | None = None,
        **kwargs,
    ):
        super().__init__(message, code="DATA_ERROR", **kwargs)
        self.table_code = table_code
        self.record_id = record_id
        if table_code:
            self.details["table_code"] = table_code
        if record_id:
            self.details["record_id"] = record_id


class RecordNotFoundError(DataError):
    """Record not found in database."""

    def __init__(self, table_code: str, record_id: str):
        super().__init__(
            f"Record not found: {table_code}/{record_id}",
            table_code=table_code,
            record_id=record_id,
        )
        self.code = "RECORD_NOT_FOUND"


class ViolationNotFoundError(DataError):
    """Violation record not found."""

    def __init__(self, violation_id: str):
        super().__init__(
            f"Violation not found: {violation_id}",
            details={"violation_id": violation_id},
        )
        self.code = "VIOLATION_NOT_FOUND"


class InvalidDataError(DataError):
    """Invalid data format or content."""

    def __init__(
        self,
        message: str,
        field_name: str | None = None,
        value: Any | None = None,
        **kwargs,
    ):
        super().__init__(message, **kwargs)
        self.code = "INVALID_DATA"
        if field_name:
            self.details["field_name"] = field_name
        if value is not None:
            self.details["value"] = str(value)


# =============================================================================
# AI Exceptions
# =============================================================================


class AIError(CleaningError):
    """Error related to AI operations."""

    def __init__(self, message: str, model: str | None = None, **kwargs):
        super().__init__(message, code="AI_ERROR", **kwargs)
        self.model = model
        if model:
            self.details["model"] = model


class AIServiceUnavailableError(AIError):
    """AI service is not available."""

    def __init__(self, message: str = "AI service unavailable", **kwargs):
        super().__init__(message, **kwargs)
        self.code = "AI_SERVICE_UNAVAILABLE"


class AIRateLimitError(AIError):
    """AI service rate limit exceeded."""

    def __init__(self, retry_after: int | None = None, **kwargs):
        super().__init__("AI rate limit exceeded", **kwargs)
        self.code = "AI_RATE_LIMIT"
        self.retry_after = retry_after
        if retry_after:
            self.details["retry_after_seconds"] = retry_after


class AIResponseError(AIError):
    """Invalid or unexpected AI response."""

    def __init__(self, message: str, response: str | None = None, **kwargs):
        super().__init__(message, **kwargs)
        self.code = "AI_RESPONSE_ERROR"
        if response:
            self.details["response_preview"] = response[:500]


# =============================================================================
# BigQuery Exceptions
# =============================================================================


class BigQueryError(CleaningError):
    """Error related to BigQuery operations."""

    def __init__(self, message: str, query: str | None = None, **kwargs):
        super().__init__(message, code="BIGQUERY_ERROR", **kwargs)
        if query:
            self.details["query_preview"] = query[:500]


class BigQueryTableNotFoundError(BigQueryError):
    """BigQuery table not found."""

    def __init__(self, table_name: str):
        super().__init__(f"Table not found: {table_name}")
        self.code = "BIGQUERY_TABLE_NOT_FOUND"
        self.details["table_name"] = table_name


class BigQueryQueryError(BigQueryError):
    """BigQuery query execution failed."""

    def __init__(self, message: str, query: str | None = None):
        super().__init__(f"Query failed: {message}", query=query)
        self.code = "BIGQUERY_QUERY_ERROR"


# =============================================================================
# Configuration Exceptions
# =============================================================================


class ConfigError(CleaningError):
    """Error related to configuration."""

    def __init__(self, message: str, config_key: str | None = None, **kwargs):
        super().__init__(message, code="CONFIG_ERROR", **kwargs)
        if config_key:
            self.details["config_key"] = config_key


class MissingConfigError(ConfigError):
    """Required configuration is missing."""

    def __init__(self, config_key: str):
        super().__init__(f"Missing required configuration: {config_key}", config_key=config_key)
        self.code = "MISSING_CONFIG"


class SymbolNotFoundError(ConfigError):
    """Symbol not found in index."""

    def __init__(self, symbol_type: str, symbol_key: str):
        super().__init__(
            f"Symbol not found: {symbol_type}/{symbol_key}",
            details={"symbol_type": symbol_type, "symbol_key": symbol_key},
        )
        self.code = "SYMBOL_NOT_FOUND"


# =============================================================================
# Batch Exceptions
# =============================================================================


class BatchError(CleaningError):
    """Error related to batch processing."""

    def __init__(self, message: str, batch_id: str | None = None, **kwargs):
        super().__init__(message, code="BATCH_ERROR", **kwargs)
        if batch_id:
            self.details["batch_id"] = batch_id


class BatchTimeoutError(BatchError):
    """Batch processing timeout."""

    def __init__(self, batch_id: str, timeout_minutes: int):
        super().__init__(
            f"Batch {batch_id} timed out after {timeout_minutes} minutes",
            batch_id=batch_id,
            details={"timeout_minutes": timeout_minutes},
        )
        self.code = "BATCH_TIMEOUT"


# =============================================================================
# Utility Functions
# =============================================================================


def error_response(error: CleaningError | Exception) -> dict[str, Any]:
    """Convert exception to API error response.

    Args:
        error: Exception to convert

    Returns:
        Dictionary suitable for JSON response
    """
    if isinstance(error, CleaningError):
        return error.to_dict()

    return {
        "error": "INTERNAL_ERROR",
        "message": str(error),
        "details": {"type": type(error).__name__},
    }


def is_retryable(error: Exception) -> bool:
    """Check if an error is retryable.

    Args:
        error: Exception to check

    Returns:
        True if the operation should be retried
    """
    retryable_errors = (
        AIServiceUnavailableError,
        AIRateLimitError,
        BigQueryError,
    )
    return isinstance(error, retryable_errors)
