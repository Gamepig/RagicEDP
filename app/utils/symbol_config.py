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

# 內建預設配置（Cloud Function 環境使用）
DEFAULT_CONFIG = {
    "sheets": {
        "10": {"code": "10", "bq_table": "sheet_10_brand", "ragic_path": "forms8/5", "chinese_name": "品牌表"},
        "20": {"code": "20", "bq_table": "sheet_20_channel", "ragic_path": "forms8/4", "chinese_name": "通路表"},
        "30": {"code": "30", "bq_table": "sheet_30_payment", "ragic_path": "forms8/7", "chinese_name": "金流表"},
        "40": {"code": "40", "bq_table": "sheet_40_logistics", "ragic_path": "forms8/1", "chinese_name": "物流表"},
        "41": {"code": "41", "bq_table": "sheet_41_zipcode", "ragic_path": "forms8/6", "chinese_name": "郵遞區號表"},
        "50": {"code": "50", "bq_table": "sheet_50_order", "ragic_path": "forms8/17", "chinese_name": "訂單表"},
        "60": {"code": "60", "bq_table": "sheet_60_customer", "ragic_path": "forms8/2", "chinese_name": "客戶表"},
        "70": {"code": "70", "bq_table": "sheet_70_product", "ragic_path": "forms8/9", "chinese_name": "商品表"},
        "80": {"code": "80", "bq_table": "sheet_80_campaign", "ragic_path": "forms8/10", "chinese_name": "活動管理表"},
        "99": {"code": "99", "bq_table": "sheet_99_order_detail", "ragic_path": "forms8/3", "chinese_name": "訂單明細表"},
    },
    "env_vars": {
        "GCP_PROJECT_ID": {"correct_name": "GCP_PROJECT_ID", "default_value": "b25h01-ragic"},
        "BQ_DATASET": {"correct_name": "BQ_DATASET", "default_value": "erp_backup"},
    },
    "cleaning_status": {
        "valid_values": [None, "pending", "processing", "completed", "auto_fixed", "ai_fixed", "manual", "filtered", "failed"]
    },
    "primary_keys": {
        "10": {"field": "品牌編號", "json_path": "品牌編號", "ragic_field": "1000942"},
        "20": {"field": "通路編號", "json_path": "通路編號", "ragic_field": "1000921"},
        "30": {"field": "金流編號", "json_path": "金流編號", "ragic_field": "1000954"},
        "40": {"field": "物流編號", "json_path": "物流編號", "ragic_field": "1000736"},
        "41": {"field": "郵遞區號", "json_path": "郵遞區號", "ragic_field": "1000964"},
        "50": {"field": "訂單編號", "json_path": "訂單編號", "ragic_field": "1000976"},
        "60": {"field": "客戶編號", "json_path": "客戶編號", "ragic_field": "1000710"},
        "70": {"field": "商品編號", "json_path": "商品編號", "ragic_field": "1000998"},
        "80": {"field": "活動編號", "json_path": "活動編號", "ragic_field": "1001019"},
        "99": {"field": "訂單編號,商品編號", "json_path": "訂單編號,商品編號", "ragic_field": "1000976,1000998", "composite": True},
    },
    "ai_models": {
        "openrouter": {
            "primary_model": "meta-llama/llama-3.3-70b-instruct:free",
            "fallback_model": "meta-llama/llama-3.2-3b-instruct:free",
            "confidence_threshold": 0.9,
        }
    },
}


class SymbolConfig:
    """Load and provide access to symbol configuration."""

    def __init__(self, config_path: str | Path | None = None):
        """Initialize symbol config loader.

        Args:
            config_path: Path to index.yaml. Defaults to .claude/symbols/index.yaml
        """
        self._config: dict[str, Any] = {}
        self.config_path: Path | None = None

        if config_path is None:
            # Find project root by looking for .claude directory
            current = Path(__file__).resolve()
            for parent in current.parents:
                if (parent / ".claude" / "symbols" / "index.yaml").exists():
                    config_path = parent / ".claude" / "symbols" / "index.yaml"
                    break

        if config_path is None:
            # Cloud Function 環境：使用內建預設配置
            logger.info("Using built-in default config (Cloud Function environment)")
            self._config = DEFAULT_CONFIG.copy()
            return

        self.config_path = Path(config_path)
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

    def get_sheet_table(self, code: str | int) -> str:
        """Get BigQuery table name for sheet code.

        Args:
            code: Sheet code (e.g., "50", "60", or 50, 60)

        Returns:
            BigQuery table name (e.g., "sheet_50_order")

        Raises:
            KeyError: If sheet code not found
        """
        sheets = self._config.get("sheets", {})
        code_str = str(code)  # Ensure string comparison
        if code_str not in sheets:
            raise KeyError(f"Unknown sheet code: {code_str}")
        return sheets[code_str]["bq_table"]

    def get_sheet_ragic_path(self, code: str | int) -> str:
        """Get Ragic API path for sheet code.

        Args:
            code: Sheet code (e.g., "50" or 50)

        Returns:
            Ragic path (e.g., "forms8/17")
        """
        sheets = self._config.get("sheets", {})
        code_str = str(code)
        if code_str not in sheets:
            raise KeyError(f"Unknown sheet code: {code_str}")
        return sheets[code_str]["ragic_path"]

    def get_all_sheet_codes(self) -> list[str]:
        """Get all configured sheet codes."""
        return list(self._config.get("sheets", {}).keys())

    def get_sheet_info(self, code: str | int) -> dict[str, Any]:
        """Get full info for a sheet code."""
        sheets = self._config.get("sheets", {})
        code_str = str(code)
        if code_str not in sheets:
            raise KeyError(f"Unknown sheet code: {code_str}")
        return sheets[code_str]

    # =========================================================================
    # Primary Key Methods
    # =========================================================================

    def get_primary_key(self, code: str | int) -> dict[str, Any] | None:
        """Get primary key info for sheet code.

        Args:
            code: Sheet code (e.g., "50" or 50)

        Returns:
            Dict with keys: field, json_path, ragic_field, composite (optional)
            Returns None if no primary key defined

        Example:
            >>> config.get_primary_key("50")
            {"field": "訂單編號", "json_path": "訂單編號", "ragic_field": "1000976"}
            >>> config.get_primary_key("99")
            {"field": "訂單編號,商品編號", "json_path": "訂單編號,商品編號",
             "ragic_field": "1000976,1000998", "composite": True}
        """
        primary_keys = self._config.get("primary_keys", {})
        code_str = str(code)
        return primary_keys.get(code_str)

    def is_composite_key(self, code: str | int) -> bool:
        """Check if sheet has composite primary key.

        Args:
            code: Sheet code

        Returns:
            True if composite key (e.g., 99 table needs both 訂單編號 and 商品編號)
        """
        pk_info = self.get_primary_key(code)
        if pk_info is None:
            return False
        return pk_info.get("composite", False)

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
def get_sheet_table(code: str | int) -> str:
    """Get BigQuery table name for sheet code."""
    return get_symbol_config().get_sheet_table(code)


def get_secret_name(env_var: str) -> str:
    """Get GCP secret name for environment variable."""
    return get_symbol_config().get_secret_name(env_var)


def get_valid_statuses() -> list[str | None]:
    """Get list of valid cleaning status values."""
    return get_symbol_config().get_valid_statuses()
