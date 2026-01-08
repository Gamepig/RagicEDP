"""
上傳本地清洗資料到 BigQuery

功能：
1. 讀取 data/cleaned_backup/*.json 檔案
2. 清空 BQ 表格後重新上傳
3. 支援單表或全部表格

使用範例：
    # 上傳全部表格
    uv run python scripts/upload_local_to_bq.py --all --confirm

    # 上傳指定表格
    uv run python scripts/upload_local_to_bq.py --sheet 99 --confirm

    # 預覽模式（不實際執行）
    uv run python scripts/upload_local_to_bq.py --all
"""
import argparse
import json
import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

# 載入環境變數
from dotenv import load_dotenv
load_dotenv(override=True)

from google.cloud import bigquery

# 加入 src 到路徑
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.config import BIGQUERY_CONFIG, SHEET_CONFIG

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class LocalDataUploader:
    """本地資料上傳器"""

    # 檔案優先順序：merged > cleaned_v2 > cleaned
    FILE_PATTERNS = [
        '{code}_{name}_merged_*.json',
        '{code}_{name}_cleaned_v2_*.json',
        '{code}_{name}_cleaned_*.json',
        '{code}_{name}*_cleaned_*.json',  # 處理有時間戳的格式如 20_通路管理_150405_cleaned
    ]

    def __init__(self, data_dir: str = './data/cleaned_backup'):
        self.data_dir = Path(data_dir)
        self.client = bigquery.Client(project=BIGQUERY_CONFIG['project_id'])
        self.dataset = BIGQUERY_CONFIG['dataset']
        self.project = BIGQUERY_CONFIG['project_id']

    def _get_table_id(self, table_name: str) -> str:
        """取得完整的表格 ID"""
        return f"{self.project}.{self.dataset}.{table_name}"

    def find_data_file(self, sheet_code: str) -> Optional[Path]:
        """尋找對應的本地資料檔案"""
        config = SHEET_CONFIG.get(sheet_code)
        if not config:
            return None

        sheet_name = config['name']

        # 按優先順序搜尋檔案
        for pattern in self.FILE_PATTERNS:
            formatted_pattern = pattern.format(code=sheet_code, name=sheet_name)
            matches = list(self.data_dir.glob(formatted_pattern))
            if matches:
                # 選擇最新的檔案
                latest = max(matches, key=lambda p: p.stat().st_mtime)
                return latest

        return None

    def load_records(self, file_path: Path) -> List[Dict[str, Any]]:
        """從 JSON 檔案載入記錄"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, dict) and 'records' in data:
            return data['records']
        elif isinstance(data, list):
            return data
        else:
            raise ValueError(f"Unexpected data format in {file_path}")

    def truncate_table(self, table_name: str) -> int:
        """清空表格並返回刪除的筆數"""
        table_id = self._get_table_id(table_name)

        # 先查詢現有資料量
        count_query = f"SELECT COUNT(*) as cnt FROM `{table_id}`"
        try:
            result = self.client.query(count_query).result()
            existing_count = list(result)[0].cnt
        except Exception:
            existing_count = 0

        # 執行 TRUNCATE
        query = f"TRUNCATE TABLE `{table_id}`"
        self.client.query(query).result()
        logger.info(f"Truncated {table_name}: removed {existing_count} rows")

        return existing_count

    def prepare_row(
        self,
        record: Dict[str, Any],
        sheet_code: str,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """準備單筆資料行"""
        ragic_id = record.get('_ragicId', '')

        row = {
            'ragic_id': str(ragic_id),
            'data': json.dumps(record, ensure_ascii=False),
            'status': str(record.get(config.get('status_field', ''), '')),
            'backup_time': datetime.utcnow().isoformat(),
        }

        # 提取關鍵欄位
        key_fields = config.get('key_fields', {})
        date_fields = {'start_date', 'end_date', 'order_date'}
        numeric_fields = {'price', 'order_amount', 'quantity', 'unit_price'}

        for field_name, field_id in key_fields.items():
            value = record.get(field_id, '')
            if isinstance(value, str):
                value = value.strip()

            # 處理日期欄位
            if field_name in date_fields:
                value = self._parse_date(value) if value else None
            # 處理數值欄位
            elif field_name in numeric_fields:
                if not value:
                    value = None
                else:
                    try:
                        value = float(str(value).replace(',', ''))
                    except (ValueError, TypeError):
                        value = None

            row[field_name] = value

        return row

    def _parse_date(self, date_str: str) -> Optional[str]:
        """解析日期字串為 YYYY-MM-DD 格式"""
        if not date_str:
            return None

        for fmt in ['%Y/%m/%d', '%Y-%m-%d', '%Y/%m/%d %H:%M:%S', '%Y-%m-%d %H:%M:%S']:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        return None

    def insert_rows(self, rows: List[Dict[str, Any]], table_name: str) -> int:
        """批次插入資料"""
        if not rows:
            return 0

        table_id = self._get_table_id(table_name)
        batch_size = 500
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

            # 進度報告
            if (i + batch_size) % 10000 == 0 or i + batch_size >= len(rows):
                logger.info(f"Progress: {min(i + batch_size, len(rows))} / {len(rows)} rows")

        if total_errors > 0:
            logger.warning(f"Total insert errors: {total_errors} rows failed")

        return total_inserted

    def upload_sheet(self, sheet_code: str, truncate: bool = True) -> Dict[str, Any]:
        """上傳單一表格"""
        config = SHEET_CONFIG.get(sheet_code)
        if not config:
            return {'status': 'error', 'error': f'Unknown sheet code: {sheet_code}'}

        table_name = config['bq_table']
        sheet_name = config['name']

        logger.info(f"{'='*50}")
        logger.info(f"Uploading {sheet_code} ({sheet_name})")

        # 尋找檔案
        file_path = self.find_data_file(sheet_code)
        if not file_path:
            logger.warning(f"No data file found for {sheet_code}")
            return {'status': 'skipped', 'reason': 'No data file'}

        logger.info(f"Using file: {file_path.name}")

        try:
            # 載入記錄
            records = self.load_records(file_path)
            logger.info(f"Loaded {len(records)} records from file")

            if not records:
                return {'status': 'success', 'loaded': 0, 'inserted': 0}

            # 清空表格
            if truncate:
                removed = self.truncate_table(table_name)
            else:
                removed = 0

            # 準備資料
            rows = []
            for record in records:
                row = self.prepare_row(record, sheet_code, config)
                rows.append(row)

            # 插入資料
            inserted = self.insert_rows(rows, table_name)

            logger.info(f"Completed: {inserted} rows inserted")

            return {
                'status': 'success',
                'file': file_path.name,
                'loaded': len(records),
                'inserted': inserted,
                'removed': removed,
            }

        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return {'status': 'error', 'error': str(e)}

    def upload_all(self, truncate: bool = True, dry_run: bool = False) -> Dict[str, Any]:
        """上傳全部表格"""
        results = {
            'sheets': {},
            'total_loaded': 0,
            'total_inserted': 0,
            'success_count': 0,
            'failed_count': 0,
        }

        # 排除管理表
        sheet_codes = [code for code in SHEET_CONFIG.keys()
                       if code not in ('backup_status', 'backup_logs')]

        if dry_run:
            logger.info("=== DRY RUN MODE ===")
            for sheet_code in sheet_codes:
                file_path = self.find_data_file(sheet_code)
                config = SHEET_CONFIG.get(sheet_code, {})
                if file_path:
                    records = self.load_records(file_path)
                    logger.info(f"  {sheet_code} ({config.get('name', '')}): {len(records)} records from {file_path.name}")
                else:
                    logger.info(f"  {sheet_code} ({config.get('name', '')}): No data file found")
            return results

        for sheet_code in sheet_codes:
            result = self.upload_sheet(sheet_code, truncate=truncate)
            results['sheets'][sheet_code] = result

            if result.get('status') == 'success':
                results['success_count'] += 1
                results['total_loaded'] += result.get('loaded', 0)
                results['total_inserted'] += result.get('inserted', 0)
            elif result.get('status') == 'error':
                results['failed_count'] += 1

        # 輸出摘要
        logger.info("=" * 60)
        logger.info("UPLOAD SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Success: {results['success_count']}, Failed: {results['failed_count']}")
        logger.info(f"Total loaded: {results['total_loaded']}")
        logger.info(f"Total inserted: {results['total_inserted']}")

        return results


def main():
    parser = argparse.ArgumentParser(description='Upload local data to BigQuery')
    parser.add_argument('--all', '-a', action='store_true', help='Upload all sheets')
    parser.add_argument('--sheet', '-s', type=str, help='Sheet code to upload')
    parser.add_argument('--confirm', action='store_true', help='Confirm execution (required for actual upload)')
    parser.add_argument('--no-truncate', action='store_true', help='Do not truncate table before upload')

    args = parser.parse_args()

    if not args.all and not args.sheet:
        parser.error('Please specify --all or --sheet')

    uploader = LocalDataUploader()

    if args.all:
        if not args.confirm:
            logger.info("Running in DRY RUN mode. Use --confirm to execute.")
            uploader.upload_all(dry_run=True)
        else:
            uploader.upload_all(truncate=not args.no_truncate)
    else:
        if not args.confirm:
            logger.info("Running in DRY RUN mode. Use --confirm to execute.")
            file_path = uploader.find_data_file(args.sheet)
            if file_path:
                records = uploader.load_records(file_path)
                logger.info(f"Would upload {len(records)} records from {file_path.name}")
            else:
                logger.info(f"No data file found for sheet {args.sheet}")
        else:
            uploader.upload_sheet(args.sheet, truncate=not args.no_truncate)


if __name__ == '__main__':
    main()
