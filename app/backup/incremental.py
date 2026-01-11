"""
Ragic 增量備份核心模組 v3

簡化設計：
- 時間基準固定為昨天 00:00
- 不設 limit，讓 API 返回所有符合條件的資料
- 移除 API 層狀態過濾
- 清洗規則在程式層處理
"""
import logging
import time
import uuid
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any, Optional

from google.cloud import bigquery

from .config import RAGIC_CONFIG, SHEET_CONFIG, BIGQUERY_CONFIG, TIMEZONE, now_taipei

logger = logging.getLogger(__name__)

# 使用統一時區配置
TZ = TIMEZONE


class IncrementalBackup:
    """增量備份執行器"""

    def __init__(self):
        self.bq_client = bigquery.Client(project=BIGQUERY_CONFIG['project_id'])
        self.dataset = BIGQUERY_CONFIG['dataset']
        self.project = BIGQUERY_CONFIG['project_id']

    def run(self, sheet_codes: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        執行增量備份

        Args:
            sheet_codes: 要備份的表格代碼（None = 全部）

        Returns:
            備份結果摘要
        """
        if sheet_codes is None:
            sheet_codes = list(SHEET_CONFIG.keys())

        start_time = datetime.now(TZ)

        # Step 1: 計算備份基準時間
        base_time = self._get_backup_base_time()
        logger.info(f"Backup base time: {base_time.strftime('%Y/%m/%d %H:%M:%S')}")

        results = {
            'backup_time': start_time.isoformat(),
            'base_time': base_time.isoformat(),
            'sheets': {},
            'total_fetched': 0,
            'total_inserted': 0,
            'total_updated': 0,
            'total_filtered': 0,
            'success_count': 0,
            'failed_count': 0,
        }

        for sheet_code in sheet_codes:
            sheet_result = self._backup_sheet(sheet_code, base_time)
            results['sheets'][sheet_code] = sheet_result

            if sheet_result['status'] == 'success':
                results['success_count'] += 1
                results['total_fetched'] += sheet_result.get('fetched', 0)
                results['total_inserted'] += sheet_result.get('inserted', 0)
                results['total_updated'] += sheet_result.get('updated', 0)
                results['total_filtered'] += sheet_result.get('filtered', 0)
            elif sheet_result['status'] == 'skipped':
                results['success_count'] += 1
            else:
                results['failed_count'] += 1

        end_time = datetime.now(TZ)
        results['end_time'] = end_time.isoformat()
        results['duration_seconds'] = (end_time - start_time).total_seconds()

        return results

    def _get_backup_base_time(self) -> datetime:
        """
        計算備份基準時間：昨天 00:00 (Asia/Taipei)
        """
        now = datetime.now(TZ)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return today - timedelta(days=1)

    def _backup_sheet(self, sheet_code: str, base_time: datetime) -> Dict[str, Any]:
        """備份單一表格"""
        config = SHEET_CONFIG.get(sheet_code)
        if not config:
            return {'status': 'failed', 'error': f'Unknown sheet code: {sheet_code}'}

        sheet_name = config['name']
        start_time = time.time()

        logger.info(f"{'='*50}")
        logger.info(f"Starting backup for sheet {sheet_code} ({sheet_name})")

        try:
            # Step 2: 從 Ragic 抓取資料
            records = self._fetch_data(sheet_code, base_time)
            fetched_count = len(records)
            logger.info(f"Fetched {fetched_count} records from Ragic")

            if fetched_count == 0:
                duration = time.time() - start_time
                self._write_backup_log(
                    sheet_code, sheet_name, 0, 0, 0, 0,
                    'skipped', duration
                )
                return {
                    'status': 'skipped',
                    'message': 'No new data',
                    'fetched': 0,
                    'filtered': 0,
                    'inserted': 0,
                    'updated': 0,
                    'duration': duration,
                }

            # Step 3: 初步清洗
            valid_records, filtered_count = self._filter_records(records, sheet_code)
            logger.info(f"After filtering: {len(valid_records)} valid, {filtered_count} filtered")

            if not valid_records:
                duration = time.time() - start_time
                self._write_backup_log(
                    sheet_code, sheet_name, fetched_count, 0, 0, filtered_count,
                    'success', duration
                )
                return {
                    'status': 'success',
                    'message': 'All records filtered',
                    'fetched': fetched_count,
                    'filtered': filtered_count,
                    'inserted': 0,
                    'updated': 0,
                    'duration': duration,
                }

            # Step 4: 分區資料
            to_insert, to_update = self._partition_records(valid_records, sheet_code)
            logger.info(f"Partition: {len(to_insert)} to insert, {len(to_update)} to update")

            # Step 5: 上傳到 BQ
            inserted, updated = self._upload_records(to_insert, to_update, sheet_code)

            duration = time.time() - start_time
            self._write_backup_log(
                sheet_code, sheet_name, fetched_count, inserted, updated, filtered_count,
                'success', duration
            )

            logger.info(f"Backup completed for {sheet_code} in {duration:.2f}s")

            return {
                'status': 'success',
                'fetched': fetched_count,
                'filtered': filtered_count,
                'inserted': inserted,
                'updated': updated,
                'duration': duration,
            }

        except Exception as e:
            duration = time.time() - start_time
            error_msg = str(e)
            logger.error(f"Backup failed for {sheet_code}: {error_msg}")

            self._write_backup_log(
                sheet_code, sheet_name, 0, 0, 0, 0,
                'failed', duration, error_msg
            )

            return {
                'status': 'failed',
                'error': error_msg,
                'duration': duration,
            }

    # ========================================
    # Step 2: 從 Ragic 抓取資料
    # ========================================

    # 分頁設定
    PAGE_SIZE = 1000  # Ragic API 預設/最大單頁記錄數
    MAX_PAGES = 100   # 安全限制，防止無限迴圈

    def _fetch_data(self, sheet_code: str, base_time: datetime) -> List[Dict[str, Any]]:
        """
        從 Ragic 抓取增量資料（含分頁）

        使用分頁機制確保獲取所有符合條件的資料
        """
        config = SHEET_CONFIG[sheet_code]

        # 格式化時間
        time_str = base_time.strftime('%Y/%m/%d %H:%M:%S')

        # 建構 API URL
        base_url = RAGIC_CONFIG['base_url']
        url = f"{base_url}/{config['ragic_path']}"

        # where 條件：最後修改時間 > 基準時間
        where_clause = f"{config['last_modified_field_id']},gt,{time_str}"

        headers = {
            'Authorization': f"Basic {RAGIC_CONFIG['api_key']}",
            'Content-Type': 'application/json',
        }

        logger.info(f"Fetching from: {url}")
        logger.info(f"Where: {where_clause}")

        all_records = []
        page = 1

        while page <= self.MAX_PAGES:
            offset = (page - 1) * self.PAGE_SIZE

            params = {
                'api': '',
                'v': 3,
                'where': where_clause,
                'limit': self.PAGE_SIZE,
                'offset': offset,  # 正確的分頁參數是 offset，不是 qs
            }

            # 發送請求
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=RAGIC_CONFIG['timeout']
            )
            response.raise_for_status()

            data = response.json()

            # 解析回應
            records = self._parse_response(data)
            records_count = len(records)

            if records:
                all_records.extend(records)
                logger.info(f"  Page {page}: {records_count} records")

            # 如果記錄數少於 PAGE_SIZE，表示已經是最後一頁
            if records_count < self.PAGE_SIZE:
                break

            page += 1

        logger.info(f"Total fetched: {len(all_records)} records in {page} page(s)")
        return all_records

    def _parse_response(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """解析 Ragic API 回應"""
        if not isinstance(data, dict):
            return []

        # 檢查錯誤回應
        if data.get('status') == 'ERROR':
            error_msg = data.get('msg', 'Unknown error')
            raise RuntimeError(f"Ragic API error: {error_msg}")

        records = []
        for ragic_id, record_data in data.items():
            # 跳過元資料
            if ragic_id.startswith('_'):
                continue
            if not isinstance(record_data, dict):
                continue

            record_data['_ragicId'] = ragic_id
            records.append(record_data)

        return records

    # ========================================
    # Step 3: 初步清洗
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
        """
        99 表嚴格驗證：訂單編號 + 商品編號 至少有一個有值
        """
        order_code = self._get_field_value(record, '訂單編號', '1000781')
        product_code = self._get_field_value(record, '商品編號', '1000811')

        return bool(order_code) or bool(product_code)

    def _validate_loose(self, record: Dict[str, Any], sheet_code: str) -> bool:
        """
        寬鬆驗證：主鍵不為空
        """
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
        """取得欄位值（支援中文欄位名和欄位 ID）"""
        # 優先用欄位 ID
        value = record.get(field_id, '')
        if value:
            return str(value).strip()

        # 再用欄位名
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
    # Step 4: 分區資料
    # ========================================

    def _partition_records(
        self,
        records: List[Dict[str, Any]],
        sheet_code: str
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        分區資料：區分新增和更新
        """
        config = SHEET_CONFIG[sheet_code]
        table_name = config['bq_table']

        # 取得現有的 ragic_id
        existing_ids = self._get_existing_ids(table_name)

        to_insert = []
        to_update = []

        for record in records:
            ragic_id = record.get('_ragicId', '')
            if ragic_id in existing_ids:
                to_update.append(record)
            else:
                to_insert.append(record)

        return to_insert, to_update

    def _get_existing_ids(self, table_name: str) -> set:
        """取得表格中現有的所有 ragic_id"""
        table_id = f"{self.project}.{self.dataset}.{table_name}"

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

    # ========================================
    # Step 5: 上傳到 BQ
    # ========================================

    def _upload_records(
        self,
        to_insert: List[Dict[str, Any]],
        to_update: List[Dict[str, Any]],
        sheet_code: str
    ) -> Tuple[int, int]:
        """上傳資料到 BigQuery"""
        config = SHEET_CONFIG[sheet_code]
        table_name = config['bq_table']

        inserted = 0
        updated = 0

        # 新增資料
        if to_insert:
            rows = [self._prepare_row(r, config) for r in to_insert]
            self._insert_rows(table_name, rows)
            inserted = len(to_insert)

        # 更新資料
        if to_update:
            streaming_buffer_skipped = 0
            for record in to_update:
                try:
                    row = self._prepare_row(record, config)
                    self._update_row(table_name, row)
                    updated += 1
                except Exception as e:
                    if 'streaming buffer' in str(e).lower():
                        streaming_buffer_skipped += 1
                    else:
                        raise

            if streaming_buffer_skipped > 0:
                logger.warning(
                    f"Skipped {streaming_buffer_skipped} updates due to streaming buffer "
                    f"(will retry in next backup)"
                )

        return inserted, updated

    def _prepare_row(
        self,
        record: Dict[str, Any],
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """準備單筆資料行"""
        import json

        # 數值類型欄位
        NUMERIC_FIELDS = {'order_amount', 'quantity', 'unit_price', 'price', 'subtotal'}
        # 日期類型欄位 (BQ DATE 格式: YYYY-MM-DD)
        DATE_FIELDS = {'order_date', 'start_date', 'end_date'}

        ragic_id = record.get('_ragicId', '')

        row = {
            'ragic_id': ragic_id,
            'data': json.dumps(record, ensure_ascii=False),
            'backup_time': now_taipei().isoformat(),
        }

        # 提取關鍵欄位
        key_fields = config.get('key_fields', {})
        for field_name, field_source in key_fields.items():
            value = record.get(field_source, '')
            if isinstance(value, str):
                value = value.strip()

            # 數值欄位轉換
            if field_name in NUMERIC_FIELDS:
                if value:
                    try:
                        value = float(str(value).replace(',', ''))
                    except (ValueError, TypeError):
                        value = None
                else:
                    value = None
            # 日期欄位轉換 (YYYY/MM/DD -> YYYY-MM-DD)
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
        table_id = f"{self.project}.{self.dataset}.{table_name}"
        batch_size = 500

        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            errors = self.bq_client.insert_rows_json(table_id, batch)

            if errors:
                logger.error(f"Insert errors: {errors[:3]}")
                raise RuntimeError(f"Failed to insert rows: {errors}")

    def _update_row(self, table_name: str, row: Dict[str, Any]):
        """更新單筆資料"""
        table_id = f"{self.project}.{self.dataset}.{table_name}"

        # 數值類型欄位
        NUMERIC_FIELDS = {'order_amount', 'quantity', 'unit_price', 'price', 'subtotal'}

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
                # 根據欄位類型決定 NULL 類型
                if key in NUMERIC_FIELDS:
                    params.append(bigquery.ScalarQueryParameter(param_name, "FLOAT64", None))
                else:
                    params.append(bigquery.ScalarQueryParameter(param_name, "STRING", None))
            elif key in NUMERIC_FIELDS:
                # 數值欄位：轉換為 float
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

    # ========================================
    # 備份日誌
    # ========================================

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
        log_id = str(uuid.uuid4())
        now = now_taipei()

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

        table_id = f"{self.project}.{self.dataset}.backup_logs"

        try:
            errors = self.bq_client.insert_rows_json(table_id, [row])
            if errors:
                logger.error(f"Failed to write backup log: {errors}")
        except Exception as e:
            logger.error(f"Error writing backup log: {e}")
