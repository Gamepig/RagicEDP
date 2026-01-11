"""
Field Fixer for 資料清洗系統 v2.

Applies auto-fix logic to violations with known patterns.
"""

import re
from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.cleaning.models import (
    ActionType,
    CleaningHistory,
    Violation,
    ViolationStatus,
)
from app.cleaning.rule_registry import CleaningRule, get_registry


class FieldFixer:
    """Applies auto-fix logic to violations."""

    def __init__(self):
        """Initialize field fixer."""
        self.registry = get_registry()

    def fix_violations(
        self,
        violations: list[Violation],
    ) -> tuple[list[Violation], list[CleaningHistory]]:
        """Fix violations that can be auto-fixed.

        Args:
            violations: List of violations to process

        Returns:
            Tuple of (updated violations, history records)
        """
        fixed_violations: list[Violation] = []
        histories: list[CleaningHistory] = []

        for violation in violations:
            if violation.status != ViolationStatus.PENDING:
                fixed_violations.append(violation)
                continue

            # Get rule
            rule = self.registry.get_rule(violation.rule_id)
            if not rule or not rule.auto_fixable:
                fixed_violations.append(violation)
                continue

            # Try to fix
            fixed_value = self._fix_value(violation.before_value, rule)
            if fixed_value is not None:
                # Update violation
                violation.after_value = fixed_value
                violation.status = ViolationStatus.AUTO_FIXED
                violation.fixed_at = datetime.now(timezone.utc)
                violation.fixed_by = "system"

                # Create history
                history = CleaningHistory(
                    table_code=violation.table_code,
                    record_id=violation.record_id,
                    action=ActionType.AUTO_FIX,
                    field_name=violation.field_name,
                    before_value=violation.before_value,
                    after_value=fixed_value,
                    rule_id=violation.rule_id,
                    modified_by="system",
                )
                histories.append(history)

                logger.debug(
                    f"Auto-fixed {violation.field_name}: "
                    f"'{violation.before_value}' -> '{fixed_value}'"
                )

            fixed_violations.append(violation)

        auto_fixed = len([v for v in fixed_violations if v.status == ViolationStatus.AUTO_FIXED])
        logger.info(f"Auto-fixed {auto_fixed}/{len(violations)} violations")

        return fixed_violations, histories

    def fix_value(
        self,
        value: Any,
        rule_id: str,
    ) -> str | None:
        """Fix a single value using a specific rule.

        Args:
            value: Value to fix
            rule_id: Rule ID to use

        Returns:
            Fixed value or None if unable to fix
        """
        rule = self.registry.get_rule(rule_id)
        if not rule or not rule.auto_fixable:
            return None

        return self._fix_value(value, rule)

    def _fix_value(self, value: Any, rule: CleaningRule) -> str | None:
        """Internal method to fix a value.

        Args:
            value: Value to fix
            rule: Rule with fix logic

        Returns:
            Fixed value or None if unable to fix
        """
        if value is None:
            return None

        str_value = str(value)
        fix_logic = rule.fix_logic

        if not fix_logic:
            return None

        fix_type = fix_logic.get("type")

        try:
            if fix_type == "regex_replace":
                return self._fix_regex_replace(str_value, fix_logic)
            elif fix_type == "trim":
                return self._fix_trim(str_value)
            elif fix_type == "lowercase":
                return self._fix_lowercase(str_value)
            elif fix_type == "uppercase":
                return self._fix_uppercase(str_value)
            elif fix_type == "default_value":
                return self._fix_default(fix_logic)
            elif fix_type == "phone_normalize":
                return self._fix_phone(str_value)
            elif fix_type == "email_normalize":
                return self._fix_email(str_value)
            elif fix_type == "date_normalize":
                return self._fix_date(str_value)
            else:
                logger.warning(f"Unknown fix type: {fix_type}")
                return None
        except Exception as e:
            logger.error(f"Error fixing value: {e}")
            return None

    def _fix_regex_replace(self, value: str, fix_logic: dict) -> str:
        """Apply regex replacement."""
        pattern = fix_logic.get("pattern", "")
        replacement = fix_logic.get("replacement", "")
        return re.sub(pattern, replacement, value)

    def _fix_trim(self, value: str) -> str:
        """Trim whitespace."""
        return value.strip()

    def _fix_lowercase(self, value: str) -> str:
        """Convert to lowercase and trim."""
        return value.lower().strip()

    def _fix_uppercase(self, value: str) -> str:
        """Convert to uppercase and trim."""
        return value.upper().strip()

    def _fix_default(self, fix_logic: dict) -> str:
        """Return default value."""
        return str(fix_logic.get("value", ""))

    def _fix_phone(self, value: str) -> str | None:
        """Normalize phone number.

        Removes non-digit characters and validates format.
        """
        # Remove all non-digit characters
        digits = re.sub(r"[^\d]", "", value)

        # Taiwan mobile: 09XXXXXXXX (10 digits)
        if len(digits) == 10 and digits.startswith("09"):
            return digits

        # Taiwan landline: 0X-XXXXXXX or 0X-XXXXXXXX
        if len(digits) in (9, 10) and digits.startswith("0") and not digits.startswith("09"):
            return digits

        # If starts with +886, convert to local format
        if digits.startswith("886") and len(digits) >= 11:
            local = "0" + digits[3:]
            if len(local) == 10:
                return local

        return None  # Cannot normalize

    def _fix_email(self, value: str) -> str | None:
        """Normalize email address.

        Converts to lowercase and trims whitespace.
        """
        normalized = value.lower().strip()

        # Basic validation: must have local part before @, domain after, and dot in domain
        if "@" in normalized:
            parts = normalized.split("@")
            if len(parts) == 2 and parts[0] and "." in parts[1]:
                return normalized

        return None  # Invalid email

    def _fix_date(self, value: str) -> str | None:
        """Normalize date to ISO 8601 format (YYYY-MM-DD).

        Handles various input formats.
        """
        # Already in correct format
        if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
            return value

        # Common formats to try
        formats = [
            "%Y/%m/%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y.%m.%d",
            "%d.%m.%Y",
            "%Y%m%d",
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue

        return None  # Cannot parse

    def can_auto_fix(self, rule_id: str) -> bool:
        """Check if a rule supports auto-fix.

        Args:
            rule_id: Rule ID

        Returns:
            True if rule can auto-fix
        """
        rule = self.registry.get_rule(rule_id)
        return rule is not None and rule.auto_fixable and rule.fix_logic is not None


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_fixer: FieldFixer | None = None


def get_field_fixer() -> FieldFixer:
    """Get the default field fixer (singleton)."""
    global _default_fixer
    if _default_fixer is None:
        _default_fixer = FieldFixer()
    return _default_fixer


def fix_violations(
    violations: list[Violation],
) -> tuple[list[Violation], list[CleaningHistory]]:
    """Fix violations using the default fixer."""
    return get_field_fixer().fix_violations(violations)


def fix_value(value: Any, rule_id: str) -> str | None:
    """Fix a value using the default fixer."""
    return get_field_fixer().fix_value(value, rule_id)
