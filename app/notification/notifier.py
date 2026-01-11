"""
通知調度器

統一管理 Email 和 LINE 通知的發送
"""
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from ..config import now_taipei
import logging

from .email_sender import EmailSender
from .line_sender import LineSender
from .templates import (
    build_cleaning_report_email,
    build_cleaning_report_line,
    build_error_notification_email,
)
from .sanitize import redact_mapping, redact_error_message

logger = logging.getLogger(__name__)


class Notifier:
    """通知調度器"""

    def __init__(
        self,
        email_sender: Optional[EmailSender] = None,
        line_sender: Optional[LineSender] = None,
    ):
        """
        初始化通知調度器

        Args:
            email_sender: Email 發送器（可選）
            line_sender: LINE 發送器（可選）
        """
        self.email_sender = email_sender or EmailSender()
        self.line_sender = line_sender or LineSender()

    def send_cleaning_report(
        self,
        cleaning_result: Dict[str, Any],
        force_send: bool = False,
    ) -> Dict[str, Any]:
        """
        發送清洗報告通知

        Args:
            cleaning_result: 清洗結果
            force_send: 是否強制發送（即使無待處理項目）

        Returns:
            發送結果 {
                'email': Optional[bool],  # True=成功, False=失敗, None=未嘗試
                'line': Optional[bool],
                'skipped': bool,
                'errors': list,
            }
        """
        result: Dict[str, Any] = {
            'email': None,
            'line': None,
            'skipped': False,
            'errors': [],
            'sent_at': now_taipei().isoformat(),
        }

        manual_count = cleaning_result.get('manual_required', 0)

        # 檢查是否需要發送
        if not force_send and manual_count == 0:
            logger.info("無待處理項目，跳過通知")
            result['skipped'] = True
            # 語意修正：skipped 時 email/line 保持 None（未嘗試）
            return result

        # 發送 Email
        if self.email_sender.is_configured():
            try:
                subject, body = build_cleaning_report_email(cleaning_result)
                result['email'] = self.email_sender.send(subject, body)
                if not result['email']:
                    result['errors'].append('Email 發送失敗')
            except Exception as e:
                logger.exception("Email 發送異常")
                result['email'] = False
                result['errors'].append(f'Email 異常: {type(e).__name__}')
        else:
            logger.info("Email 未配置，跳過")

        # 發送 LINE
        if self.line_sender.is_configured():
            try:
                message = build_cleaning_report_line(cleaning_result)
                result['line'] = self.line_sender.send(message)
                if not result['line']:
                    result['errors'].append('LINE 發送失敗')
            except Exception as e:
                logger.exception("LINE 發送異常")
                result['line'] = False
                result['errors'].append(f'LINE 異常: {type(e).__name__}')
        else:
            logger.info("LINE 未配置，跳過")

        # 記錄結果
        logger.info(
            f"清洗報告通知: email={result['email']}, line={result['line']}, "
            f"errors={len(result['errors'])}"
        )

        return result

    def send_error_notification(
        self,
        error_type: str,
        error_message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        發送錯誤通知

        Args:
            error_type: 錯誤類型
            error_message: 錯誤訊息
            context: 額外上下文

        Returns:
            發送結果
        """
        result: Dict[str, Any] = {
            'email': None,
            'line': None,
            'errors': [],
            'sent_at': now_taipei().isoformat(),
        }

        # 遮罩敏感資訊
        safe_message = redact_error_message(error_message)
        safe_context = redact_mapping(context) if context else None

        # 發送 Email
        if self.email_sender.is_configured():
            try:
                subject, body = build_error_notification_email(
                    error_type, safe_message, safe_context
                )
                result['email'] = self.email_sender.send(subject, body)
            except Exception as e:
                result['email'] = False
                result['errors'].append(f'Email 異常: {type(e).__name__}')

        # 發送 LINE（簡短版本，只送摘要）
        if self.line_sender.is_configured():
            try:
                # 簡化 LINE 訊息，避免敏感資訊外洩
                line_message = (
                    f"\n!! RagicEDP 錯誤\n\n"
                    f"類型: {error_type}\n"
                    f"訊息: {safe_message[:100]}"
                )
                if len(safe_message) > 100:
                    line_message += "..."
                result['line'] = self.line_sender.send(line_message)
            except Exception as e:
                result['line'] = False
                result['errors'].append(f'LINE 異常: {type(e).__name__}')

        return result

    def test_connections(self) -> Dict[str, Any]:
        """
        測試所有通知管道連接

        Returns:
            測試結果
        """
        result: Dict[str, Any] = {
            'email': {
                'configured': self.email_sender.is_configured(),
                'test_sent': False,
            },
            'line': {
                'configured': self.line_sender.is_configured(),
                'test_sent': False,
                'status': None,
            },
        }

        # 測試 Email
        if result['email']['configured']:
            result['email']['test_sent'] = self.email_sender.send_test()

        # 測試 LINE
        if result['line']['configured']:
            result['line']['status'] = self.line_sender.get_status()
            result['line']['test_sent'] = self.line_sender.send_test()

        return result
