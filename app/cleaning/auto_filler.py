"""
Auto Filler for 資料清洗系統 v2.

Executes auto-fill rules to populate missing fields from related data.
"""

from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.cleaning.models import (
    ActionType,
    CleaningHistory,
    FillResult,
    ViolationStatus,
)
from app.cleaning.rule_registry import CleaningRule, get_registry
from app.utils.bq_client import get_bq_client


class AutoFiller:
    """Executes auto-fill rules to populate missing fields."""

    def __init__(self):
        """Initialize auto filler."""
        self.registry = get_registry()
        self.bq_client = get_bq_client()

    def fill_table(
        self,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute all fill rules for a table.

        Args:
            table_code: Table code to fill
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        fill_rules = self.registry.get_fill_rules(table_code)
        if not fill_rules:
            logger.info(f"No fill rules for table {table_code}")
            return []

        logger.info(f"Executing {len(fill_rules)} fill rules for table {table_code}")

        results: list[FillResult] = []

        # Group rules by execution phase
        phases = sorted(set(r.execution_phase for r in fill_rules))

        for phase in phases:
            phase_rules = [r for r in fill_rules if r.execution_phase == phase]
            logger.debug(f"Phase {phase}: {len(phase_rules)} rules")

            for rule in phase_rules:
                try:
                    phase_results = self._execute_fill_rule(
                        rule, table_code, batch_id, limit
                    )
                    results.extend(phase_results)
                except Exception as e:
                    logger.error(f"Error executing fill rule {rule.id}: {e}")

        filled_count = len([r for r in results if r.status == ViolationStatus.AUTO_FIXED])
        logger.info(f"Filled {filled_count} fields for table {table_code}")

        return results

    def _execute_fill_rule(
        self,
        rule: CleaningRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute a single fill rule.

        Args:
            rule: Fill rule to execute
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []

        # Get source configuration
        source = rule.source or {}
        fill_logic = source if isinstance(source, dict) else {}

        fill_type = fill_logic.get("type", "")

        if fill_type == "sql_query":
            results = self._fill_from_sql(rule, table_code, batch_id, limit)
        elif fill_type == "lookup":
            results = self._fill_from_lookup(rule, table_code, batch_id, limit)
        elif fill_type == "compute":
            results = self._fill_from_compute(rule, table_code, batch_id, limit)
        else:
            logger.warning(f"Unknown fill type: {fill_type} for rule {rule.id}")

        return results

    def _fill_from_sql(
        self,
        rule: CleaningRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Fill fields using SQL query.

        Args:
            rule: Fill rule with SQL query
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []
        source = rule.source or {}

        # Get target field
        target_field = rule.field
        bq_table = rule.get_bq_table_name(table_code)

        # Get records that need filling
        condition = source.get("condition", f"{target_field} IS NULL")

        # Build query to find records needing fill
        find_query = f"""
        SELECT ragic_id, data
        FROM `{self.bq_client.dataset}.{bq_table}`
        WHERE {condition}
        """
        if limit:
            find_query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query(find_query)
        except Exception as e:
            logger.error(f"Error finding records for {rule.id}: {e}")
            return results

        if not rows:
            logger.debug(f"No records need filling for rule {rule.id}")
            return results

        logger.info(f"Found {len(rows)} records to fill for rule {rule.id}")

        # Get the fill query template
        fill_query_template = source.get("query", "")
        if not fill_query_template:
            logger.warning(f"No fill query for rule {rule.id}")
            return results

        # Process each record
        for row in rows:
            record_id = row.get("ragic_id", "")
            data = row.get("data", {})

            try:
                # Execute fill query with record context
                fill_value = self._execute_fill_query(
                    fill_query_template, data, table_code
                )

                if fill_value is not None:
                    result = FillResult(
                        table_code=table_code,
                        record_id=record_id,
                        field_name=target_field,
                        rule_id=rule.id,
                        before_value=data.get(target_field),
                        after_value=fill_value,
                        status=ViolationStatus.AUTO_FIXED,
                        batch_id=batch_id,
                        fixed_at=datetime.now(timezone.utc),
                    )
                    results.append(result)

                    logger.debug(
                        f"Filled {target_field} for {record_id}: {fill_value}"
                    )
            except Exception as e:
                logger.error(f"Error filling record {record_id}: {e}")

        return results

    def _execute_fill_query(
        self,
        query_template: str,
        record_data: dict[str, Any],
        table_code: str,
    ) -> Any:
        """Execute a fill query for a specific record.

        Args:
            query_template: SQL query template
            record_data: Current record data
            table_code: Table code

        Returns:
            Fill value or None
        """
        # Replace placeholders in query
        query = query_template.format(
            project=self.bq_client.project_id,
            dataset=self.bq_client.dataset,
        )

        # Replace parameter placeholders with values
        for key, value in record_data.items():
            placeholder = f"@{key}"
            if placeholder in query:
                if isinstance(value, str):
                    query = query.replace(placeholder, f"'{value}'")
                elif value is None:
                    query = query.replace(placeholder, "NULL")
                else:
                    query = query.replace(placeholder, str(value))

        # Also handle common parameters
        if "@customer_code" in query and "客戶編號" in record_data:
            query = query.replace("@customer_code", f"'{record_data['客戶編號']}'")
        if "@order_id" in query and "訂單編號" in record_data:
            query = query.replace("@order_id", f"'{record_data['訂單編號']}'")

        try:
            result = self.bq_client.query_single_value(query)
            return result
        except Exception as e:
            logger.debug(f"Fill query returned no result: {e}")
            return None

    def _fill_from_lookup(
        self,
        rule: CleaningRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Fill fields from lookup table.

        Args:
            rule: Fill rule with lookup configuration
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []
        source = rule.source or {}

        reference_table = source.get("reference_table", "")
        reference_field = source.get("reference_field", "")
        match_field = source.get("match_field", "")

        if not all([reference_table, reference_field, match_field]):
            logger.warning(f"Incomplete lookup config for rule {rule.id}")
            return results

        target_field = rule.field
        bq_table = rule.get_bq_table_name(table_code)
        ref_bq_table = rule.get_bq_table_name(reference_table)

        # Build lookup query
        query = f"""
        SELECT
            t.ragic_id,
            JSON_VALUE(r.data, '$.{reference_field}') as fill_value
        FROM `{self.bq_client.dataset}.{bq_table}` t
        JOIN `{self.bq_client.dataset}.{ref_bq_table}` r
            ON JSON_VALUE(t.data, '$.{match_field}') = JSON_VALUE(r.data, '$.{match_field}')
        WHERE JSON_VALUE(t.data, '$.{target_field}') IS NULL
            OR JSON_VALUE(t.data, '$.{target_field}') = ''
        """
        if limit:
            query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query(query)
        except Exception as e:
            logger.error(f"Error executing lookup for {rule.id}: {e}")
            return results

        for row in rows:
            record_id = row.get("ragic_id", "")
            fill_value = row.get("fill_value")

            if fill_value:
                result = FillResult(
                    table_code=table_code,
                    record_id=record_id,
                    field_name=target_field,
                    rule_id=rule.id,
                    before_value=None,
                    after_value=fill_value,
                    status=ViolationStatus.AUTO_FIXED,
                    batch_id=batch_id,
                    fixed_at=datetime.now(timezone.utc),
                )
                results.append(result)

        return results

    def _fill_from_compute(
        self,
        rule: CleaningRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Fill fields from computed values.

        Args:
            rule: Fill rule with compute configuration
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        # Delegate to DerivedCalculator for complex computations
        from app.cleaning.derived_calculator import DerivedCalculator

        calculator = DerivedCalculator()
        return calculator.calculate_field(rule, table_code, batch_id, limit)

    def create_histories(
        self,
        fill_results: list[FillResult],
    ) -> list[CleaningHistory]:
        """Create history records from fill results.

        Args:
            fill_results: List of fill results

        Returns:
            List of history records
        """
        histories: list[CleaningHistory] = []

        for result in fill_results:
            if result.status == ViolationStatus.AUTO_FIXED:
                history = CleaningHistory(
                    table_code=result.table_code,
                    record_id=result.record_id,
                    action=ActionType.AUTO_FILL,
                    field_name=result.field_name,
                    before_value=result.before_value,
                    after_value=result.after_value,
                    rule_id=result.rule_id,
                    modified_by="system",
                )
                histories.append(history)

        return histories


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_filler: AutoFiller | None = None


def get_filler() -> AutoFiller:
    """Get the default auto filler (singleton)."""
    global _default_filler
    if _default_filler is None:
        _default_filler = AutoFiller()
    return _default_filler


def fill_table(
    table_code: str,
    batch_id: str,
    limit: int | None = None,
) -> list[FillResult]:
    """Fill missing fields for a table."""
    return get_filler().fill_table(table_code, batch_id, limit)
