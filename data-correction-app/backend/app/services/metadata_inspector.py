"""
BigQuery 元數據檢查器

動態讀取 INFORMATION_SCHEMA 獲取表結構
"""
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from google.cloud import bigquery

logger = logging.getLogger(__name__)

# BigQuery identifier 白名單驗證
_BQ_PROJECT_PATTERN = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")
_BQ_DATASET_TABLE_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,1023}$")

# 表命名規範識別
FACT_TABLE_PATTERN = re.compile(r"^fact_")
DIM_TABLE_PATTERN = re.compile(r"^dim_")


def _validate_project_id(value: str) -> str:
    """驗證 GCP project ID"""
    if not _BQ_PROJECT_PATTERN.match(value):
        raise ValueError(f"Invalid project_id format: {value!r}")
    return value


def _validate_identifier(value: str, field_name: str) -> str:
    """驗證 BigQuery dataset/table identifier"""
    if not _BQ_DATASET_TABLE_PATTERN.match(value):
        raise ValueError(f"Invalid {field_name} format: {value!r}")
    return value


@dataclass
class ColumnInfo:
    """欄位資訊"""
    name: str
    data_type: str
    ordinal_position: int
    is_nullable: bool = True


@dataclass
class TableInfo:
    """表格資訊"""
    name: str
    row_count: int
    columns: List[ColumnInfo] = field(default_factory=list)

    @property
    def is_fact(self) -> bool:
        """是否為事實表（以 fact_ 開頭）"""
        return bool(FACT_TABLE_PATTERN.match(self.name))

    @property
    def is_dim(self) -> bool:
        """是否為維度表（以 dim_ 開頭）"""
        return bool(DIM_TABLE_PATTERN.match(self.name))


@dataclass
class SchemaMetadata:
    """Schema 元數據"""
    fact_tables: Dict[str, TableInfo]
    dim_tables: Dict[str, TableInfo]
    other_tables: Dict[str, TableInfo]
    fetched_at: float  # Unix timestamp

    @property
    def total_tables(self) -> int:
        """星狀模型表格總數（事實表 + 維度表）"""
        return len(self.fact_tables) + len(self.dim_tables)

    @property
    def age_seconds(self) -> float:
        """快取年齡（秒）"""
        return time.time() - self.fetched_at


