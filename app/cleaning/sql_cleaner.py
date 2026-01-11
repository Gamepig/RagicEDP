"""
SQL Cleaner for 資料清洗系統 v2.

Executes SQL validation rules against BigQuery data.
"""

import re
from typing import Any

from loguru import logger

from app.cleaning.models import Severity, Violation, ViolationStatus
from app.cleaning.rule_registry import CleaningRule, get_registry
from app.utils.bq_client import BigQueryClient, get_bq_client
from app.utils.symbol_config import get_symbol_config


class SQLCleaner:
    """Executes SQL validation rules."""

    def __init__(self, bq_client: BigQueryClient | None = None):
        """Initialize SQL cleaner.

        Args:
            bq_client: BigQuery client. Defaults to shared client.
        """
        self.bq_client = bq_client or get_bq_client()
        self.registry = get_registry()
        self.symbol_config = get_symbol_config()

    def validate_table(
        self,
        table_code: str,
        record_ids: list[str] | None = None,
        limit: int = 1000,
    ) -> list[Violation]:
        """Validate all records in a table against rules.

        Args:
            table_code: Table code (e.g., "50", "60")
            record_ids: Optional list of specific record IDs to validate
            limit: Maximum records to process

        Returns:
            List of Violations found
        """
        violations: list[Violation] = []

        # Get rules for this table
        rules = self.registry.get_validation_rules(table_code)
        if not rules:
            logger.debug(f"No validation rules for table {table_code}")
            return violations

        logger.info(f"Validating table {table_code} with {len(rules)} rules")

        # Get table name
        table_name = self.symbol_config.get_sheet_table(table_code)
        table_id = self.bq_client.get_table_id(table_name)

        # Fetch records
        records = self._fetch_records(table_id, record_ids, limit)
        logger.info(f"Fetched {len(records)} records from {table_name}")

        # Apply each rule
        for rule in rules:
            try:
                rule_violations = self._apply_rule(table_code, records, rule)
                violations.extend(rule_violations)
            except Exception as e:
                logger.error(f"Error applying rule {rule.id}: {e}")

        logger.info(f"Found {len(violations)} violations in table {table_code}")
        return violations

    def validate_record(
        self,
        table_code: str,
        record: dict[str, Any],
    ) -> list[Violation]:
        """Validate a single record against all rules.

        Args:
            table_code: Table code
            record: Record data

        Returns:
            List of Violations found
        """
        violations: list[Violation] = []
        rules = self.registry.get_validation_rules(table_code)

        for rule in rules:
            try:
                violation = self._check_rule(table_code, record, rule)
                if violation:
                    violations.append(violation)
            except Exception as e:
                logger.error(f"Error checking rule {rule.id}: {e}")

        return violations

    def _fetch_records(
        self,
        table_id: str,
        record_ids: list[str] | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        """Fetch records from BigQuery."""
        if record_ids:
            ids_str = ", ".join([f"'{rid}'" for rid in record_ids])
            sql = f"""
            SELECT *
            FROM `{table_id}`
            WHERE ragic_id IN ({ids_str})
            LIMIT {limit}
            """
        else:
            sql = f"""
            SELECT *
            FROM `{table_id}`
            WHERE cleaning_status IS NULL OR cleaning_status = 'pending'
            LIMIT {limit}
            """

        return self.bq_client.query_to_list(sql)

    def _apply_rule(
        self,
        table_code: str,
        records: list[dict[str, Any]],
        rule: CleaningRule,
    ) -> list[Violation]:
        """Apply a rule to multiple records."""
        violations: list[Violation] = []

        for record in records:
            violation = self._check_rule(table_code, record, rule)
            if violation:
                violations.append(violation)

        return violations

    def _check_rule(
        self,
        table_code: str,
        record: dict[str, Any],
        rule: CleaningRule,
    ) -> Violation | None:
        """Check a single rule against a record.

        Args:
            table_code: Table code
            record: Record data
            rule: Rule to check

        Returns:
            Violation if rule violated, None otherwise
        """
        field_value = record.get(rule.field)
        record_id = str(record.get("ragic_id", record.get("_ragicId", "")))

        # Skip if field doesn't exist
        if rule.field not in record:
            return None

        # Check by category
        if rule.category == "format":
            return self._check_format_rule(table_code, record_id, field_value, rule)
        elif rule.category == "fk":
            return self._check_fk_rule(table_code, record_id, field_value, rule)
        elif rule.category == "numeric":
            return self._check_numeric_rule(table_code, record_id, field_value, rule)
        elif rule.category == "required":
            return self._check_required_rule(table_code, record_id, field_value, rule)
        elif rule.category == "unique":
            # Uniqueness checked separately at batch level
            return None

        return None

    def _check_format_rule(
        self,
        table_code: str,
        record_id: str,
        value: Any,
        rule: CleaningRule,
    ) -> Violation | None:
        """Check format validation rule."""
        if value is None or str(value).strip() == "":
            return None  # Empty values handled by required rules

        str_value = str(value)
        pattern = rule.compile_pattern()

        if pattern and not pattern.match(str_value):
            # Try to auto-fix if possible
            fixed_value = None
            if rule.auto_fixable and rule.fix_logic:
                fixed_value = self._apply_fix(str_value, rule.fix_logic)

            return Violation(
                table_code=table_code,
                record_id=record_id,
                rule_id=rule.id,
                field_name=rule.field,
                before_value=str_value,
                after_value=fixed_value,
                severity=Severity(rule.severity),
                status=ViolationStatus.PENDING,
            )

        return None

    def _check_fk_rule(
        self,
        table_code: str,
        record_id: str,
        value: Any,
        rule: CleaningRule,
    ) -> Violation | None:
        """Check foreign key validation rule."""
        if value is None or str(value).strip() == "":
            if rule.allow_null:
                return None
            return Violation(
                table_code=table_code,
                record_id=record_id,
                rule_id=rule.id,
                field_name=rule.field,
                before_value=None,
                severity=Severity(rule.severity),
                status=ViolationStatus.PENDING,
            )

        # Check if reference exists
        if not self._check_reference_exists(str(value), rule):
            return Violation(
                table_code=table_code,
                record_id=record_id,
                rule_id=rule.id,
                field_name=rule.field,
                before_value=str(value),
                severity=Severity(rule.severity),
                status=ViolationStatus.PENDING,
            )

        return None

    def _check_numeric_rule(
        self,
        table_code: str,
        record_id: str,
        value: Any,
        rule: CleaningRule,
    ) -> Violation | None:
        """Check numeric range rule."""
        if value is None:
            if rule.allow_null:
                return None
            return Violation(
                table_code=table_code,
                record_id=record_id,
                rule_id=rule.id,
                field_name=rule.field,
                before_value=None,
                severity=Severity(rule.severity),
                status=ViolationStatus.PENDING,
            )

        try:
            num_value = float(value)
        except (ValueError, TypeError):
            return Violation(
                table_code=table_code,
                record_id=record_id,
                rule_id=rule.id,
                field_name=rule.field,
                before_value=str(value),
                severity=Severity(rule.severity),
                status=ViolationStatus.PENDING,
            )

        # Check zero
        if num_value == 0 and not rule.allow_zero:
            return Violation(
                table_code=table_code,
                record_id=record_id,
                rule_id=rule.id,
                field_name=rule.field,
                before_value=str(value),
                severity=Severity(rule.severity),
                status=ViolationStatus.PENDING,
            )

        # Check min
        if rule.min_value is not None and num_value < rule.min_value:
            return Violation(
                table_code=table_code,
                record_id=record_id,
                rule_id=rule.id,
                field_name=rule.field,
                before_value=str(value),
                severity=Severity(rule.severity),
                status=ViolationStatus.PENDING,
            )

        # Check max
        if rule.max_value is not None and num_value > rule.max_value:
            return Violation(
                table_code=table_code,
                record_id=record_id,
                rule_id=rule.id,
                field_name=rule.field,
                before_value=str(value),
                severity=Severity(rule.severity),
                status=ViolationStatus.PENDING,
            )

        return None

    def _check_required_rule(
        self,
        table_code: str,
        record_id: str,
        value: Any,
        rule: CleaningRule,
    ) -> Violation | None:
        """Check required field rule."""
        if value is None or str(value).strip() == "":
            return Violation(
                table_code=table_code,
                record_id=record_id,
                rule_id=rule.id,
                field_name=rule.field,
                before_value=None,
                severity=Severity(rule.severity),
                status=ViolationStatus.PENDING,
            )
        return None

    def _check_reference_exists(self, value: str, rule: CleaningRule) -> bool:
        """Check if a foreign key reference exists."""
        if not rule.reference_table or not rule.reference_field:
            return True

        ref_table = self.symbol_config.get_sheet_table(rule.reference_table)
        ref_table_id = self.bq_client.get_table_id(ref_table)

        sql = f"""
        SELECT 1
        FROM `{ref_table_id}`
        WHERE {rule.reference_field} = @value
        LIMIT 1
        """

        result = self.bq_client.query_single_value(sql, {"value": value})
        return result is not None

    def _apply_fix(self, value: str, fix_logic: dict[str, Any]) -> str | None:
        """Apply fix logic to a value.

        Args:
            value: Original value
            fix_logic: Fix logic configuration

        Returns:
            Fixed value or None if unable to fix
        """
        fix_type = fix_logic.get("type")

        if fix_type == "regex_replace":
            pattern = fix_logic.get("pattern", "")
            replacement = fix_logic.get("replacement", "")
            return re.sub(pattern, replacement, value)

        elif fix_type == "trim":
            return value.strip()

        elif fix_type == "lowercase":
            return value.lower().strip()

        elif fix_type == "uppercase":
            return value.upper().strip()

        elif fix_type == "default_value":
            return fix_logic.get("value")

        return None


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_cleaner: SQLCleaner | None = None


def get_sql_cleaner() -> SQLCleaner:
    """Get the default SQL cleaner (singleton)."""
    global _default_cleaner
    if _default_cleaner is None:
        _default_cleaner = SQLCleaner()
    return _default_cleaner


def validate_table(table_code: str, record_ids: list[str] | None = None) -> list[Violation]:
    """Validate a table using the default cleaner."""
    return get_sql_cleaner().validate_table(table_code, record_ids)
