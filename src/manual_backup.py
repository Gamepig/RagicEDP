"""
Ragic 手動備份程式

功能：
1. 全量備份：抓取所有資料
2. 指定日期備份：從指定日期 00:00 開始抓取

預設行為：
- 備份全部表格至本地 JSON
- 可選 --to-bq 上傳至 BigQuery（需搭配 --sheet）

使用範例：
    # 全量備份所有表格 → 本地 JSON
    uv run python -m src.manual_backup --full

    # 指定日期備份 → 本地 JSON
    uv run python -m src.manual_backup --date 2025-01-01

    # 全量備份單一表格 → 上傳 BQ
    uv run python -m src.manual_backup --full --sheet 99 --to-bq

    # 指定日期 + 單一表格 → 上傳 BQ
    uv run python -m src.manual_backup --date 2025-01-01 --sheet 50 --to-bq
"""
import argparse
import json
import logging
import os
import time
import uuid
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import pytz

# 載入環境變數（必須在 import config 之前）
from dotenv import load_dotenv
load_dotenv(override=True)

from google.cloud import bigquery

# 重新讀取配置（確保使用最新的環境變數）
from .config import RAGIC_CONFIG, SHEET_CONFIG, BIGQUERY_CONFIG

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 時區設定
TZ = pytz.timezone('Asia/Taipei')


