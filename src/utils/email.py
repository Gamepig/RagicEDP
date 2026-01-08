"""
Ragic ERP Backup System v3 - Email 通知模組

用於發送備份失敗通知
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, Optional

from ..config import EMAIL_CONFIG

logger = logging.getLogger(__name__)


def send_failure_notification(
    results: Dict[str, Any],
    error_details: Optional[str] = None
) -> bool:
    """
    發送備份失敗通知

    Args:
        results: 備份結果
        error_details: 額外的錯誤詳情

    Returns:
        是否發送成功
    """
    if not EMAIL_CONFIG.get('from_password'):
        logger.warning("Email password not configured, skipping notification")
        return False

    try:
        subject = _build_subject(results)
        body = _build_body(results, error_details)

        msg = MIMEMultipart()
        msg['From'] = EMAIL_CONFIG['from_email']
        msg['To'] = EMAIL_CONFIG['to_email']
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        with smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port']) as server:
            server.starttls()
            server.login(EMAIL_CONFIG['from_email'], EMAIL_CONFIG['from_password'])
            server.send_message(msg)

        logger.info(f"Failure notification sent to {EMAIL_CONFIG['to_email']}")
        return True

    except Exception as e:
        logger.error(f"Failed to send notification email: {e}")
        return False


def _build_subject(results: Dict[str, Any]) -> str:
    """建構郵件主旨"""
    failed_count = results.get('failed_count', 0)
    backup_time = results.get('backup_time', datetime.now().isoformat())

    if failed_count > 0:
        return f"[警告] Ragic 備份失敗 - {failed_count} 個表格錯誤 ({backup_time[:10]})"
    else:
        return f"[通知] Ragic 備份完成 ({backup_time[:10]})"


def _build_body(results: Dict[str, Any], error_details: Optional[str] = None) -> str:
    """建構郵件內容"""
    lines = [
        "=" * 60,
        "Ragic ERP 備份通知",
        "=" * 60,
        "",
        f"備份時間: {results.get('backup_time', 'N/A')}",
        f"基準時間: {results.get('base_time', 'N/A')}",
        f"執行時間: {results.get('duration_seconds', 0):.2f} 秒",
        "",
        "【總覽】",
        f"  成功: {results.get('success_count', 0)} 個表格",
        f"  失敗: {results.get('failed_count', 0)} 個表格",
        f"  抓取: {results.get('total_fetched', 0)} 筆",
        f"  新增: {results.get('total_inserted', 0)} 筆",
        f"  更新: {results.get('total_updated', 0)} 筆",
        f"  過濾: {results.get('total_filtered', 0)} 筆",
        "",
    ]

    # 失敗詳情
    sheets = results.get('sheets', {})
    failed_sheets = [
        (code, data) for code, data in sheets.items()
        if data.get('status') == 'failed'
    ]

    if failed_sheets:
        lines.append("【失敗表格】")
        for code, data in failed_sheets:
            lines.append(f"  Sheet {code}: {data.get('error', 'Unknown error')}")
        lines.append("")

    # 額外錯誤詳情
    if error_details:
        lines.append("【錯誤詳情】")
        lines.append(error_details)
        lines.append("")

    lines.extend([
        "=" * 60,
        "此郵件由系統自動產生，請勿直接回覆",
        "=" * 60,
    ])

    return "\n".join(lines)


def send_success_summary(results: Dict[str, Any]) -> bool:
    """
    發送成功摘要（可選，用於每週報告）

    Args:
        results: 備份結果

    Returns:
        是否發送成功
    """
    # 只在有實際資料變更時發送
    if results.get('total_fetched', 0) == 0:
        logger.info("No data changes, skipping success summary")
        return True

    return send_failure_notification(results)
