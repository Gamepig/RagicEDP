"""
[DEPRECATED] Ragic ERP Backup System v2 - 資料過濾模組

==============================================================================
⚠️  此模組已棄用，過濾邏輯已整合至 src/incremental.py
==============================================================================

棄用原因：
1. 過濾邏輯已整合到 incremental.py 的 _filter_records 方法
2. 簡化架構，減少模組依賴

新版位置：src/incremental.py 的 _filter_records() 方法

原過濾規則（已遷移）：
- 規則 A (嚴格模式, sheet 99)：關鍵欄位全部為空 → 跳過
- 規則 B (寬鬆模式, 其他表)：主鍵為空 → 跳過
- 規則 C (時間過濾)：最後修改日期為未來 → 跳過（避免重複抓取）
"""
import warnings
warnings.warn(
    "data_filter.py 已棄用，過濾邏輯已整合至 incremental.py。",
    DeprecationWarning,
    stacklevel=2
)
import logging
from datetime import datetime
from typing import Dict, List, Tuple, Any

from .config import SHEET_CONFIG, FIELD_NAME_TO_ID

logger = logging.getLogger(__name__)


class DataFilter:
    """資料過濾器"""

    def __init__(self):
        pass

    def filter_records(
        self,
        records: List[Dict[str, Any]],
        sheet_code: str
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        過濾記錄

        Args:
            records: 原始記錄列表
            sheet_code: 表格代碼

        Returns:
            (有效記錄列表, 被過濾的記錄數)
        """
        config = SHEET_CONFIG.get(sheet_code)
        if not config:
            logger.warning(f"Unknown sheet code: {sheet_code}, returning all records")
            return records, 0

        filter_mode = config.get('filter_mode', 'loose')
        last_modified_field = config.get('last_modified_field', '最後修改日期')

        valid_records = []
        filtered_count = 0
        future_date_count = 0
        now = datetime.now()

        for record in records:
            # 規則 C: 過濾未來日期的記錄
            if self._is_future_date(record, last_modified_field, now):
                future_date_count += 1
                filtered_count += 1
                continue

            # 規則 A/B: 主鍵/關鍵欄位驗證
            if filter_mode == 'strict':
                is_valid = self._validate_strict(record, config)
            else:
                is_valid = self._validate_loose(record, config)

            if is_valid:
                valid_records.append(record)
            else:
                filtered_count += 1

        if filtered_count > 0:
            log_msg = (
                f"Sheet {sheet_code} ({config['name']}): "
                f"filtered {filtered_count} records, kept {len(valid_records)}"
            )
            if future_date_count > 0:
                log_msg += f" (including {future_date_count} with future dates)"
            logger.info(log_msg)

        return valid_records, filtered_count

    def _is_future_date(
        self,
        record: Dict[str, Any],
        last_modified_field: str,
        now: datetime
    ) -> bool:
        """
        檢查記錄的修改日期是否為未來日期

        Args:
            record: 記錄資料
            last_modified_field: 最後修改日期欄位名稱
            now: 當前時間

        Returns:
            True 如果是未來日期，否則 False
        """
        modified_str = record.get(last_modified_field, '')
        if not modified_str:
            return False  # 沒有日期欄位，不過濾

        try:
            # 嘗試解析日期時間
            modified_time = datetime.strptime(modified_str, '%Y/%m/%d %H:%M:%S')
        except ValueError:
            try:
                modified_time = datetime.strptime(modified_str, '%Y/%m/%d %H:%M')
            except ValueError:
                try:
                    modified_time = datetime.strptime(modified_str, '%Y/%m/%d')
                except ValueError:
                    return False  # 無法解析，不過濾

        # 判斷是否為未來日期（超過當前時間 1 天以上視為異常）
        if modified_time > now:
            # 記錄警告（只在首次遇到時記錄，避免日誌過多）
            return True

        return False

    def _validate_strict(self, record: Dict[str, Any], config: Dict[str, Any]) -> bool:
        """
        嚴格模式驗證（用於 sheet 99）
        1. 主鍵為空 → 無效
        2. 關鍵欄位全部為空 → 無效（只要有一個有值就有效）
        """
        # Step 1: 檢查主鍵
        primary_key = config.get('primary_key', '')
        if primary_key == '_ragicId':
            ragic_id = record.get('_ragicId', '')
            if not self._is_valid_value(ragic_id):
                return False  # 主鍵為空，跳過

        # Step 2: 檢查關鍵欄位
        critical_fields = config.get('critical_fields', [])
        critical_field_ids = config.get('critical_field_ids', [])

        # 收集所有關鍵欄位是否有值
        has_any_value = False

        # 檢查中文欄位名
        for field_name in critical_fields:
            value = self._get_field_value(record, field_name)
            if self._is_valid_value(value):
                has_any_value = True
                break

        # 如果還沒找到有效值，檢查欄位 ID
        if not has_any_value:
            for field_id in critical_field_ids:
                value = record.get(field_id, '')
                if self._is_valid_value(value):
                    has_any_value = True
                    break

        return has_any_value

    def _validate_loose(self, record: Dict[str, Any], config: Dict[str, Any]) -> bool:
        """
        寬鬆模式驗證
        主鍵為空 → 無效
        """
        primary_key = config.get('primary_key', '')
        primary_key_field_id = config.get('primary_key_field_id', '')

        # 特殊處理 _ragicId
        if primary_key == '_ragicId':
            ragic_id = record.get('_ragicId', '')
            return self._is_valid_value(ragic_id)

        # 嘗試用欄位 ID 取值
        if primary_key_field_id:
            value = record.get(primary_key_field_id, '')
            if self._is_valid_value(value):
                return True

        # 嘗試用中文欄位名取值
        if primary_key:
            value = self._get_field_value(record, primary_key)
            if self._is_valid_value(value):
                return True

        return False

    def _get_field_value(self, record: Dict[str, Any], field_name: str) -> str:
        """取得欄位值（支援中文欄位名）"""
        # 直接用欄位名查找
        if field_name in record:
            return str(record[field_name]).strip()

        # 用欄位 ID 查找
        field_id = FIELD_NAME_TO_ID.get(field_name)
        if field_id and field_id in record:
            return str(record[field_id]).strip()

        return ''

    def _is_valid_value(self, value: Any) -> bool:
        """檢查值是否有效（非空）"""
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        if isinstance(value, (int, float)):
            return True
        return bool(value)
