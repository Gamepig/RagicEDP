"""
星狀模型 ETL 腳本

將清洗完成的備份表格 (sheet_*) 轉換為星狀模型 (dim_*, fact_*)

資料流程:
    Ragic API → sheet_* (備份) → 清洗 → dim_*/fact_* (星狀模型)

Author: RagicEDP Team
Version: 1.0.0
Date: 2026-01-08
"""

import os
import logging
from datetime import datetime, date, timezone
from typing import Dict, List, Any, Optional
from google.cloud import bigquery
from google.api_core.exceptions import GoogleAPIError

from ..config import now_taipei

logger = logging.getLogger(__name__)

# 來源表格對照 (清洗後的備份表格)
SOURCE_TABLES = {
    '10': 'sheet_10_brand',
    '20': 'sheet_20_channel',
    '30': 'sheet_30_payment',
    '40': 'sheet_40_logistics',
    '41': 'sheet_41_zipcode',
    '50': 'sheet_50_order',
    '60': 'sheet_60_customer',
    '70': 'sheet_70_product',
    '80': 'sheet_80_campaign',
    '99': 'sheet_99_order_detail',
}

# 目標星狀模型表格
TARGET_TABLES = {
    'dim_brand': '10',
    'dim_channel': '20',
    'dim_payment': '30',
    'dim_logistics': '40',
    'dim_postal': '41',
    'dim_customer': '60',
    'dim_product': '70',
    'dim_campaign': '80',
    'fact_orders': '50',
    'fact_order_details': '99',
}

# ETL 處理順序 (維度表優先，事實表最後)
ETL_ORDER = [
    'dim_brand',
    'dim_payment',
    'dim_logistics',
    'dim_postal',
    'dim_channel',
    'dim_product',
    'dim_campaign',
    'dim_customer',
    'fact_orders',
    'fact_order_details',
]