class ManualBackup:
    """手動備份執行器"""

    # 分頁設定
    PAGE_SIZE = 1000
    MAX_PAGES = 200

    def __init__(
        self,
        mode: str = 'incremental',
        base_date: Optional[str] = None,
        to_bq: bool = False,
        output_dir: str = './data/manual_backup'
    ):
        """
        初始化

        Args:
            mode: 'full' 全量 | 'incremental' 增量
            base_date: 起始日期 (YYYY-MM-DD)，None 時使用昨天 00:00
            to_bq: 是否上傳至 BigQuery
            output_dir: 本地輸出目錄
        """
        self.mode = mode
        self.base_date = base_date
        self.to_bq = to_bq
        self.output_dir = Path(output_dir)

        # 計算基準時間
        self.base_time = self._calculate_base_time()

        # BigQuery 客戶端（僅在需要時初始化）
        self._bq_client = None

    @property
    def bq_client(self) -> bigquery.Client:
        """延遲初始化 BigQuery 客戶端"""
        if self._bq_client is None:
            self._bq_client = bigquery.Client(project=BIGQUERY_CONFIG['project_id'])
        return self._bq_client

    def _calculate_base_time(self) -> Optional[datetime]:
        """計算備份基準時間"""
        if self.mode == 'full':
            return None  # 全量不需要時間過濾

        if self.base_date:
            # 解析指定日期
            try:
                dt = datetime.strptime(self.base_date, '%Y-%m-%d')
                return TZ.localize(dt.replace(hour=0, minute=0, second=0, microsecond=0))
            except ValueError:
                raise ValueError(f"Invalid date format: {self.base_date}, expected YYYY-MM-DD")
        else:
            # 預設：昨天 00:00
            now = datetime.now(TZ)
            today = now.replace(hour=0, minute=0, second=0, microsecond=0)
            return today - timedelta(days=1)

    def run(self, sheet_codes: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        執行手動備份

        Args:
            sheet_codes: 要備份的表格代碼（None = 全部）

        Returns:
            備份結果摘要
        """
        if sheet_codes is None:
            sheet_codes = list(SHEET_CONFIG.keys())

        start_time = datetime.now(TZ)
        timestamp = start_time.strftime('%Y%m%d_%H%M%S')

        # 建立輸出目錄
        if not self.to_bq:
            self.run_output_dir = self.output_dir / timestamp
            self.run_output_dir.mkdir(parents=True, exist_ok=True)

        logger.info("=" * 60)
        logger.info("Ragic Manual Backup")
        logger.info("=" * 60)
        logger.info(f"Mode: {self.mode}")
        logger.info(f"Base time: {self.base_time.strftime('%Y-%m-%d %H:%M:%S') if self.base_time else 'N/A (full)'}")
        logger.info(f"Target: {'BigQuery' if self.to_bq else 'Local JSON'}")
        logger.info(f"Sheets: {sheet_codes}")
        logger.info("=" * 60)

        results = {
            'backup_time': start_time.isoformat(),
            'mode': self.mode,
            'base_time': self.base_time.isoformat() if self.base_time else None,
            'target': 'bigquery' if self.to_bq else 'local',
            'output_dir': str(self.run_output_dir) if not self.to_bq else None,
            'sheets': {},
            'total_fetched': 0,
            'total_saved': 0,
            'total_filtered': 0,
            'success_count': 0,
            'failed_count': 0,
        }

        for sheet_code in sheet_codes:
            sheet_result = self._backup_sheet(sheet_code)
            results['sheets'][sheet_code] = sheet_result

            if sheet_result['status'] == 'success':
                results['success_count'] += 1
                results['total_fetched'] += sheet_result.get('fetched', 0)
                results['total_saved'] += sheet_result.get('saved', 0)
                results['total_filtered'] += sheet_result.get('filtered', 0)
            elif sheet_result['status'] == 'skipped':
                results['success_count'] += 1
            else:
                results['failed_count'] += 1

        end_time = datetime.now(TZ)
        results['end_time'] = end_time.isoformat()
        results['duration_seconds'] = (end_time - start_time).total_seconds()

        # 儲存摘要
        if not self.to_bq:
            self._save_summary(results)

        self._print_summary(results)
        return results

    def _backup_sheet(self, sheet_code: str) -> Dict[str, Any]:
        """備份單一表格"""
        config = SHEET_CONFIG.get(sheet_code)
        if not config:
            return {'status': 'failed', 'error': f'Unknown sheet code: {sheet_code}'}

        sheet_name = config['name']
        start_time = time.time()

        logger.info(f"{'='*50}")
        logger.info(f"Backing up sheet {sheet_code} ({sheet_name})")

        try:
            # Step 1: 從 Ragic 抓取資料
            records = self._fetch_data(sheet_code)
            fetched_count = len(records)
            logger.info(f"Fetched {fetched_count} records from Ragic")

            if fetched_count == 0:
                return {
                    'status': 'skipped',
                    'message': 'No data',
                    'fetched': 0,
                    'filtered': 0,
                    'saved': 0,
                    'duration': time.time() - start_time,
                }

            # Step 2: 清洗過濾
            valid_records, filtered_count = self._filter_records(records, sheet_code)
            logger.info(f"After filtering: {len(valid_records)} valid, {filtered_count} filtered")

            if not valid_records:
                return {
                    'status': 'success',
                    'message': 'All records filtered',
                    'fetched': fetched_count,
                    'filtered': filtered_count,
                    'saved': 0,
                    'duration': time.time() - start_time,
                }

            # Step 3: 存檔或上傳
            if self.to_bq:
                saved_count = self._upload_to_bq(valid_records, sheet_code, config)
            else:
                saved_count = self._save_to_local(valid_records, sheet_code, sheet_name, filtered_count)

            duration = time.time() - start_time
            logger.info(f"Completed in {duration:.2f}s")

            return {
                'status': 'success',
                'fetched': fetched_count,
                'filtered': filtered_count,
                'saved': saved_count,
                'duration': duration,
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Backup failed for {sheet_code}: {error_msg}")
            return {
                'status': 'failed',
                'error': error_msg,
                'duration': time.time() - start_time,
            }

    # ========================================
    # 資料抓取
    # ========================================

    def _fetch_data(self, sheet_code: str) -> List[Dict[str, Any]]:
        """從 Ragic 抓取資料"""
        config = SHEET_CONFIG[sheet_code]

        base_url = RAGIC_CONFIG['base_url']
        url = f"{base_url}/{config['ragic_path']}"

        headers = {
            'Authorization': f"Basic {RAGIC_CONFIG['api_key']}",
            'Content-Type': 'application/json',
        }

        # 建構查詢參數
        params = {
            'api': '',
            'v': 3,
            'limit': self.PAGE_SIZE,
        }

        # 增量模式：加入時間過濾
        if self.base_time:
            time_str = self.base_time.strftime('%Y/%m/%d %H:%M:%S')
            params['where'] = f"{config['last_modified_field_id']},gt,{time_str}"
            logger.info(f"Fetching from: {url}")
            logger.info(f"Where: {params['where']}")
        else:
            logger.info(f"Fetching all data from: {url}")

        all_records = []
        page = 1

        while page <= self.MAX_PAGES:
            offset = (page - 1) * self.PAGE_SIZE
            params['offset'] = offset

            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=RAGIC_CONFIG['timeout']
            )
            response.raise_for_status()

            data = response.json()
            records = self._parse_response(data)
            records_count = len(records)

            if records:
                all_records.extend(records)
                logger.info(f"  Page {page}: {records_count} records (total: {len(all_records)})")

            if records_count < self.PAGE_SIZE:
                break

            page += 1

        logger.info(f"Total fetched: {len(all_records)} records in {page} page(s)")
        return all_records

    def _parse_response(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """解析 Ragic API 回應"""
        if not isinstance(data, dict):
            return []

        if data.get('status') == 'ERROR':
            error_msg = data.get('msg', 'Unknown error')
            raise RuntimeError(f"Ragic API error: {error_msg}")

        records = []
        for ragic_id, record_data in data.items():
            if ragic_id.startswith('_'):
                continue
            if not isinstance(record_data, dict):
                continue

            record_data['_ragicId'] = ragic_id
            records.append(record_data)

        return records

    # ========================================
    # 清洗過濾
    # ========================================

    def _filter_records(
        self,
        records: List[Dict[str, Any]],
        sheet_code: str
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        初步清洗資料

        規則 A (99 表)：訂單編號 + 商品編號 都為空 → 跳過
        規則 B (其他表)：主鍵為空 → 跳過
        規則 C (全部)：最後修改日期為未來 → 跳過
        """
        config = SHEET_CONFIG[sheet_code]
        now = datetime.now(TZ)

        valid = []
        filtered = 0

        for record in records:
            # 規則 C: 過濾未來日期
            if self._is_future_date(record, config, now):
                filtered += 1
                continue

            # 規則 A/B: 驗證關鍵欄位
            if sheet_code == '99':
                if not self._validate_strict(record):
                    filtered += 1
                    continue
            else:
                if not self._validate_loose(record, sheet_code):
                    filtered += 1
                    continue

            valid.append(record)

        return valid, filtered

    def _is_future_date(
        self,
        record: Dict[str, Any],
        config: Dict[str, Any],
        now: datetime
    ) -> bool:
        """檢查是否為未來日期"""
        field_name = config.get('last_modified_field', '')
        modified_str = record.get(field_name, '')

        if not modified_str:
            return False

        try:
            modified_time = self._parse_datetime(modified_str)
            if modified_time.tzinfo is None:
                modified_time = TZ.localize(modified_time)
            return modified_time > now
        except Exception:
            return False

    def _validate_strict(self, record: Dict[str, Any]) -> bool:
        """99 表嚴格驗證：訂單編號 + 商品編號 至少有一個有值"""
        order_code = self._get_field_value(record, '訂單編號', '1000781')
        product_code = self._get_field_value(record, '商品編號', '1000811')
        return bool(order_code) or bool(product_code)

    def _validate_loose(self, record: Dict[str, Any], sheet_code: str) -> bool:
        """寬鬆驗證：主鍵不為空"""
        PRIMARY_KEYS = {
            '10': ('品牌編號', '1000942'),
            '20': ('通路編號', '1000921'),
            '30': ('金流編號', '1000954'),
            '40': ('物流編號', '1000736'),
            '41': ('郵遞區號', '1000964'),
            '50': ('訂單編號', '1000976'),
            '60': ('客戶編號', '1000710'),
            '70': ('商品編號', '1000998'),
            '80': ('活動編號', '1001019'),
        }

        pk_info = PRIMARY_KEYS.get(sheet_code)
        if not pk_info:
            return True

        pk_name, pk_id = pk_info
        value = self._get_field_value(record, pk_name, pk_id)
        return bool(value)

    def _get_field_value(
        self,
        record: Dict[str, Any],
        field_name: str,
        field_id: str
    ) -> str:
        """取得欄位值"""
        value = record.get(field_id, '')
        if value:
            return str(value).strip()

        value = record.get(field_name, '')
        if value:
            return str(value).strip()

        return ''

    def _parse_datetime(self, date_str: str) -> datetime:
        """解析日期字串"""
        for fmt in [
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y/%m/%d',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d',
        ]:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"Unable to parse date: {date_str}")

    # ========================================
    # 本地存檔
    # ========================================

    def _save_to_local(
        self,
        records: List[Dict[str, Any]],
        sheet_code: str,
        sheet_name: str,
        filtered_count: int
    ) -> int:
        """存檔到本地 JSON"""
        filename = f"{sheet_code}_{sheet_name}.json"
        output_file = self.run_output_dir / filename

        output_data = {
            'sheet_code': sheet_code,
            'sheet_name': sheet_name,
            'mode': self.mode,
            'base_time': self.base_time.isoformat() if self.base_time else None,
            'fetched_at': datetime.now(TZ).isoformat(),
            'total_records': len(records),
            'filtered_records': filtered_count,
            'records': records,
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        logger.info(f"Saved to: {output_file}")
        return len(records)

    def _save_summary(self, results: Dict[str, Any]):
        """儲存執行摘要"""
        summary_file = self.run_output_dir / 'summary.json'

        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        logger.info(f"Summary saved to: {summary_file}")

    # ========================================
    # BigQuery 上傳
    # ========================================

    def _upload_to_bq(
        self,
        records: List[Dict[str, Any]],
        sheet_code: str,
        config: Dict[str, Any]
    ) -> int:
        """上傳到 BigQuery"""
        table_name = config['bq_table']
        project = BIGQUERY_CONFIG['project_id']
        dataset = BIGQUERY_CONFIG['dataset']

        # 取得現有 ragic_id
        existing_ids = self._get_existing_ids(table_name)

        # 分區
        to_insert = []
        to_update = []

        for record in records:
            ragic_id = record.get('_ragicId', '')
            if ragic_id in existing_ids:
                to_update.append(record)
            else:
                to_insert.append(record)

        logger.info(f"Partition: {len(to_insert)} to insert, {len(to_update)} to update")

        inserted = 0
        updated = 0

        # 新增資料
        if to_insert:
            rows = [self._prepare_row(r, config) for r in to_insert]
            self._insert_rows(table_name, rows)
            inserted = len(to_insert)

        # 更新資料
        if to_update:
            for record in to_update:
                try:
                    row = self._prepare_row(record, config)
                    self._update_row(table_name, row)
                    updated += 1
                except Exception as e:
                    if 'streaming buffer' in str(e).lower():
                        logger.warning(f"Skipped update due to streaming buffer")
                    else:
                        raise

        # 寫入備份日誌
        self._write_backup_log(
            sheet_code, config['name'],
            len(records), inserted, updated, 0,
            'success', 0
        )

        logger.info(f"Uploaded to BQ: {inserted} inserted, {updated} updated")
        return inserted + updated

    def _get_existing_ids(self, table_name: str) -> set:
        """取得表格中現有的所有 ragic_id"""
        project = BIGQUERY_CONFIG['project_id']
        dataset = BIGQUERY_CONFIG['dataset']
        table_id = f"{project}.{dataset}.{table_name}"

        query = f"""
        SELECT DISTINCT ragic_id
        FROM `{table_id}`
        """

        try:
            result = self.bq_client.query(query).result()
            return {row.ragic_id for row in result}
        except Exception as e:
            logger.warning(f"Error getting existing IDs from {table_name}: {e}")
            return set()

    def _prepare_row(
        self,
        record: Dict[str, Any],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """準備單筆資料行"""
        NUMERIC_FIELDS = {'order_amount', 'quantity', 'unit_price', 'price'}
        DATE_FIELDS = {'order_date', 'start_date', 'end_date'}

        ragic_id = record.get('_ragicId', '')

        row = {
            'ragic_id': ragic_id,
            'data': json.dumps(record, ensure_ascii=False),
            'backup_time': datetime.now(timezone.utc).isoformat(),
        }

        # 提取關鍵欄位
        key_fields = config.get('key_fields', {})
        for field_name, field_source in key_fields.items():
            value = record.get(field_source, '')
            if isinstance(value, str):
                value = value.strip()

            if field_name in NUMERIC_FIELDS:
                if value:
                    try:
                        value = float(str(value).replace(',', ''))
                    except (ValueError, TypeError):
                        value = None
                else:
                    value = None
            elif field_name in DATE_FIELDS:
                if value:
                    try:
                        value = value.replace('/', '-')
                    except Exception:
                        value = None
                else:
                    value = None
            else:
                value = value if value else None

            row[field_name] = value

        # 提取 Ragic 時間戳
        if '_ragicCreatedTime' in record:
            row['ragic_created'] = self._parse_timestamp(record['_ragicCreatedTime'])
        if '_ragicModifiedTime' in record:
            row['ragic_modified'] = self._parse_timestamp(record['_ragicModifiedTime'])

        return row

    def _parse_timestamp(self, ts_value: Any) -> Optional[str]:
        """解析時間戳"""
        if not ts_value:
            return None

        if isinstance(ts_value, (int, float)):
            dt = datetime.fromtimestamp(ts_value / 1000)
            return dt.isoformat()

        if isinstance(ts_value, str):
            try:
                dt = self._parse_datetime(ts_value)
                return dt.isoformat()
            except Exception:
                pass

        return None

    def _insert_rows(self, table_name: str, rows: List[Dict[str, Any]]):
        """批次新增資料"""
        project = BIGQUERY_CONFIG['project_id']
        dataset = BIGQUERY_CONFIG['dataset']
        table_id = f"{project}.{dataset}.{table_name}"
        batch_size = 500

        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            errors = self.bq_client.insert_rows_json(table_id, batch)

            if errors:
                logger.error(f"Insert errors: {errors[:3]}")
                raise RuntimeError(f"Failed to insert rows: {errors}")

    def _update_row(self, table_name: str, row: Dict[str, Any]):
        """更新單筆資料"""
        project = BIGQUERY_CONFIG['project_id']
        dataset = BIGQUERY_CONFIG['dataset']
        table_id = f"{project}.{dataset}.{table_name}"

        NUMERIC_FIELDS = {'order_amount', 'quantity', 'unit_price', 'price'}

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
                if key in NUMERIC_FIELDS:
                    params.append(bigquery.ScalarQueryParameter(param_name, "FLOAT64", None))
                else:
                    params.append(bigquery.ScalarQueryParameter(param_name, "STRING", None))
            elif key in NUMERIC_FIELDS:
                try:
                    float_value = float(str(value).replace(',', '')) if value else None
                    params.append(bigquery.ScalarQueryParameter(param_name, "FLOAT64", float_value))
                except (ValueError, TypeError):
                    params.append(bigquery.ScalarQueryParameter(param_name, "FLOAT64", None))
            elif isinstance(value, (int, float)):
                params.append(bigquery.ScalarQueryParameter(param_name, "FLOAT64", value))
            else:
                params.append(bigquery.ScalarQueryParameter(param_name, "STRING", str(value)))

            param_idx += 1

        query = f"""
        UPDATE `{table_id}`
        SET {', '.join(set_clauses)}
        WHERE ragic_id = @ragic_id
        """

        job_config = bigquery.QueryJobConfig(query_parameters=params)
        self.bq_client.query(query, job_config=job_config).result()

    def _write_backup_log(
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
        project = BIGQUERY_CONFIG['project_id']
        dataset = BIGQUERY_CONFIG['dataset']

        log_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

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

        table_id = f"{project}.{dataset}.backup_logs"

        try:
            errors = self.bq_client.insert_rows_json(table_id, [row])
            if errors:
                logger.error(f"Failed to write backup log: {errors}")
        except Exception as e:
            logger.error(f"Error writing backup log: {e}")

    # ========================================
    # 輸出摘要
    # ========================================

    def _print_summary(self, results: Dict[str, Any]):
        """輸出摘要"""
        logger.info("=" * 60)
        logger.info("MANUAL BACKUP SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Mode: {results['mode']}")
        logger.info(f"Base time: {results['base_time'] or 'N/A (full)'}")
        logger.info(f"Target: {results['target']}")
        if results.get('output_dir'):
            logger.info(f"Output: {results['output_dir']}")
        logger.info(f"Duration: {results['duration_seconds']:.2f}s")
        logger.info(f"Total sheets: {results['success_count'] + results['failed_count']}")
        logger.info(f"Success: {results['success_count']}, Failed: {results['failed_count']}")
        logger.info(f"Total fetched: {results['total_fetched']}")
        logger.info(f"Total filtered: {results['total_filtered']}")
        logger.info(f"Total saved: {results['total_saved']}")
        logger.info("=" * 60)


# ========================================
# CLI 入口
# ========================================

def main():
    """命令列入口"""
    parser = argparse.ArgumentParser(
        description='Ragic Manual Backup Tool',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full backup all sheets to local JSON
  uv run python -m src.manual_backup --full

  # Incremental backup from specific date
  uv run python -m src.manual_backup --date 2025-01-01

  # Full backup single sheet to BigQuery
  uv run python -m src.manual_backup --full --sheet 99 --to-bq

  # Incremental backup single sheet to BigQuery
  uv run python -m src.manual_backup --date 2025-01-01 --sheet 50 --to-bq
        """
    )

    parser.add_argument(
        '--full', '-f',
        action='store_true',
        help='Full backup (no time filter, fetch all data)'
    )
    parser.add_argument(
        '--date', '-d',
        type=str,
        metavar='YYYY-MM-DD',
        help='Base date for incremental backup (fetch data modified after this date 00:00)'
    )
    parser.add_argument(
        '--sheet', '-s',
        type=str,
        metavar='CODE',
        help='Sheet code to backup (e.g., 99, 50). Default: all sheets'
    )
    parser.add_argument(
        '--to-bq',
        action='store_true',
        help='Upload to BigQuery instead of local JSON'
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='./data/manual_backup',
        help='Output directory for local backup (default: ./data/manual_backup)'
    )

    args = parser.parse_args()

    # 驗證參數
    if args.full and args.date:
        parser.error('Cannot use --full and --date together')

    # 確定模式
    if args.full:
        mode = 'full'
    else:
        mode = 'incremental'

    # 確定表格
    if args.sheet:
        if args.sheet not in SHEET_CONFIG:
            parser.error(f"Unknown sheet code: {args.sheet}. Valid codes: {list(SHEET_CONFIG.keys())}")
        sheet_codes = [args.sheet]
    else:
        sheet_codes = None  # 全部

    # 執行備份
    backup = ManualBackup(
        mode=mode,
        base_date=args.date,
        to_bq=args.to_bq,
        output_dir=args.output
    )

    results = backup.run(sheet_codes)

    # 回傳結果狀態
    if results['failed_count'] > 0:
        exit(1)


if __name__ == '__main__':
    main()
