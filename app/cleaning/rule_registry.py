"""
Rule Registry for 資料清洗系統 v2.

Loads and manages YAML cleaning rules from the rules/ directory.
"""

import os
import re
from pathlib import Path
from typing import Annotated, Any, Literal, Union

import yaml
from loguru import logger
from pydantic import BaseModel, Field, field_validator

from app.utils.symbol_config import get_symbol_config


# =============================================================================
# Pydantic Models for Rules
# =============================================================================


class FixLogic(BaseModel):
    """Fix logic configuration."""

    type: str = Field(..., description="Fix type: regex_replace, trim, lowercase, etc.")
    pattern: str | None = Field(None, description="Regex pattern for replacement")
    replacement: str | None = Field(None, description="Replacement value")
    value: Any | None = Field(None, description="Default value")


# =============================================================================
# FillRule Models (for fill_rules.yaml)
# =============================================================================


class FillTrigger(BaseModel):
    """Trigger condition for fill rules."""

    condition: str = Field(..., description="SQL condition or 'always'")


class FillLogic(BaseModel):
    """Fill logic with SQL query."""

    type: Literal["sql_query"] = "sql_query"
    query: str = Field(..., description="BigQuery SQL query")


class FillSource(BaseModel):
    """Fill source for cascade fill rules."""

    source_table: int | None = None
    source_table_name: str | None = None
    lookup_key: str | None = None
    source_field: str | None = None
    priority: int = 1
    ai_task: str | None = None
    input_field: str | None = None
    confidence_threshold: float | None = None


class DerivedFormula(BaseModel):
    """Formula for derived fields."""

    type: Literal["sql"] = "sql"
    expression: str = Field(..., description="SQL expression")


class BaseFillRule(BaseModel):
    """Base model for all fill rules with common fields."""

    id: str = Field(..., pattern=r"^FILL-[A-Z]+-\d{3}$")
    name: str = Field(..., min_length=1, max_length=100)
    tables: list[str]
    target_field: str = Field(..., description="Target field to fill")
    target_field_id: str | int | None = None
    auto_fixable: bool | str = True  # Can be "partial"
    priority: str = Field(default="P2", pattern=r"^P[1-3]$")
    severity: str = Field(default="medium", pattern=r"^(critical|high|medium|low)$")
    note: str | None = None
    description: str | None = None

    @field_validator("tables")
    @classmethod
    def validate_tables(cls, v: list[str]) -> list[str]:
        valid = ["10", "20", "30", "40", "41", "50", "60", "70", "80", "99"]
        for table in v:
            if table not in valid:
                raise ValueError(f"Invalid table code: {table}. Must be one of {valid}")
        return v


class AutoFillRule(BaseFillRule):
    """Auto fill rule - SQL query based (FILL-CUST-*)."""

    type: Literal["auto_fill"] = "auto_fill"
    category: Literal["customer_stats"] = "customer_stats"
    source: str = Field(default="order_detail_calculation")
    trigger: FillTrigger
    fill_logic: FillLogic
    refresh: Literal["once", "daily", "weekly"] = "daily"
    data_type: str | None = None


class LookupFillRule(BaseFillRule):
    """Lookup fill rule - FK based (FILL-OD-001 to 004)."""

    type: Literal["lookup_fill"] = "lookup_fill"
    category: Literal["order_lookup"] = "order_lookup"
    source_table: int = Field(..., description="Source table code")
    source_table_name: str = Field(..., description="Source table BQ name")
    lookup_key: str = Field(..., description="Field to match on")
    source_field: str = Field(..., description="Field to retrieve")
    trigger: FillTrigger
    affected_count: int | None = None


class CascadeFillRule(BaseFillRule):
    """Cascade fill rule - Multiple sources (FILL-OD-005, 006)."""

    type: Literal["cascade_fill"] = "cascade_fill"
    category: Literal["order_lookup"] = "order_lookup"
    trigger: FillTrigger
    fill_sources: list[FillSource] = Field(..., description="Ordered fill sources")
    affected_count: int | None = None


