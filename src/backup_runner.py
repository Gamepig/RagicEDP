"""
[DEPRECATED] Ragic ERP Backup System v2 - 備份執行器

==============================================================================
⚠️  此模組已棄用，請使用 src/incremental.py 替代
==============================================================================

棄用原因：
1. 依賴已棄用的 ragic_client.py（分頁參數錯誤）
2. 架構過於複雜
3. 已被 v3 增量備份系統取代

新版模組：src/incremental.py
"""
import warnings
warnings.warn(
    "backup_runner.py 已棄用，請使用 incremental.py 替代。",
    DeprecationWarning,
    stacklevel=2
)
import logging
import time
from datetime import datetime
from typing import Dict, Any, List, Optional

from .config import SHEET_CONFIG
from .ragic_client import RagicClient
from .data_filter import DataFilter
from .bigquery_uploader import BigQueryUploader

logger = logging.getLogger(__name__)


class BackupRunner:
    """備份執行器"""

    def __init__(self):
        self.ragic_client = RagicClient()
        self.data_filter = DataFilter()
        self.bq_uploader = BigQueryUploader()

    def run_backup(
        self,
        sheet_codes: Optional[List[str]] = None,
        full_backup: bool = False
    ) -> Dict[str, Any]:
        """
        執行備份

        Args:
            sheet_codes: 要備份的表格代碼列表（None = 全部）
            full_backup: 是否執行全量備份（忽略增量條件）

        Returns:
            備份結果摘要
        """
        if sheet_codes is None:
            sheet_codes = list(SHEET_CONFIG.keys())

        start_time = datetime.now()
        results = {
            'start_time': start_time.isoformat(),
            'sheets': {},
            'total_fetched': 0,
            'total_inserted': 0,
            'total_updated': 0,
            'total_filtered': 0,
            'success_count': 0,
            'failed_count': 0,
        }

        for sheet_code in sheet_codes:
            sheet_result = self._backup_sheet(sheet_code, full_backup)
            results['sheets'][sheet_code] = sheet_result

            if sheet_result['status'] == 'success':
                results['success_count'] += 1
                results['total_fetched'] += sheet_result['records_fetched']
                results['total_inserted'] += sheet_result['records_inserted']
                results['total_updated'] += sheet_result['records_updated']
                results['total_filtered'] += sheet_result['records_filtered']
            else:
                results['failed_count'] += 1

        end_time = datetime.now()
        results['end_time'] = end_time.isoformat()
        results['duration_seconds'] = (end_time - start_time).total_seconds()

        return results

    def _backup_sheet(
        self,
        sheet_code: str,
        full_backup: bool = False
    ) -> Dict[str, Any]:
        """備份單一表格"""
        config = SHEET_CONFIG.get(sheet_code)
        if not config:
            return {
                'status': 'failed',
                'error': f'Unknown sheet code: {sheet_code}',
            }

        sheet_name = config['name']
        start_time = time.time()

        logger.info(f"{'='*50}")
        logger.info(f"Starting backup for sheet {sheet_code} ({sheet_name})")
        logger.info(f"{'='*50}")

        try:
            # Step 1: 取得上次備份時間（增量模式）
            last_backup_time = None
            if not full_backup:
                last_backup_time = self.bq_uploader.get_last_backup_time(sheet_code)
                if last_backup_time:
                    logger.info(f"Last backup time: {last_backup_time}")
                else:
                    logger.info("No previous backup, will fetch all records")

            # Step 2: 從 Ragic API 抓取資料
            records = self.ragic_client.fetch_incremental(
                sheet_code,
                last_modified_time=last_backup_time
            )
            records_fetched = len(records)
            logger.info(f"Fetched {records_fetched} records from Ragic")

            if records_fetched == 0:
                # 無新資料
                duration = time.time() - start_time
                self.bq_uploader.write_backup_log(
                    sheet_code=sheet_code,
                    sheet_name=sheet_name,
                    records_fetched=0,
                    records_inserted=0,
                    records_updated=0,
                    records_filtered=0,
                    status='skipped',
                    duration_seconds=duration,
                )
                return {
                    'status': 'success',
                    'message': 'No new records',
                    'records_fetched': 0,
                    'records_inserted': 0,
                    'records_updated': 0,
                    'records_filtered': 0,
                    'duration_seconds': duration,
                }

            # Step 3: 資料過濾
            valid_records, filtered_count = self.data_filter.filter_records(
                records, sheet_code
            )
            logger.info(
                f"After filtering: {len(valid_records)} valid, "
                f"{filtered_count} filtered"
            )

            # Step 4: 上傳到 BigQuery
            inserted, updated = self.bq_uploader.upload_records(
                valid_records, sheet_code
            )

            # Step 5: 更新備份狀態
            # 找出最新的修改時間
            latest_modified = self._get_latest_modified_time(records, config)
            total_records = self.bq_uploader.get_total_records(config['bq_table'])

            self.bq_uploader.update_backup_status(
                sheet_code=sheet_code,
                total_records=total_records,
                last_fetch_count=records_fetched,
                last_record_time=latest_modified,
            )

            # Step 6: 寫入日誌
            duration = time.time() - start_time
            self.bq_uploader.write_backup_log(
                sheet_code=sheet_code,
                sheet_name=sheet_name,
                records_fetched=records_fetched,
                records_inserted=inserted,
                records_updated=updated,
                records_filtered=filtered_count,
                status='success',
                duration_seconds=duration,
            )

            logger.info(f"Backup completed for {sheet_code} in {duration:.2f}s")

            return {
                'status': 'success',
                'records_fetched': records_fetched,
                'records_inserted': inserted,
                'records_updated': updated,
                'records_filtered': filtered_count,
                'duration_seconds': duration,
            }

        except Exception as e:
            duration = time.time() - start_time
            error_msg = str(e)
            logger.error(f"Backup failed for {sheet_code}: {error_msg}")

            self.bq_uploader.write_backup_log(
                sheet_code=sheet_code,
                sheet_name=sheet_name,
                records_fetched=0,
                records_inserted=0,
                records_updated=0,
                records_filtered=0,
                status='failed',
                duration_seconds=duration,
                error_message=error_msg,
            )

            return {
                'status': 'failed',
                'error': error_msg,
                'records_fetched': 0,
                'records_inserted': 0,
                'records_updated': 0,
                'records_filtered': 0,
                'duration_seconds': duration,
            }

    def _get_latest_modified_time(
        self,
        records: List[Dict[str, Any]],
        config: Dict[str, Any]
    ) -> Optional[datetime]:
        """
        從記錄中取得最新的修改時間

        注意：會自動排除未來時間（超過當前時間的記錄）
        """
        latest = None
        now = datetime.now()
        last_modified_field = config.get('last_modified_field', '')
        future_count = 0

        for record in records:
            dt = None

            # 嘗試從 _ragicModifiedTime 取得
            modified_time = record.get('_ragicModifiedTime')
            if modified_time:
                try:
                    if isinstance(modified_time, (int, float)):
                        dt = datetime.fromtimestamp(modified_time / 1000)
                    else:
                        dt = datetime.strptime(str(modified_time), '%Y/%m/%d %H:%M:%S')
                except Exception:
                    pass
            # 嘗試從欄位名稱取得
            elif last_modified_field:
                modified_str = record.get(last_modified_field, '')
                if modified_str:
                    try:
                        dt = datetime.strptime(modified_str, '%Y/%m/%d %H:%M:%S')
                    except Exception:
                        try:
                            dt = datetime.strptime(modified_str, '%Y/%m/%d %H:%M')
                        except Exception:
                            pass

            # 排除未來時間
            if dt:
                if dt > now:
                    future_count += 1
                    continue  # 跳過未來時間

                if latest is None or dt > latest:
                    latest = dt

        if future_count > 0:
            logger.warning(
                f"Skipped {future_count} records with future timestamps "
                f"(beyond {now.strftime('%Y-%m-%d %H:%M')})"
            )

        return latest
