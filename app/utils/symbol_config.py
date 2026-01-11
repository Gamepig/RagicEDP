"""
Symbol Configuration Loader for 資料清洗系統 v2.

Provides access to the symbol index table (.claude/symbols/index.yaml)
for consistent naming across the system.
"""

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from loguru import logger


class SymbolConfig:
    """Load and provide access to symbol configuration."""

    def __init__(self, config_path: str | Path | None = None):
        """Initialize symbol config loader.

        Args:
            config_path: Path to index.yaml. Defaults to .claude/symbols/index.yaml
        """
        if config_path is None:
            # Find project root by looking for .claude directory
            current = Path(__file__).resolve()
            for parent in current.parents:
                if (parent / ".claude" / "symbols" / "index.yaml").exists():
                    config_path = parent / ".claude" / "symbols" / "index.yaml"
                    break

        if config_path is None:
            raise FileNotFoundError("Symbol index file not found")

        self.config_path = Path(config_path)
        self._config: dict[str, Any] = {}
        self._load_config()

    def _load_config(self) -> None:
        """Load configuration from YAML file."""
        try:
            with open(self.config_path, encoding="utf-8") as f:
                self._config = yaml.safe_load(f) or {}
            logger.debug(f"Loaded symbol config from {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to load symbol config: {e}")
            raise

    # =========================================================================
    # Sheet / Table Methods
    # =========================================================================

    def get_sheet_table(self, code: str) -> str:
        """Get BigQuery table name for sheet code.

        Args:
            code: Sheet code (e.g., "50", "60")

        Returns:
            BigQuery table name (e.g., "sheet_50_order")

        Raises:
            KeyError: If sheet code not found
        """
        sheets = self._config.get("sheets", {})
        if code not in sheets:
            raise KeyError(f"Unknown sheet code: {code}")
        return sheets[code]["bq_table"]

    def get_sheet_ragic_path(self, code: str) -> str:
        """Get Ragic API path for sheet code.

        Args:
            code: Sheet code (e.g., "50")

        Returns:
            Ragic path (e.g., "forms8/17")
        """
        sheets = self._config.get("sheets", {})
        if code not in sheets:
            raise KeyError(f"Unknown sheet code: {code}")
        return sheets[code]["ragic_path"]

    def get_all_sheet_codes(self) -> list[str]:
        """Get all configured sheet codes."""
        return list(self._config.get("sheets", {}).keys())

    def get_sheet_info(self, code: str) -> dict[str, Any]:
        """Get full info for a sheet code."""
        sheets = self._config.get("sheets", {})
        if code not in sheets:
            raise KeyError(f"Unknown sheet code: {code}")
        return sheets[code]

    # =========================================================================
    # Secret Methods
    # =========================================================================

    def get_secret_name(self, env_var: str) -> str:
        """Get GCP Secret Manager name for environment variable.

        Args:
            env_var: Environment variable name (e.g., "RAGIC_API_KEY")

        Returns:
            GCP secret name (e.g., "ragic-api-key")
        """
        secrets = self._config.get("secrets", {})
        if env_var not in secrets:
            raise KeyError(f"Unknown secret: {env_var}")
        return secrets[env_var]["gcp_secret_name"]

    def get_deploy_format(self, env_var: str) -> str:
        """Get --set-secrets format for deployment.

        Args:
            env_var: Environment variable name

        Returns:
            Deploy format string (e.g., "RAGIC_API_KEY=ragic-api-key:latest")
        """
        secrets = self._config.get("secrets", {})
        if env_var not in secrets:
            raise KeyError(f"Unknown secret: {env_var}")
        return secrets[env_var]["deploy_format"]

    # =========================================================================
    # Cloud Function Methods
    # =========================================================================

    def get_function_name(self, key: str) -> str:
        """Get Cloud Function name.

        Args:
            key: Function key (e.g., "backup", "clean")

        Returns:
            Function name (e.g., "backup-erp-incremental")
        """
        functions = self._config.get("functions", {})
        if key not in functions:
            raise KeyError(f"Unknown function: {key}")
        return functions[key]["function_name"]

    def get_entry_point(self, key: str) -> str:
        """Get Python entry point for function.

        Args:
            key: Function key

        Returns:
            Entry point (e.g., "backup_erp_data")
        """
        functions = self._config.get("functions", {})
        if key not in functions:
            raise KeyError(f"Unknown function: {key}")
        return functions[key]["entry_point"]

    # =========================================================================
    # Cleaning Status Methods
    # =========================================================================

    def get_valid_statuses(self) -> list[str | None]:
        """Get list of valid cleaning status values."""
        return self._config.get("cleaning_status", {}).get("valid_values", [])

    def is_valid_status(self, status: str | None) -> bool:
        """Check if status value is valid."""
        return status in self.get_valid_statuses()

    # =========================================================================
    # Rule Methods
    # =========================================================================

    def get_rule_types(self) -> dict[str, str]:
        """Get rule type codes and descriptions."""
        return self._config.get("cleaning_rules", {}).get("types", {})

    def get_rule_files(self) -> list[str]:
        """Get list of rule YAML files."""
        return self._config.get("cleaning_rules", {}).get("rule_files", [])

    # =========================================================================
    # AI Model Methods
    # =========================================================================

    def get_primary_model(self) -> str:
        """Get primary AI model name."""
        return self._config.get("ai_models", {}).get("openrouter", {}).get(
            "primary_model", "claude-3-5-sonnet-20241022"
        )

    def get_fallback_model(self) -> str:
        """Get fallback AI model name."""
        return self._config.get("ai_models", {}).get("openrouter", {}).get(
            "fallback_model", "gemini-2.0-flash-exp"
        )

    def get_confidence_threshold(self) -> float:
        """Get AI confidence threshold."""
        return self._config.get("ai_models", {}).get("openrouter", {}).get(
            "confidence_threshold", 0.9
        )

    # =========================================================================
    # Environment Variables
    # =========================================================================

    def get_env_default(self, var_name: str) -> str | None:
        """Get default value for environment variable.

        Args:
            var_name: Variable name (e.g., "GCP_PROJECT_ID")

        Returns:
            Default value or None
        """
        env_vars = self._config.get("env_vars", {})
        if var_name not in env_vars:
            return None
        return env_vars[var_name].get("default_value")

    # =========================================================================
    # Raw Access
    # =========================================================================

    def get_raw(self, *keys: str) -> Any:
        """Get raw config value by path.

        Args:
            keys: Path to value (e.g., "sheets", "50", "bq_table")

        Returns:
            Config value or None
        """
        result = self._config
        for key in keys:
            if isinstance(result, dict):
                result = result.get(key)
            else:
                return None
        return result


@lru_cache(maxsize=1)
def get_symbol_config() -> SymbolConfig:
    """Get cached symbol config instance."""
    return SymbolConfig()


# Convenience functions
def get_sheet_table(code: str) -> str:
    """Get BigQuery table name for sheet code."""
    return get_symbol_config().get_sheet_table(code)


def get_secret_name(env_var: str) -> str:
    """Get GCP secret name for environment variable."""
    return get_symbol_config().get_secret_name(env_var)


def get_valid_statuses() -> list[str | None]:
    """Get list of valid cleaning status values."""
    return get_symbol_config().get_valid_statuses()
