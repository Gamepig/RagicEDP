#!/usr/bin/env python3
"""
Sync cleaning rules from YAML files to BigQuery.

This script reads all YAML rule files and syncs them to the cleaning_rules
table in BigQuery using MERGE (upsert) to handle updates.

Usage:
    python scripts/sync_cleaning_rules.py [--dry-run]
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml
from google.cloud import bigquery
from loguru import logger

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Configuration
PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "b25h01-ragic")
DATASET = os.environ.get("BQ_DATASET", "erp_backup")
TABLE_ID = f"{PROJECT_ID}.{DATASET}.cleaning_rules"
RULES_DIR = PROJECT_ROOT / "rules"


def create_table_if_not_exists(client: bigquery.Client) -> None:
    """Create cleaning_rules table if it doesn't exist."""
    ddl = f"""
    CREATE TABLE IF NOT EXISTS `{TABLE_ID}` (
        id STRING NOT NULL,
        name STRING NOT NULL,
        type STRING NOT NULL,
        category STRING NOT NULL,
        tables ARRAY<STRING>,
        field STRING NOT NULL,
        trigger_condition STRING,
        fix_logic STRING,
        auto_fixable BOOL DEFAULT FALSE,
        severity STRING NOT NULL,
        priority STRING DEFAULT 'P3',
        enabled BOOL DEFAULT TRUE,
        version STRING DEFAULT '1.0.0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
    )
    CLUSTER BY category, type
    """

    try:
        job = client.query(ddl)
        job.result()
        logger.info(f"Table {TABLE_ID} ready")
    except Exception as e:
        logger.error(f"Failed to create table: {e}")
        raise


def load_yaml_rules() -> list[dict]:
    """Load all rules from YAML files."""
    all_rules = []

    yaml_files = sorted(RULES_DIR.glob("*_rules.yaml"))
    logger.info(f"Found {len(yaml_files)} rule files")

    for yaml_file in yaml_files:
        try:
            with open(yaml_file, encoding="utf-8") as f:
                data = yaml.safe_load(f)

            rules = data.get("rules", [])
            logger.debug(f"Loaded {len(rules)} rules from {yaml_file.name}")
            all_rules.extend(rules)

        except Exception as e:
            logger.error(f"Failed to load {yaml_file}: {e}")

    logger.info(f"Total rules loaded: {len(all_rules)}")
    return all_rules


def convert_rule_to_bq_row(rule: dict) -> dict:
    """Convert YAML rule to BigQuery row format."""
    # Build fix_logic JSON from various fix-related fields
    fix_logic = {}
    if "fix_rule" in rule:
        fix_logic["fix_rule"] = rule["fix_rule"]
    if "pattern" in rule:
        fix_logic["pattern"] = rule["pattern"]
    if "description" in rule:
        fix_logic["description"] = rule["description"]
    if "note" in rule:
        fix_logic["note"] = rule["note"]

    # Handle auto_fixable: convert non-boolean values
    auto_fixable_raw = rule.get("auto_fixable", False)
    if isinstance(auto_fixable_raw, bool):
        auto_fixable = auto_fixable_raw
    elif auto_fixable_raw in ("partial", "conditional"):
        auto_fixable = True  # Treat partial/conditional as True
    else:
        auto_fixable = bool(auto_fixable_raw)

    return {
        "id": rule.get("id", ""),
        "name": rule.get("name", ""),
        "type": rule.get("type", "validation"),
        "category": rule.get("category", ""),
        "tables": rule.get("tables", []),
        "field": rule.get("field", ""),
        "trigger_condition": rule.get("trigger_condition"),
        "fix_logic": json.dumps(fix_logic, ensure_ascii=False) if fix_logic else None,
        "auto_fixable": auto_fixable,
        "severity": rule.get("severity", "medium"),
        "priority": rule.get("priority", "P3"),
        "enabled": rule.get("enabled", True),
        "version": "1.0.0",
    }


def sync_rules_to_bigquery(
    client: bigquery.Client,
    rules: list[dict],
    dry_run: bool = False,
) -> int:
    """Sync rules to BigQuery using MERGE."""
    if not rules:
        logger.warning("No rules to sync")
        return 0

    # Convert rules to BQ format
    rows = [convert_rule_to_bq_row(r) for r in rules]

    if dry_run:
        logger.info(f"[DRY RUN] Would sync {len(rows)} rules")
        for row in rows[:5]:
            logger.debug(f"  - {row['id']}: {row['name']}")
        return 0

    # Delete existing rules and insert new ones (full sync)
    # Using DELETE + INSERT instead of MERGE for simplicity with arrays
    try:
        # Delete all existing rules
        delete_sql = f"DELETE FROM `{TABLE_ID}` WHERE TRUE"
        job = client.query(delete_sql)
        job.result()
        deleted_count = job.num_dml_affected_rows or 0
        logger.info(f"Deleted {deleted_count} existing rules")

        # Insert new rules
        errors = client.insert_rows_json(TABLE_ID, rows)

        if errors:
            logger.error(f"Insert errors: {errors}")
            return len(rows) - len(errors)

        logger.info(f"Successfully synced {len(rows)} rules")
        return len(rows)

    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise


def main() -> None:
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Sync cleaning rules to BigQuery")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be synced")
    args = parser.parse_args()

    # Setup logging
    logger.remove()
    logger.add(sys.stderr, level="INFO")

    logger.info("Starting cleaning rules sync...")

    # Create BigQuery client
    client = bigquery.Client(project=PROJECT_ID)

    # Create table if needed
    create_table_if_not_exists(client)

    # Load rules from YAML
    rules = load_yaml_rules()

    # Sync to BigQuery
    synced = sync_rules_to_bigquery(client, rules, dry_run=args.dry_run)

    logger.info(f"Sync complete: {synced} rules")


if __name__ == "__main__":
    main()
