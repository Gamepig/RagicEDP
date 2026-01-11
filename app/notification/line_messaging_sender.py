"""
LINE Messaging API 發送器

使用 LINE Messaging API 發送推播通知
需要 LINE Official Account 和 Messaging API Channel
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


class LineMessagingSender:
    """LINE Messaging API 發送器"""

    API_BASE = "https://api.line.me/v2/bot"

    def __init__(
        self,
        channel_access_token: str | None = None,
        user_id: str | None = None,
        session: requests.Session | None = None,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        """
        初始化 LINE Messaging API 發送器

        Args:
            channel_access_token: LINE Channel Access Token（長期有效）
            user_id: 目標 User ID 或 Group ID
            session: HTTP Session（可選，預設帶重試）
            timeout: 請求超時秒數
        """
        self.channel_access_token = channel_access_token or os.environ.get(
            "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", ""
        )
        self.user_id = user_id or os.environ.get("LINE_MESSAGING_USER_ID", "")
        self.session = session or build_session()
        self.timeout = timeout

    def is_configured(self) -> bool:
        """檢查是否已配置"""
        return bool(self.channel_access_token and self.user_id)

    def _get_headers(self) -> dict[str, str]:
        """取得請求標頭"""
        return {
            "Authorization": f"Bearer {self.channel_access_token}",
            "Content-Type": "application/json",
        }

    def send(
        self,
        message: str,
        user_id: str | None = None,
    ) -> bool:
        """
        發送 LINE 推播訊息

        Args:
            message: 訊息內容
            user_id: 目標 User ID（可選，預設使用初始化時的 user_id）

        Returns:
            是否發送成功
        """
        if not self.is_configured():
            logger.warning("LINE Messaging API 未配置，跳過發送")
            return False

        target_id = user_id or self.user_id

        data = {
            "to": target_id,
            "messages": [
                {
                    "type": "text",
                    "text": message,
                }
            ],
        }

        try:
            response = self.session.post(
                f"{self.API_BASE}/message/push",
                headers=self._get_headers(),
                json=data,
                timeout=self.timeout,
            )

            if response.status_code == 200:
                logger.info("LINE 通知發送成功")
                return True
            else:
                error_body = response.json() if response.text else {}
                error_msg = error_body.get("message", response.text)
                logger.error(f"LINE 通知發送失敗: status={response.status_code}, {error_msg}")
                return False

        except requests.exceptions.Timeout:
            logger.error("LINE 通知發送超時")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"LINE 通知發送失敗: {type(e).__name__}")
            return False
        except Exception as e:
            logger.exception(f"LINE 通知發送失敗: {type(e).__name__}")
            return False

    def send_flex_message(
        self,
        alt_text: str,
        contents: dict[str, Any],
        user_id: str | None = None,
    ) -> bool:
        """
        發送 Flex Message（富文本訊息）

        Args:
            alt_text: 替代文字（在不支援 Flex 的環境顯示）
            contents: Flex Message 內容
            user_id: 目標 User ID

        Returns:
            是否發送成功
        """
        if not self.is_configured():
            logger.warning("LINE Messaging API 未配置，跳過發送")
            return False

        target_id = user_id or self.user_id

        data = {
            "to": target_id,
            "messages": [
                {
                    "type": "flex",
                    "altText": alt_text,
                    "contents": contents,
                }
            ],
        }

        try:
            response = self.session.post(
                f"{self.API_BASE}/message/push",
                headers=self._get_headers(),
                json=data,
                timeout=self.timeout,
            )

            if response.status_code == 200:
                logger.info("LINE Flex 訊息發送成功")
                return True
            else:
                error_body = response.json() if response.text else {}
                error_msg = error_body.get("message", response.text)
                logger.error(f"LINE Flex 訊息發送失敗: status={response.status_code}, {error_msg}")
                return False

        except Exception as e:
            logger.exception(f"LINE Flex 訊息發送失敗: {type(e).__name__}")
            return False

    def send_test(self) -> bool:
        """發送測試訊息"""
        return self.send(
            message="🔔 [RagicEDP] LINE 通知測試\n\n這是一則測試訊息，用於確認 LINE Messaging API 通知功能正常運作。"
        )

    def get_profile(self, user_id: str | None = None) -> dict[str, Any] | None:
        """
        取得用戶資料

        Args:
            user_id: 用戶 ID

        Returns:
            用戶資料或 None
        """
        if not self.channel_access_token:
            return None

        target_id = user_id or self.user_id
        if not target_id:
            return None

        try:
            response = self.session.get(
                f"{self.API_BASE}/profile/{target_id}",
                headers=self._get_headers(),
                timeout=10,
            )

            if response.status_code == 200:
                return response.json()
            return None

        except Exception as e:
            logger.warning(f"取得 LINE 用戶資料失敗: {type(e).__name__}")
            return None

    def get_bot_info(self) -> dict[str, Any] | None:
        """
        取得 Bot 資訊

        Returns:
            Bot 資訊或 None
        """
        if not self.channel_access_token:
            return None

        try:
            response = self.session.get(
                f"{self.API_BASE}/info",
                headers=self._get_headers(),
                timeout=10,
            )

            if response.status_code == 200:
                return response.json()
            return None

        except Exception as e:
            logger.warning(f"取得 LINE Bot 資訊失敗: {type(e).__name__}")
            return None

    def get_message_quota(self) -> dict[str, Any] | None:
        """
        取得訊息配額

        Returns:
            配額資訊或 None
        """
        if not self.channel_access_token:
            return None

        try:
            response = self.session.get(
                f"{self.API_BASE}/message/quota",
                headers=self._get_headers(),
                timeout=10,
            )

            if response.status_code == 200:
                return response.json()
            return None

        except Exception as e:
            logger.warning(f"取得 LINE 訊息配額失敗: {type(e).__name__}")
            return None


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_sender: LineMessagingSender | None = None


def get_line_messaging_sender() -> LineMessagingSender:
    """Get the default LINE Messaging sender (singleton)."""
    global _default_sender
    if _default_sender is None:
        _default_sender = LineMessagingSender()
    return _default_sender


def send_line_message(message: str) -> bool:
    """Send message using the default sender."""
    return get_line_messaging_sender().send(message)
