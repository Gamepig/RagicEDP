"""
Logging configuration for RagicEDP.

This module provides structured logging with loguru, including:
- Console output with colors (INFO+)
- File logging with rotation (DEBUG+)
- Error-specific logs (ERROR+)
- Visual formatting helpers to preserve existing output style

Environment Variables:
    LOG_LEVEL: DEBUG, INFO, WARNING, ERROR (default: INFO)
    LOG_TO_FILE: Enable file logging (default: true)
    LOG_DIR: Log directory path (default: logs/)
"""

from loguru import logger as _loguru_logger
import os
import sys
from pathlib import Path

# Remove default handler to customize output
_loguru_logger.remove()

# Get configuration from environment variables
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_DIR = os.getenv("LOG_DIR", "logs")

# Cloud Functions/Run 環境檢測（唯讀文件系統）
_IS_CLOUD_ENV = (
    os.getenv("K_SERVICE") is not None  # Cloud Run
    or os.getenv("FUNCTION_NAME") is not None  # Cloud Functions Gen1
    or os.getenv("K_REVISION") is not None  # Cloud Functions Gen2
)

# 在雲端環境禁用文件日誌，避免唯讀文件系統錯誤
LOG_TO_FILE = (
    os.getenv("LOG_TO_FILE", "true").lower() in ("true", "1", "yes")
    and not _IS_CLOUD_ENV
)

# Ensure log directory exists (only if file logging is enabled)
if LOG_TO_FILE:
    Path(LOG_DIR).mkdir(parents=True, exist_ok=True)
    Path(f"{LOG_DIR}/errors").mkdir(parents=True, exist_ok=True)

# ============================================================================
# Console Handler: INFO and above with colors
# ============================================================================
_loguru_logger.add(
    sys.stderr,
    level=LOG_LEVEL,
    format=(
        "<green>{time:HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<level>{message}</level>"
    ),
    colorize=True,
)

# ============================================================================
# File Handler: DEBUG and above with detailed format (if enabled)
# ============================================================================
if LOG_TO_FILE:
    _loguru_logger.add(
        f"{LOG_DIR}/ragic_{{time:YYYY-MM-DD}}.log",
        level="DEBUG",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
        rotation="10 MB",
        retention="30 days",
        compression="zip",
        encoding="utf-8",
    )

# ============================================================================
# Error File Handler: ERROR and above only (if enabled)
# ============================================================================
if LOG_TO_FILE:
    _loguru_logger.add(
        f"{LOG_DIR}/errors/error_{{time:YYYY-MM-DD}}.log",
        level="ERROR",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}\n{exception}",
        rotation="1 week",
        retention="3 months",
        encoding="utf-8",
        backtrace=True,
        diagnose=True,
    )

# ============================================================================
# Export logger instance
# ============================================================================
logger = _loguru_logger


# ============================================================================
# Visual Formatting Helpers
# ============================================================================
def log_section(title: str, char: str = "=", width: int = 80):
    """
    Log a section header with separator lines.

    Args:
        title: Section title
        char: Character to use for separator (default: "=")
        width: Width of separator (default: 80)

    Example:
        log_section("Ragic 增量同步開始")
        Output:
            ================================================================================
                              Ragic 增量同步開始
            ================================================================================
    """
    logger.info("")
    logger.info(char * width)
    logger.info(title.center(width))
    logger.info(char * width)


def log_subsection(title: str, width: int = 80):
    """
    Log a subsection header with lighter separator.

    Args:
        title: Subsection title
        width: Width of separator (default: 80)

    Example:
        log_subsection("[50] 訂單表")
    """
    logger.info("")
    logger.info("-" * width)
    logger.info(title)


def log_progress(sheet_name: str, offset: int, count: int):
    """
    Log API pagination progress (DEBUG level).

    Args:
        sheet_name: Name of the sheet being fetched
        offset: Current pagination offset
        count: Number of records in this batch

    Example:
        log_progress("訂單表", offset=0, count=1000)
        Output: [DEBUG] 抓取 訂單表 (offset=0, count=1000)
    """
    logger.debug(f"抓取 {sheet_name} (offset={offset}, count={count})")


def log_summary(total_records: int, new_records: int, updated_records: int = 0):
    """
    Log sync summary with statistics.

    Args:
        total_records: Total records processed
        new_records: Number of new records
        updated_records: Number of updated records (optional)

    Example:
        log_summary(5000, 120, 50)
        Output: [SUCCESS] ✅ 同步完成: 總計 5000 筆，新增 120 筆，修改 50 筆
    """
    if updated_records > 0:
        msg = f"同步完成: 總計 {total_records} 筆，新增 {new_records} 筆，修改 {updated_records} 筆"
    else:
        msg = f"同步完成: 總計 {total_records} 筆，新增 {new_records} 筆"
    logger.success(msg)


# ============================================================================
# Additional Helpers for Common Patterns
# ============================================================================
def log_api_request(method: str, url: str, params: dict = None):
    """Log API request details (DEBUG level)."""
    logger.debug(f"API {method}: {url}")
    if params:
        logger.debug(f"  Parameters: {params}")


def log_api_response(status_code: int, record_count: int):
    """Log API response details (DEBUG level)."""
    logger.debug(f"API Response: {status_code}, 取得 {record_count} 筆")


def log_file_saved(filepath: str, record_count: int):
    """Log file save operation."""
    logger.info(f"✓ 已儲存: {filepath} ({record_count} 筆)")


def log_no_data(reason: str = ""):
    """Log when no new data is found."""
    if reason:
        logger.warning(f"⚠️ 無新資料: {reason}")
    else:
        logger.warning("⚠️ 無新資料")


# ============================================================================
# Convenience Export
# ============================================================================
__all__ = [
    "logger",
    "log_section",
    "log_subsection",
    "log_progress",
    "log_summary",
    "log_api_request",
    "log_api_response",
    "log_file_saved",
    "log_no_data",
]