class StarSchemaETL:
    """星狀模型 ETL 處理器"""

    def __init__(
        self,
        project_id: str,
        source_dataset: str,
        target_dataset: str,
        bq_client: Optional[bigquery.Client] = None,
    ):
        """
        初始化 ETL 處理器

        Args:
            project_id: GCP 專案 ID
            source_dataset: 來源資料集 (清洗後的備份表格)
            target_dataset: 目標資料集 (星狀模型)
            bq_client: BigQuery 客戶端 (可選)
        """
        self.project_id = project_id
        self.source_dataset = source_dataset
        self.target_dataset = target_dataset
        self.bq_client = bq_client or bigquery.Client(project=project_id)

    def run_full_etl(self, create_tables: bool = True) -> Dict[str, Any]:
        """
        執行完整 ETL 流程

        Args:
            create_tables: 是否自動建立目標表格

        Returns:
            ETL 執行結果
        """
        import time
        start_time = time.time()

        logger.info("=" * 60)
        logger.info("Star Schema ETL - Starting Full ETL")
        logger.info("=" * 60)

        results = {
            'start_time': now_taipei().isoformat(),
            'tables': {},
            'total_rows': 0,
            'errors': [],
        }

        # 建立目標表格 (如果需要)
        if create_tables:
            self._ensure_target_tables()

        # 依序處理各表
        for target_table in ETL_ORDER:
            try:
                table_result = self._process_table(target_table)
                results['tables'][target_table] = table_result
                results['total_rows'] += table_result.get('rows_affected', 0)
            except Exception as e:
                logger.error(f"ETL 處理 {target_table} 失敗: {e}")
                results['tables'][target_table] = {'status': 'failed', 'error': str(e)}
                results['errors'].append(f"{target_table}: {e}")

        results['duration_seconds'] = round(time.time() - start_time, 2)
        results['end_time'] = now_taipei().isoformat()

        logger.info("=" * 60)
        logger.info(f"ETL 完成: {results['total_rows']} 筆，耗時 {results['duration_seconds']} 秒")
        logger.info("=" * 60)

        return results

    def run_incremental_etl(self, since_date: Optional[date] = None) -> Dict[str, Any]:
        """
        執行增量 ETL (只處理清洗完成的新資料)

        Args:
            since_date: 起始日期 (預設為今天)

        Returns:
            ETL 執行結果
        """
        import time
        start_time = time.time()

        if since_date is None:
            since_date = date.today()

        logger.info("=" * 60)
        logger.info(f"Star Schema ETL - Incremental ETL since {since_date}")
        logger.info("=" * 60)

        results = {
            'start_time': now_taipei().isoformat(),
            'since_date': since_date.isoformat(),
            'tables': {},
            'total_rows': 0,
            'errors': [],
        }

        # 依序處理各表
        for target_table in ETL_ORDER:
            try:
                table_result = self._process_table_incremental(target_table, since_date)
                results['tables'][target_table] = table_result
                results['total_rows'] += table_result.get('rows_affected', 0)
            except Exception as e:
                logger.error(f"增量 ETL 處理 {target_table} 失敗: {e}")
                results['tables'][target_table] = {'status': 'failed', 'error': str(e)}
                results['errors'].append(f"{target_table}: {e}")

        results['duration_seconds'] = round(time.time() - start_time, 2)
        results['end_time'] = now_taipei().isoformat()

        logger.info("=" * 60)
        logger.info(f"增量 ETL 完成: {results['total_rows']} 筆，耗時 {results['duration_seconds']} 秒")
        logger.info("=" * 60)

        return results

    def _process_table(self, target_table: str) -> Dict[str, Any]:
        """處理單一目標表格 (完整載入)"""
        source_code = TARGET_TABLES.get(target_table)
        source_table = SOURCE_TABLES.get(source_code)

        if not source_table:
            return {'status': 'skipped', 'reason': 'no_source_mapping'}

        logger.info(f"處理 {target_table} (來源: {source_table})")

        # 取得轉換 SQL
        transform_sql = self._get_transform_sql(target_table, source_table)

        # 執行 MERGE 或 INSERT
        target_ref = f"`{self.project_id}.{self.target_dataset}.{target_table}`"

        # 使用 MERGE 來處理 upsert
        merge_sql = self._get_merge_sql(target_table, source_table, transform_sql)

        try:
            query_job = self.bq_client.query(merge_sql)
            query_job.result()

            rows_affected = query_job.num_dml_affected_rows or 0
            logger.info(f"{target_table}: {rows_affected} 筆受影響")

            return {
                'status': 'success',
                'rows_affected': rows_affected,
                'job_id': query_job.job_id,
            }
        except GoogleAPIError as e:
            logger.error(f"執行 {target_table} ETL 失敗: {e}")
            raise

    def _process_table_incremental(self, target_table: str, since_date: date) -> Dict[str, Any]:
        """處理單一目標表格 (增量載入)"""
        source_code = TARGET_TABLES.get(target_table)
        source_table = SOURCE_TABLES.get(source_code)

        if not source_table:
            return {'status': 'skipped', 'reason': 'no_source_mapping'}

        logger.info(f"增量處理 {target_table} (來源: {source_table}, 日期: {since_date})")

        # 取得轉換 SQL (含日期過濾)
        transform_sql = self._get_transform_sql(target_table, source_table, since_date)

        # 使用 MERGE 來處理 upsert
        merge_sql = self._get_merge_sql(target_table, source_table, transform_sql, since_date)

        try:
            query_job = self.bq_client.query(merge_sql)
            query_job.result()

            rows_affected = query_job.num_dml_affected_rows or 0
            logger.info(f"{target_table}: {rows_affected} 筆受影響")

            return {
                'status': 'success',
                'rows_affected': rows_affected,
                'job_id': query_job.job_id,
            }
        except GoogleAPIError as e:
            logger.error(f"執行 {target_table} 增量 ETL 失敗: {e}")
            raise

    def _get_transform_sql(
        self,
        target_table: str,
        source_table: str,
        since_date: Optional[date] = None
    ) -> str:
        """
        取得各表格的轉換 SQL

        Args:
            target_table: 目標表格名稱
            source_table: 來源表格名稱
            since_date: 增量日期過濾 (可選)

        Returns:
            SELECT SQL 語句
        """
        source_ref = f"`{self.project_id}.{self.source_dataset}.{source_table}`"

        # 日期過濾條件
        date_filter = ""
        if since_date:
            date_filter = f"AND DATE(backup_time) >= '{since_date.isoformat()}'"

        # 清洗完成過濾 (只處理 completed, auto_fixed, ai_fixed 狀態)
        cleaning_filter = "AND cleaning_status IN ('completed', 'auto_fixed', 'ai_fixed')"

        # 各表格的轉換邏輯
        transforms = {
            'dim_brand': f"""
                SELECT
                    ragic_id,
                    brand_code,
                    brand_name,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,

            'dim_channel': f"""
                SELECT
                    ragic_id,
                    channel_code,
                    channel_name,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,

            'dim_payment': f"""
                SELECT
                    ragic_id,
                    payment_code,
                    payment_name,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,

            'dim_logistics': f"""
                SELECT
                    ragic_id,
                    logistics_code,
                    logistics_name,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,

            'dim_postal': f"""
                SELECT
                    ragic_id,
                    zipcode,
                    city,
                    district,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,

            'dim_customer': f"""
                SELECT
                    ragic_id,
                    customer_code,
                    customer_name,
                    phone,
                    email,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,

            'dim_product': f"""
                SELECT
                    ragic_id,
                    product_code,
                    product_name,
                    price,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,

            'dim_campaign': f"""
                SELECT
                    ragic_id,
                    campaign_code,
                    campaign_name,
                    start_date,
                    end_date,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,

            'fact_orders': f"""
                SELECT
                    ragic_id,
                    order_code,
                    customer_code,
                    order_date,
                    order_amount,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,

            'fact_order_details': f"""
                SELECT
                    ragic_id,
                    order_code,
                    product_code,
                    CAST(quantity AS INT64) AS quantity,
                    unit_price,
                    order_amount AS subtotal,
                    status,
                    ragic_created,
                    ragic_modified,
                    backup_time AS etl_loaded_at,
                    CURRENT_TIMESTAMP() AS etl_updated_at
                FROM {source_ref}
                WHERE 1=1 {cleaning_filter} {date_filter}
            """,
        }

        return transforms.get(target_table, f"SELECT * FROM {source_ref}")

    def _get_merge_sql(
        self,
        target_table: str,
        source_table: str,
        transform_sql: str,
        since_date: Optional[date] = None
    ) -> str:
        """
        取得 MERGE SQL 語句

        Args:
            target_table: 目標表格名稱
            source_table: 來源表格名稱
            transform_sql: 轉換 SQL
            since_date: 增量日期 (可選)

        Returns:
            MERGE SQL 語句
        """
        target_ref = f"`{self.project_id}.{self.target_dataset}.{target_table}`"

        # 各表的主鍵與更新欄位
        merge_configs = {
            'dim_brand': {
                'key': 'ragic_id',
                'update_cols': ['brand_code', 'brand_name', 'status', 'ragic_modified', 'etl_updated_at'],
            },
            'dim_channel': {
                'key': 'ragic_id',
                'update_cols': ['channel_code', 'channel_name', 'status', 'ragic_modified', 'etl_updated_at'],
            },
            'dim_payment': {
                'key': 'ragic_id',
                'update_cols': ['payment_code', 'payment_name', 'status', 'ragic_modified', 'etl_updated_at'],
            },
            'dim_logistics': {
                'key': 'ragic_id',
                'update_cols': ['logistics_code', 'logistics_name', 'status', 'ragic_modified', 'etl_updated_at'],
            },
            'dim_postal': {
                'key': 'ragic_id',
                'update_cols': ['zipcode', 'city', 'district', 'status', 'ragic_modified', 'etl_updated_at'],
            },
            'dim_customer': {
                'key': 'ragic_id',
                'update_cols': ['customer_code', 'customer_name', 'phone', 'email', 'status', 'ragic_modified', 'etl_updated_at'],
            },
            'dim_product': {
                'key': 'ragic_id',
                'update_cols': ['product_code', 'product_name', 'price', 'status', 'ragic_modified', 'etl_updated_at'],
            },
            'dim_campaign': {
                'key': 'ragic_id',
                'update_cols': ['campaign_code', 'campaign_name', 'start_date', 'end_date', 'status', 'ragic_modified', 'etl_updated_at'],
            },
            'fact_orders': {
                'key': 'ragic_id',
                'update_cols': ['order_code', 'customer_code', 'order_date', 'order_amount', 'status', 'ragic_modified', 'etl_updated_at'],
            },
            'fact_order_details': {
                'key': 'ragic_id',
                'update_cols': ['order_code', 'product_code', 'quantity', 'unit_price', 'subtotal', 'status', 'ragic_modified', 'etl_updated_at'],
            },
        }

        config = merge_configs.get(target_table, {'key': 'ragic_id', 'update_cols': []})
        key_col = config['key']
        update_cols = config['update_cols']

        # 建立 UPDATE SET 子句
        update_set = ', '.join([f"T.{col} = S.{col}" for col in update_cols])

        merge_sql = f"""
            MERGE {target_ref} AS T
            USING (
                {transform_sql}
            ) AS S
            ON T.{key_col} = S.{key_col}
            WHEN MATCHED THEN
                UPDATE SET {update_set}
            WHEN NOT MATCHED THEN
                INSERT ROW
        """

        return merge_sql

    def _ensure_target_tables(self) -> None:
        """確保目標表格存在"""
        logger.info("檢查並建立目標表格...")

        for target_table in ETL_ORDER:
            self._create_target_table_if_not_exists(target_table)

    def _create_target_table_if_not_exists(self, target_table: str) -> None:
        """建立目標表格 (如果不存在)"""
        table_ref = f"{self.project_id}.{self.target_dataset}.{target_table}"

        # 各表的 schema 定義
        schemas = {
            'dim_brand': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("brand_code", "STRING"),
                bigquery.SchemaField("brand_name", "STRING"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
            'dim_channel': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("channel_code", "STRING"),
                bigquery.SchemaField("channel_name", "STRING"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
            'dim_payment': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("payment_code", "STRING"),
                bigquery.SchemaField("payment_name", "STRING"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
            'dim_logistics': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("logistics_code", "STRING"),
                bigquery.SchemaField("logistics_name", "STRING"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
            'dim_postal': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("zipcode", "STRING"),
                bigquery.SchemaField("city", "STRING"),
                bigquery.SchemaField("district", "STRING"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
            'dim_customer': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("customer_code", "STRING"),
                bigquery.SchemaField("customer_name", "STRING"),
                bigquery.SchemaField("phone", "STRING"),
                bigquery.SchemaField("email", "STRING"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
            'dim_product': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("product_code", "STRING"),
                bigquery.SchemaField("product_name", "STRING"),
                bigquery.SchemaField("price", "FLOAT"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
            'dim_campaign': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("campaign_code", "STRING"),
                bigquery.SchemaField("campaign_name", "STRING"),
                bigquery.SchemaField("start_date", "DATE"),
                bigquery.SchemaField("end_date", "DATE"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
            'fact_orders': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("order_code", "STRING"),
                bigquery.SchemaField("customer_code", "STRING"),
                bigquery.SchemaField("order_date", "DATE"),
                bigquery.SchemaField("order_amount", "FLOAT"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
            'fact_order_details': [
                bigquery.SchemaField("ragic_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("order_code", "STRING"),
                bigquery.SchemaField("product_code", "STRING"),
                bigquery.SchemaField("quantity", "INTEGER"),
                bigquery.SchemaField("unit_price", "FLOAT"),
                bigquery.SchemaField("subtotal", "FLOAT"),
                bigquery.SchemaField("status", "STRING"),
                bigquery.SchemaField("ragic_created", "TIMESTAMP"),
                bigquery.SchemaField("ragic_modified", "TIMESTAMP"),
                bigquery.SchemaField("etl_loaded_at", "TIMESTAMP"),
                bigquery.SchemaField("etl_updated_at", "TIMESTAMP"),
            ],
        }

        schema = schemas.get(target_table)
        if not schema:
            logger.warning(f"未定義 {target_table} 的 schema")
            return

        table = bigquery.Table(table_ref, schema=schema)

        try:
            self.bq_client.get_table(table_ref)
            logger.info(f"表格 {target_table} 已存在")
        except Exception:
            # 表格不存在，建立它
            table = self.bq_client.create_table(table)
            logger.info(f"已建立表格 {target_table}")


def run_star_schema_etl(
    mode: str = 'incremental',
    since_date: Optional[date] = None,
    create_tables: bool = True,
) -> Dict[str, Any]:
    """
    執行星狀模型 ETL 的便捷函數

    Args:
        mode: 執行模式 ('full' 或 'incremental')
        since_date: 增量模式的起始日期
        create_tables: 是否自動建立表格

    Returns:
        ETL 執行結果
    """
    project_id = os.getenv('GCP_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT')
    dataset = os.getenv('BQ_DATASET', 'erp_backup')

    if not project_id:
        raise ValueError("GCP_PROJECT_ID 環境變數未設定")

    etl = StarSchemaETL(
        project_id=project_id,
        source_dataset=dataset,
        target_dataset=dataset,  # 使用同一個 dataset
    )

    if mode == 'full':
        return etl.run_full_etl(create_tables=create_tables)
    else:
        return etl.run_incremental_etl(since_date=since_date)


# CLI 入口點
if __name__ == '__main__':
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    parser = argparse.ArgumentParser(description='Star Schema ETL')
    parser.add_argument('--mode', choices=['full', 'incremental'], default='incremental',
                        help='ETL 模式 (full: 完整載入, incremental: 增量載入)')
    parser.add_argument('--since', type=str, help='增量載入起始日期 (YYYY-MM-DD)')
    parser.add_argument('--create-tables', action='store_true', help='自動建立目標表格')

    args = parser.parse_args()

    since_date = None
    if args.since:
        since_date = datetime.strptime(args.since, '%Y-%m-%d').date()

    result = run_star_schema_etl(
        mode=args.mode,
        since_date=since_date,
        create_tables=args.create_tables,
    )

    import json
    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
