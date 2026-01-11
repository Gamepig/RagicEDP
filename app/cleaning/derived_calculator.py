"""
Derived Calculator for 資料清洗系統 v2.

Calculates derived fields like RFM scores, customer statistics.
"""

from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.cleaning.models import FillResult, ViolationStatus
from app.cleaning.rule_registry import CleaningRule
from app.utils.bq_client import get_bq_client


class DerivedCalculator:
    """Calculates derived fields from existing data."""

    def __init__(self):
        """Initialize derived calculator."""
        self.bq_client = get_bq_client()

    def calculate_field(
        self,
        rule: CleaningRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Calculate a derived field for records.

        Args:
            rule: Rule with compute configuration
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []
        source = rule.source or {}

        formula = source.get("formula", "")
        inputs = source.get("inputs", [])

        if not formula:
            logger.warning(f"No formula for rule {rule.id}")
            return results

        # Dispatch to specific calculator based on formula type
        if "rfm" in formula.lower():
            results = self._calculate_rfm(rule, table_code, batch_id, limit)
        elif "first_purchase" in formula.lower():
            results = self._calculate_first_purchase_flag(
                rule, table_code, batch_id, limit
            )
        elif "days_since" in formula.lower():
            results = self._calculate_days_since(rule, table_code, batch_id, limit)
        else:
            # Generic formula evaluation
            results = self._calculate_generic(
                rule, table_code, batch_id, formula, inputs, limit
            )

        return results

    def _calculate_rfm(
        self,
        rule: CleaningRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Calculate RFM scores for customers.

        RFM = Recency, Frequency, Monetary
        - R: Days since last purchase (lower is better)
        - F: Number of orders (higher is better)
        - M: Total spend (higher is better)

        Args:
            rule: Rule configuration
            table_code: Should be 60 (customer table)
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results with RFM scores
        """
        results: list[FillResult] = []
        target_field = rule.field

        # Calculate RFM components for all customers
        rfm_query = f"""
        WITH customer_stats AS (
            SELECT
                JSON_VALUE(data, '$.客戶編號') as customer_code,
                DATE_DIFF(CURRENT_DATE(), MAX(DATE(JSON_VALUE(data, '$.訂單日期'))), DAY) as recency,
                COUNT(DISTINCT JSON_VALUE(data, '$.訂單編號')) as frequency,
                COALESCE(SUM(SAFE_CAST(JSON_VALUE(data, '$.訂單實收') AS FLOAT64)), 0) as monetary
            FROM `{self.bq_client.dataset}.sheet_99_order_detail`
            GROUP BY customer_code
        ),
        rfm_scores AS (
            SELECT
                customer_code,
                recency,
                frequency,
                monetary,
                -- R score: 1-5 (5 = most recent)
                CASE
                    WHEN recency <= 30 THEN 5
                    WHEN recency <= 60 THEN 4
                    WHEN recency <= 90 THEN 3
                    WHEN recency <= 180 THEN 2
                    ELSE 1
                END as r_score,
                -- F score: 1-5 (5 = most frequent)
                CASE
                    WHEN frequency >= 10 THEN 5
                    WHEN frequency >= 5 THEN 4
                    WHEN frequency >= 3 THEN 3
                    WHEN frequency >= 2 THEN 2
                    ELSE 1
                END as f_score,
                -- M score: 1-5 (5 = highest spend)
                CASE
                    WHEN monetary >= 50000 THEN 5
                    WHEN monetary >= 20000 THEN 4
                    WHEN monetary >= 10000 THEN 3
                    WHEN monetary >= 5000 THEN 2
                    ELSE 1
                END as m_score
            FROM customer_stats
        )
        SELECT
            c.ragic_id,
            JSON_VALUE(c.data, '$.客戶編號') as customer_code,
            r.r_score,
            r.f_score,
            r.m_score,
            CONCAT(CAST(r.r_score AS STRING), CAST(r.f_score AS STRING), CAST(r.m_score AS STRING)) as rfm_score
        FROM `{self.bq_client.dataset}.sheet_60_customer` c
        LEFT JOIN rfm_scores r ON JSON_VALUE(c.data, '$.客戶編號') = r.customer_code
        WHERE JSON_VALUE(c.data, '$.{target_field}') IS NULL
            OR JSON_VALUE(c.data, '$.{target_field}') = ''
        """
        if limit:
            rfm_query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query(rfm_query)
        except Exception as e:
            logger.error(f"Error calculating RFM: {e}")
            return results

        for row in rows:
            record_id = row.get("ragic_id", "")
            rfm_score = row.get("rfm_score", "111")  # Default score

            result = FillResult(
                table_code=table_code,
                record_id=record_id,
                field_name=target_field,
                rule_id=rule.id,
                before_value=None,
                after_value=rfm_score,
                status=ViolationStatus.AUTO_FIXED,
                batch_id=batch_id,
                fixed_at=datetime.now(timezone.utc),
            )
            results.append(result)

        logger.info(f"Calculated RFM for {len(results)} customers")
        return results

    def _calculate_first_purchase_flag(
        self,
        rule: CleaningRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Calculate first purchase flag for orders.

        Args:
            rule: Rule configuration
            table_code: Should be 50 (order table)
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []
        target_field = rule.field

        # Find first order for each customer
        query = f"""
        WITH first_orders AS (
            SELECT
                JSON_VALUE(data, '$.客戶編號') as customer_code,
                MIN(JSON_VALUE(data, '$.訂單編號')) as first_order_id
            FROM `{self.bq_client.dataset}.sheet_50_order`
            GROUP BY customer_code
        )
        SELECT
            o.ragic_id,
            JSON_VALUE(o.data, '$.訂單編號') as order_id,
            CASE WHEN f.first_order_id = JSON_VALUE(o.data, '$.訂單編號') THEN 'Y' ELSE 'N' END as is_first_purchase
        FROM `{self.bq_client.dataset}.sheet_50_order` o
        LEFT JOIN first_orders f ON JSON_VALUE(o.data, '$.客戶編號') = f.customer_code
        WHERE JSON_VALUE(o.data, '$.{target_field}') IS NULL
            OR JSON_VALUE(o.data, '$.{target_field}') = ''
        """
        if limit:
            query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query(query)
        except Exception as e:
            logger.error(f"Error calculating first purchase flag: {e}")
            return results

        for row in rows:
            record_id = row.get("ragic_id", "")
            is_first = row.get("is_first_purchase", "N")

            result = FillResult(
                table_code=table_code,
                record_id=record_id,
                field_name=target_field,
                rule_id=rule.id,
                before_value=None,
                after_value=is_first,
                status=ViolationStatus.AUTO_FIXED,
                batch_id=batch_id,
                fixed_at=datetime.now(timezone.utc),
            )
            results.append(result)

        logger.info(f"Calculated first purchase flag for {len(results)} orders")
        return results

    def _calculate_days_since(
        self,
        rule: CleaningRule,
        table_code: str,
        batch_id: str,
        limit: int | None = None,
    ) -> list[FillResult]:
        """Calculate days since a reference date.

        Args:
            rule: Rule configuration
            table_code: Table code
            batch_id: Current batch ID
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []
        source = rule.source or {}
        target_field = rule.field

        # Get reference field from source config
        reference_field = source.get("inputs", ["訂單日期"])[0]
        bq_table = rule.get_bq_table_name(table_code)

        query = f"""
        SELECT
            ragic_id,
            DATE_DIFF(CURRENT_DATE(), DATE(JSON_VALUE(data, '$.{reference_field}')), DAY) as days_since
        FROM `{self.bq_client.dataset}.{bq_table}`
        WHERE JSON_VALUE(data, '$.{target_field}') IS NULL
            AND JSON_VALUE(data, '$.{reference_field}') IS NOT NULL
        """
        if limit:
            query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query(query)
        except Exception as e:
            logger.error(f"Error calculating days since: {e}")
            return results

        for row in rows:
            record_id = row.get("ragic_id", "")
            days = row.get("days_since", 0)

            result = FillResult(
                table_code=table_code,
                record_id=record_id,
                field_name=target_field,
                rule_id=rule.id,
                before_value=None,
                after_value=str(days),
                status=ViolationStatus.AUTO_FIXED,
                batch_id=batch_id,
                fixed_at=datetime.now(timezone.utc),
            )
            results.append(result)

        return results

    def _calculate_generic(
        self,
        rule: CleaningRule,
        table_code: str,
        batch_id: str,
        formula: str,
        inputs: list[str],
        limit: int | None = None,
    ) -> list[FillResult]:
        """Calculate using a generic SQL formula.

        Args:
            rule: Rule configuration
            table_code: Table code
            batch_id: Current batch ID
            formula: SQL expression formula
            inputs: Input field names
            limit: Max records to process

        Returns:
            List of fill results
        """
        results: list[FillResult] = []
        target_field = rule.field
        bq_table = rule.get_bq_table_name(table_code)

        # Build SELECT clause for inputs
        input_selects = ", ".join(
            [f"JSON_VALUE(data, '$.{f}') as {f.replace(' ', '_')}" for f in inputs]
        )

        # Replace field references in formula with JSON_VALUE
        sql_formula = formula
        for field in inputs:
            sql_formula = sql_formula.replace(
                f"${field}", f"JSON_VALUE(data, '$.{field}')"
            )

        query = f"""
        SELECT
            ragic_id,
            {input_selects},
            ({sql_formula}) as calculated_value
        FROM `{self.bq_client.dataset}.{bq_table}`
        WHERE JSON_VALUE(data, '$.{target_field}') IS NULL
        """
        if limit:
            query += f" LIMIT {limit}"

        try:
            rows = self.bq_client.query(query)
        except Exception as e:
            logger.error(f"Error calculating generic formula: {e}")
            return results

        for row in rows:
            record_id = row.get("ragic_id", "")
            calculated = row.get("calculated_value")

            if calculated is not None:
                result = FillResult(
                    table_code=table_code,
                    record_id=record_id,
                    field_name=target_field,
                    rule_id=rule.id,
                    before_value=None,
                    after_value=str(calculated),
                    status=ViolationStatus.AUTO_FIXED,
                    batch_id=batch_id,
                    fixed_at=datetime.now(timezone.utc),
                )
                results.append(result)

        return results


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_calculator: DerivedCalculator | None = None


def get_calculator() -> DerivedCalculator:
    """Get the default derived calculator (singleton)."""
    global _default_calculator
    if _default_calculator is None:
        _default_calculator = DerivedCalculator()
    return _default_calculator
