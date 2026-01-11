"""Utility modules for RagicEDP"""

from .logger import logger, log_section, log_subsection, log_progress, log_summary

# Note: email module has legacy import issues, import directly when needed
# from .email import send_failure_notification, send_success_summary

__all__ = [
    "logger",
    "log_section",
    "log_subsection",
    "log_progress",
    "log_summary",
]
