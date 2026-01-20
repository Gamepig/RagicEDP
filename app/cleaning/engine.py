"""
Cleaning Engine for 資料清洗系統 v2.

Main orchestrator for the data cleaning pipeline.
"""

import os
from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.ai.analyzer import AIAnalyzer, get_analyzer
from app.cleaning.auto_filler import AutoFiller, get_filler
from app.cleaning.field_fixer import FieldFixer, get_field_fixer
from app.notification.notifier import Notifier, get_notifier
from app.cleaning.models import (
    CleaningBatch,
    CleaningResult,
    CleaningStatus,
    FillResult,
    Violation,
)
from app.cleaning.result_writer import ResultWriter, get_result_writer
from app.cleaning.rule_registry import get_registry
from app.cleaning.sql_cleaner import SQLCleaner, get_sql_cleaner
from app.utils.symbol_config import get_symbol_config


class CleaningEngine:
    """Main orchestrator for data cleaning."""

    def __init__(
        self,
        sql_cleaner: SQLCleaner | None = None,
        field_fixer: FieldFixer | None = None,
        auto_filler: AutoFiller | None = None,
        ai_analyzer: AIAnalyzer | None = None,
        notifier: Notifier | None = None,
        result_writer: ResultWriter | None = None,
    ):
        """Initialize cleaning engine.

        Args:
            sql_cleaner: SQL cleaner instance
            field_fixer: Field fixer instance
            auto_filler: Auto filler instance
            ai_analyzer: AI analyzer instance
            notifier: Notifier instance
            result_writer: Result writer instance
        """
        self.sql_cleaner = sql_cleaner or get_sql_cleaner()
        self.field_fixer = field_fixer or get_field_fixer()
        self.auto_filler = auto_filler or get_filler()
        self.ai_analyzer = ai_analyzer or get_analyzer()
        self.notifier = notifier or get_notifier()
        self.result_writer = result_writer or get_result_writer()
        self.registry = get_registry()
        self.symbol_config = get_symbol_config()

        # Configuration
        self.batch_size = int(os.environ.get("CLEANING_BATCH_SIZE", "100"))
        # 降低預設值避免記憶體溢出和過多 BQ 查詢
        # 每筆 AutoFillRule 都會執行獨立查詢，10000 筆 = 10000 次查詢
        self.max_records = int(os.environ.get("CLEANING_MAX_RECORDS", "1000"))
        self.enable_auto_fill = os.environ.get("ENABLE_AUTO_FILL", "true").lower() == "true"
        self.enable_ai = os.environ.get("ENABLE_AI_ANALYSIS", "true").lower() == "true"
        self.enable_notifications = os.environ.get("ENABLE_NOTIFICATIONS", "true").lower() == "true"

    def run(
        self,
        table_codes: list[str] | None = None,
        trigger_type: str = "scheduled",
    ) -> CleaningBatch:
        """Run the cleaning pipeline.

        Args:
            table_codes: List of table codes to process. Defaults to all.
            trigger_type: How the cleaning was triggered

        Returns:
            CleaningBatch with results
        """
        # Create batch
        batch = self.result_writer.start_batch(trigger_type)
        logger.info(f"Starting cleaning batch: {batch.id}")

        try:
            # Get tables to process (維度表 → 事實表 順序)
            if table_codes is None:
                table_codes = self._get_processing_order()

            # Process each table
            for table_code in table_codes:
                self._process_table(batch, table_code)

            # Complete batch
            batch.status = "completed"
            logger.info(
                f"Batch {batch.id} completed: "
                f"processed={batch.processed_records}, "
                f"auto_fixed={batch.auto_fixed_count}, "
                f"manual={batch.manual_count}"
            )

        except Exception as e:
            logger.error(f"Batch {batch.id} failed: {e}")
            batch.status = "failed"
            batch.error_message = str(e)

        finally:
            self.result_writer.complete_batch(batch)

            # Fix any inconsistent manual status records
            # This ensures records marked as 'manual' but without pending violations
            # are correctly updated to 'completed'
            try:
                fixed_counts = self.result_writer.fix_inconsistent_manual_status()
                if fixed_counts:
                    logger.info(f"Fixed inconsistent manual status: {fixed_counts}")
            except Exception as e:
                logger.warning(f"Failed to fix inconsistent manual status: {e}")

            # Send notification
            if self.enable_notifications:
                try:
                    self.notifier.notify_batch_complete(batch)
                except Exception as e:
                    logger.warning(f"Failed to send notification: {e}")

        return batch

    def run_table(
        self,
        table_code: str,
        record_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """Run cleaning for a single table.

        Args:
            table_code: Table code to process
            record_ids: Optional specific record IDs

        Returns:
            Processing statistics
        """
        batch = self.result_writer.start_batch("manual")

        try:
            stats = self._process_table(batch, table_code, record_ids)
            batch.status = "completed"
        except Exception as e:
            logger.error(f"Table processing failed: {e}")
            batch.status = "failed"
            batch.error_message = str(e)
            stats = {"error": str(e)}
        finally:
            self.result_writer.complete_batch(batch)

        return stats

    def _get_processing_order(self) -> list[str]:
        """Get tables in processing order (維度表 → 事實表)."""
        # Based on research.md §6
        return [
            "10",  # 品牌表 (維度)
            "20",  # 通路表 (維度)
            "30",  # 金流表 (維度)
            "40",  # 物流表 (維度)
            "41",  # 郵遞區號表 (維度)
            "70",  # 商品表 (維度)
            "80",  # 活動管理表 (維度)
            "60",  # 客戶表 (事實)
            "50",  # 訂單表 (事實)
            "99",  # 訂單明細表 (事實)
        ]

    def _process_table(
        self,
        batch: CleaningBatch,
        table_code: str,
        record_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """Process a single table.

        處理順序（重要）：
        1. Phase 1: Auto-fill - 先從關聯表回填缺失欄位
        2. Phase 2.5: Data Fix - 修正資料異常（如未來時間戳）
        3. Phase 2: Validation - 再驗證資料（此時已有回填資料）
        4. Phase 3: Auto-fix - 自動修復格式問題
        5. Phase 4: AI Analysis - AI 分析無法自動修復的問題
        6. Phase 5: Filter - 過濾無法使用的記錄（最後執行）

        Args:
            batch: Current batch
            table_code: Table to process
            record_ids: Optional specific record IDs

        Returns:
            Processing statistics
        """
        logger.info(f"Processing table {table_code}")
        stats = {
            "table_code": table_code,
            "total_records": 0,
            "violations_found": 0,
            "auto_fixed": 0,
            "ai_fixed": 0,
            "auto_filled": 0,
            "pending_manual": 0,
            "data_fixed": 0,
            "filtered": 0,
        }

        try:
            histories = []

            # Phase 1: Auto-fill missing fields FIRST (before validation)
            # 先從關聯表回填缺失欄位（如從訂單明細回填訂單的客戶編號）
            fill_results: list[FillResult] = []
            if self.enable_auto_fill:
                fill_results = self.auto_filler.fill_table(
                    table_code, batch.id, limit=self.max_records
                )
                fill_histories = self.auto_filler.create_histories(fill_results)
                histories.extend(fill_histories)

                auto_filled = len([r for r in fill_results if r.status.value == "auto_fixed"])
                stats["auto_filled"] = auto_filled
                batch.auto_fixed_count += auto_filled

                logger.info(f"Table {table_code}: auto_filled={auto_filled}")

            # Phase 2.5: Fix data issues (e.g., future timestamps)
            # 嘗試修正異常資料，無法修正的會被標記 filter_reason
            data_fix_stats = self._fix_data_issues(table_code, batch.id)
            stats["data_fixed"] = data_fix_stats.get("fixed_count", 0)
            if data_fix_stats.get("future_records_found", 0) > 0:
                logger.info(
                    f"Table {table_code}: data_fix found={data_fix_stats['future_records_found']}, "
                    f"fixed={data_fix_stats['fixed_count']}, unfixable={data_fix_stats['unfixable_count']}"
                )

            # Phase 2: SQL Validation (after auto-fill and data fix)
            # 回填後再驗證，避免對可自動回填的欄位產生假違規
            violations = self.sql_cleaner.validate_table(
                table_code, record_ids, limit=self.max_records
            )
            stats["violations_found"] = len(violations)

            # Phase 3: Auto-fix violations
            fixed_violations: list[Violation] = []

            if violations:
                fixed_violations, fix_histories = self.field_fixer.fix_violations(violations)
                histories.extend(fix_histories)

                # Count results
                auto_fixed = len([v for v in fixed_violations if v.status.value == "auto_fixed"])
                pending = len([v for v in fixed_violations if v.status.value == "pending"])

                stats["auto_fixed"] = auto_fixed
                stats["pending_manual"] = pending

                # Update batch counts
                batch.processed_records += len(set(v.record_id for v in fixed_violations))
                batch.auto_fixed_count += auto_fixed
                batch.manual_count += pending

            # Phase 4: AI Analysis for pending violations
            if self.enable_ai and fixed_violations:
                pending_violations = [
                    v for v in fixed_violations if v.status.value == "pending"
                ]

                if pending_violations:
                    logger.info(
                        f"Running AI analysis on {len(pending_violations)} pending violations"
                    )

                    # Analyze with AI
                    ai_results = self.ai_analyzer.analyze_violations_batch(
                        pending_violations,
                        table_context={"table_code": table_code},
                    )

                    # Apply high-confidence suggestions
                    fixed_violations, ai_fixed_count = self.ai_analyzer.apply_suggestions(
                        fixed_violations, ai_results
                    )

                    stats["ai_fixed"] = ai_fixed_count
                    batch.ai_fixed_count += ai_fixed_count

                    # Apply AI corrections to actual data in sheet table
                    if ai_fixed_count > 0:
                        ai_corrected = self.result_writer.apply_ai_corrections(
                            table_code, fixed_violations
                        )
                        logger.info(
                            f"Table {table_code}: applied {ai_corrected} AI corrections to data"
                        )

                    # Update pending count (subtract AI-fixed from previously accumulated manual_count)
                    pending = len([v for v in fixed_violations if v.status.value == "pending"])
                    stats["pending_manual"] = pending
                    batch.manual_count -= ai_fixed_count  # Subtract AI-fixed, don't replace

                    logger.info(f"Table {table_code}: ai_fixed={ai_fixed_count}")

            # Write results
            self._write_results(batch, table_code, fixed_violations, histories, fill_results)

            # Phase 5: Filter invalid records (executed LAST)
            # 過濾無效記錄：缺少主鍵、無法修正的異常資料等
            filter_stats = self._filter_invalid_records(table_code, batch.id)
            stats["filtered"] = filter_stats.get("filtered_count", 0)
            if filter_stats.get("filtered_count", 0) > 0:
                logger.info(
                    f"Table {table_code}: filtered {filter_stats['filtered_count']} records "
                    f"(reasons: {filter_stats.get('reasons', {})})"
                )

            logger.info(
                f"Table {table_code}: "
                f"violations={len(violations)}, "
                f"auto_fixed={stats['auto_fixed']}, "
                f"ai_fixed={stats['ai_fixed']}, "
                f"auto_filled={stats['auto_filled']}, "
                f"data_fixed={stats['data_fixed']}, "
                f"filtered={stats['filtered']}, "
                f"pending={stats['pending_manual']}"
            )

        except Exception as e:
            logger.error(f"Error processing table {table_code}: {e}")
            stats["error"] = str(e)

        return stats

    def _write_results(
        self,
        batch: CleaningBatch,
        table_code: str,
        violations: list[Violation],
        histories: list,
        fill_results: list[FillResult] | None = None,
    ) -> None:
        """Write cleaning results to BigQuery."""
        # Group violations by record
        records: dict[str, list[Violation]] = {}
        for v in violations:
            if v.record_id not in records:
                records[v.record_id] = []
            records[v.record_id].append(v)

        # Create results
        results: list[CleaningResult] = []
        for record_id, record_violations in records.items():
            # Determine overall status
            status = self._determine_status(record_violations)

            result = CleaningResult(
                table_code=table_code,
                record_id=record_id,
                batch_id=batch.id,
                status=status,
                violation_count=len(record_violations),
                fixed_count=len([v for v in record_violations if v.status.value == "auto_fixed"]),
                pending_count=len([v for v in record_violations if v.status.value == "pending"]),
                processed_at=datetime.now(timezone.utc),
            )
            results.append(result)

        # Write to BigQuery
        if results:
            self.result_writer.write_results(results)

        if violations:
            self.result_writer.write_violations(violations)

        if histories:
            self.result_writer.write_history_batch(histories)

        # Write fill results
        if fill_results:
            self.result_writer.write_fill_results(fill_results)

        # Update cleaning_status in sheet tables
        if results:
            record_statuses = {r.record_id: r.status for r in results}
            self.result_writer.update_sheet_cleaning_status(table_code, record_statuses)

    def _determine_status(self, violations: list[Violation]) -> CleaningStatus:
        """Determine overall status for a record based on its violations."""
        if not violations:
            return CleaningStatus.COMPLETED

        statuses = [v.status.value for v in violations]

        # If any pending, needs manual review
        if "pending" in statuses:
            return CleaningStatus.MANUAL

        # All auto-fixed
        if all(s == "auto_fixed" for s in statuses):
            return CleaningStatus.AUTO_FIXED

        return CleaningStatus.COMPLETED

    def _fix_data_issues(self, table_code: str, batch_id: str) -> dict[str, Any]:
        """Phase 2.5: Fix data issues like future timestamps.

        Attempts to fix records with anomalous data before filtering:
        1. Find records where _ragicModifiedTime > current time
        2. For orders (table 50), try to get earliest time from order_details (table 99)
        3. Mark unfixable records with filter_reason

        Args:
            table_code: Table code to process
            batch_id: Current batch ID

        Returns:
            Stats dict: {future_records_found, fixed_count, unfixable_count}
        """
        stats = {
            "future_records_found": 0,
            "fixed_count": 0,
            "unfixable_count": 0,
        }

        try:
            table_name = self.symbol_config.get_sheet_table(table_code)
        except KeyError:
            logger.warning(f"Unknown table code: {table_code}")
            return stats

        bq_client = self.sql_cleaner.bq_client
        full_table = f"`{bq_client.project_id}.{bq_client.dataset}.{table_name}`"

        # Step 1: Find records with future timestamps
        find_future_sql = f"""
        SELECT
            ragic_id,
            JSON_VALUE(data, '$._ragicModifiedTime') as modified_time
        FROM {full_table}
        WHERE SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S',
                JSON_VALUE(data, '$._ragicModifiedTime')) > CURRENT_TIMESTAMP()
          AND (is_filtered IS NULL OR is_filtered = FALSE)
        """

        try:
            future_records = list(bq_client.query(find_future_sql).result())
            stats["future_records_found"] = len(future_records)

            if not future_records:
                logger.info(f"Table {table_code}: No future timestamp records found")
                return stats

            logger.info(
                f"Table {table_code}: Found {len(future_records)} records with future timestamps"
            )

            # Step 2: Try to fix from related tables (only for order table 50)
            if table_code == "50":
                fixed_ids = self._fix_order_timestamps_from_details(
                    bq_client, full_table, future_records, batch_id
                )
                stats["fixed_count"] = len(fixed_ids)

                # Mark remaining as unfixable
                unfixable_ids = [r.ragic_id for r in future_records if r.ragic_id not in fixed_ids]
            else:
                # For other tables, all future timestamp records are unfixable
                unfixable_ids = [r.ragic_id for r in future_records]

            # Step 3: Mark unfixable records
            if unfixable_ids:
                mark_unfixable_sql = f"""
                UPDATE {full_table}
                SET filter_reason = 'future_timestamp_unfixable',
                    cleaning_batch_id = @batch_id
                WHERE ragic_id IN UNNEST(@ids)
                """
                bq_client.query(mark_unfixable_sql, {"batch_id": batch_id, "ids": unfixable_ids}).result()
                stats["unfixable_count"] = len(unfixable_ids)

                logger.info(
                    f"Table {table_code}: Marked {len(unfixable_ids)} records as unfixable"
                )

        except Exception as e:
            logger.error(f"Error fixing data issues for table {table_code}: {e}")
            stats["error"] = str(e)

        return stats

    def _fix_order_timestamps_from_details(
        self,
        bq_client,
        order_table: str,
        future_records: list,
        batch_id: str,
    ) -> set[int]:
        """Fix order timestamps using earliest detail timestamp.

        Args:
            bq_client: BigQuery client
            order_table: Full order table name
            future_records: List of records with future timestamps
            batch_id: Current batch ID

        Returns:
            Set of ragic_id values that were successfully fixed
        """
        fixed_ids = set()
        try:
            detail_table_name = self.symbol_config.get_sheet_table("99")
        except KeyError:
            return fixed_ids

        detail_table = f"`{bq_client.project_id}.{bq_client.dataset}.{detail_table_name}`"

        for record in future_records:
            try:
                # Get order number from the order record
                get_order_no_sql = f"""
                SELECT JSON_VALUE(data, '$.訂單編號') as order_no
                FROM {order_table}
                WHERE ragic_id = @ragic_id
                """
                order_result = list(bq_client.query(get_order_no_sql, {"ragic_id": record.ragic_id}).result())

                if not order_result or not order_result[0].order_no:
                    continue

                order_no = order_result[0].order_no

                # Find earliest modified time from order details
                find_earliest_sql = f"""
                SELECT MIN(SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S',
                    JSON_VALUE(data, '$._ragicModifiedTime'))) as earliest_time
                FROM {detail_table}
                WHERE JSON_VALUE(data, '$.訂單編號') = @order_no
                  AND SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S',
                      JSON_VALUE(data, '$._ragicModifiedTime')) <= CURRENT_TIMESTAMP()
                """
                detail_result = list(bq_client.query(find_earliest_sql, {"order_no": order_no}).result())

                if not detail_result or not detail_result[0].earliest_time:
                    continue

                earliest_time = detail_result[0].earliest_time

                # Update order with the fixed timestamp using string format
                # Note: BigQuery JSON_SET returns JSON type, need TO_JSON_STRING
                formatted_time = earliest_time.strftime("%Y-%m-%d %H:%M:%S")
                fix_sql = f"""
                UPDATE {order_table}
                SET data = TO_JSON_STRING(
                    JSON_SET(
                        PARSE_JSON(data),
                        '$._ragicModifiedTime',
                        @fixed_time
                    )
                ),
                cleaning_batch_id = @batch_id
                WHERE ragic_id = @ragic_id
                """
                bq_client.query(fix_sql, {
                    "fixed_time": formatted_time,
                    "batch_id": batch_id,
                    "ragic_id": record.ragic_id,
                }).result()

                fixed_ids.add(record.ragic_id)
                logger.debug(f"Fixed order ragic_id={record.ragic_id} with time from details")

            except Exception as e:
                logger.warning(f"Failed to fix order ragic_id={record.ragic_id}: {e}")
                continue

        return fixed_ids

    def _filter_invalid_records(self, table_code: str, batch_id: str) -> dict[str, Any]:
        """Phase 5: Filter records that cannot be used for analysis.

        Marks records as filtered when:
        1. Primary key is missing (null or empty)
        2. Has unfixable data issues (filter_reason already set)

        Args:
            table_code: Table code to process
            batch_id: Current batch ID

        Returns:
            Stats dict: {total_checked, filtered_count, reasons}
        """
        stats = {
            "total_checked": 0,
            "filtered_count": 0,
            "reasons": {},
        }

        try:
            table_name = self.symbol_config.get_sheet_table(table_code)
        except KeyError:
            logger.warning(f"Unknown table code: {table_code}")
            return stats

        pk_info = self.symbol_config.get_primary_key(table_code)
        if not pk_info:
            logger.warning(f"No primary key config for table {table_code}")
            return stats

        bq_client = self.sql_cleaner.bq_client
        full_table = f"`{bq_client.project_id}.{bq_client.dataset}.{table_name}`"

        # Build primary key check condition
        if pk_info.get("composite", False):
            # Composite key: all parts must be non-empty
            pk_fields = pk_info["json_path"].split(",")
            pk_conditions = " OR ".join([
                f"(JSON_VALUE(data, '$.{field.strip()}') IS NULL OR "
                f"TRIM(JSON_VALUE(data, '$.{field.strip()}')) = '')"
                for field in pk_fields
            ])
        else:
            # Single key
            pk_field = pk_info["json_path"]
            pk_conditions = (
                f"(JSON_VALUE(data, '$.{pk_field}') IS NULL OR "
                f"TRIM(JSON_VALUE(data, '$.{pk_field}')) = '')"
            )

        try:
            # Count total unflagged records
            count_sql = f"""
            SELECT COUNT(*) as cnt
            FROM {full_table}
            WHERE is_filtered IS NULL OR is_filtered = FALSE
            """
            count_result = list(bq_client.query(count_sql).result())
            stats["total_checked"] = count_result[0].cnt if count_result else 0

            # Filter 1: Missing primary key
            filter_pk_sql = f"""
            UPDATE {full_table}
            SET is_filtered = TRUE,
                filter_reason = 'missing_primary_key',
                cleaning_batch_id = @batch_id
            WHERE (is_filtered IS NULL OR is_filtered = FALSE)
              AND ({pk_conditions})
            """
            pk_job = bq_client.query(filter_pk_sql, {"batch_id": batch_id})
            pk_job.result()
            pk_filtered = pk_job.num_dml_affected_rows or 0
            stats["reasons"]["missing_primary_key"] = pk_filtered

            # Filter 2: Records already marked with filter_reason (e.g., from Phase 2.5)
            filter_reason_sql = f"""
            UPDATE {full_table}
            SET is_filtered = TRUE,
                cleaning_batch_id = @batch_id
            WHERE (is_filtered IS NULL OR is_filtered = FALSE)
              AND filter_reason IS NOT NULL
            """
            reason_job = bq_client.query(filter_reason_sql, {"batch_id": batch_id})
            reason_job.result()
            reason_filtered = reason_job.num_dml_affected_rows or 0
            stats["reasons"]["had_filter_reason"] = reason_filtered

            stats["filtered_count"] = pk_filtered + reason_filtered

            logger.info(
                f"Table {table_code}: Filtered {stats['filtered_count']} records "
                f"(pk_missing={pk_filtered}, had_reason={reason_filtered})"
            )

            # Update sheet table cleaning_status for filtered records
            if stats["filtered_count"] > 0:
                self._update_filtered_status(bq_client, full_table, table_code, batch_id)

        except Exception as e:
            logger.error(f"Error filtering records for table {table_code}: {e}")
            stats["error"] = str(e)

        return stats

    def _update_filtered_status(
        self,
        bq_client,
        full_table: str,
        table_code: str,
        batch_id: str,
    ) -> None:
        """Update cleaning_status to 'filtered' for filtered records.

        Args:
            bq_client: BigQuery client
            full_table: Full table name
            table_code: Table code
            batch_id: Current batch ID
        """
        try:
            update_status_sql = f"""
            UPDATE {full_table}
            SET cleaning_status = 'filtered'
            WHERE is_filtered = TRUE
              AND cleaning_batch_id = @batch_id
              AND (cleaning_status IS NULL OR cleaning_status != 'filtered')
            """
            bq_client.query(update_status_sql, {"batch_id": batch_id}).result()
            logger.debug(f"Updated cleaning_status for filtered records in table {table_code}")

        except Exception as e:
            logger.warning(f"Failed to update cleaning_status for table {table_code}: {e}")


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_engine: CleaningEngine | None = None


def get_engine() -> CleaningEngine:
    """Get the default cleaning engine (singleton)."""
    global _default_engine
    if _default_engine is None:
        _default_engine = CleaningEngine()
    return _default_engine


def run_cleaning(
    table_codes: list[str] | None = None,
    trigger_type: str = "scheduled",
) -> CleaningBatch:
    """Run cleaning using the default engine."""
    return get_engine().run(table_codes, trigger_type)


# =============================================================================
# CLI Entry Point
# =============================================================================

if __name__ == "__main__":
    import argparse

    from app.utils.logging_config import setup_logging

    setup_logging()

    parser = argparse.ArgumentParser(description="Run data cleaning")
    parser.add_argument("--table", "-t", type=str, help="Specific table code to process")
    parser.add_argument("--date", "-d", type=str, help="Processing date (YYYY-MM-DD)")
    args = parser.parse_args()

    tables = [args.table] if args.table else None
    result = run_cleaning(tables, "manual")

    print(f"Batch ID: {result.id}")
    print(f"Status: {result.status}")
    print(f"Processed: {result.processed_records}")
    print(f"Auto-fixed: {result.auto_fixed_count}")
    print(f"Manual: {result.manual_count}")
