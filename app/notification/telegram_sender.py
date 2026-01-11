"""
Telegram Bot 發送器

使用 Telegram Bot API 發送通知，替代已停用的 LINE Notify
"""

import os
from typing import Any

import requests
from loguru import logger
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# 預設超時（秒）
DEFAULT_TIMEOUT = 30


def build_session(
    retries: int = 3,
    backoff_factor: float = 0.5,
    status_forcelist: tuple = (429, 500, 502, 503, 504),
) -> requests.Session:
    """
    建立帶重試機制的 Session

    Args:
        retries: 重試次數
        backoff_factor: 退避因子
        status_forcelist: 需要重試的 HTTP 狀態碼

    Returns:
        配置好的 Session
    """
    retry = Retry(
        total=retries,
        backoff_factor=backoff_factor,
        status_forcelist=status_forcelist,
        allowed_methods=("POST", "GET"),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


class TelegramSender:
    """Telegram Bot 發送器"""

    API_BASE = "https://api.telegram.org/bot{token}"

    def __init__(
        self,
        bot_token: str | None = None,
        chat_id: str | None = None,
        session: requests.Session | None = None,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        """
        初始化 Telegram 發送器

        Args:
            bot_token: Telegram Bot Token
            chat_id: 目標 Chat ID（群組或用戶）
            session: HTTP Session（可選，預設帶重試）
            timeout: 請求超時秒數
        """
        self.bot_token = bot_token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
        self.chat_id = chat_id or os.environ.get("TELEGRAM_CHAT_ID", "")
        self.session = session or build_session()
        self.timeout = timeout

    def is_configured(self) -> bool:
        """檢查是否已配置"""
        return bool(self.bot_token and self.chat_id)

    def _get_api_url(self, method: str) -> str:
        """取得 API URL"""
        return f"{self.API_BASE.format(token=self.bot_token)}/{method}"

    def send(
        self,
        message: str,
        parse_mode: str | None = None,
        disable_notification: bool = False,
    ) -> bool:
        """
        發送 Telegram 訊息

        Args:
            message: 訊息內容
            parse_mode: 解析模式 (None, "Markdown", "MarkdownV2", "HTML")
            disable_notification: 是否靜音發送

        Returns:
            是否發送成功
        """
        if not self.is_configured():
            logger.warning("Telegram Bot 未配置，跳過發送")
            return False

        data: dict[str, Any] = {
            "chat_id": self.chat_id,
            "text": message,
            "disable_notification": disable_notification,
        }

        if parse_mode:
            data["parse_mode"] = parse_mode

        try:
            response = self.session.post(
                self._get_api_url("sendMessage"),
                json=data,
                timeout=self.timeout,
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("ok"):
                    logger.info("Telegram 通知發送成功")
                    return True
                else:
                    logger.error(f"Telegram API 錯誤: {result.get('description', 'Unknown')}")
                    return False
            else:
                logger.error(f"Telegram 通知發送失敗: status={response.status_code}")
                return False

        except requests.exceptions.Timeout:
            logger.error("Telegram 通知發送超時")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Telegram 通知發送失敗: {type(e).__name__}")
            return False
        except Exception as e:
            logger.exception(f"Telegram 通知發送失敗: {type(e).__name__}")
            return False

    def send_test(self) -> bool:
        """發送測試訊息"""
        return self.send(
            message="🔔 [RagicEDP] Telegram 通知測試\n\n這是一則測試訊息，用於確認 Telegram 通知功能正常運作。"
        )

    def get_me(self) -> dict[str, Any] | None:
        """
        取得 Bot 資訊

        Returns:
            Bot 資訊或 None
        """
        if not self.bot_token:
            return None

        try:
            response = self.session.get(
                self._get_api_url("getMe"),
                timeout=10,
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("ok"):
                    return result.get("result")
            return None

        except Exception as e:
            logger.warning(f"取得 Telegram Bot 資訊失敗: {type(e).__name__}")
            return None

    def get_updates(self, limit: int = 10) -> list[dict[str, Any]]:
        """
        取得最近的更新（用於查找 chat_id）

        Args:
            limit: 最多取得幾筆

        Returns:
            更新列表
        """
        if not self.bot_token:
            return []

        try:
            response = self.session.get(
                self._get_api_url("getUpdates"),
                params={"limit": limit},
                timeout=10,
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("ok"):
                    return result.get("result", [])
            return []

        except Exception as e:
            logger.warning(f"取得 Telegram 更新失敗: {type(e).__name__}")
            return []


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_sender: TelegramSender | None = None


def get_telegram_sender() -> TelegramSender:
    """Get the default Telegram sender (singleton)."""
    global _default_sender
    if _default_sender is None:
        _default_sender = TelegramSender()
    return _default_sender


def send_telegram(message: str) -> bool:
    """Send message using the default sender."""
    return get_telegram_sender().send(message)
