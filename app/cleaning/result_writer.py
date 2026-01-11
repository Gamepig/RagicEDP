"""
Result Writer for 資料清洗系統 v2.

Writes cleaning results, violations, and history to BigQuery.
"""

import os
from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.cleaning.models import (
    CleaningBatch,
    CleaningHistory,
    CleaningResult,
    Violation,
)
from app.utils.bq_client import BigQueryClient, get_bq_client


class ResultWriter:
    """Writer for cleaning results to BigQuery."""

    def __init__(self, bq_client: BigQueryClient | None = None):
        """Initialize result writer.

        Args:
            bq_client: BigQuery client. Defaults to shared client.
        """
        self.bq_client = bq_client or get_bq_client()

        # Table names from environment or defaults
        self.results_table = os.environ.get("CLEANING_RESULTS_TABLE", "cleaning_results")
        self.violations_table = os.environ.get("VIOLATIONS_TABLE", "violations")
        self.history_table = os.environ.get("CLEANING_HISTORY_TABLE", "cleaning_history")
        self.batches_table = os.environ.get("CLEANING_BATCHES_TABLE", "cleaning_batches")

    # =========================================================================
    # Batch Operations
    # =========================================================================

    def start_batch(self, trigger_type: str = "scheduled") -> CleaningBatch:
        """Create and save a new batch.

        Args:
            trigger_type: How the batch was triggered

        Returns:
            Created CleaningBatch
        """
        batch = CleaningBatch.create(trigger_type=trigger_type)

        errors = self.bq_client.insert_row(self.batches_table, batch.to_bq_row())
        if errors:
            logger.error(f"Failed to insert batch: {errors}")

        logger.info(f"Started batch: {batch.id}")
        return batch

    def complete_batch(self, batch: CleaningBatch, error: str | None = None) -> None:
        """Mark batch as complete and update statistics.

        Args:
            batch: Batch to complete
            error: Optional error message if failed
        """
        batch.complete(error=error)

        # Update using SQL (BigQuery doesn't support UPDATE via API directly)
        sql = f"""
        UPDATE `{self.bq_client.get_table_id(self.batches_table)}`
        SET
            status = @status,
            completed_at = @completed_at,
            total_records = @total_records,
            processed_records = @processed_records,
            auto_fixed_count = @auto_fixed_count,
            ai_fixed_count = @ai_fixed_count,
            manual_count = @manual_count,
            error_message = @error_message
        WHERE id = @batch_id
        """

        params = {
            "batch_id": batch.id,
            "status": batch.status,
            "completed_at": batch.completed_at.isoformat() if batch.completed_at else None,
            "total_records": batch.total_records,
            "processed_records": batch.processed_records,
            "auto_fixed_count": batch.auto_fixed_count,
            "ai_fixed_count": batch.ai_fixed_count,
            "manual_count": batch.manual_count,
            "error_message": batch.error_message,
        }

        try:
            self.bq_client.query(sql, params)
            logger.info(f"Completed batch: {batch.id}, status={batch.status}")
        except Exception as e:
            logger.error(f"Failed to update batch: {e}")

    # =========================================================================
    # Result Operations
    # =========================================================================

    def write_result(self, result: CleaningResult) -> bool:
        """Write a single cleaning result.

        Args:
            result: CleaningResult to write

        Returns:
            True if successful
        """
        errors = self.bq_client.insert_row(self.results_table, result.to_bq_row())
        if errors:
            logger.error(f"Failed to write result {result.id}: {errors}")
            return False
        return True

    def write_results(self, results: list[CleaningResult]) -> int:
        """Write multiple cleaning results.

        Args:
            results: List of CleaningResult to write

        Returns:
            Number of successfully written results
        """
        if not results:
            return 0

        rows = [r.to_bq_row() for r in results]
        errors = self.bq_client.insert_rows(self.results_table, rows)

        success_count = len(results) - len(errors)
        if errors:
            logger.error(f"Failed to write {len(errors)} results")

        return success_count

    def update_result_status(
        self,
        result_id: str,
        status: str,
        fixed_count: int | None = None,
        pending_count: int | None = None,
    ) -> None:
        """Update a result's status.

        Args:
            result_id: Result ID to update
            status: New status
            fixed_count: Updated fixed count
            pending_count: Updated pending count
        """
        set_clauses = ["status = @status"]
        params: dict[str, Any] = {"result_id": result_id, "status": status}

        if fixed_count is not None:
            set_clauses.append("fixed_count = @fixed_count")
            params["fixed_count"] = fixed_count

        if pending_count is not None:
            set_clauses.append("pending_count = @pending_count")
            params["pending_count"] = pending_count

        sql = f"""
        UPDATE `{self.bq_client.get_table_id(self.results_table)}`
        SET {', '.join(set_clauses)}
        WHERE id = @result_id
        """

        try:
            self.bq_client.query(sql, params)
        except Exception as e:
            logger.error(f"Failed to update result status: {e}")

    # =========================================================================
    # Violation Operations
    # =========================================================================

    def write_violation(self, violation: Violation) -> bool:
        """Write a single violation.

        Args:
            violation: Violation to write

        Returns:
            True if successful
        """
        errors = self.bq_client.insert_row(self.violations_table, violation.to_bq_row())
        if errors:
            logger.error(f"Failed to write violation {violation.id}: {errors}")
            return False
        return True

    def write_violations(self, violations: list[Violation]) -> int:
        """Write multiple violations.

        Args:
            violations: List of Violations to write

        Returns:
            Number of successfully written violations
        """
        if not violations:
            return 0

        rows = [v.to_bq_row() for v in violations]
        errors = self.bq_client.insert_rows(self.violations_table, rows)

        success_count = len(violations) - len(errors)
        if errors:
            logger.error(f"Failed to write {len(errors)} violations")

        logger.debug(f"Wrote {success_count} violations")
        return success_count

    def update_violation_status(
        self,
        violation_id: str,
        status: str,
        after_value: str | None = None,
        fixed_by: str | None = None,
    ) -> None:
        """Update a violation's status.

        Args:
            violation_id: Violation ID to update
            status: New status
            after_value: Fixed value
            fixed_by: Who fixed it
        """
        set_clauses = ["status = @status"]
        params: dict[str, Any] = {"violation_id": violation_id, "status": status}

        if status in ("auto_fixed", "ai_fixed", "manual_fixed"):
            set_clauses.append("fixed_at = @fixed_at")
            params["fixed_at"] = datetime.now(timezone.utc).isoformat()

        if after_value is not None:
            set_clauses.append("after_value = @after_value")
            params["after_value"] = after_value

        if fixed_by is not None:
            set_clauses.append("fixed_by = @fixed_by")
            params["fixed_by"] = fixed_by

        sql = f"""
        UPDATE `{self.bq_client.get_table_id(self.violations_table)}`
        SET {', '.join(set_clauses)}
        WHERE id = @violation_id
        """

        try:
            self.bq_client.query(sql, params)
        except Exception as e:
            logger.error(f"Failed to update violation status: {e}")

    # =========================================================================
    # History Operations
    # =========================================================================

    def write_history(self, history: CleaningHistory) -> bool:
        """Write a single history record.

        Args:
            history: CleaningHistory to write

        Returns:
            True if successful
        """
        errors = self.bq_client.insert_row(self.history_table, history.to_bq_row())
        if errors:
            logger.error(f"Failed to write history {history.id}: {errors}")
            return False
        return True

    def write_history_batch(self, histories: list[CleaningHistory]) -> int:
        """Write multiple history records.

        Args:
            histories: List of CleaningHistory to write

        Returns:
            Number of successfully written records
        """
        if not histories:
            return 0

        rows = [h.to_bq_row() for h in histories]
        errors = self.bq_client.insert_rows(self.history_table, rows)

        success_count = len(histories) - len(errors)
        if errors:
            logger.error(f"Failed to write {len(errors)} history records")

        return success_count

    # =========================================================================
    # Query Operations
    # =========================================================================

    def get_pending_violations(
        self,
        table_code: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Get pending violations.

        Args:
            table_code: Filter by table code
            limit: Maximum number to return

        Returns:
            List of violation dictionaries
        """
        where_clauses = ["status = 'pending'"]
        params: dict[str, Any] = {"limit": limit}

        if table_code:
            where_clauses.append("table_code = @table_code")
            params["table_code"] = table_code

        sql = f"""
        SELECT *
        FROM `{self.bq_client.get_table_id(self.violations_table)}`
        WHERE {' AND '.join(where_clauses)}
        ORDER BY
            CASE severity
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END,
            detected_at ASC
        LIMIT @limit
        """

        return self.bq_client.query_to_list(sql, params)

    def get_cleaning_stats(self, batch_id: str | None = None) -> dict[str, Any]:
        """Get cleaning statistics.

        Args:
            batch_id: Optional batch ID to filter by

        Returns:
            Statistics dictionary
        """
        where_clause = ""
        params: dict[str, Any] = {}

        if batch_id:
            where_clause = "WHERE batch_id = @batch_id"
            params["batch_id"] = batch_id

        sql = f"""
        SELECT
            COUNT(*) as total,
            COUNTIF(status = 'completed') as completed,
            COUNTIF(status = 'auto_fixed') as auto_fixed,
            COUNTIF(status = 'ai_fixed') as ai_fixed,
            COUNTIF(status = 'manual') as manual,
            COUNTIF(status = 'failed') as failed
        FROM `{self.bq_client.get_table_id(self.results_table)}`
        {where_clause}
        """

        rows = self.bq_client.query_to_list(sql, params)
        if rows:
            return rows[0]

        return {
            "total": 0,
            "completed": 0,
            "auto_fixed": 0,
            "ai_fixed": 0,
            "manual": 0,
            "failed": 0,
        }


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_writer: ResultWriter | None = None


def get_result_writer() -> ResultWriter:
    """Get the default result writer (singleton)."""
    global _default_writer
    if _default_writer is None:
        _default_writer = ResultWriter()
    return _default_writer


def write_violation(violation: Violation) -> bool:
    """Write a violation using the default writer."""
    return get_result_writer().write_violation(violation)


def write_history(history: CleaningHistory) -> bool:
    """Write a history record using the default writer."""
    return get_result_writer().write_history(history)
