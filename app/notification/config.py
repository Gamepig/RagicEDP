"""
通知系統配置

分離設定與模板，延後讀取環境變數以提高可測試性
"""
from dataclasses import dataclass
from typing import Optional, Tuple
import os
import logging

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NotificationConfig:
    """通知配置（不可變）"""
    smtp_server: str
    smtp_port: int
    from_email: str
    from_password: str
    to_emails: Tuple[str, ...]
    line_notify_token: str
    correction_app_url: str


def load_config() -> NotificationConfig:
    """
    從環境變數載入配置

    延後讀取，避免 import 時污染

    Returns:
        通知配置物件
    """
    # 解析收件者列表（支援逗號/分號分隔）
    raw_emails = os.getenv("NOTIFICATION_TO_EMAILS", "")
    to_emails = tuple(
        e.strip()
        for e in raw_emails.replace(";", ",").split(",")
        if e.strip()
    )

    # 解析 SMTP Port（容錯處理）
    smtp_port_str = os.getenv("SMTP_PORT", "587")
    try:
        smtp_port = int(smtp_port_str)
    except ValueError:
        logger.warning(f"無效的 SMTP_PORT: {smtp_port_str}，使用預設值 587")
        smtp_port = 587

    return NotificationConfig(
        smtp_server=os.getenv("SMTP_SERVER", "smtp.gmail.com"),
        smtp_port=smtp_port,
        from_email=os.getenv("NOTIFICATION_FROM_EMAIL", ""),
        from_password=os.getenv("NOTIFICATION_FROM_PASSWORD", ""),
        to_emails=to_emails,
        line_notify_token=os.getenv("LINE_NOTIFY_TOKEN", ""),
        correction_app_url=os.getenv(
            "CORRECTION_APP_URL",
            "https://data-correction-app-571015722523.asia-east1.run.app"
        ),
    )


# 全域配置（延後載入）
_config: Optional[NotificationConfig] = None


def get_config() -> NotificationConfig:
    """
    取得配置（單例模式）

    Returns:
        通知配置物件
    """
    global _config
    if _config is None:
        _config = load_config()
    return _config


def reset_config() -> None:
    """重設配置（測試用）"""
    global _config
    _config = None
