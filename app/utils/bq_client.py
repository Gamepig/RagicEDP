"""
BigQuery Client Wrapper for 資料清洗系統 v2.

Provides a unified interface for BigQuery operations.
"""

import os
from typing import Any

from google.cloud import bigquery
from google.cloud.bigquery import QueryJobConfig
from loguru import logger

from app.utils.symbol_config import get_symbol_config


class BigQueryClient:
    """Wrapper for BigQuery operations."""

    def __init__(
        self,
        project_id: str | None = None,
        dataset: str | None = None,
        location: str | None = None,
    ):
        """Initialize BigQuery client.

        Args:
            project_id: GCP project ID. Defaults to GCP_PROJECT_ID env var.
            dataset: BigQuery dataset. Defaults to BQ_DATASET env var.
            location: BigQuery location. Defaults to asia-east1.
        """
        config = get_symbol_config()

        self.project_id = project_id or os.environ.get(
            "GCP_PROJECT_ID", config.get_env_default("GCP_PROJECT_ID")
        )
        self.dataset = dataset or os.environ.get(
            "BQ_DATASET", config.get_env_default("BQ_DATASET")
        )
        self.location = location or os.environ.get("BIGQUERY_LOCATION", "asia-east1")

        self._client: bigquery.Client | None = None

    @property
    def client(self) -> bigquery.Client:
        """Get or create BigQuery client (lazy initialization)."""
        if self._client is None:
            self._client = bigquery.Client(
                project=self.project_id,
                location=self.location,
            )
            logger.debug(f"Created BigQuery client for {self.project_id}")
        return self._client

    def get_table_id(self, table_name: str) -> str:
        """Get fully qualified table ID.

        Args:
            table_name: Table name (can be with or without project.dataset prefix)

        Returns:
            Fully qualified table ID (project.dataset.table)
        """
        if "." in table_name:
            return table_name
        return f"{self.project_id}.{self.dataset}.{table_name}"

    def get_sheet_table_id(self, sheet_code: str) -> str:
        """Get fully qualified table ID for a sheet code.

        Args:
            sheet_code: Sheet code (e.g., "50", "60")

        Returns:
            Fully qualified table ID
        """
        config = get_symbol_config()
        table_name = config.get_sheet_table(sheet_code)
        return self.get_table_id(table_name)

    # =========================================================================
    # Query Operations
    # =========================================================================

    def query(
        self,
        sql: str,
        params: dict[str, Any] | None = None,
        dry_run: bool = False,
    ) -> bigquery.QueryJob:
        """Execute a query.

        Args:
            sql: SQL query string
            params: Query parameters (for parameterized queries)
            dry_run: If True, only estimate costs without running

        Returns:
            QueryJob result
        """
        job_config = QueryJobConfig(dry_run=dry_run)

        if params:
            job_config.query_parameters = self._build_query_params(params)

        # Replace placeholders
        sql = sql.format(
            project=self.project_id,
            dataset=self.dataset,
        )

        logger.debug(f"Executing query: {sql[:200]}...")
        return self.client.query(sql, job_config=job_config)

    def query_to_dataframe(
        self,
        sql: str,
        params: dict[str, Any] | None = None,
    ):
        """Execute query and return results as pandas DataFrame.

        Args:
            sql: SQL query string
            params: Query parameters

        Returns:
            pandas DataFrame with results
        """
        job = self.query(sql, params)
        return job.to_dataframe()

    def query_to_list(
        self,
        sql: str,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Execute query and return results as list of dicts.

        Args:
            sql: SQL query string
            params: Query parameters

        Returns:
            List of row dictionaries
        """
        job = self.query(sql, params)
        return [dict(row) for row in job.result()]

    def query_single_value(
        self,
        sql: str,
        params: dict[str, Any] | None = None,
        default: Any = None,
    ) -> Any:
        """Execute query and return single value.

        Args:
            sql: SQL query that returns single value
            params: Query parameters
            default: Default value if no results

        Returns:
            Single value from first row, first column
        """
        job = self.query(sql, params)
        rows = list(job.result())
        if not rows:
            return default
        return list(rows[0].values())[0]

    # =========================================================================
    # Table Operations
    # =========================================================================

    def table_exists(self, table_name: str) -> bool:
        """Check if table exists.

        Args:
            table_name: Table name

        Returns:
            True if table exists
        """
        table_id = self.get_table_id(table_name)
        try:
            self.client.get_table(table_id)
            return True
        except Exception:
            return False

    def get_row_count(self, table_name: str) -> int:
        """Get row count for a table.

        Args:
            table_name: Table name

        Returns:
            Number of rows
        """
        table_id = self.get_table_id(table_name)
        sql = f"SELECT COUNT(*) as cnt FROM `{table_id}`"
        return self.query_single_value(sql, default=0)

    # =========================================================================
    # Insert Operations
    # =========================================================================

    def insert_rows(
        self,
        table_name: str,
        rows: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Insert rows into table.

        Args:
            table_name: Table name
            rows: List of row dictionaries

        Returns:
            List of errors (empty if success)
        """
        if not rows:
            return []

        table_id = self.get_table_id(table_name)
        errors = self.client.insert_rows_json(table_id, rows)

        if errors:
            logger.error(f"Insert errors for {table_name}: {errors}")

        return errors

    def insert_row(self, table_name: str, row: dict[str, Any]) -> list[dict[str, Any]]:
        """Insert single row into table.

        Args:
            table_name: Table name
            row: Row dictionary

        Returns:
            List of errors (empty if success)
        """
        return self.insert_rows(table_name, [row])

    # =========================================================================
    # Update Operations (via MERGE)
    # =========================================================================

    def upsert_rows(
        self,
        table_name: str,
        rows: list[dict[str, Any]],
        key_columns: list[str],
    ) -> int:
        """Upsert rows using MERGE statement.

        Args:
            table_name: Table name
            rows: List of row dictionaries
            key_columns: Columns to match on

        Returns:
            Number of rows affected
        """
        if not rows:
            return 0

        table_id = self.get_table_id(table_name)

        # Build MERGE statement
        columns = list(rows[0].keys())
        on_clause = " AND ".join([f"T.{k} = S.{k}" for k in key_columns])
        update_clause = ", ".join([f"T.{c} = S.{c}" for c in columns if c not in key_columns])
        insert_columns = ", ".join(columns)
        insert_values = ", ".join([f"S.{c}" for c in columns])

        # Create temporary table from rows
        values_sql = ", ".join([
            "STRUCT(" + ", ".join([
                f"'{v}'" if isinstance(v, str) else str(v) if v is not None else "NULL"
                for v in row.values()
            ]) + ")"
            for row in rows
        ])

        sql = f"""
        MERGE `{table_id}` T
        USING (SELECT * FROM UNNEST([{values_sql}])) S
        ON {on_clause}
        WHEN MATCHED THEN UPDATE SET {update_clause}
        WHEN NOT MATCHED THEN INSERT ({insert_columns}) VALUES ({insert_values})
        """

        job = self.query(sql)
        job.result()  # Wait for completion
        return job.num_dml_affected_rows or 0

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _build_query_params(
        self,
        params: dict[str, Any],
    ) -> list:
        """Build BigQuery query parameters.

        Args:
            params: Dictionary of parameter name -> value

        Returns:
            List of ScalarQueryParameter or ArrayQueryParameter
        """
        bq_params = []
        for name, value in params.items():
            # Handle list/array types
            if isinstance(value, list):
                if not value:
                    # Empty list - default to STRING array
                    bq_params.append(
                        bigquery.ArrayQueryParameter(name, "STRING", [])
                    )
                elif isinstance(value[0], str):
                    bq_params.append(
                        bigquery.ArrayQueryParameter(name, "STRING", value)
                    )
                elif isinstance(value[0], int):
                    bq_params.append(
                        bigquery.ArrayQueryParameter(name, "INT64", value)
                    )
                elif isinstance(value[0], float):
                    bq_params.append(
                        bigquery.ArrayQueryParameter(name, "FLOAT64", value)
                    )
                else:
                    # Default to STRING array
                    bq_params.append(
                        bigquery.ArrayQueryParameter(name, "STRING", [str(v) for v in value])
                    )
            # Handle scalar types
            elif isinstance(value, str):
                bq_params.append(
                    bigquery.ScalarQueryParameter(name, "STRING", value)
                )
            elif isinstance(value, bool):
                # Check bool before int (bool is subclass of int)
                bq_params.append(
                    bigquery.ScalarQueryParameter(name, "BOOL", value)
                )
            elif isinstance(value, int):
                bq_params.append(
                    bigquery.ScalarQueryParameter(name, "INT64", value)
                )
            elif isinstance(value, float):
                bq_params.append(
                    bigquery.ScalarQueryParameter(name, "FLOAT64", value)
                )
            else:
                # Default to STRING
                bq_params.append(
                    bigquery.ScalarQueryParameter(name, "STRING", str(value))
                )
        return bq_params

    def close(self) -> None:
        """Close the client connection."""
        if self._client:
            self._client.close()
            self._client = None


# =============================================================================
# Module-level convenience functions
# =============================================================================

_default_client: BigQueryClient | None = None


def get_bq_client() -> BigQueryClient:
    """Get the default BigQuery client (singleton)."""
    global _default_client
    if _default_client is None:
        _default_client = BigQueryClient()
    return _default_client


def query(sql: str, params: dict[str, Any] | None = None) -> bigquery.QueryJob:
    """Execute a query using the default client."""
    return get_bq_client().query(sql, params)


def query_to_list(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Execute query and return list of dicts."""
    return get_bq_client().query_to_list(sql, params)
