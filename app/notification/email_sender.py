"""
Email 發送器

使用 SMTP 發送通知郵件
"""
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging

from .config import NotificationConfig, get_config

logger = logging.getLogger(__name__)

# 預設超時（秒）
DEFAULT_TIMEOUT = 30


class EmailSender:
    """Email 發送器"""

    def __init__(
        self,
        smtp_server: Optional[str] = None,
        smtp_port: Optional[int] = None,
        from_email: Optional[str] = None,
        from_password: Optional[str] = None,
        config: Optional[NotificationConfig] = None,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        """
        初始化 Email 發送器

        Args:
            smtp_server: SMTP 伺服器（優先於 config）
            smtp_port: SMTP 埠號（優先於 config）
            from_email: 發送者 Email（優先於 config）
            from_password: 發送者密碼（優先於 config）
            config: 通知配置（可選，預設從環境變數載入）
            timeout: 連線超時秒數
        """
        cfg = config or get_config()

        self.smtp_server = smtp_server or cfg.smtp_server
        self.smtp_port = smtp_port or cfg.smtp_port
        self.from_email = from_email or cfg.from_email
        self.from_password = from_password or cfg.from_password
        self.default_recipients = list(cfg.to_emails)
        self.timeout = timeout

    def is_configured(self) -> bool:
        """檢查是否已配置"""
        return bool(
            self.smtp_server and
            self.smtp_port and
            self.from_email and
            self.from_password
        )

    def send(
        self,
        subject: str,
        body: str,
        recipients: Optional[List[str]] = None,
        html_body: Optional[str] = None,
    ) -> bool:
        """
        發送 Email

        Args:
            subject: 郵件主旨
            body: 郵件內容（純文字）
            recipients: 收件者列表（預設使用配置）
            html_body: HTML 格式內容（可選）

        Returns:
            是否發送成功
        """
        if not self.is_configured():
            logger.warning("Email 未配置，跳過發送")
            return False

        recipients = recipients or self.default_recipients
        recipients = [r.strip() for r in recipients if r.strip()]

        if not recipients:
            logger.warning("無收件者，跳過發送")
            return False

        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = self.from_email
            msg['To'] = ', '.join(recipients)
            msg['Subject'] = subject

            # 添加純文字內容
            msg.attach(MIMEText(body, 'plain', 'utf-8'))

            # 添加 HTML 內容（如果有）
            if html_body:
                msg.attach(MIMEText(html_body, 'html', 'utf-8'))

            # 建立 SSL context
            ssl_ctx = ssl.create_default_context()

            # 發送（明確 timeout + TLS）
            with smtplib.SMTP(
                self.smtp_server,
                self.smtp_port,
                timeout=self.timeout
            ) as server:
                server.ehlo()
                server.starttls(context=ssl_ctx)
                server.ehlo()
                server.login(self.from_email, self.from_password)
                server.send_message(msg)

            logger.info(f"Email 發送成功: {subject} -> {len(recipients)} 位收件者")
            return True

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"Email 認證失敗: {e}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"Email 發送失敗 (SMTP): {e}")
            return False
        except (TimeoutError, OSError) as e:
            # 包含 socket.timeout 和其他連線錯誤
            logger.error(f"Email 連線錯誤: {type(e).__name__}")
            return False
        except Exception as e:
            logger.exception(f"Email 發送失敗: {type(e).__name__}")
            return False

    def send_test(self) -> bool:
        """發送測試郵件"""
        return self.send(
            subject="[RagicEDP] Email 測試",
            body="這是一封測試郵件，用於確認 Email 通知功能正常運作。",
        )
