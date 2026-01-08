"""
[DEPRECATED] Ragic ERP Backup System v2 - Ragic API 客戶端

==============================================================================
⚠️  此模組已棄用，請使用 src/incremental.py 替代
==============================================================================

棄用原因：
1. 分頁參數錯誤：使用 'qs' 而非正確的 'offset'，導致分頁失效
2. 架構過於複雜：包含不必要的狀態過濾和配置
3. 已被 v3 增量備份系統取代

新版模組：src/incremental.py
- 使用正確的 'offset' 分頁參數
- 簡化的時間基準計算（昨天 00:00）
- 清洗規則程式層處理

原始功能（已失效）：
- 並行分頁：當資料超過單頁時，並行抓取多頁加速
- 時間緩衝：增量時間往前推 60 秒，避免邊界遺漏
- 智慧批次：可配置的批次大小
"""
import warnings
warnings.warn(
    "ragic_client.py 已棄用，請使用 incremental.py 替代。"
    "此模組的分頁參數有誤（使用 qs 而非 offset）。",
    DeprecationWarning,
    stacklevel=2
)
import requests
import time
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

from .config import RAGIC_CONFIG, SHEET_CONFIG

# 優化配置
TIME_BUFFER_SECONDS = 60  # 時間緩衝：往前推 60 秒
MAX_PARALLEL_WORKERS = 4  # 最大並行數
ENABLE_PARALLEL_FETCH = True  # 是否啟用並行抓取

logger = logging.getLogger(__name__)