class DerivedFieldRule(BaseFillRule):
    """Derived field rule - Computed fields (FILL-DERIVED-*)."""

    type: Literal["derived_field"] = "derived_field"
    category: Literal["derived"] = "derived"
    data_type: Literal["boolean", "string"] = "string"
    formula: DerivedFormula
    depends_on: list[str] = Field(default_factory=list, description="Rule dependencies")
    valid_values: list[str] | None = None
    refresh: Literal["on_insert", "daily", "weekly"] = "on_insert"
    marketing_use: str | None = None
    thresholds: dict[str, int] | None = None
    remote_regions: dict[str, list[str]] | None = None
    example: str | None = None


# Union type for all fill rules
FillRule = Annotated[
    Union[AutoFillRule, LookupFillRule, CascadeFillRule, DerivedFieldRule],
    Field(discriminator="type"),
]


def parse_fill_rule(data: dict[str, Any]) -> BaseFillRule:
    """Parse a fill rule from dict based on type."""
    rule_type = data.get("type", "auto_fill")

    if rule_type == "auto_fill":
        return AutoFillRule(**data)
    elif rule_type == "lookup_fill":
        return LookupFillRule(**data)
    elif rule_type == "cascade_fill":
        return CascadeFillRule(**data)
    elif rule_type == "derived_field":
        return DerivedFieldRule(**data)
    else:
        raise ValueError(f"Unknown fill rule type: {rule_type}")


class SqlSource(BaseModel):
    """SQL data source."""

    type: Literal["sql"] = "sql"
    query: str = Field(..., description="BigQuery SQL query")


class LookupSource(BaseModel):
    """Lookup data source."""

    type: Literal["lookup"] = "lookup"
    reference_table: str = Field(..., description="Reference table code")
    reference_field: str = Field(..., description="Field to retrieve")
    match_field: str = Field(..., description="Field to match on")


class ComputeSource(BaseModel):
    """Compute data source."""

    type: Literal["compute"] = "compute"
    formula: str = Field(..., description="Python expression formula")
    inputs: list[str] = Field(default_factory=list, description="Input fields")


class CleaningRule(BaseModel):
    """Base cleaning rule model."""

    id: str = Field(..., pattern=r"^[A-Z]+-[A-Z0-9-]+$")
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    type: str = Field(..., pattern=r"^(validation|auto_fill|derived)$")
    category: str
    tables: list[str]
    field: str
    severity: str = Field(..., pattern=r"^(critical|high|medium|low)$")
    priority: str = Field(default="P3", pattern=r"^P[1-3]$")
    enabled: bool = True
    version: str = "1.0.0"
    tags: list[str] = Field(default_factory=list)

    # Validation-specific fields
    pattern: str | None = None
    auto_fixable: bool = False
    fix_logic: dict[str, Any] | None = None

    # FK-specific fields
    reference_table: str | None = None
    reference_field: str | None = None
    allow_null: bool = False

    # Numeric-specific fields
    min_value: float | None = None
    max_value: float | None = None
    allow_zero: bool = True

    # Fill-specific fields
    source: dict[str, Any] | None = None
    condition: str | None = None
    execution_phase: int = 3

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        valid = ["format", "fk", "numeric", "required", "unique", "temporal", "association", "fill"]
        if v not in valid:
            raise ValueError(f"Invalid category: {v}. Must be one of {valid}")
        return v

    @field_validator("tables")
    @classmethod
    def validate_tables(cls, v: list[str]) -> list[str]:
        valid = ["10", "20", "30", "40", "41", "50", "60", "70", "80", "99"]
        for table in v:
            if table not in valid:
                raise ValueError(f"Invalid table code: {table}. Must be one of {valid}")
        return v

    def get_bq_table_name(self, table_code: str) -> str:
        """Get BigQuery table name for a table code."""
        config = get_symbol_config()
        return config.get_sheet_table(table_code)

    def matches_table(self, table_code: str) -> bool:
        """Check if rule applies to a table."""
        return table_code in self.tables

    def compile_pattern(self) -> re.Pattern | None:
        """Compile regex pattern if present."""
        if self.pattern:
            return re.compile(self.pattern)
        return None


