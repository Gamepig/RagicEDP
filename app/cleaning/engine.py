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
        self.max_records = int(os.environ.get("CLEANING_MAX_RECORDS", "10000"))
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
        2. Phase 2: Validation - 再驗證資料（此時已有回填資料）
        3. Phase 3: Auto-fix - 自動修復格式問題
        4. Phase 4: AI Analysis - AI 分析無法自動修復的問題

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

            # Phase 2: SQL Validation (after auto-fill)
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

                    # Update pending count (subtract AI-fixed from previously accumulated manual_count)
                    pending = len([v for v in fixed_violations if v.status.value == "pending"])
                    stats["pending_manual"] = pending
                    batch.manual_count -= ai_fixed_count  # Subtract AI-fixed, don't replace

                    logger.info(f"Table {table_code}: ai_fixed={ai_fixed_count}")

            # Write results
            self._write_results(batch, table_code, fixed_violations, histories, fill_results)

            logger.info(
                f"Table {table_code}: "
                f"violations={len(violations)}, "
                f"auto_fixed={stats['auto_fixed']}, "
                f"ai_fixed={stats['ai_fixed']}, "
                f"auto_filled={stats['auto_filled']}, "
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