class RagicClient:
    """Ragic API 客戶端"""

    def __init__(self):
        self.base_url = RAGIC_CONFIG['base_url']
        self.api_key = RAGIC_CONFIG['api_key']
        self.page_size = RAGIC_CONFIG['page_size']
        self.max_pages = RAGIC_CONFIG['max_pages']
        self.timeout = RAGIC_CONFIG['timeout']
        self.max_retries = RAGIC_CONFIG['max_retries']

    def _get_headers(self) -> Dict[str, str]:
        """取得 API 請求標頭"""
        return {
            'Authorization': f'Basic {self.api_key}',
            'Content-Type': 'application/json',
        }

    def _build_url(self, sheet_code: str, params: Dict[str, Any]) -> str:
        """建構 API URL"""
        config = SHEET_CONFIG.get(sheet_code)
        if not config:
            raise ValueError(f"Unknown sheet code: {sheet_code}")

        url = f"{self.base_url}/{config['ragic_path']}"
        query_parts = ['api', 'v=3']

        for key, value in params.items():
            if key == 'where':
                # where 參數可以有多個
                if isinstance(value, list):
                    for w in value:
                        query_parts.append(f'where={w}')
                else:
                    query_parts.append(f'where={value}')
            else:
                query_parts.append(f'{key}={value}')

        return f"{url}?{'&'.join(query_parts)}"

    def fetch_incremental(
        self,
        sheet_code: str,
        last_modified_time: Optional[datetime] = None,
        include_status_filter: bool = True,
        use_time_buffer: bool = True
    ) -> List[Dict[str, Any]]:
        """
        增量抓取資料（優化版：並行分頁 + 時間緩衝）

        Args:
            sheet_code: 表格代碼
            last_modified_time: 上次同步時間（用於增量抓取）
            include_status_filter: 是否包含狀態過濾（Toggle-On）
            use_time_buffer: 是否使用時間緩衝（往前推 60 秒避免遺漏）

        Returns:
            抓取到的記錄列表
        """
        config = SHEET_CONFIG.get(sheet_code)
        if not config:
            raise ValueError(f"Unknown sheet code: {sheet_code}")

        # 建構 where 條件
        where_conditions = self._build_where_conditions(
            config, last_modified_time, include_status_filter, use_time_buffer
        )

        # 抓取第一頁
        first_page_records, first_page_time = self._fetch_first_page(
            sheet_code, config, where_conditions
        )

        if not first_page_records:
            logger.info(f"No records found from {config['name']}")
            return []

        all_records = first_page_records

        # 判斷是否需要分頁
        if len(first_page_records) >= self.page_size:
            # 需要抓取更多頁面
            if ENABLE_PARALLEL_FETCH:
                additional_records = self._fetch_remaining_pages_parallel(
                    sheet_code, config, where_conditions
                )
            else:
                additional_records = self._fetch_remaining_pages_sequential(
                    sheet_code, config, where_conditions
                )
            all_records.extend(additional_records)

        logger.info(f"Total fetched from {config['name']}: {len(all_records)} records")
        return all_records

    def _build_where_conditions(
        self,
        config: Dict[str, Any],
        last_modified_time: Optional[datetime],
        include_status_filter: bool,
        use_time_buffer: bool
    ) -> List[str]:
        """建構 where 條件"""
        where_conditions = []

        # 狀態過濾（只抓取啟用的記錄）
        status_field_id = config.get('status_field_id')
        if include_status_filter and status_field_id:
            where_conditions.append(f"{status_field_id},eq,Toggle-On")

        # 增量條件（只抓取修改時間大於上次同步時間的記錄）
        last_modified_field_id = config.get('last_modified_field_id')
        if last_modified_time and last_modified_field_id:
            # 時間緩衝：往前推 60 秒，避免邊界遺漏
            if use_time_buffer:
                buffered_time = last_modified_time - timedelta(seconds=TIME_BUFFER_SECONDS)
                logger.debug(
                    f"Time buffer applied: {last_modified_time} -> {buffered_time}"
                )
            else:
                buffered_time = last_modified_time

            time_str = buffered_time.strftime('%Y/%m/%d %H:%M:%S')
            where_conditions.append(f"{last_modified_field_id},gt,{time_str}")

        return where_conditions

    def _fetch_first_page(
        self,
        sheet_code: str,
        config: Dict[str, Any],
        where_conditions: List[str]
    ) -> Tuple[List[Dict[str, Any]], float]:
        """抓取第一頁並返回結果和耗時"""
        params = {'limit': self.page_size}
        if where_conditions:
            params['where'] = where_conditions

        url = self._build_url(sheet_code, params)
        logger.info(f"Fetching page 1 from {config['name']}...")

        start_time = time.time()
        records = self._fetch_page(url)
        elapsed = time.time() - start_time

        if records:
            logger.info(f"  Got {len(records)} records in {elapsed:.2f}s")
        return records, elapsed

    def _fetch_remaining_pages_parallel(
        self,
        sheet_code: str,
        config: Dict[str, Any],
        where_conditions: List[str]
    ) -> List[Dict[str, Any]]:
        """並行抓取剩餘頁面"""
        all_records = []
        start_time = time.time()

        # 預估需要抓取的頁數（保守估計）
        estimated_pages = min(self.max_pages - 1, 10)  # 最多並行 10 頁

        logger.info(f"Starting parallel fetch for up to {estimated_pages} more pages...")

        with ThreadPoolExecutor(max_workers=MAX_PARALLEL_WORKERS) as executor:
            futures = {}

            for page in range(2, estimated_pages + 2):
                offset = (page - 1) * self.page_size
                params = {
                    'limit': self.page_size,
                    'qs': offset,
                }
                if where_conditions:
                    params['where'] = where_conditions

                url = self._build_url(sheet_code, params)
                future = executor.submit(self._fetch_page, url)
                futures[future] = page

            # 收集結果
            pages_with_data = 0
            for future in as_completed(futures):
                page = futures[future]
                try:
                    records = future.result()
                    if records:
                        all_records.extend(records)
                        pages_with_data += 1
                        logger.info(f"  Page {page}: {len(records)} records")

                        # 如果這一頁不滿，後面的頁面也不用等了
                        if len(records) < self.page_size:
                            break
                except Exception as e:
                    logger.error(f"Error fetching page {page}: {e}")

        elapsed = time.time() - start_time
        logger.info(
            f"Parallel fetch completed: {len(all_records)} records "
            f"from {pages_with_data} pages in {elapsed:.2f}s"
        )
        return all_records

    def _fetch_remaining_pages_sequential(
        self,
        sheet_code: str,
        config: Dict[str, Any],
        where_conditions: List[str]
    ) -> List[Dict[str, Any]]:
        """串行抓取剩餘頁面（備用方案）"""
        all_records = []
        page = 2

        while page <= self.max_pages:
            offset = (page - 1) * self.page_size
            params = {
                'limit': self.page_size,
                'qs': offset,
            }
            if where_conditions:
                params['where'] = where_conditions

            url = self._build_url(sheet_code, params)
            logger.info(f"Fetching page {page} from {config['name']}...")

            records = self._fetch_page(url)
            if records:
                all_records.extend(records)
                logger.info(f"  Got {len(records)} records")

                if len(records) < self.page_size:
                    break
                page += 1
            else:
                break

        return all_records

    def _fetch_page(self, url: str) -> List[Dict[str, Any]]:
        """抓取單頁資料（含重試邏輯）"""
        for attempt in range(self.max_retries):
            try:
                response = requests.get(
                    url,
                    headers=self._get_headers(),
                    timeout=self.timeout
                )
                response.raise_for_status()

                data = response.json()

                # 檢查是否為錯誤回應
                if isinstance(data, dict) and data.get('status') == 'ERROR':
                    error_msg = data.get('msg', 'Unknown error')
                    logger.error(f"Ragic API error: {error_msg}")
                    raise RuntimeError(f"Ragic API error: {error_msg}")

                # Ragic API 返回格式：{ragic_id: {field_data}, ...}
                if isinstance(data, dict):
                    records = []
                    for ragic_id, record_data in data.items():
                        # 跳過元資料欄位和非字典值
                        if ragic_id.startswith('_'):
                            continue
                        if not isinstance(record_data, dict):
                            continue
                        record_data['_ragicId'] = ragic_id
                        records.append(record_data)
                    return records
                return []

            except requests.exceptions.Timeout:
                logger.warning(f"Timeout on attempt {attempt + 1}/{self.max_retries}")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)  # 指數退避
                else:
                    raise

            except requests.exceptions.RequestException as e:
                logger.error(f"Request error on attempt {attempt + 1}: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    raise

        return []

    def fetch_full(self, sheet_code: str) -> List[Dict[str, Any]]:
        """全量抓取資料（不含增量條件）"""
        return self.fetch_incremental(
            sheet_code,
            last_modified_time=None,
            include_status_filter=True
        )
