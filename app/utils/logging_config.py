"""
Logging Configuration for 資料清洗系統 v2.

Provides centralized logging setup using loguru.
"""

import json
import os
import sys
from typing import Any

from loguru import logger


def serialize_record(record: dict[str, Any]) -> str:
    """Serialize log record to JSON format."""
    subset = {
        "timestamp": record["time"].strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "level": record["level"].name,
        "message": record["message"],
        "module": record["module"],
        "function": record["function"],
        "line": record["line"],
    }

    # Add extra fields if present
    if record.get("extra"):
        subset.update(record["extra"])

    # Add exception info if present
    if record["exception"]:
        subset["exception"] = {
            "type": str(record["exception"].type),
            "value": str(record["exception"].value),
            "traceback": record["exception"].traceback,
        }

    return json.dumps(subset, ensure_ascii=False, default=str)


def json_sink(message):
    """Custom sink for JSON logging."""
    record = message.record
    serialized = serialize_record(record)
    print(serialized, file=sys.stderr)


def setup_logging(
    level: str | None = None,
    json_format: bool | None = None,
    log_file: str | None = None,
) -> None:
    """Setup logging configuration.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR). Defaults to LOG_LEVEL env var.
        json_format: Use JSON format. Defaults to LOG_FORMAT=json env var.
        log_file: Optional file path for logging.
    """
    # Get configuration from environment or defaults
    level = level or os.environ.get("LOG_LEVEL", "INFO")
    if json_format is None:
        json_format = os.environ.get("LOG_FORMAT", "").lower() == "json"

    # Remove default handler
    logger.remove()

    if json_format:
        # JSON format for Cloud Functions / structured logging
        logger.add(
            json_sink,
            level=level,
            format="{message}",
            serialize=False,
        )
    else:
        # Human-readable format for local development
        logger.add(
            sys.stderr,
            level=level,
            format=(
                "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
                "<level>{level: <8}</level> | "
                "<cyan>{module}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
                "<level>{message}</level>"
            ),
            colorize=True,
        )

    # Add file handler if specified
    if log_file:
        logger.add(
            log_file,
            level=level,
            format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {module}:{function}:{line} - {message}",
            rotation="10 MB",
            retention="7 days",
            compression="gz",
        )

    logger.debug(f"Logging configured: level={level}, json_format={json_format}")


def get_logger(name: str | None = None):
    """Get a logger instance with optional context.

    Args:
        name: Optional logger name for context

    Returns:
        Logger instance
    """
    if name:
        return logger.bind(logger_name=name)
    return logger


# Context managers for structured logging
class LogContext:
    """Context manager for adding context to log messages."""

    def __init__(self, **kwargs):
        self.context = kwargs
        self._token = None

    def __enter__(self):
        self._token = logger.contextualize(**self.context)
        return logger

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._token:
            self._token.__exit__(exc_type, exc_val, exc_tb)


def log_operation(operation: str, **extra):
    """Context manager for logging an operation with timing.

    Usage:
        with log_operation("process_records", table="orders"):
            # do work
    """
    return LogContext(operation=operation, **extra)


# Auto-setup on import if in Cloud Functions environment
if os.environ.get("FUNCTION_NAME") or os.environ.get("K_SERVICE"):
    setup_logging(json_format=True)
