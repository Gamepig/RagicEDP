"""
Notification Module for 資料清洗系統 v2.

Provides email notifications for cleaning events.
"""

from app.notification.email_sender import (
    EmailConfig,
    EmailSender,
    get_email_sender,
    send_email,
)
from app.notification.notifier import (
    Notifier,
    get_notifier,
    notify_batch_complete,
)

__all__ = [
    # Email Sender
    "EmailSender",
    "EmailConfig",
    "get_email_sender",
    "send_email",
    # Notifier
    "Notifier",
    "get_notifier",
    "notify_batch_complete",
]
