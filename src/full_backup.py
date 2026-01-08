"""
Ragic 全量備份模組

功能：
- 從 Ragic API 下載全部資料
- 不上傳 BQ，直接存檔到本地
- 支援單表或全部表格備份
"""
import argparse
import json
import logging
import os
import time
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

import pytz

from .config import RAGIC_CONFIG, SHEET_CONFIG

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 時區設定
TZ = pytz.timezone('Asia/Taipei')


class FullBackup:
    """全量備份執行器"""

    # 分頁設定
    PAGE_SIZE = 5000  # Ragic API 最大支援 5000
    MAX_PAGES = 200   # 全量備份可能有更多頁

    def __init__(self, output_dir: str = './data/full_backup', skip_filter: bool = False):
        """
        初始化

        Args:
            output_dir: 輸出目錄
            skip_filter: 是否跳過清洗過濾
        """
        self.output_dir = Path(output_dir)
        self.skip_filter = skip_filter
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def run(self, sheet_codes: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        執行全量備份

        Args:
            sheet_codes: 要備份的表格代碼（None = 全部）

        Returns:
            備份結果摘要
        """
        if sheet_codes is None:
            sheet_codes = list(SHEET_CONFIG.keys())

        start_time = datetime.now(TZ)
        logger.info(f"Starting full backup at {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"Skip filter: {self.skip_filter}")

        results = {
            'backup_time': start_time.isoformat(),
            'output_dir': str(self.output_dir),
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
            else:
                results['failed_count'] += 1

        end_time = datetime.now(TZ)
        results['end_time'] = end_time.isoformat()
        results['duration_seconds'] = (end_time - start_time).total_seconds()

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
            # Step 1: 從 Ragic 抓取全部資料
            records = self._fetch_all_data(sheet_code)
            fetched_count = len(records)
            logger.info(f"Fetched {fetched_count} records from Ragic")

            if fetched_count == 0:
                return {
                    'status': 'success',
                    'message': 'No data',
                    'fetched': 0,
                    'filtered': 0,
                    'saved': 0,
                    'duration': time.time() - start_time,
                }

            # Step 2: 清洗過濾（可選）
            if self.skip_filter:
                valid_records = records
                filtered_count = 0
            else:
                valid_records, filtered_count = self._filter_records(records, sheet_code)
                logger.info(f"After filtering: {len(valid_records)} valid, {filtered_count} filtered")

            # Step 3: 存檔到本地
            output_file = self._save_to_file(sheet_code, sheet_name, valid_records, filtered_count)

            duration = time.time() - start_time
            logger.info(f"Saved to: {output_file}")
            logger.info(f"Completed in {duration:.2f}s")

            return {
                'status': 'success',
                'fetched': fetched_count,
                'filtered': filtered_count,
                'saved': len(valid_records),
                'output_file': str(output_file),
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
    # 從 Ragic 抓取全部資料（無時間過濾）
    # ========================================

    def _fetch_all_data(self, sheet_code: str) -> List[Dict[str, Any]]:
        """
        從 Ragic 抓取全部資料（含分頁）

        不設 where 條件，抓取所有資料
        """
        config = SHEET_CONFIG[sheet_code]

        base_url = RAGIC_CONFIG['base_url']
        url = f"{base_url}/{config['ragic_path']}"

        headers = {
            'Authorization': f"Basic {RAGIC_CONFIG['api_key']}",
            'Content-Type': 'application/json',
        }

        logger.info(f"Fetching from: {url}")

        all_records = []
        page = 1

        while page <= self.MAX_PAGES:
            offset = (page - 1) * self.PAGE_SIZE

            params = {
                'api': '',
                'v': 3,
                'limit': self.PAGE_SIZE,
                'offset': offset,
            }

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
    # 清洗過濾（與增量備份相同）
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
    # 存檔到本地
    # ========================================

    def _save_to_file(
        self,
        sheet_code: str,
        sheet_name: str,
        records: List[Dict[str, Any]],
        filtered_count: int
    ) -> Path:
        """存檔到本地 JSON"""
        timestamp = datetime.now(TZ).strftime('%Y%m%d_%H%M%S')
        filename = f"{sheet_code}_{sheet_name}_{timestamp}.json"
        output_file = self.output_dir / filename

        output_data = {
            'sheet_code': sheet_code,
            'sheet_name': sheet_name,
            'fetched_at': datetime.now(TZ).isoformat(),
            'total_records': len(records),
            'filtered_records': filtered_count,
            'records': records,
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        return output_file

    def _print_summary(self, results: Dict[str, Any]):
        """輸出摘要"""
        logger.info("=" * 60)
        logger.info("FULL BACKUP SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Output directory: {results['output_dir']}")
        logger.info(f"Total sheets: {results['success_count'] + results['failed_count']}")
        logger.info(f"Success: {results['success_count']}, Failed: {results['failed_count']}")
        logger.info(f"Total fetched: {results['total_fetched']}")
        logger.info(f"Total filtered: {results['total_filtered']}")
        logger.info(f"Total saved: {results['total_saved']}")
        logger.info(f"Duration: {results['duration_seconds']:.2f}s")
        logger.info("=" * 60)


def main():
    """命令列入口"""
    parser = argparse.ArgumentParser(description='Ragic Full Backup Tool')
    parser.add_argument(
        '--sheet', '-s',
        type=str,
        help='Sheet code to backup (e.g., 99, 50). Use --all for all sheets.'
    )
    parser.add_argument(
        '--all', '-a',
        action='store_true',
        help='Backup all sheets'
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='./data/full_backup',
        help='Output directory (default: ./data/full_backup)'
    )
    parser.add_argument(
        '--skip-filter',
        action='store_true',
        help='Skip data filtering (keep all raw data)'
    )

    args = parser.parse_args()

    # 確定要備份的表格
    if args.all:
        sheet_codes = None  # None = 全部
    elif args.sheet:
        sheet_codes = [args.sheet]
    else:
        parser.error('Please specify --sheet or --all')

    # 執行備份
    backup = FullBackup(
        output_dir=args.output,
        skip_filter=args.skip_filter
    )
    results = backup.run(sheet_codes)

    # 回傳結果狀態
    if results['failed_count'] > 0:
        exit(1)


if __name__ == '__main__':
    main()
