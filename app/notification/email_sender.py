"""
Email Sender for 資料清洗系統 v2.

Sends email notifications using SMTP (Gmail).
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from loguru import logger
from pydantic import BaseModel, Field


class EmailConfig(BaseModel):
    """Configuration for email sending."""

    smtp_server: str = Field(default="smtp.gmail.com")
    smtp_port: int = Field(default=587)
    from_email: str = Field(default="")
    from_password: str = Field(default="")
    to_email: str = Field(default="")

    @classmethod
    def from_env(cls) -> "EmailConfig":
        """Load configuration from environment variables."""
        return cls(
            smtp_server=os.environ.get("SMTP_SERVER", "smtp.gmail.com"),
            smtp_port=int(os.environ.get("SMTP_PORT", "587")),
            from_email=os.environ.get("SMTP_FROM_EMAIL", ""),
            from_password=os.environ.get("SMTP_FROM_PASSWORD", ""),
            to_email=os.environ.get("NOTIFICATION_EMAIL", ""),
        )

    def is_configured(self) -> bool:
        """Check if email is properly configured."""
        return bool(self.from_email and self.from_password and self.to_email)


class EmailSender:
    """Sends email notifications via SMTP."""

    def __init__(self, config: EmailConfig | None = None):
        """Initialize email sender.

        Args:
            config: Email configuration. Defaults to loading from env.
        """
        self.config = config or EmailConfig.from_env()

        if not self.config.is_configured():
            logger.warning("Email not fully configured, notifications will be skipped")

    def send(
        self,
        subject: str,
        body: str,
        to_email: str | None = None,
        is_html: bool = False,
    ) -> bool:
        """Send an email.

        Args:
            subject: Email subject
            body: Email body (plain text or HTML)
            to_email: Recipient email. Defaults to config.to_email
            is_html: Whether body is HTML

        Returns:
            True if sent successfully
        """
        if not self.config.is_configured():
            logger.warning("Email not configured, skipping send")
            return False

        to_email = to_email or self.config.to_email

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.config.from_email
            msg["To"] = to_email

            # Attach body
            content_type = "html" if is_html else "plain"
            msg.attach(MIMEText(body, content_type, "utf-8"))

            # Send via SMTP
            with smtplib.SMTP(self.config.smtp_server, self.config.smtp_port) as server:
                server.starttls()
                server.login(self.config.from_email, self.config.from_password)
                server.sendmail(self.config.from_email, to_email, msg.as_string())

            logger.info(f"Email sent to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    def send_template(
        self,
        template_name: str,
        context: dict[str, Any],
        to_email: str | None = None,
    ) -> bool:
        """Send email using a template.

        Args:
            template_name: Template name (maps to _get_template)
            context: Template context variables
            to_email: Recipient email

        Returns:
            True if sent successfully
        """
        template = self._get_template(template_name)
        if not template:
            logger.error(f"Unknown template: {template_name}")
            return False

        subject = template["subject"].format(**context)
        body = template["body"].format(**context)

        return self.send(subject, body, to_email, is_html=template.get("is_html", False))

    def _get_template(self, name: str) -> dict[str, Any] | None:
        """Get email template by name."""
        templates = {
            "cleaning_summary": {
                "subject": "[RagicEDP] 資料清洗完成 - {batch_id}",
                "body": """
資料清洗批次 {batch_id} 已完成。

統計摘要：
- 處理記錄數: {processed_records}
- 自動修正: {auto_fixed_count}
- AI 修正: {ai_fixed_count}
- 待人工處理: {manual_count}

詳情請登入資料修正介面查看。
""",
                "is_html": False,
            },
            "pending_violations": {
                "subject": "[RagicEDP] 待處理資料異常 ({count} 筆)",
                "body": """<html>
<body>
<h2>待處理資料異常通知</h2>
<p>目前有 <strong>{count}</strong> 筆資料問題需要人工處理：</p>

<h3>依嚴重程度分類</h3>
<ul>
<li>Critical: {critical_count}</li>
<li>High: {high_count}</li>
<li>Medium: {medium_count}</li>
<li>Low: {low_count}</li>
</ul>

<h3>依表格分類</h3>
<ul>
{table_summary}
</ul>

<p><a href="{app_url}">登入資料修正介面處理</a></p>
</body>
</html>""",
                "is_html": True,
            },
            "escalation_reminder": {
                "subject": "[RagicEDP] 提醒：{count} 筆資料已逾期未處理",
                "body": """<html>
<body>
<h2>資料處理逾期提醒</h2>
<p>以下資料問題已超過 {days} 天未處理：</p>

<table border="1" cellpadding="5">
<tr><th>記錄ID</th><th>表格</th><th>欄位</th><th>問題</th><th>天數</th></tr>
{records_table}
</table>

<p><a href="{app_url}">立即處理</a></p>
</body>
</html>""",
                "is_html": True,
            },
            "cleaning_failed": {
                "subject": "[RagicEDP] 警告：資料清洗失敗 - {batch_id}",
                "body": """
資料清洗批次 {batch_id} 執行失敗！

錯誤訊息：
{error_message}

請檢查系統日誌並排除問題。
""",
                "is_html": False,
            },
        }

        return templates.get(name)


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_sender: EmailSender | None = None


def get_email_sender() -> EmailSender:
    """Get the default email sender (singleton)."""
    global _default_sender
    if _default_sender is None:
        _default_sender = EmailSender()
    return _default_sender


def send_email(subject: str, body: str, to_email: str | None = None) -> bool:
    """Send email using the default sender."""
    return get_email_sender().send(subject, body, to_email)
