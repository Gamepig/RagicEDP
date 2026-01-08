"""
Ragic ERP Backup System v2 - 郵件發送模組
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from .config import EMAIL_CONFIG

logger = logging.getLogger(__name__)


class EmailSender:
    """郵件發送器"""

    def __init__(self):
        self.smtp_server = EMAIL_CONFIG['smtp_server']
        self.smtp_port = EMAIL_CONFIG['smtp_port']
        self.from_email = EMAIL_CONFIG['from_email']
        self.from_password = EMAIL_CONFIG['from_password']
        self.to_email = EMAIL_CONFIG['to_email']

    def send_report(
        self,
        subject: str,
        text_content: str,
        html_content: Optional[str] = None,
        to_email: Optional[str] = None
    ) -> bool:
        """
        發送報告郵件

        Args:
            subject: 郵件主旨
            text_content: 純文字內容
            html_content: HTML 內容（可選）
            to_email: 收件人（可選，預設使用配置）

        Returns:
            是否發送成功
        """
        recipient = to_email or self.to_email

        try:
            # 建立郵件
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = recipient

            # 附加純文字版本
            text_part = MIMEText(text_content, 'plain', 'utf-8')
            msg.attach(text_part)

            # 附加 HTML 版本（如果有）
            if html_content:
                html_part = MIMEText(html_content, 'html', 'utf-8')
                msg.attach(html_part)

            # 連接 SMTP 伺服器並發送
            logger.info(f"Connecting to SMTP server {self.smtp_server}:{self.smtp_port}...")
            server = smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30)
            server.starttls()

            logger.info("Logging in...")
            server.login(self.from_email, self.from_password)

            logger.info(f"Sending email to {recipient}...")
            server.send_message(msg)
            server.quit()

            logger.info("Email sent successfully")
            return True

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            return False

        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {e}")
            return False

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    def send_weekly_report(
        self,
        text_report: str,
        html_report: str,
        start_date: str,
        end_date: str
    ) -> bool:
        """
        發送週報

        Args:
            text_report: 純文字報告
            html_report: HTML 報告
            start_date: 報告開始日期
            end_date: 報告結束日期

        Returns:
            是否發送成功
        """
        subject = f"📊 Ragic ERP 備份週報 ({start_date} ~ {end_date})"
        return self.send_report(
            subject=subject,
            text_content=text_report,
            html_content=html_report
        )
