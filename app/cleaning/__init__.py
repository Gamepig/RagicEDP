"""
資料清洗模組 v2

包含:
- engine.py: 清洗引擎主協調器
- sql_cleaner.py: SQL 驗證規則執行器
- field_fixer.py: 欄位自動修正器
- rule_registry.py: YAML 規則註冊器
- result_writer.py: BigQuery 結果寫入器
- models.py: 資料模型

Cloud Function 入口點: clean_erp_data

版本: 2.0.0
建立日期: 2026-01-11
"""

import json
from typing import Any

import flask
import functions_framework
from loguru import logger

from app.utils.logging_config import setup_logging

__version__ = "2.0.0"

# Setup logging for Cloud Functions
setup_logging()


@functions_framework.http
def clean_erp_data(request: flask.Request) -> flask.Response:
    """Cloud Function entry point for data cleaning.

    HTTP Triggers:
        POST /: Run full cleaning pipeline
        POST /?table=50: Clean specific table

    Request Body (optional):
        {
            "table_codes": ["50", "60"],  # Specific tables
            "record_ids": ["123", "456"],  # Specific records
            "trigger_type": "manual"       # Trigger type
        }

    Returns:
        JSON response with cleaning results
    """
    try:
        # Parse request
        table_codes = None
        record_ids = None
        trigger_type = "scheduled"

        # Query parameters
        if request.args.get("table"):
            table_codes = [request.args.get("table")]

        # Request body
        if request.is_json:
            data = request.get_json(silent=True) or {}
            table_codes = data.get("table_codes", table_codes)
            record_ids = data.get("record_ids")
            trigger_type = data.get("trigger_type", trigger_type)

        logger.info(f"Starting cleaning: tables={table_codes}, trigger={trigger_type}")

        # Import here to avoid circular imports
        from app.cleaning.engine import run_cleaning

        # Run cleaning
        batch = run_cleaning(table_codes, trigger_type)

        # Build response
        result = {
            "success": batch.status == "completed",
            "batch_id": batch.id,
            "status": batch.status,
            "processed_records": batch.processed_records,
            "auto_fixed_count": batch.auto_fixed_count,
            "ai_fixed_count": batch.ai_fixed_count,
            "manual_count": batch.manual_count,
            "error": batch.error_message,
        }

        logger.info(f"Cleaning completed: {result}")

        return flask.Response(
            json.dumps(result, ensure_ascii=False),
            status=200 if batch.status == "completed" else 500,
            mimetype="application/json",
        )

    except Exception as e:
        logger.error(f"Cleaning failed: {e}")
        return flask.Response(
            json.dumps({"success": False, "error": str(e)}, ensure_ascii=False),
            status=500,
            mimetype="application/json",
        )


def get_cleaning_stats(request: flask.Request) -> flask.Response:
    """Get cleaning statistics.

    HTTP Triggers:
        GET /stats: Get overall stats
        GET /stats?batch_id=xxx: Get stats for specific batch

    Returns:
        JSON response with statistics
    """
    try:
        from app.cleaning.result_writer import get_result_writer

        writer = get_result_writer()
        batch_id = request.args.get("batch_id")

        stats = writer.get_cleaning_stats(batch_id)

        return flask.Response(
            json.dumps(stats, ensure_ascii=False),
            status=200,
            mimetype="application/json",
        )

    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        return flask.Response(
            json.dumps({"error": str(e)}, ensure_ascii=False),
            status=500,
            mimetype="application/json",
        )


# Export for testing
__all__ = ["clean_erp_data", "get_cleaning_stats", "__version__"]
