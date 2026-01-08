"""
Ragic ERP Backup System v2 - BigQuery 上傳模組
"""
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

from google.cloud import bigquery

from .config import BIGQUERY_CONFIG, SHEET_CONFIG

logger = logging.getLogger(__name__)


class BigQueryUploader:
    """BigQuery 上傳器"""

    def __init__(self):
        self.client = bigquery.Client(project=BIGQUERY_CONFIG['project_id'])
        self.dataset = BIGQUERY_CONFIG['dataset']
        self.project = BIGQUERY_CONFIG['project_id']

    def _get_table_id(self, table_name: str) -> str:
        """取得完整的表格 ID"""
        return f"{self.project}.{self.dataset}.{table_name}"

    def get_last_backup_time(self, sheet_code: str) -> Optional[datetime]:
        """取得指定表格的最後備份時間"""
        query = f"""
        SELECT last_record_time
        FROM `{self._get_table_id('backup_status')}`
        WHERE sheet_code = @sheet_code
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("sheet_code", "STRING", sheet_code)
            ]
        )

        try:
            result = self.client.query(query, job_config=job_config).result()
            for row in result:
                return row.last_record_time
        except Exception as e:
            logger.error(f"Error getting last backup time for {sheet_code}: {e}")

        return None

    def upload_records(
        self,
        records: List[Dict[str, Any]],
        sheet_code: str
    ) -> Tuple[int, int]:
        """
        上傳記錄到 BigQuery

        使用 MERGE 策略：存在則更新，不存在則新增

        Returns:
            (inserted_count, updated_count)
        """
        config = SHEET_CONFIG.get(sheet_code)
        if not config:
            raise ValueError(f"Unknown sheet code: {sheet_code}")

        table_name = config['bq_table']

        if not records:
            logger.info(f"No records to upload for {sheet_code}")
            return 0, 0

        # 準備資料
        rows = []
        for record in records:
            row = self._prepare_row(record, sheet_code, config)
            rows.append(row)

        # 建立臨時表並執行 MERGE
        inserted, updated = self._merge_records(rows, table_name)

        logger.info(
            f"Uploaded to {table_name}: "
            f"{inserted} inserted, {updated} updated"
        )

        return inserted, updated

    def _prepare_row(
        self,
        record: Dict[str, Any],
        sheet_code: str,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """準備單筆資料行"""
        ragic_id = record.get('_ragicId', '')

        # 提取關鍵欄位
        key_fields = config.get('key_fields', {})
        row = {
            'ragic_id': ragic_id,
            'data': json.dumps(record, ensure_ascii=False),
            'status': record.get(config.get('status_field', ''), ''),
            'backup_time': datetime.utcnow().isoformat(),
        }

        # 提取 Ragic 時間戳
        if '_ragicCreatedTime' in record:
            try:
                row['ragic_created'] = self._parse_timestamp(
                    record['_ragicCreatedTime']
                )
            except Exception:
                pass

        if '_ragicModifiedTime' in record:
            try:
                row['ragic_modified'] = self._parse_timestamp(
                    record['_ragicModifiedTime']
                )
            except Exception:
                pass

        # 根據表格類型提取特定欄位
        date_fields = {'start_date', 'end_date', 'order_date'}
        numeric_fields = {'price', 'order_amount', 'quantity', 'unit_price'}

        for field_name, field_id in key_fields.items():
            value = record.get(field_id, '')
            if isinstance(value, str):
                value = value.strip()

            # 處理日期欄位：空值轉為 None
            if field_name in date_fields:
                if not value:
                    value = None
                else:
                    # 嘗試轉換日期格式
                    parsed = self._parse_date(value)
                    value = parsed if parsed else None
            # 處理數值欄位：空值轉為 None
            elif field_name in numeric_fields:
                if not value:
                    value = None
                else:
                    try:
                        # 嘗試轉換為浮點數
                        value = float(str(value).replace(',', ''))
                    except (ValueError, TypeError):
                        value = None

            row[field_name] = value

        return row

    def _parse_date(self, date_str: str) -> Optional[str]:
        """解析日期字串為 YYYY-MM-DD 格式"""
        if not date_str:
            return None

        for fmt in [
            '%Y/%m/%d',
            '%Y-%m-%d',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d %H:%M:%S',
        ]:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue

        return None

    def _parse_timestamp(self, ts_value: Any) -> Optional[str]:
        """解析時間戳"""
        if not ts_value:
            return None

        if isinstance(ts_value, (int, float)):
            # Unix timestamp (毫秒)
            dt = datetime.fromtimestamp(ts_value / 1000)
            return dt.isoformat()

        if isinstance(ts_value, str):
            # 嘗試解析日期字串
            for fmt in [
                '%Y/%m/%d %H:%M:%S',
                '%Y-%m-%d %H:%M:%S',
                '%Y/%m/%d',
                '%Y-%m-%d',
            ]:
                try:
                    dt = datetime.strptime(ts_value, fmt)
                    return dt.isoformat()
                except ValueError:
                    continue

        return None

    def _merge_records(
        self,
        rows: List[Dict[str, Any]],
        table_name: str
    ) -> Tuple[int, int]:
        """使用 MERGE 策略上傳資料"""
        if not rows:
            return 0, 0

        # 先查詢現有的 ragic_id
        existing_ids = self._get_existing_ids(table_name)

        # 分類新增和更新
        to_insert = []
        to_update = []

        for row in rows:
            if row['ragic_id'] in existing_ids:
                to_update.append(row)
            else:
                to_insert.append(row)

        # 執行新增
        if to_insert:
            self._insert_rows(to_insert, table_name)

        # 執行更新
        if to_update:
            self._update_rows(to_update, table_name)

        return len(to_insert), len(to_update)

    def _get_existing_ids(self, table_name: str) -> set:
        """取得表格中現有的所有 ragic_id"""
        query = f"""
        SELECT DISTINCT ragic_id
        FROM `{self._get_table_id(table_name)}`
        """
        try:
            result = self.client.query(query).result()
            return {row.ragic_id for row in result}
        except Exception as e:
            logger.warning(f"Error getting existing IDs: {e}")
            return set()

    def _insert_rows(self, rows: List[Dict[str, Any]], table_name: str):
        """批次新增資料（支援大量資料分批上傳）"""
        table_id = self._get_table_id(table_name)
        batch_size = 500  # BigQuery streaming insert 建議每批次 500 筆

        total_inserted = 0
        total_errors = 0

        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            errors = self.client.insert_rows_json(table_id, batch)

            if errors:
                logger.error(f"Insert errors in batch {i//batch_size + 1}: {errors[:3]}")
                total_errors += len(errors)
            else:
                total_inserted += len(batch)

            if (i + batch_size) % 5000 == 0:
                logger.info(f"Progress: {i + batch_size} / {len(rows)} rows processed")

        if total_errors > 0:
            logger.error(f"Total insert errors: {total_errors} rows failed")
            raise RuntimeError(f"Failed to insert {total_errors} rows")

        logger.info(f"Successfully inserted {total_inserted} rows in {(len(rows) + batch_size - 1) // batch_size} batches")

    def _update_rows(self, rows: List[Dict[str, Any]], table_name: str):
        """批次更新資料"""
        # 使用 DML UPDATE 語句
        update_count = 0
        skipped_count = 0

        for row in rows:
            try:
                self._update_single_row(row, table_name)
                update_count += 1
            except Exception as e:
                error_msg = str(e)
                if 'streaming buffer' in error_msg.lower():
                    # Streaming buffer 問題，跳過此筆，下次備份時會更新
                    skipped_count += 1
                    if skipped_count == 1:
                        logger.warning(
                            f"Skipping updates due to streaming buffer "
                            f"(will retry in next backup)"
                        )
                else:
                    raise

        if skipped_count > 0:
            logger.warning(
                f"Updated {update_count} rows, skipped {skipped_count} "
                f"(streaming buffer)"
            )

    def _update_single_row(self, row: Dict[str, Any], table_name: str):
        """更新單筆資料"""
        # 建構 UPDATE 語句
        set_clauses = []
        params = [
            bigquery.ScalarQueryParameter("ragic_id", "STRING", row['ragic_id'])
        ]

        param_idx = 0
        for key, value in row.items():
            if key == 'ragic_id':
                continue
            param_name = f"p{param_idx}"
            set_clauses.append(f"{key} = @{param_name}")

            if value is None:
                params.append(bigquery.ScalarQueryParameter(param_name, "STRING", None))
            elif isinstance(value, (int, float)):
                params.append(bigquery.ScalarQueryParameter(param_name, "FLOAT64", value))
            else:
                params.append(bigquery.ScalarQueryParameter(param_name, "STRING", str(value)))

            param_idx += 1

        query = f"""
        UPDATE `{self._get_table_id(table_name)}`
        SET {', '.join(set_clauses)}
        WHERE ragic_id = @ragic_id
        """

        job_config = bigquery.QueryJobConfig(query_parameters=params)
        self.client.query(query, job_config=job_config).result()

    def update_backup_status(
        self,
        sheet_code: str,
        total_records: int,
        last_fetch_count: int,
        last_record_time: Optional[datetime] = None
    ):
        """更新備份狀態表"""
        query = f"""
        UPDATE `{self._get_table_id('backup_status')}`
        SET
            last_backup_time = CURRENT_TIMESTAMP(),
            last_record_time = @last_record_time,
            total_records = @total_records,
            last_fetch_count = @last_fetch_count,
            updated_at = CURRENT_TIMESTAMP()
        WHERE sheet_code = @sheet_code
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("sheet_code", "STRING", sheet_code),
                bigquery.ScalarQueryParameter("total_records", "INT64", total_records),
                bigquery.ScalarQueryParameter("last_fetch_count", "INT64", last_fetch_count),
                bigquery.ScalarQueryParameter(
                    "last_record_time",
                    "TIMESTAMP",
                    last_record_time.isoformat() if last_record_time else None
                ),
            ]
        )

        self.client.query(query, job_config=job_config).result()
        logger.info(f"Updated backup_status for sheet {sheet_code}")

    def write_backup_log(
        self,
        sheet_code: str,
        sheet_name: str,
        records_fetched: int,
        records_inserted: int,
        records_updated: int,
        records_filtered: int,
        status: str,
        duration_seconds: float,
        error_message: Optional[str] = None
    ):
        """寫入備份日誌"""
        log_id = str(uuid.uuid4())
        now = datetime.utcnow()

        row = {
            'id': log_id,
            'backup_date': now.strftime('%Y-%m-%d'),
            'backup_time': now.isoformat(),
            'sheet_code': sheet_code,
            'sheet_name': sheet_name,
            'records_fetched': records_fetched,
            'records_inserted': records_inserted,
            'records_updated': records_updated,
            'records_filtered': records_filtered,
            'status': status,
            'error_message': error_message,
            'duration_seconds': duration_seconds,
            'created_at': now.isoformat(),
        }

        table_id = self._get_table_id('backup_logs')
        errors = self.client.insert_rows_json(table_id, [row])

        if errors:
            logger.error(f"Failed to write backup log: {errors}")
        else:
            logger.info(f"Wrote backup log for sheet {sheet_code}: {status}")

    def get_total_records(self, table_name: str) -> int:
        """取得表格的總記錄數"""
        query = f"""
        SELECT COUNT(*) as cnt
        FROM `{self._get_table_id(table_name)}`
        """
        try:
            result = self.client.query(query).result()
            for row in result:
                return row.cnt
        except Exception:
            pass
        return 0