# =============================================================================
# Rule Registry
# =============================================================================


class RuleRegistry:
    """Registry for loading and managing cleaning rules."""

    def __init__(self, rules_dir: str | Path | None = None):
        """Initialize rule registry.

        Args:
            rules_dir: Path to rules directory. Defaults to 'rules/'
        """
        if rules_dir is None:
            rules_dir = os.environ.get("RULES_DIR", "rules")

        self.rules_dir = Path(rules_dir)
        self._rules: dict[str, CleaningRule] = {}
        self._rules_by_category: dict[str, list[CleaningRule]] = {}
        self._rules_by_table: dict[str, list[CleaningRule]] = {}
        self._loaded = False

        # Fill rules (separate storage)
        self._fill_rules: dict[str, BaseFillRule] = {}
        self._fill_rules_by_type: dict[str, list[BaseFillRule]] = {}
        self._fill_rules_by_table: dict[str, list[BaseFillRule]] = {}
        self._fill_loaded = False

    def load_all_rules(self) -> int:
        """Load all rules from YAML files.

        Returns:
            Number of rules loaded
        """
        if not self.rules_dir.exists():
            logger.warning(f"Rules directory not found: {self.rules_dir}")
            return 0

        self._rules.clear()
        self._rules_by_category.clear()
        self._rules_by_table.clear()

        rule_files = list(self.rules_dir.glob("*.yaml"))
        if not rule_files:
            # Also check for .yml extension
            rule_files = list(self.rules_dir.glob("*.yml"))

        # Exclude schema.yaml and fill_rules.yaml (has separate loader)
        rule_files = [f for f in rule_files if f.name not in ("schema.yaml", "fill_rules.yaml")]

        total_loaded = 0
        for rule_file in rule_files:
            try:
                loaded = self._load_rule_file(rule_file)
                total_loaded += loaded
                logger.debug(f"Loaded {loaded} rules from {rule_file.name}")
            except Exception as e:
                logger.error(f"Failed to load {rule_file}: {e}")

        self._loaded = True
        logger.info(f"Loaded {total_loaded} rules from {len(rule_files)} files")
        return total_loaded

    def _load_rule_file(self, file_path: Path) -> int:
        """Load rules from a single YAML file."""
        with open(file_path, encoding="utf-8") as f:
            data = yaml.safe_load(f)

        if not data or "rules" not in data:
            logger.warning(f"No rules found in {file_path}")
            return 0

        loaded = 0
        for rule_data in data["rules"]:
            try:
                rule = CleaningRule(**rule_data)
                self._register_rule(rule)
                loaded += 1
            except Exception as e:
                logger.error(f"Invalid rule in {file_path}: {rule_data.get('id', 'unknown')}: {e}")

        return loaded

    def _register_rule(self, rule: CleaningRule) -> None:
        """Register a rule in all indexes."""
        # Primary index by ID
        if rule.id in self._rules:
            logger.warning(f"Duplicate rule ID: {rule.id}, overwriting")
        self._rules[rule.id] = rule

        # Category index
        if rule.category not in self._rules_by_category:
            self._rules_by_category[rule.category] = []
        self._rules_by_category[rule.category].append(rule)

        # Table index
        for table in rule.tables:
            if table not in self._rules_by_table:
                self._rules_by_table[table] = []
            self._rules_by_table[table].append(rule)

    # =========================================================================
    # Fill Rules Loading
    # =========================================================================

    def load_fill_rules(self) -> int:
        """Load fill rules from fill_rules.yaml.

        Returns:
            Number of fill rules loaded
        """
        fill_file = self.rules_dir / "fill_rules.yaml"
        if not fill_file.exists():
            logger.warning(f"Fill rules file not found: {fill_file}")
            return 0

        self._fill_rules.clear()
        self._fill_rules_by_type.clear()
        self._fill_rules_by_table.clear()

        try:
            with open(fill_file, encoding="utf-8") as f:
                data = yaml.safe_load(f)

            if not data or "rules" not in data:
                logger.warning(f"No rules found in {fill_file}")
                return 0

            loaded = 0
            for rule_data in data["rules"]:
                try:
                    rule = parse_fill_rule(rule_data)
                    self._register_fill_rule(rule)
                    loaded += 1
                except Exception as e:
                    logger.error(f"Invalid fill rule: {rule_data.get('id', 'unknown')}: {e}")

            self._fill_loaded = True
            logger.info(f"Loaded {loaded} fill rules from {fill_file.name}")
            return loaded

        except Exception as e:
            logger.error(f"Failed to load fill rules: {e}")
            return 0

    def _register_fill_rule(self, rule: BaseFillRule) -> None:
        """Register a fill rule in all indexes."""
        # Primary index by ID
        if rule.id in self._fill_rules:
            logger.warning(f"Duplicate fill rule ID: {rule.id}, overwriting")
        self._fill_rules[rule.id] = rule

        # Type index
        rule_type = rule.type
        if rule_type not in self._fill_rules_by_type:
            self._fill_rules_by_type[rule_type] = []
        self._fill_rules_by_type[rule_type].append(rule)

        # Table index
        for table in rule.tables:
            if table not in self._fill_rules_by_table:
                self._fill_rules_by_table[table] = []
            self._fill_rules_by_table[table].append(rule)

    def _ensure_fill_loaded(self) -> None:
        """Ensure fill rules are loaded."""
        if not self._fill_loaded:
            self.load_fill_rules()

    def get_fill_rule(self, rule_id: str) -> BaseFillRule | None:
        """Get fill rule by ID."""
        self._ensure_fill_loaded()
        return self._fill_rules.get(rule_id)

    def get_fill_rules_by_type(self, rule_type: str) -> list[BaseFillRule]:
        """Get fill rules by type (auto_fill, lookup_fill, cascade_fill, derived_field)."""
        self._ensure_fill_loaded()
        return self._fill_rules_by_type.get(rule_type, [])

    def get_fill_rules_by_table(self, table_code: str) -> list[BaseFillRule]:
        """Get fill rules that apply to a table."""
        self._ensure_fill_loaded()
        return self._fill_rules_by_table.get(table_code, [])

    def get_all_fill_rules(self) -> list[BaseFillRule]:
        """Get all fill rules."""
        self._ensure_fill_loaded()
        return list(self._fill_rules.values())

    def get_fill_stats(self) -> dict[str, Any]:
        """Get statistics about loaded fill rules."""
        self._ensure_fill_loaded()
        return {
            "total_fill_rules": len(self._fill_rules),
            "by_type": {k: len(v) for k, v in self._fill_rules_by_type.items()},
            "by_table": {k: len(v) for k, v in self._fill_rules_by_table.items()},
        }

    def get_rule(self, rule_id: str) -> CleaningRule | None:
        """Get rule by ID."""
        self._ensure_loaded()
        return self._rules.get(rule_id)

    def get_rules_by_category(self, category: str) -> list[CleaningRule]:
        """Get all rules for a category."""
        self._ensure_loaded()
        return self._rules_by_category.get(category, [])

    def get_rules_by_table(self, table_code: str) -> list[CleaningRule]:
        """Get all rules that apply to a table."""
        self._ensure_loaded()
        return self._rules_by_table.get(table_code, [])

    def get_enabled_rules(self) -> list[CleaningRule]:
        """Get all enabled rules."""
        self._ensure_loaded()
        return [r for r in self._rules.values() if r.enabled]

    def get_validation_rules(self, table_code: str | None = None) -> list[CleaningRule]:
        """Get validation rules, optionally filtered by table."""
        self._ensure_loaded()
        rules = [r for r in self._rules.values() if r.type == "validation" and r.enabled]
        if table_code:
            rules = [r for r in rules if r.matches_table(table_code)]
        return rules

    def get_fill_rules(self, table_code: str | None = None, phase: int | None = None) -> list[CleaningRule]:
        """Get auto-fill rules, optionally filtered by table and phase."""
        self._ensure_loaded()
        rules = [r for r in self._rules.values() if r.type == "auto_fill" and r.enabled]
        if table_code:
            rules = [r for r in rules if r.matches_table(table_code)]
        if phase is not None:
            rules = [r for r in rules if r.execution_phase == phase]
        return sorted(rules, key=lambda r: r.execution_phase)

    def get_rules_by_severity(self, severity: str) -> list[CleaningRule]:
        """Get rules by severity level."""
        self._ensure_loaded()
        return [r for r in self._rules.values() if r.severity == severity and r.enabled]

    def get_rules_by_priority(self, priority: str) -> list[CleaningRule]:
        """Get rules by priority (P1, P2, P3)."""
        self._ensure_loaded()
        return [r for r in self._rules.values() if r.priority == priority and r.enabled]

    def get_auto_fixable_rules(self, table_code: str | None = None) -> list[CleaningRule]:
        """Get rules that can be auto-fixed."""
        self._ensure_loaded()
        rules = [r for r in self._rules.values() if r.auto_fixable and r.enabled]
        if table_code:
            rules = [r for r in rules if r.matches_table(table_code)]
        return rules

    def _ensure_loaded(self) -> None:
        """Ensure rules are loaded."""
        if not self._loaded:
            self.load_all_rules()

    def get_stats(self) -> dict[str, Any]:
        """Get statistics about loaded rules."""
        self._ensure_loaded()
        self._ensure_fill_loaded()
        return {
            "total_rules": len(self._rules),
            "enabled_rules": len([r for r in self._rules.values() if r.enabled]),
            "by_category": {k: len(v) for k, v in self._rules_by_category.items()},
            "by_table": {k: len(v) for k, v in self._rules_by_table.items()},
            "by_type": {
                "validation": len([r for r in self._rules.values() if r.type == "validation"]),
                "auto_fill": len([r for r in self._rules.values() if r.type == "auto_fill"]),
                "derived": len([r for r in self._rules.values() if r.type == "derived"]),
            },
            "by_severity": {
                "critical": len(self.get_rules_by_severity("critical")),
                "high": len(self.get_rules_by_severity("high")),
                "medium": len(self.get_rules_by_severity("medium")),
                "low": len(self.get_rules_by_severity("low")),
            },
            "auto_fixable": len([r for r in self._rules.values() if r.auto_fixable]),
            "fill_rules": self.get_fill_stats(),
        }

    def reload(self) -> tuple[int, int]:
        """Reload all rules from files.

        Returns:
            Tuple of (validation_rules_count, fill_rules_count)
        """
        self._loaded = False
        self._fill_loaded = False
        validation_count = self.load_all_rules()
        fill_count = self.load_fill_rules()
        return validation_count, fill_count


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_registry: RuleRegistry | None = None


