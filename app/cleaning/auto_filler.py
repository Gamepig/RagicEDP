"""
Auto Filler for 資料清洗系統 v2.

Executes auto-fill rules to populate missing fields from related data.
"""

import re
from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.cleaning.models import (
    ActionType,
    CleaningHistory,
    FillResult,
    ViolationStatus,
)
from app.cleaning.rule_registry import (
    CleaningRule,
    BaseFillRule,
    LookupFillRule,
    AutoFillRule,
    get_registry,
)
from app.utils.bq_client import get_bq_client
from app.utils.symbol_config import get_symbol_config


class AutoFiller:
    """Executes auto-fill rules to populate missing fields."""

    def __init__(self):
        """Initialize auto filler."""
        self.registry = get_registry()
        self.bq_client = get_bq_client()
        self.symbol_config = get_symbol_config()

    def fill_table(
        self,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute all fill rules for a table.

        支援兩種規則來源：
        1. _rules (CleaningRule) - 舊格式，type='auto_fill'
        2. _fill_rules (BaseFillRule) - 新格式，從 fill_rules.yaml 載入

        Args:
            table_code: Table code to fill
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []

        # 1. 執行新格式的 fill rules (from fill_rules.yaml)
        new_fill_rules = self.registry.get_fill_rules_by_table(table_code)
        if new_fill_rules:
            logger.info(f"Executing {len(new_fill_rules)} new-format fill rules for table {table_code}")
            for rule in new_fill_rules:
                try:
                    rule_results = self._execute_new_fill_rule(rule, table_code, batch_id, limit)
                    results.extend(rule_results)
                except Exception as e:
                    # Include full traceback for debugging
                    import traceback
                    logger.error(f"Error executing fill rule {rule.id}: {e}\n{traceback.format_exc()}")

        # 2. 執行舊格式的 fill rules (from CleaningRule)
        old_fill_rules = self.registry.get_fill_rules(table_code)
        if old_fill_rules:
            logger.info(f"Executing {len(old_fill_rules)} old-format fill rules for table {table_code}")
            phases = sorted(set(r.execution_phase for r in old_fill_rules))

            for phase in phases:
                phase_rules = [r for r in old_fill_rules if r.execution_phase == phase]
                logger.debug(f"Phase {phase}: {len(phase_rules)} rules")

                for rule in phase_rules:
                    try:
                        phase_results = self._execute_fill_rule(
                            rule, table_code, batch_id, limit
                        )
                        results.extend(phase_results)
                    except Exception as e:
                        logger.error(f"Error executing fill rule {rule.id}: {e}")

        if not new_fill_rules and not old_fill_rules:
            logger.info(f"No fill rules for table {table_code}")
            return []

        filled_count = len([r for r in results if r.status == ViolationStatus.AUTO_FIXED])
        logger.info(f"Filled {filled_count} fields for table {table_code}")

        return results

    def _execute_new_fill_rule(
        self,
        rule: BaseFillRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute a new-format fill rule (from fill_rules.yaml).

        Args:
            rule: Fill rule (BaseFillRule subclass)
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        if isinstance(rule, LookupFillRule):
            return self._fill_from_lookup_rule(rule, table_code, batch_id, limit)
        elif isinstance(rule, AutoFillRule):
            return self._fill_from_auto_rule(rule, table_code, batch_id, limit)
        else:
            logger.warning(f"Unsupported fill rule type: {type(rule).__name__} for {rule.id}")
            return []

    def _fill_from_lookup_rule(
        self,
        rule: LookupFillRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute a lookup fill rule (e.g., FILL-ORD-001).

        從關聯表查詢並回填欄位。

        Args:
            rule: LookupFillRule
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []

        # Get table names
        target_table = self.symbol_config.get_sheet_table(table_code)
        source_table = rule.source_table_name
        target_table_id = self.bq_client.get_table_id(target_table)
        source_table_id = self.bq_client.get_table_id(source_table)

        target_field = rule.target_field  # 中文欄位名
        lookup_key = rule.lookup_key  # 關聯欄位（中文）
        source_field = rule.source_field  # 來源欄位（中文）

        # Build query to find and fill records using JOIN (BigQuery doesn't support correlated subqueries)
        query = f"""
        WITH source_lookup AS (
            SELECT DISTINCT
                JSON_VALUE(data, '$.{lookup_key}') as lookup_key,
                JSON_VALUE(data, '$.{source_field}') as source_value
            FROM `{source_table_id}`
            WHERE JSON_VALUE(data, '$.{lookup_key}') IS NOT NULL
              AND JSON_VALUE(data, '$.{source_field}') IS NOT NULL
        )
        SELECT
            t.ragic_id,
            JSON_VALUE(t.data, '$.{lookup_key}') as lookup_value,
            s.source_value as fill_value
        FROM `{target_table_id}` t
        LEFT JOIN source_lookup s
            ON JSON_VALUE(t.data, '$.{lookup_key}') = s.lookup_key
        WHERE (JSON_VALUE(t.data, '$.{target_field}') IS NULL
               OR JSON_VALUE(t.data, '$.{target_field}') = '')
          AND JSON_VALUE(t.data, '$.{lookup_key}') IS NOT NULL
          AND s.source_value IS NOT NULL
        """
        if limit:
            query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query_to_list(query)
        except Exception as e:
            logger.error(f"Error executing lookup query for {rule.id}: {e}")
            return results

        if not rows:
            logger.debug(f"No records need filling for rule {rule.id}")
            return results

        logger.info(f"Found {len(rows)} records to fill for rule {rule.id}")

        # Collect records to update
        updates_to_apply = []
        for row in rows:
            record_id = str(row.get("ragic_id", ""))
            fill_value = row.get("fill_value")

            if fill_value:
                result = FillResult(
                    table_code=str(table_code),  # Ensure string type
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
                updates_to_apply.append((record_id, fill_value))
                logger.debug(f"Filled {target_field} for {record_id}: {fill_value}")

        # Apply updates to BigQuery in batches
        if updates_to_apply:
            self._apply_fill_updates(
                target_table_id, target_field, updates_to_apply
            )

        return results

    def _apply_fill_updates(
        self,
        table_id: str,
        field_name: str,
        updates: list[tuple[str, str]],
        batch_size: int = 500,
    ) -> int:
        """Apply fill updates to BigQuery records.

        Uses JSON_SET to update the data column with new field values.

        Args:
            table_id: Full BigQuery table ID
            field_name: JSON field name to update (Chinese)
            updates: List of (ragic_id, new_value) tuples
            batch_size: Number of records per batch

        Returns:
            Number of records updated
        """
        if not updates:
            return 0

        total_updated = 0

        # Process in batches
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i + batch_size]

            # Build CASE WHEN statement for batch update
            case_parts = []
            ragic_ids = []
            for ragic_id, new_value in batch:
                # Escape single quotes using BigQuery standard ('' not \')
                escaped_value = new_value.replace("'", "''") if new_value else ""
                case_parts.append(f"WHEN ragic_id = '{ragic_id}' THEN '{escaped_value}'")
                ragic_ids.append(f"'{ragic_id}'")

            case_statement = " ".join(case_parts)
            ids_list = ", ".join(ragic_ids)

            # Use PARSE_JSON since data column is STRING type, not JSON
            # Use $."field_name" format for Chinese field names in JSON path
            # Add ELSE to preserve original value if no match (safety)
            update_query = f"""
            UPDATE `{table_id}`
            SET data = TO_JSON_STRING(
                JSON_SET(PARSE_JSON(data), '$."{field_name}"',
                    CASE {case_statement} ELSE JSON_VALUE(data, '$."{field_name}"') END
                )
            ),
            cleaning_status = 'auto_fixed'
            WHERE ragic_id IN ({ids_list})
            """

            try:
                result = self.bq_client.client.query(update_query)
                result.result()  # Wait for completion
                affected = result.num_dml_affected_rows
                if affected is not None:
                    total_updated += affected
                else:
                    # Fallback: assume all succeeded if BQ doesn't report
                    total_updated += len(batch)
                logger.debug(f"Updated {affected} records in batch {i // batch_size + 1}")
            except Exception as e:
                logger.error(f"Error updating batch: {e}")

        logger.info(f"Applied {total_updated} fill updates to {table_id}")
        return total_updated

    def _fill_from_auto_rule(
        self,
        rule: AutoFillRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute an auto fill rule with SQL query.

        Args:
            rule: AutoFillRule
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []

        target_table = self.symbol_config.get_sheet_table(table_code)
        table_id = self.bq_client.get_table_id(target_table)

        target_field = rule.target_field
        trigger_condition = rule.trigger.condition

        # Build query to find records needing fill
        find_query = f"""
        SELECT ragic_id, data
        FROM `{table_id}`
        WHERE {trigger_condition}
        """
        if limit:
            find_query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query_to_list(find_query)
        except Exception as e:
            logger.error(f"Error finding records for {rule.id}: {e}")
            return results

        if not rows:
            logger.debug(f"No records need filling for rule {rule.id}")
            return results

        logger.info(f"Found {len(rows)} records to fill for rule {rule.id}")

        # Get the fill query template
        if not rule.fill_logic or not rule.fill_logic.query:
            logger.warning(f"Rule {rule.id} has no fill_logic.query, skipping")
            return results
        fill_query_template = rule.fill_logic.query

        for row in rows:
            record_id = str(row.get("ragic_id", ""))
            data = row.get("data", {})

            try:
                fill_value = self._execute_fill_query(fill_query_template, data)

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
                    logger.debug(f"Filled {target_field} for {record_id}: {fill_value}")
            except Exception as e:
                logger.error(f"Error filling record {record_id}: {e}")

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
        table_id = self.bq_client.get_table_id(bq_table)

        # Get records that need filling
        condition = source.get("condition", f"{target_field} IS NULL")

        # Build query to find records needing fill
        find_query = f"""
        SELECT ragic_id, data
        FROM `{table_id}`
        WHERE {condition}
        """
        if limit:
            find_query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query_to_list(find_query)
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
                    fill_query_template, data
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
    ) -> Any:
        """Execute a fill query for a specific record.

        Uses parameterized queries to prevent SQL injection.

        Args:
            query_template: SQL query template with @param placeholders
            record_data: Current record data

        Returns:
            Fill value or None
        """
        # Replace {project} and {dataset} placeholders in query
        query = query_template.format(
            project=self.bq_client.project_id,
            dataset=self.bq_client.dataset,
        )

        # Build parameters dict for parameterized query
        params: dict[str, Any] = {}

        # Extract all @param placeholders from query and map to record_data
        param_pattern = re.compile(r"@(\w+)")
        param_names = param_pattern.findall(query)

        for param_name in param_names:
            # Try direct match first
            if param_name in record_data:
                params[param_name] = record_data[param_name]
            # Handle common Chinese field name mappings
            elif param_name == "customer_code" and "客戶編號" in record_data:
                params[param_name] = record_data["客戶編號"]
            elif param_name == "order_id" and "訂單編號" in record_data:
                params[param_name] = record_data["訂單編號"]
            else:
                # Parameter not found in record data, set to None
                params[param_name] = None

        try:
            result = self.bq_client.query_single_value(query, params)
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
        table_id = self.bq_client.get_table_id(bq_table)
        ref_table_id = self.bq_client.get_table_id(ref_bq_table)

        # Build lookup query
        query = f"""
        SELECT
            t.ragic_id,
            JSON_VALUE(r.data, '$.{reference_field}') as fill_value
        FROM `{table_id}` t
        JOIN `{ref_table_id}` r
            ON JSON_VALUE(t.data, '$.{match_field}') = JSON_VALUE(r.data, '$.{match_field}')
        WHERE JSON_VALUE(t.data, '$.{target_field}') IS NULL
            OR JSON_VALUE(t.data, '$.{target_field}') = ''
        """
        if limit:
            query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query_to_list(query)
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
