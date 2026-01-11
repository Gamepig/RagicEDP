"""
Notifier for 資料清洗系統 v2.

Handles notification logic for data cleaning events.
Supports Email and LINE Messaging API notifications.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from loguru import logger

from app.cleaning.models import CleaningBatch
from app.notification.email_sender import EmailSender, get_email_sender
from app.notification.line_messaging_sender import (
    LineMessagingSender,
    get_line_messaging_sender,
)


class Notifier:
    """Handles notification dispatch based on cleaning events."""

    def __init__(
        self,
        email_sender: EmailSender | None = None,
        line_sender: LineMessagingSender | None = None,
    ):
        """Initialize notifier.

        Args:
            email_sender: Email sender instance. Defaults to shared sender.
            line_sender: LINE Messaging sender instance. Defaults to shared sender.
        """
        self.email_sender = email_sender or get_email_sender()
        self.line_sender = line_sender or get_line_messaging_sender()

        # Configuration from environment
        self.app_url = os.environ.get(
            "DATA_CORRECTION_APP_URL", "https://correction.ragic-edp.example.com"
        )
        self.escalation_days = int(os.environ.get("ESCALATION_DAYS", "3"))
        self.enable_notifications = (
            os.environ.get("ENABLE_NOTIFICATIONS", "true").lower() == "true"
        )

    def notify_batch_complete(self, batch: CleaningBatch) -> bool:
        """Send notification when a cleaning batch completes.

        Args:
            batch: Completed batch

        Returns:
            True if at least one notification sent
        """
        if not self.enable_notifications:
            logger.debug("Notifications disabled, skipping batch complete notification")
            return False

        if batch.status == "failed":
            return self._notify_batch_failed(batch)

        # Only notify if there are pending items
        if batch.manual_count == 0:
            logger.info("No pending items, skipping notification")
            return True

        context = {
            "batch_id": batch.id,
            "processed_records": batch.processed_records,
            "auto_fixed_count": batch.auto_fixed_count,
            "ai_fixed_count": batch.ai_fixed_count,
            "manual_count": batch.manual_count,
        }

        # Send Email
        email_ok = self.email_sender.send_template("cleaning_summary", context)

        # Send LINE
        line_msg = self._format_batch_complete_line(batch)
        line_ok = self.line_sender.send(line_msg)

        return email_ok or line_ok

    def _format_batch_complete_line(self, batch: CleaningBatch) -> str:
        """Format batch completion message for LINE."""
        return (
            f"📊 [RagicEDP] 資料清洗完成\n\n"
            f"批次 ID: {batch.id}\n"
            f"處理記錄: {batch.processed_records}\n"
            f"自動修正: {batch.auto_fixed_count}\n"
            f"AI 修正: {batch.ai_fixed_count}\n"
            f"待人工處理: {batch.manual_count}\n\n"
            f"🔗 {self.app_url}"
        )

    def _notify_batch_failed(self, batch: CleaningBatch) -> bool:
        """Send notification when a batch fails."""
        context = {
            "batch_id": batch.id,
            "error_message": batch.error_message or "Unknown error",
        }

        # Send Email
        email_ok = self.email_sender.send_template("cleaning_failed", context)

        # Send LINE
        line_msg = (
            f"❌ [RagicEDP] 資料清洗失敗\n\n"
            f"批次 ID: {batch.id}\n"
            f"錯誤: {batch.error_message or 'Unknown error'}"
        )
        line_ok = self.line_sender.send(line_msg)

        return email_ok or line_ok

    def notify_pending_violations(
        self,
        violations_summary: dict[str, Any],
    ) -> bool:
        """Send notification about pending violations.

        Args:
            violations_summary: Summary of pending violations

        Returns:
            True if at least one notification sent
        """
        if not self.enable_notifications:
            return False

        total = violations_summary.get("total", 0)
        if total == 0:
            return True

        # Build table summary HTML for Email
        by_table = violations_summary.get("by_table", {})
        table_lines = [f"<li>{table}: {cnt}</li>" for table, cnt in by_table.items()]
        table_summary = "\n".join(table_lines)

        context = {
            "count": total,
            "critical_count": violations_summary.get("critical", 0),
            "high_count": violations_summary.get("high", 0),
            "medium_count": violations_summary.get("medium", 0),
            "low_count": violations_summary.get("low", 0),
            "table_summary": table_summary,
            "app_url": self.app_url,
        }

        # Send Email
        email_ok = self.email_sender.send_template("pending_violations", context)

        # Send LINE
        line_msg = self._format_pending_violations_line(violations_summary)
        line_ok = self.line_sender.send(line_msg)

        return email_ok or line_ok

    def _format_pending_violations_line(
        self, violations_summary: dict[str, Any]
    ) -> str:
        """Format pending violations message for LINE."""
        total = violations_summary.get("total", 0)
        critical = violations_summary.get("critical", 0)
        high = violations_summary.get("high", 0)
        medium = violations_summary.get("medium", 0)
        low = violations_summary.get("low", 0)

        by_table = violations_summary.get("by_table", {})
        table_lines = [f"  • {table}: {cnt}" for table, cnt in by_table.items()]
        table_text = "\n".join(table_lines) if table_lines else "  (無)"

        return (
            f"⚠️ [RagicEDP] 待處理違規通知\n\n"
            f"總計: {total} 筆\n"
            f"🔴 嚴重: {critical}\n"
            f"🟠 高: {high}\n"
            f"🟡 中: {medium}\n"
            f"🟢 低: {low}\n\n"
            f"按表格分類:\n{table_text}\n\n"
            f"🔗 {self.app_url}"
        )

    def notify_escalation(
        self,
        overdue_records: list[dict[str, Any]],
    ) -> bool:
        """Send escalation notification for overdue items.

        Args:
            overdue_records: List of overdue violation records

        Returns:
            True if at least one notification sent
        """
        if not self.enable_notifications:
            return False

        if not overdue_records:
            return True

        # Build records table HTML for Email
        rows = []
        for record in overdue_records[:20]:  # Limit to 20 items
            days = record.get("days_overdue", 0)
            rows.append(
                f"<tr><td>{record.get('record_id', '')}</td>"
                f"<td>{record.get('table_code', '')}</td>"
                f"<td>{record.get('field_name', '')}</td>"
                f"<td>{record.get('before_value', '')}</td>"
                f"<td>{days}</td></tr>"
            )

        context = {
            "count": len(overdue_records),
            "days": self.escalation_days,
            "records_table": "\n".join(rows),
            "app_url": self.app_url,
        }

        # Send Email
        email_ok = self.email_sender.send_template("escalation_reminder", context)

        # Send LINE
        line_msg = self._format_escalation_line(overdue_records)
        line_ok = self.line_sender.send(line_msg)

        return email_ok or line_ok

    def _format_escalation_line(
        self, overdue_records: list[dict[str, Any]]
    ) -> str:
        """Format escalation message for LINE."""
        count = len(overdue_records)

        # Show first 5 records
        record_lines = []
        for record in overdue_records[:5]:
            days = record.get("days_overdue", 0)
            record_id = record.get("record_id", "")[:20]
            table = record.get("table_code", "")
            field = record.get("field_name", "")
            record_lines.append(f"  • [{table}] {record_id} - {field} ({days}天)")

        records_text = "\n".join(record_lines)
        if count > 5:
            records_text += f"\n  ... 還有 {count - 5} 筆"

        return (
            f"🚨 [RagicEDP] 逾期通知\n\n"
            f"共 {count} 筆記錄超過 {self.escalation_days} 天未處理\n\n"
            f"部分記錄:\n{records_text}\n\n"
            f"🔗 {self.app_url}"
        )

    def check_escalations(
        self,
        pending_violations: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Check for violations that need escalation.

        Args:
            pending_violations: List of pending violations

        Returns:
            List of overdue violations
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.escalation_days)
        overdue = []

        for v in pending_violations:
            detected_at = v.get("detected_at")
            if detected_at:
                # Parse ISO format
                if isinstance(detected_at, str):
                    try:
                        detected_at = datetime.fromisoformat(detected_at.replace("Z", "+00:00"))
                    except ValueError:
                        continue

                if detected_at < cutoff:
                    days_overdue = (datetime.now(timezone.utc) - detected_at).days
                    v["days_overdue"] = days_overdue
                    overdue.append(v)

        return overdue

    def run_escalation_check(
        self,
        result_writer: Any,
    ) -> bool:
        """Run escalation check and send notifications.

        Args:
            result_writer: ResultWriter to query pending violations

        Returns:
            True if escalation check completed
        """
        try:
            # Get pending violations
            pending = result_writer.get_pending_violations(limit=1000)

            # Check for overdue items
            overdue = self.check_escalations(pending)

            if overdue:
                logger.info(f"Found {len(overdue)} overdue violations")
                self.notify_escalation(overdue)

            return True

        except Exception as e:
            logger.error(f"Escalation check failed: {e}")
            return False


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_notifier: Notifier | None = None


def get_notifier() -> Notifier:
    """Get the default notifier (singleton)."""
    global _default_notifier
    if _default_notifier is None:
        _default_notifier = Notifier()
    return _default_notifier


def notify_batch_complete(batch: CleaningBatch) -> bool:
    """Notify about batch completion using the default notifier."""
    return get_notifier().notify_batch_complete(batch)