def get_registry() -> RuleRegistry:
    """Get the default rule registry (singleton)."""
    global _default_registry
    if _default_registry is None:
        _default_registry = RuleRegistry()
    return _default_registry


def get_rule(rule_id: str) -> CleaningRule | None:
    """Get a rule by ID from the default registry."""
    return get_registry().get_rule(rule_id)


def get_validation_rules(table_code: str | None = None) -> list[CleaningRule]:
    """Get validation rules from the default registry."""
    return get_registry().get_validation_rules(table_code)


def get_fill_rules(table_code: str | None = None, phase: int | None = None) -> list[CleaningRule]:
    """Get fill rules from the default registry."""
    return get_registry().get_fill_rules(table_code, phase)


# Fill rules convenience functions
def load_fill_rules() -> int:
    """Load fill rules from fill_rules.yaml."""
    return get_registry().load_fill_rules()


def get_fill_rule_by_id(rule_id: str) -> BaseFillRule | None:
    """Get a fill rule by ID."""
    return get_registry().get_fill_rule(rule_id)


def get_fill_rules_by_type(rule_type: str) -> list[BaseFillRule]:
    """Get fill rules by type (auto_fill, lookup_fill, cascade_fill, derived_field)."""
    return get_registry().get_fill_rules_by_type(rule_type)


def get_all_fill_rules() -> list[BaseFillRule]:
    """Get all fill rules."""
    return get_registry().get_all_fill_rules()


def get_fill_stats() -> dict[str, Any]:
    """Get fill rules statistics."""
    return get_registry().get_fill_stats()
