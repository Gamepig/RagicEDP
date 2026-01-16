"""
Auto Filler for 資料清洗系統 v2.

Executes auto-fill rules to populate missing fields from related data.
"""

import json
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
    CascadeFillRule,
    DerivedFieldRule,
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
        elif isinstance(rule, CascadeFillRule):
            return self._fill_from_cascade_rule_sql(rule, table_code, batch_id, limit)
        elif isinstance(rule, DerivedFieldRule):
            return self._fill_from_derived_rule_sql(rule, table_code, batch_id, limit)
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
              AND JSON_VALUE(data, '$.{source_field}') != ''
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
          AND s.source_value != ''
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
        """Execute an auto fill rule using MERGE + CTE.

        重寫：使用 MERGE + CTE 方式，避免 BigQuery 不支援的跨表關聯子查詢。

        Args:
            rule: AutoFillRule
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results (僅包含更新數量的摘要)
        """
        results: list[FillResult] = []

        target_table = self.symbol_config.get_sheet_table(table_code)
        table_id = self.bq_client.get_table_id(target_table)

        target_field = rule.target_field
        trigger_condition = rule.trigger.condition

        # Get the fill query template
        if not rule.fill_logic or not rule.fill_logic.query:
            logger.warning(f"Rule {rule.id} has no fill_logic.query, skipping")
            return results

        fill_query_template = rule.fill_logic.query

        # 替換 {project} 和 {dataset} 佔位符
        fill_query = fill_query_template.format(
            project=self.bq_client.project_id,
            dataset=self.bq_client.dataset,
        ).strip()

        # 解析參數並提取關聯資訊
        # @customer_code -> 客戶編號
        param_to_field = {
            "@customer_code": "客戶編號",
            "@ragic_id": "_ragicId",
            "@order_id": "訂單編號",
            "@product_code": "商品編號",
        }

        # 找出使用的參數
        used_param = None
        join_field = None
        for param, field in param_to_field.items():
            if param in fill_query:
                used_param = param
                join_field = field
                break

        if not used_param:
            logger.warning(f"Rule {rule.id}: No recognized parameter in query, skipping")
            return results

        # 從 fill_query 中提取源表和選取欄位
        # 例如: SELECT JSON_VALUE(data, '$.品牌編號') FROM `project.dataset.sheet_99_order_detail`
        source_table_match = re.search(r'FROM\s+`([^`]+)`', fill_query, re.IGNORECASE)
        select_field_match = re.search(r"JSON_VALUE\(data,\s*['\"]\\?\$\.([^'\"]+)['\"]", fill_query)

        if not source_table_match:
            logger.warning(f"Rule {rule.id}: Cannot extract source table from query")
            return results

        source_table_id = source_table_match.group(1)
        source_field = select_field_match.group(1) if select_field_match else None

        if not source_field:
            logger.warning(f"Rule {rule.id}: Cannot extract source field from query")
            return results

        # 檢查是否有排序（用於 FIRST_VALUE）
        order_match = re.search(r'ORDER\s+BY\s+JSON_VALUE\(data,\s*[\'"]\\?\$\.([^\'"]+)[\'"]', fill_query, re.IGNORECASE)
        order_field = order_match.group(1) if order_match else None
        order_dir = "ASC"
        if order_match and "DESC" in fill_query.upper():
            order_dir = "DESC"

        # 構建 MERGE + CTE 語句
        limit_clause = f"LIMIT {limit}" if limit else ""

        if order_field:
            # 使用 FIRST_VALUE 視窗函數
            merge_sql = f"""
            MERGE `{table_id}` target
            USING (
                WITH source_values AS (
                    SELECT DISTINCT
                        JSON_VALUE(data, '$.{join_field}') as join_key,
                        FIRST_VALUE(JSON_VALUE(data, '$.{source_field}')) OVER (
                            PARTITION BY JSON_VALUE(data, '$.{join_field}')
                            ORDER BY JSON_VALUE(data, '$.{order_field}') {order_dir}
                        ) as fill_value
                    FROM `{source_table_id}`
                    WHERE JSON_VALUE(data, '$.{join_field}') IS NOT NULL
                      AND JSON_VALUE(data, '$.{source_field}') IS NOT NULL
                ),
                records_to_fill AS (
                    SELECT ragic_id, JSON_VALUE(data, '$.{join_field}') as join_key
                    FROM `{table_id}`
                    WHERE {trigger_condition}
                    {limit_clause}
                )
                SELECT rtf.ragic_id, sv.fill_value
                FROM records_to_fill rtf
                JOIN source_values sv ON rtf.join_key = sv.join_key
                WHERE sv.fill_value IS NOT NULL
            ) source
            ON target.ragic_id = source.ragic_id
            WHEN MATCHED THEN
                UPDATE SET data = TO_JSON_STRING(
                    JSON_SET(PARSE_JSON(target.data), '$.{target_field}', source.fill_value)
                )
            """
        else:
            # 無排序，使用 ANY_VALUE
            merge_sql = f"""
            MERGE `{table_id}` target
            USING (
                WITH source_values AS (
                    SELECT
                        JSON_VALUE(data, '$.{join_field}') as join_key,
                        ANY_VALUE(JSON_VALUE(data, '$.{source_field}')) as fill_value
                    FROM `{source_table_id}`
                    WHERE JSON_VALUE(data, '$.{join_field}') IS NOT NULL
                      AND JSON_VALUE(data, '$.{source_field}') IS NOT NULL
                    GROUP BY 1
                ),
                records_to_fill AS (
                    SELECT ragic_id, JSON_VALUE(data, '$.{join_field}') as join_key
                    FROM `{table_id}`
                    WHERE {trigger_condition}
                    {limit_clause}
                )
                SELECT rtf.ragic_id, sv.fill_value
                FROM records_to_fill rtf
                JOIN source_values sv ON rtf.join_key = sv.join_key
                WHERE sv.fill_value IS NOT NULL
            ) source
            ON target.ragic_id = source.ragic_id
            WHEN MATCHED THEN
                UPDATE SET data = TO_JSON_STRING(
                    JSON_SET(PARSE_JSON(target.data), '$.{target_field}', source.fill_value)
                )
            """

        try:
            logger.info(f"Executing MERGE for rule {rule.id}")
            job = self.bq_client.query(merge_sql)

            # 等待 job 完成，才能取得 DML 統計
            job.result()

            # 取得更新筆數
            updated_count = job.num_dml_affected_rows or 0

            logger.info(f"Rule {rule.id}: Updated {updated_count} records via MERGE")

            # 創建一個摘要結果
            if updated_count > 0:
                result = FillResult(
                    table_code=table_code,
                    record_id=f"batch_{updated_count}",
                    field_name=target_field,
                    rule_id=rule.id,
                    before_value=None,
                    after_value=f"SQL_UPDATE:{updated_count}",
                    status=ViolationStatus.AUTO_FIXED,
                    batch_id=batch_id,
                    fixed_at=datetime.now(timezone.utc),
                )
                results.append(result)

        except Exception as e:
            logger.error(f"Error executing SQL UPDATE for {rule.id}: {e}")
            # 如果 SQL UPDATE 失敗，記錄錯誤但不中斷流程

        return results

    def _fill_from_derived_rule_sql(
        self,
        rule: DerivedFieldRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute a derived field rule using MERGE + SQL expression.

        重寫：使用 MERGE 在 SQL 層直接計算並更新，避免載入大量資料到記憶體。

        Args:
            rule: DerivedFieldRule
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results (僅包含更新數量的摘要)
        """
        results: list[FillResult] = []

        target_table = self.symbol_config.get_sheet_table(table_code)
        table_id = self.bq_client.get_table_id(target_table)
        target_field = rule.target_field
        formula_expr = rule.formula.expression

        # Replace placeholders in formula
        formula_expr = formula_expr.format(
            project=self.bq_client.project_id,
            dataset=self.bq_client.dataset,
        ).strip()

        # Handle boolean data type - convert to string for JSON storage
        if rule.data_type == "boolean":
            value_expr = f"CASE WHEN ({formula_expr}) THEN 'true' ELSE 'false' END"
        else:
            value_expr = f"CAST(({formula_expr}) AS STRING)"

        limit_clause = f"LIMIT {limit}" if limit else ""

        # Build MERGE statement
        # Note: For expressions with NTILE or other window functions that need
        # full table context, we need to handle them specially
        if "NTILE(" in formula_expr.upper() or "OVER" in formula_expr.upper():
            # Window functions need full table scan
            # Use a CTE to calculate values first, then MERGE
            merge_sql = f"""
            MERGE `{table_id}` target
            USING (
                SELECT
                    ragic_id,
                    {value_expr} as calculated_value
                FROM `{table_id}` main
                WHERE (JSON_VALUE(data, '$.{target_field}') IS NULL
                       OR JSON_VALUE(data, '$.{target_field}') = '')
                {limit_clause}
            ) source
            ON target.ragic_id = source.ragic_id
            WHEN MATCHED AND source.calculated_value IS NOT NULL THEN
                UPDATE SET data = TO_JSON_STRING(
                    JSON_SET(PARSE_JSON(target.data), '$.{target_field}', source.calculated_value)
                )
            """
        else:
            # Simple expressions can be calculated directly
            merge_sql = f"""
            MERGE `{table_id}` target
            USING (
                SELECT
                    ragic_id,
                    {value_expr} as calculated_value
                FROM `{table_id}` main
                WHERE (JSON_VALUE(data, '$.{target_field}') IS NULL
                       OR JSON_VALUE(data, '$.{target_field}') = '')
                {limit_clause}
            ) source
            ON target.ragic_id = source.ragic_id
            WHEN MATCHED AND source.calculated_value IS NOT NULL THEN
                UPDATE SET data = TO_JSON_STRING(
                    JSON_SET(PARSE_JSON(target.data), '$.{target_field}', source.calculated_value)
                )
            """

        try:
            logger.info(f"Executing MERGE for derived rule {rule.id}")
            job = self.bq_client.query(merge_sql)
            job.result()  # Wait for completion

            updated_count = job.num_dml_affected_rows or 0
            logger.info(f"Rule {rule.id}: Updated {updated_count} records via MERGE")

            if updated_count > 0:
                result = FillResult(
                    table_code=table_code,
                    record_id=f"batch_{updated_count}",
                    field_name=target_field,
                    rule_id=rule.id,
                    before_value=None,
                    after_value=f"DERIVED:{updated_count}",
                    status=ViolationStatus.AUTO_FIXED,
                    batch_id=batch_id,
                    fixed_at=datetime.now(timezone.utc),
                )
                results.append(result)

        except Exception as e:
            logger.error(f"Error executing MERGE for derived rule {rule.id}: {e}")

        return results

    def _fill_from_cascade_rule_sql(
        self,
        rule: CascadeFillRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute a cascade fill rule using MERGE + COALESCE.

        重寫：使用 MERGE + 多個 LEFT JOIN + COALESCE，在 SQL 層完成優先順序填充。

        Args:
            rule: CascadeFillRule
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results (僅包含更新數量的摘要)
        """
        results: list[FillResult] = []

        target_table = self.symbol_config.get_sheet_table(table_code)
        table_id = self.bq_client.get_table_id(target_table)
        target_field = rule.target_field
        trigger_condition = rule.trigger.condition

        # Build JSON condition if not already using JSON_VALUE
        if "JSON_VALUE" not in trigger_condition:
            trigger_condition = f"JSON_VALUE(data, '$.{target_field}') IS NULL"

        # Sort fill sources by priority
        sorted_sources = sorted(rule.fill_sources, key=lambda s: s.priority)

        # Build JOINs and COALESCE for each source
        join_clauses = []
        coalesce_fields = []
        alias_idx = 0

        for source in sorted_sources:
            if source.ai_task:
                # Skip AI tasks - they can't be done in SQL
                logger.debug(f"Skipping AI task {source.ai_task} in cascade rule {rule.id}")
                continue

            if source.source_table_name and source.lookup_key and source.source_field:
                alias = f"src_{alias_idx}"
                source_table_id = self.bq_client.get_table_id(source.source_table_name)

                # Use DISTINCT subquery to avoid duplicates from source table
                join_clauses.append(f"""
                LEFT JOIN (
                    SELECT DISTINCT
                        JSON_VALUE(data, '$.{source.lookup_key}') as _join_key,
                        JSON_VALUE(data, '$.{source.source_field}') as _source_value
                    FROM `{source_table_id}`
                    WHERE JSON_VALUE(data, '$.{source.lookup_key}') IS NOT NULL
                ) {alias}
                    ON JSON_VALUE(target.data, '$.{source.lookup_key}') = {alias}._join_key
                """)
                coalesce_fields.append(f"{alias}._source_value")
                alias_idx += 1

        if not coalesce_fields:
            logger.warning(f"No valid sources for cascade rule {rule.id}")
            return results

        # Build COALESCE expression
        coalesce_expr = f"COALESCE({', '.join(coalesce_fields)})"
        joins = " ".join(join_clauses)
        limit_clause = f"LIMIT {limit}" if limit else ""

        # Build MERGE statement
        merge_sql = f"""
        MERGE `{table_id}` main_target
        USING (
            SELECT
                target.ragic_id,
                {coalesce_expr} as fill_value
            FROM `{table_id}` target
            {joins}
            WHERE {trigger_condition.replace('main.', 'target.')}
            {limit_clause}
        ) source
        ON main_target.ragic_id = source.ragic_id
        WHEN MATCHED AND source.fill_value IS NOT NULL THEN
            UPDATE SET data = TO_JSON_STRING(
                JSON_SET(PARSE_JSON(main_target.data), '$.{target_field}', source.fill_value)
            )
        """

        try:
            logger.info(f"Executing MERGE for cascade rule {rule.id}")
            job = self.bq_client.query(merge_sql)
            job.result()  # Wait for completion

            updated_count = job.num_dml_affected_rows or 0
            logger.info(f"Rule {rule.id}: Updated {updated_count} records via MERGE")

            if updated_count > 0:
                result = FillResult(
                    table_code=table_code,
                    record_id=f"batch_{updated_count}",
                    field_name=target_field,
                    rule_id=rule.id,
                    before_value=None,
                    after_value=f"CASCADE:{updated_count}",
                    status=ViolationStatus.AUTO_FIXED,
                    batch_id=batch_id,
                    fixed_at=datetime.now(timezone.utc),
                )
                results.append(result)

        except Exception as e:
            logger.error(f"Error executing MERGE for cascade rule {rule.id}: {e}")

        return results

    def _fill_from_cascade_rule(
        self,
        rule: CascadeFillRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute a cascade fill rule (FILL-OD-005, FILL-OD-006).

        按優先順序從多個來源嘗試填充，第一個有值的來源即採用。

        Args:
            rule: CascadeFillRule
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

        # Build JSON condition if not already using JSON_VALUE
        if "JSON_VALUE" not in trigger_condition:
            # Convert simple field condition to JSON_VALUE syntax
            trigger_condition = f"JSON_VALUE(data, '$.{target_field}') IS NULL"

        # Find records needing fill
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

        # Sort fill sources by priority
        sorted_sources = sorted(rule.fill_sources, key=lambda s: s.priority)

        # Collect updates
        updates_to_apply = []

        for row in rows:
            record_id = str(row.get("ragic_id", ""))
            data = row.get("data", {})
            if isinstance(data, str):
                import json
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    data = {}

            fill_value = None

            # Try each source in priority order
            for source in sorted_sources:
                if source.ai_task:
                    # Skip AI tasks for now (would require AI integration)
                    logger.debug(f"Skipping AI task {source.ai_task} for {record_id}")
                    continue

                if source.source_table_name and source.lookup_key and source.source_field:
                    # Lookup from another table
                    lookup_value = data.get(source.lookup_key)
                    if lookup_value:
                        source_table_id = self.bq_client.get_table_id(source.source_table_name)
                        lookup_query = f"""
                        SELECT JSON_VALUE(data, '$.{source.source_field}') as value
                        FROM `{source_table_id}`
                        WHERE JSON_VALUE(data, '$.{source.lookup_key}') = @lookup_value
                        LIMIT 1
                        """
                        try:
                            fill_value = self.bq_client.query_single_value(
                                lookup_query, {"lookup_value": lookup_value}
                            )
                            if fill_value:
                                break  # Found value, stop trying other sources
                        except Exception as e:
                            logger.debug(f"Cascade lookup failed for source {source.priority}: {e}")

            if fill_value:
                result = FillResult(
                    table_code=str(table_code),
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
                logger.debug(f"Cascade filled {target_field} for {record_id}: {fill_value}")

        # Apply updates
        if updates_to_apply:
            self._apply_fill_updates(table_id, target_field, updates_to_apply)

        return results

    def _fill_from_derived_rule(
        self,
        rule: DerivedFieldRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Execute a derived field rule (FILL-DERIVED-*).

        根據 formula.expression 計算衍生欄位。

        Args:
            rule: DerivedFieldRule
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
        formula_expr = rule.formula.expression

        # Replace placeholders in formula
        formula_expr = formula_expr.format(
            project=self.bq_client.project_id,
            dataset=self.bq_client.dataset,
        )

        # Build query using formula expression
        # The formula is expected to be a SQL expression that can be used in SELECT
        query = f"""
        SELECT
            ragic_id,
            ({formula_expr}) as calculated_value
        FROM `{table_id}` main
        WHERE JSON_VALUE(data, '$.{target_field}') IS NULL
           OR JSON_VALUE(data, '$.{target_field}') = ''
        """
        if limit:
            query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query_to_list(query)
        except Exception as e:
            logger.error(f"Error calculating derived field for {rule.id}: {e}")
            return results

        if not rows:
            logger.debug(f"No records need derived calculation for rule {rule.id}")
            return results

        logger.info(f"Calculating derived field for {len(rows)} records for rule {rule.id}")

        # Collect updates
        updates_to_apply = []

        for row in rows:
            record_id = str(row.get("ragic_id", ""))
            calculated_value = row.get("calculated_value")

            if calculated_value is not None:
                # Convert boolean to string for storage
                if rule.data_type == "boolean":
                    str_value = "true" if calculated_value else "false"
                else:
                    str_value = str(calculated_value)

                result = FillResult(
                    table_code=str(table_code),
                    record_id=record_id,
                    field_name=target_field,
                    rule_id=rule.id,
                    before_value=None,
                    after_value=str_value,
                    status=ViolationStatus.AUTO_FIXED,
                    batch_id=batch_id,
                    fixed_at=datetime.now(timezone.utc),
                )
                results.append(result)
                updates_to_apply.append((record_id, str_value))
                logger.debug(f"Derived {target_field} for {record_id}: {str_value}")

        # Apply updates
        if updates_to_apply:
            self._apply_fill_updates(table_id, target_field, updates_to_apply)

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
