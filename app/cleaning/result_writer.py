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
    CleaningStatus,
    FillResult,
    Violation,
    ViolationStatus,
)
from app.utils.bq_client import BigQueryClient, get_bq_client
from app.utils.symbol_config import get_symbol_config


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
        self.fill_results_table = os.environ.get("FILL_RESULTS_TABLE", "fill_results")

    # =========================================================================
    # Batch Operations
    # =========================================================================

    def start_batch(self, trigger_type: str = "scheduled") -> CleaningBatch:
        """Create and save a new batch.

        Uses SQL INSERT instead of streaming insert to avoid streaming buffer
        conflicts with subsequent UPDATE operations.

        Args:
            trigger_type: How the batch was triggered

        Returns:
            Created CleaningBatch
        """
        batch = CleaningBatch.create(trigger_type=trigger_type)
        row = batch.to_bq_row()

        # Use SQL INSERT instead of streaming insert to avoid streaming buffer issues
        # Note: Don't include completed_at and error_message in initial insert (they are NULL)
        sql = f"""
        INSERT INTO `{self.bq_client.get_table_id(self.batches_table)}`
        (id, trigger_type, started_at, status, total_records,
         processed_records, auto_fixed_count, ai_fixed_count, manual_count)
        VALUES
        (@id, @trigger_type, @started_at, @status, @total_records,
         @processed_records, @auto_fixed_count, @ai_fixed_count, @manual_count)
        """

        params = {
            "id": row["id"],
            "trigger_type": row["trigger_type"],
            "started_at": row["started_at"],
            "status": row["status"],
            "total_records": row["total_records"],
            "processed_records": row["processed_records"],
            "auto_fixed_count": row["auto_fixed_count"],
            "ai_fixed_count": row["ai_fixed_count"],
            "manual_count": row["manual_count"],
        }

        try:
            job = self.bq_client.query(sql, params)
            job.result()  # Wait for completion
            logger.info(f"Started batch: {batch.id}")
        except Exception as e:
            logger.error(f"Failed to insert batch: {e}")

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
            job = self.bq_client.query(sql, params)
            job.result()  # Wait for completion
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
        record_id: str,
        table_code: str,
        status: str,
        violation_count: int | None = None,
    ) -> None:
        """Update a result's status.

        Note: BigQuery schema uses (record_id, table_code) as composite key,
        not a separate id field.

        Args:
            record_id: Record ID (ragic_id) to update
            table_code: Table code
            status: New status
            violation_count: Updated violation count
        """
        set_clauses = ["status = @status"]
        params: dict[str, Any] = {
            "record_id": record_id,
            "table_code": table_code,
            "status": status,
        }

        if violation_count is not None:
            set_clauses.append("violation_count = @violation_count")
            params["violation_count"] = violation_count

        sql = f"""
        UPDATE `{self.bq_client.get_table_id(self.results_table)}`
        SET {', '.join(set_clauses)}
        WHERE record_id = @record_id AND table_code = @table_code
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
        """Write multiple violations with deduplication.

        Uses MERGE to upsert violations, preventing duplicates when the same
        record is processed multiple times.

        Args:
            violations: List of Violations to write

        Returns:
            Number of successfully written violations
        """
        if not violations:
            return 0

        # Deduplicate violations by (table_code, record_id, rule_id)
        # Keep the latest one if duplicates exist in the input
        seen = {}
        for v in violations:
            key = (v.table_code, v.record_id, v.rule_id)
            seen[key] = v

        unique_violations = list(seen.values())
        logger.debug(
            f"Deduped {len(violations)} violations to {len(unique_violations)} unique"
        )

        # Use MERGE to upsert (prevents duplicates from multiple runs)
        table_id = self.bq_client.get_table_id(self.violations_table)

        success_count = 0
        for v in unique_violations:
            try:
                row = v.to_bq_row()
                sql = f"""
                MERGE `{table_id}` T
                USING (SELECT
                    @id as id,
                    @table_code as table_code,
                    @record_id as record_id,
                    @rule_id as rule_id,
                    @field_name as field_name,
                    @before_value as before_value,
                    @after_value as after_value,
                    @severity as severity,
                    @status as status,
                    @ai_suggestion as ai_suggestion,
                    @ai_confidence as ai_confidence,
                    @detected_at as detected_at,
                    @fixed_at as fixed_at,
                    @fixed_by as fixed_by
                ) S
                ON T.table_code = S.table_code
                   AND T.record_id = S.record_id
                   AND T.rule_id = S.rule_id
                WHEN MATCHED THEN UPDATE SET
                    id = S.id,
                    field_name = S.field_name,
                    before_value = S.before_value,
                    after_value = S.after_value,
                    severity = S.severity,
                    status = S.status,
                    ai_suggestion = S.ai_suggestion,
                    ai_confidence = S.ai_confidence,
                    detected_at = S.detected_at,
                    fixed_at = S.fixed_at,
                    fixed_by = S.fixed_by
                WHEN NOT MATCHED THEN INSERT (
                    id, table_code, record_id, rule_id, field_name,
                    before_value, after_value, severity, status,
                    ai_suggestion, ai_confidence, detected_at, fixed_at, fixed_by
                ) VALUES (
                    S.id, S.table_code, S.record_id, S.rule_id, S.field_name,
                    S.before_value, S.after_value, S.severity, S.status,
                    S.ai_suggestion, S.ai_confidence, S.detected_at, S.fixed_at, S.fixed_by
                )
                """

                params = {
                    "id": row["id"],
                    "table_code": row["table_code"],
                    "record_id": row["record_id"],
                    "rule_id": row["rule_id"],
                    "field_name": row["field_name"],
                    "before_value": row["before_value"],
                    "after_value": row["after_value"],
                    "severity": row["severity"],
                    "status": row["status"],
                    "ai_suggestion": row["ai_suggestion"],
                    "ai_confidence": row["ai_confidence"],
                    "detected_at": row["detected_at"],
                    "fixed_at": row["fixed_at"],
                    "fixed_by": row["fixed_by"],
                }

                self.bq_client.query(sql, params)
                success_count += 1

            except Exception as e:
                logger.error(f"Failed to upsert violation {v.id}: {e}")

        logger.info(f"Upserted {success_count}/{len(unique_violations)} violations")
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
    # Fill Results Operations
    # =========================================================================

    def write_fill_results(self, fill_results: list[FillResult]) -> int:
        """Write fill results to BigQuery.

        Args:
            fill_results: List of FillResult to write

        Returns:
            Number of successfully written records
        """
        if not fill_results:
            return 0

        rows = [r.to_bq_row() for r in fill_results]
        errors = self.bq_client.insert_rows(self.fill_results_table, rows)

        success_count = len(fill_results) - len(errors)
        if errors:
            logger.error(f"Failed to write {len(errors)} fill results")

        logger.debug(f"Wrote {success_count} fill results")
        return success_count

    # =========================================================================
    # AI Correction Operations
    # =========================================================================

    def apply_ai_corrections(
        self,
        table_code: str,
        violations: list[Violation],
    ) -> int:
        """Apply AI-fixed values to sheet table's data JSON.

        This method updates the actual data content in the sheet table,
        not just the cleaning_status. It uses JSON_SET to modify specific
        fields within the data JSON column.

        Args:
            table_code: Table code (e.g., "50", "60")
            violations: List of AI-fixed violations with after_value set

        Returns:
            Number of successfully updated records
        """
        # Filter for AI-fixed violations with valid after_value
        ai_fixed = [
            v for v in violations
            if v.status == ViolationStatus.AI_FIXED and v.after_value is not None
        ]

        if not ai_fixed:
            return 0

        try:
            # Get BigQuery table name from symbol config
            symbol_config = get_symbol_config()
            bq_table = symbol_config.get_sheet_table(table_code)
            table_id = self.bq_client.get_table_id(bq_table)

            updated_count = 0

            # Process each violation individually to update specific fields
            # Group by record_id for efficiency (multiple fields per record)
            records_updates: dict[str, list[Violation]] = {}
            for v in ai_fixed:
                if v.record_id not in records_updates:
                    records_updates[v.record_id] = []
                records_updates[v.record_id].append(v)

            for record_id, record_violations in records_updates.items():
                try:
                    # Build JSON_SET chain for multiple fields
                    # Start with: JSON_SET(PARSE_JSON(data), '$.field1', value1)
                    # Chain: JSON_SET(..., '$.field2', value2)
                    json_set_expr = "PARSE_JSON(data)"
                    params: dict[str, Any] = {"record_id": record_id}

                    for idx, v in enumerate(record_violations):
                        param_name = f"value_{idx}"
                        # Escape field name for JSON path
                        field_path = f'$."{v.field_name}"'
                        json_set_expr = f"JSON_SET({json_set_expr}, '{field_path}', @{param_name})"
                        params[param_name] = v.after_value

                    sql = f"""
                    UPDATE `{table_id}`
                    SET
                        data = TO_JSON_STRING({json_set_expr}),
                        cleaning_status = 'ai_fixed',
                        cleaning_updated_at = @updated_at
                    WHERE ragic_id = @record_id
                    """

                    params["updated_at"] = datetime.now(timezone.utc).isoformat()

                    result = self.bq_client.query(sql, params)
                    result.result()  # Wait for completion

                    affected = getattr(result, 'num_dml_affected_rows', None)
                    if affected is not None and isinstance(affected, int) and affected > 0:
                        updated_count += 1
                        logger.debug(
                            f"Applied AI correction to {bq_table} record {record_id}: "
                            f"{len(record_violations)} field(s) updated"
                        )
                    else:
                        # Assume success if no error
                        updated_count += 1

                except Exception as e:
                    logger.error(
                        f"Failed to apply AI correction to record {record_id}: {e}"
                    )

            logger.info(
                f"Table {table_code}: applied AI corrections to {updated_count} records' data"
            )
            return updated_count

        except Exception as e:
            logger.error(f"Failed to apply AI corrections: {e}")
            return 0

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

    def get_cleaning_stats(
        self,
        table_code: str | None = None,
        date_from: str | None = None,
    ) -> dict[str, Any]:
        """Get cleaning statistics.

        Args:
            table_code: Optional table code to filter by
            date_from: Optional date to filter from (YYYY-MM-DD format)

        Returns:
            Statistics dictionary
        """
        where_clauses = []
        params: dict[str, Any] = {}

        if table_code:
            where_clauses.append("table_code = @table_code")
            params["table_code"] = table_code

        if date_from:
            where_clauses.append("DATE(cleaned_at) >= @date_from")
            params["date_from"] = date_from

        where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

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

    # =========================================================================
    # Sheet Status Update Operations
    # =========================================================================

    def update_sheet_cleaning_status(
        self,
        table_code: str,
        record_statuses: dict[str, CleaningStatus],
    ) -> int:
        """Update cleaning_status field in sheet tables.

        Args:
            table_code: Table code (e.g., "50", "60")
            record_statuses: Dict mapping record_id (ragic_id) to CleaningStatus

        Returns:
            Number of successfully updated records
        """
        if not record_statuses:
            return 0

        try:
            # Get BigQuery table name from symbol config
            symbol_config = get_symbol_config()
            bq_table = symbol_config.get_sheet_table(table_code)
            table_id = self.bq_client.get_table_id(bq_table)

            updated_count = 0

            # Group by status for efficient batch updates
            status_groups: dict[str, list[str]] = {}
            for record_id, status in record_statuses.items():
                status_value = status.value
                if status_value not in status_groups:
                    status_groups[status_value] = []
                status_groups[status_value].append(record_id)

            # Update each status group
            for status_value, record_ids in status_groups.items():
                sql = f"""
                UPDATE `{table_id}`
                SET
                    cleaning_status = @status,
                    cleaning_updated_at = @updated_at
                WHERE ragic_id IN UNNEST(@record_ids)
                """

                params = {
                    "status": status_value,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "record_ids": record_ids,
                }

                try:
                    result = self.bq_client.query(sql, params)
                    result.result()  # Wait for completion
                    # BigQuery UPDATE returns num_dml_affected_rows
                    affected = getattr(result, 'num_dml_affected_rows', None)
                    # 確保 affected 是有效數字，避免 None 導致 TypeError
                    if affected is not None and isinstance(affected, int):
                        updated_count += affected
                    else:
                        # 如果無法取得實際影響行數，使用請求的記錄數作為估計
                        updated_count += len(record_ids)

                    logger.debug(
                        f"Updated {len(record_ids)} records in {bq_table} "
                        f"to status '{status_value}'"
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to update {bq_table} records to '{status_value}': {e}"
                    )

            logger.info(
                f"Table {table_code}: updated {updated_count} records' cleaning_status"
            )
            return updated_count

        except Exception as e:
            logger.error(f"Failed to update sheet cleaning status: {e}")
            return 0

    def fix_inconsistent_manual_status(
        self,
        table_code: str | None = None,
    ) -> dict[str, int]:
        """Fix records where cleaning_status='manual' but no pending violations exist.

        This method addresses data inconsistency where:
        - Sheet table has cleaning_status='manual'
        - But violations table has no pending violations for that record

        Such inconsistency can occur when:
        1. AI fixes violations after status was determined
        2. Manual corrections through data-correction-app
        3. Violations were deleted or updated externally

        Args:
            table_code: Optional table code to fix. If None, fix all tables.

        Returns:
            Dict with table_code -> count of fixed records
        """
        symbol_config = get_symbol_config()
        results: dict[str, int] = {}

        # Get tables to process
        if table_code:
            table_codes = [table_code]
        else:
            table_codes = ["10", "20", "30", "40", "41", "50", "60", "70", "80", "99"]

        for tc in table_codes:
            try:
                bq_table = symbol_config.get_sheet_table(tc)
                table_id = self.bq_client.get_table_id(bq_table)
                violations_table = self.bq_client.get_table_id(self.violations_table)

                # Update records that are 'manual' but have no pending violations
                sql = f"""
                UPDATE `{table_id}` t
                SET
                    cleaning_status = 'completed',
                    cleaning_updated_at = @updated_at
                WHERE t.cleaning_status = 'manual'
                  AND t.ragic_id NOT IN (
                    SELECT DISTINCT record_id
                    FROM `{violations_table}`
                    WHERE table_code = @table_code
                      AND (status IS NULL OR status = 'pending')
                  )
                """

                params = {
                    "table_code": tc,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }

                result = self.bq_client.query(sql, params)
                result.result()  # Wait for completion

                affected = getattr(result, 'num_dml_affected_rows', None)
                fixed_count = affected if isinstance(affected, int) else 0

                if fixed_count > 0:
                    results[tc] = fixed_count
                    logger.info(
                        f"Table {tc}: Fixed {fixed_count} inconsistent manual status records"
                    )

            except Exception as e:
                logger.warning(f"Failed to fix inconsistent status for table {tc}: {e}")

        total_fixed = sum(results.values())
        if total_fixed > 0:
            logger.info(f"Total fixed inconsistent manual status records: {total_fixed}")

        return results


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
