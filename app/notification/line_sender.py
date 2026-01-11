"""
LINE Notify 發送器

使用 LINE Notify API 發送通知
"""
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Optional
import logging

from .config import NotificationConfig, get_config

logger = logging.getLogger(__name__)

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


class LineSender:
    """LINE Notify 發送器"""

    API_URL = "https://notify-api.line.me/api/notify"
    STATUS_URL = "https://notify-api.line.me/api/status"

    def __init__(
        self,
        token: Optional[str] = None,
        config: Optional[NotificationConfig] = None,
        session: Optional[requests.Session] = None,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        """
        初始化 LINE 發送器

        Args:
            token: LINE Notify Token（優先於 config）
            config: 通知配置（可選，預設從環境變數載入）
            session: HTTP Session（可選，預設帶重試）
            timeout: 請求超時秒數
        """
        cfg = config or get_config()

        self.token = token or cfg.line_notify_token
        self.session = session or build_session()
        self.timeout = timeout

    def is_configured(self) -> bool:
        """檢查是否已配置"""
        return bool(self.token)

    def send(
        self,
        message: str,
        image_url: Optional[str] = None,
        sticker_package_id: Optional[int] = None,
        sticker_id: Optional[int] = None,
    ) -> bool:
        """
        發送 LINE 通知

        Args:
            message: 訊息內容
            image_url: 圖片 URL（可選）
            sticker_package_id: 貼圖套件 ID（可選）
            sticker_id: 貼圖 ID（可選）

        Returns:
            是否發送成功
        """
        if not self.is_configured():
            logger.warning("LINE Notify 未配置，跳過發送")
            return False

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        data = {
            "message": message,
        }

        # 添加圖片
        if image_url:
            data["imageThumbnail"] = image_url
            data["imageFullsize"] = image_url

        # 添加貼圖
        if sticker_package_id and sticker_id:
            data["stickerPackageId"] = sticker_package_id
            data["stickerId"] = sticker_id

        try:
            response = self.session.post(
                self.API_URL,
                headers=headers,
                data=data,
                timeout=self.timeout,
            )

            if response.status_code == 200:
                logger.info("LINE 通知發送成功")
                return True
            else:
                # 不記錄完整 response.text 以避免敏感資訊洩露
                logger.error(
                    f"LINE 通知發送失敗: status={response.status_code}"
                )
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

    def send_test(self) -> bool:
        """發送測試訊息"""
        return self.send(
            message="\n[RagicEDP] LINE 通知測試\n\n這是一則測試訊息，用於確認 LINE 通知功能正常運作。"
        )

    def get_status(self) -> Optional[dict]:
        """
        取得 LINE Notify 狀態

        Returns:
            狀態資訊或 None
        """
        if not self.is_configured():
            return None

        headers = {
            "Authorization": f"Bearer {self.token}",
        }

        try:
            response = self.session.get(
                self.STATUS_URL,
                headers=headers,
                timeout=10,
            )

            if response.status_code == 200:
                return response.json()
            else:
                return None

        except Exception as e:
            logger.warning(f"取得 LINE 狀態失敗: {type(e).__name__}")
            return None