class MetadataInspector:
    """BigQuery 元數據檢查器"""

    def __init__(
        self,
        client: bigquery.Client,
        project_id: str,
        dataset: str,
    ):
        """
        初始化檢查器

        Args:
            client: BigQuery 客戶端
            project_id: GCP 專案 ID（已驗證）
            dataset: 資料集名稱（已驗證）
        """
        self.client = client
        self.project_id = _validate_project_id(project_id)
        self.dataset = _validate_identifier(dataset, "dataset")

    def fetch_tables(self, star_schema_only: bool = True) -> List[TableInfo]:
        """
        從 __TABLES__ 系統表獲取表格

        使用 __TABLES__ 而非 INFORMATION_SCHEMA.TABLES，
        因為 __TABLES__ 提供 row_count 欄位。

        Args:
            star_schema_only: 只獲取星狀模型表（fact_* 和 dim_*）

        Returns:
            表格列表（含行數）
        """
        # 使用 __TABLES__ 系統表獲取表名和行數
        # 只查詢星狀模型表，減少不必要的數據
        if star_schema_only:
            query = f"""
                SELECT
                    table_id as table_name,
                    IFNULL(row_count, 0) as row_count
                FROM `{self.project_id}.{self.dataset}.__TABLES__`
                WHERE type = 1
                  AND (STARTS_WITH(table_id, 'fact_') OR STARTS_WITH(table_id, 'dim_'))
                ORDER BY table_id
            """
        else:
            query = f"""
                SELECT
                    table_id as table_name,
                    IFNULL(row_count, 0) as row_count
                FROM `{self.project_id}.{self.dataset}.__TABLES__`
                WHERE type = 1
                ORDER BY table_id
            """

        tables = []
        try:
            result = self.client.query(query).result()
            for row in result:
                tables.append(TableInfo(
                    name=row.table_name,
                    row_count=row.row_count or 0,
                ))
            logger.info(f"從 __TABLES__ 獲取 {len(tables)} 個表格")
        except Exception as e:
            logger.error(f"查詢 __TABLES__ 失敗: {e}")
            raise

        return tables

    def fetch_columns(self, table_name: str) -> List[ColumnInfo]:
        """
        獲取單一表格欄位資訊（已棄用，請使用 fetch_columns_batch）

        Args:
            table_name: 表格名稱

        Returns:
            欄位列表
        """
        # 驗證表名
        validated_table = _validate_identifier(table_name, "table_name")

        query = f"""
            SELECT
                column_name,
                data_type,
                ordinal_position,
                is_nullable
            FROM `{self.project_id}.{self.dataset}.INFORMATION_SCHEMA.COLUMNS`
            WHERE table_schema = '{self.dataset}'
              AND table_name = @table_name
            ORDER BY ordinal_position
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("table_name", "STRING", validated_table),
            ]
        )

        columns = []
        try:
            result = self.client.query(query, job_config=job_config).result()
            for row in result:
                columns.append(ColumnInfo(
                    name=row.column_name,
                    data_type=row.data_type,
                    ordinal_position=row.ordinal_position,
                    is_nullable=row.is_nullable == 'YES',
                ))
        except Exception as e:
            logger.warning(f"查詢欄位失敗 ({table_name}): {e}")

        return columns

    def fetch_columns_batch(self, table_names: List[str]) -> Dict[str, List[ColumnInfo]]:
        """
        批次獲取多個表格的欄位資訊（單一查詢，解決 N+1 問題）

        Args:
            table_names: 表格名稱列表

        Returns:
            {table_name: [ColumnInfo, ...]} 字典
        """
        if not table_names:
            return {}

        # 驗證所有表名
        for name in table_names:
            _validate_identifier(name, "table_name")

        # 使用單一查詢獲取所有表的欄位
        # 使用 STARTS_WITH 函數篩選星狀模型表
        query = f"""
            SELECT
                table_name,
                column_name,
                data_type,
                ordinal_position,
                is_nullable
            FROM `{self.project_id}.{self.dataset}.INFORMATION_SCHEMA.COLUMNS`
            WHERE table_schema = '{self.dataset}'
              AND (STARTS_WITH(table_name, 'fact_') OR STARTS_WITH(table_name, 'dim_'))
            ORDER BY table_name, ordinal_position
        """

        columns_by_table: Dict[str, List[ColumnInfo]] = {name: [] for name in table_names}

        try:
            result = self.client.query(query).result()
            for row in result:
                table_name = row.table_name
                if table_name in columns_by_table:
                    columns_by_table[table_name].append(ColumnInfo(
                        name=row.column_name,
                        data_type=row.data_type,
                        ordinal_position=row.ordinal_position,
                        is_nullable=row.is_nullable == 'YES',
                    ))
            logger.info(f"批次獲取 {len(table_names)} 個表的欄位資訊")
        except Exception as e:
            logger.error(f"批次查詢欄位失敗: {e}")
            raise

        return columns_by_table

    def fetch_all_metadata(self, include_columns: bool = False) -> SchemaMetadata:
        """
        獲取完整 Schema 元數據

        優化：使用批次查詢減少 BigQuery 請求次數
        - 只查詢星狀模型表（fact_* 和 dim_*）
        - 使用單一查詢獲取所有表的欄位

        Args:
            include_columns: 是否包含欄位詳情

        Returns:
            SchemaMetadata
        """
        # 只獲取星狀模型表（減少查詢範圍）
        tables = self.fetch_tables(star_schema_only=True)

        fact_tables: Dict[str, TableInfo] = {}
        dim_tables: Dict[str, TableInfo] = {}
        other_tables: Dict[str, TableInfo] = {}

        # 先分類表格
        for table in tables:
            if table.is_fact:
                fact_tables[table.name] = table
            elif table.is_dim:
                dim_tables[table.name] = table
            else:
                other_tables[table.name] = table

        # 批次獲取欄位（單一查詢，解決 N+1 問題）
        if include_columns:
            all_table_names = list(fact_tables.keys()) + list(dim_tables.keys())
            columns_by_table = self.fetch_columns_batch(all_table_names)

            # 將欄位分配到各表
            for name, table in fact_tables.items():
                table.columns = columns_by_table.get(name, [])
            for name, table in dim_tables.items():
                table.columns = columns_by_table.get(name, [])

        metadata = SchemaMetadata(
            fact_tables=fact_tables,
            dim_tables=dim_tables,
            other_tables=other_tables,
            fetched_at=time.time(),
        )

        logger.info(
            f"Schema 元數據已獲取: "
            f"{len(fact_tables)} 事實表, "
            f"{len(dim_tables)} 維度表"
        )

        return metadata
