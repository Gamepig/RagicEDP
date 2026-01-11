"""
BigQuery 服務

處理與 BigQuery 的所有互動
"""
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
import logging
import os

from google.cloud import bigquery

import json

logger = logging.getLogger(__name__)


def _parse_json_field(value) -> dict:
    """將 JSON 欄位解析為字典"""
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return {}
    return {}

# 表格對照
TABLE_MAPPING = {
    '10': 'dim_brand',
    '20': 'dim_channel',
    '30': 'dim_payment',
    '40': 'dim_logistics',
    '41': 'dim_postal',
    '50': 'fact_orders',
    '60': 'dim_customer',
    '70': 'dim_product',
    '80': 'dim_campaign',
    '99': 'fact_order_details',
}


class BigQueryService:
    """BigQuery 服務"""

    def __init__(
        self,
        project_id: Optional[str] = None,
        dataset: Optional[str] = None,
    ):
        """
        初始化 BigQuery 服務

        Args:
            project_id: GCP 專案 ID
            dataset: BigQuery 資料集名稱
        """
        self.project_id = project_id or os.getenv("GCP_PROJECT_ID", "b25h01-ragic")
        self.dataset = dataset or os.getenv("BQ_DATASET", "erp_backup")
        self.client = bigquery.Client(project=self.project_id)

    def get_pending_records(
        self,
        table_code: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        取得待處理記錄

        Args:
            table_code: 表格代碼（可選，不指定則查詢所有表）
            limit: 每頁筆數
            offset: 偏移量

        Returns:
            {
                'records': List[Dict],
                'total': int,
                'limit': int,
                'offset': int,
            }
        """
        # 建構查詢（使用清洗結果表）
        query = f"""
            SELECT
                record_id,
                table_code,
                original_values,
                fixed_values,
                violation_count,
                ai_suggestion,
                confidence_score,
                cleaned_at
            FROM `{self.project_id}.{self.dataset}.cleaning_results`
            WHERE status = 'manual'
        """

        params = []

        if table_code:
            query += " AND table_code = @table_code"
            params.append(bigquery.ScalarQueryParameter("table_code", "STRING", table_code))

        # 計算總數
        count_query = f"""
            SELECT COUNT(*) as total
            FROM `{self.project_id}.{self.dataset}.cleaning_results`
            WHERE status = 'manual'
        """
        if table_code:
            count_query += " AND table_code = @table_code"

        count_job_config = bigquery.QueryJobConfig(
            query_parameters=params,
            use_query_cache=False  # 禁用查詢快取，確保即時資料
        )
        count_result = self.client.query(count_query, job_config=count_job_config).result()
        total = list(count_result)[0].total

        # 分頁查詢
        query += " ORDER BY cleaned_at DESC LIMIT @limit OFFSET @offset"
        params.extend([
            bigquery.ScalarQueryParameter("limit", "INT64", limit),
            bigquery.ScalarQueryParameter("offset", "INT64", offset),
        ])

        job_config = bigquery.QueryJobConfig(
            query_parameters=params,
            use_query_cache=False  # 禁用查詢快取，確保即時資料
        )
        result = self.client.query(query, job_config=job_config).result()

        records = []
        for row in result:
            # ai_suggestion 可能是 JSON 字串，直接保留為字串
            ai_suggestion = row.ai_suggestion
            if isinstance(ai_suggestion, dict):
                import json
                ai_suggestion = json.dumps(ai_suggestion, ensure_ascii=False)

            records.append({
                'record_id': row.record_id,
                'table_code': row.table_code,
                'original_values': _parse_json_field(row.original_values),
                'fixed_values': _parse_json_field(row.fixed_values),
                'violation_count': row.violation_count,
                'ai_suggestion': ai_suggestion,
                'confidence_score': row.confidence_score,
                'cleaned_at': row.cleaned_at.isoformat() if row.cleaned_at else None,
            })

        return {
            'records': records,
            'total': total,
            'limit': limit,
            'offset': offset,
        }

    def get_record_detail(self, record_id: str) -> Optional[Dict[str, Any]]:
        """
        取得記錄詳情（含違規詳情）

        Args:
            record_id: 記錄 ID

        Returns:
            記錄詳情或 None
        """
        # 使用 LEFT JOIN 同時查詢 cleaning_results 和 cleaning_anomalies
        query = f"""
            SELECT
                cr.record_id,
                cr.table_code,
                cr.original_values,
                cr.fixed_values,
                cr.violation_count,
                cr.ai_suggestion,
                cr.confidence_score,
                cr.cleaned_at,
                cr.status,
                ca.violations
            FROM `{self.project_id}.{self.dataset}.cleaning_results` cr
            LEFT JOIN `{self.project_id}.{self.dataset}.cleaning_anomalies` ca
              ON cr.record_id = ca.record_id
            WHERE cr.record_id = @record_id
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("record_id", "STRING", record_id),
            ]
        )

        result = self.client.query(query, job_config=job_config).result()
        rows = list(result)

        if not rows:
            return None

        row = rows[0]
        # ai_suggestion 可能是 JSON 字串，直接保留為字串
        ai_suggestion = row.ai_suggestion
        if isinstance(ai_suggestion, dict):
            ai_suggestion = json.dumps(ai_suggestion, ensure_ascii=False)

        # 解析 violations JSON
        violations = _parse_json_field(row.violations) if hasattr(row, 'violations') and row.violations else []
        # 如果 violations 是 list，直接使用；如果是 dict，包成 list
        if isinstance(violations, dict):
            violations = [violations]
        elif not isinstance(violations, list):
            violations = []

        return {
            'record_id': row.record_id,
            'table_code': row.table_code,
            'original_values': _parse_json_field(row.original_values),
            'fixed_values': _parse_json_field(row.fixed_values),
            'violation_count': row.violation_count,
            'ai_suggestion': ai_suggestion,
            'confidence_score': row.confidence_score,
            'cleaned_at': row.cleaned_at.isoformat() if row.cleaned_at else None,
            'status': row.status,
            'violations': violations,
        }

    def apply_correction(
        self,
        record_id: str,
        fixed_values: Dict[str, Any],
        corrected_by: str = "user",
    ) -> Dict[str, Any]:
        """
        套用修正（含狀態檢查與併發保護）

        Args:
            record_id: 記錄 ID
            fixed_values: 修正後的值
            corrected_by: 修正者

        Returns:
            修正結果

        Raises:
            ValueError: 記錄不存在或狀態不正確
        """
        import json

        now = datetime.now(timezone.utc)

        # 將 fixed_values 轉為 JSON 字串
        fixed_values_json = json.dumps(fixed_values, ensure_ascii=False)

        # 條件更新：只允許修正 status='manual' 的記錄（併發保護）
        query = f"""
            UPDATE `{self.project_id}.{self.dataset}.cleaning_results`
            SET
                fixed_values = PARSE_JSON(@fixed_values_json),
                status = 'completed',
                corrected_at = @corrected_at,
                corrected_by = @corrected_by
            WHERE record_id = @record_id
              AND status = 'manual'
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("fixed_values_json", "STRING", fixed_values_json),
                bigquery.ScalarQueryParameter("corrected_at", "TIMESTAMP", now),
                bigquery.ScalarQueryParameter("corrected_by", "STRING", corrected_by),
                bigquery.ScalarQueryParameter("record_id", "STRING", record_id),
            ]
        )

        result = self.client.query(query, job_config=job_config).result()

        # 檢查是否有更新
        if result.num_dml_affected_rows == 0:
            raise ValueError(f"記錄 {record_id} 不存在或已被處理")

        logger.info(f"已套用修正: record_id={record_id}")

        return {
            'success': True,
            'record_id': record_id,
            'corrected_at': now.isoformat(),
        }

    def get_correction_history(
        self,
        table_code: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        取得修正歷史

        Args:
            table_code: 表格代碼
            date_from: 開始日期
            date_to: 結束日期
            limit: 限制筆數

        Returns:
            修正歷史列表
        """
        query = f"""
            SELECT
                record_id,
                table_code,
                original_values,
                fixed_values,
                cleaned_at,
                cleaned_by
            FROM `{self.project_id}.{self.dataset}.cleaning_results`
            WHERE status = 'completed'
        """

        params = []

        if table_code:
            query += " AND table_code = @table_code"
            params.append(bigquery.ScalarQueryParameter("table_code", "STRING", table_code))

        if date_from:
            query += " AND cleaned_at >= @date_from"
            params.append(bigquery.ScalarQueryParameter("date_from", "STRING", date_from))

        if date_to:
            query += " AND cleaned_at <= @date_to"
            params.append(bigquery.ScalarQueryParameter("date_to", "STRING", date_to))

        query += " ORDER BY cleaned_at DESC LIMIT @limit"
        params.append(bigquery.ScalarQueryParameter("limit", "INT64", limit))

        job_config = bigquery.QueryJobConfig(query_parameters=params)
        result = self.client.query(query, job_config=job_config).result()

        history = []
        for row in result:
            history.append({
                'record_id': row.record_id,
                'table_code': row.table_code,
                'original_values': _parse_json_field(row.original_values),
                'fixed_values': _parse_json_field(row.fixed_values),
                'cleaned_at': row.cleaned_at.isoformat() if row.cleaned_at else None,
                'cleaned_by': row.cleaned_by,
            })

        return history

    def get_statistics(self) -> Dict[str, Any]:
        """
        取得統計資訊

        Returns:
            統計資訊
        """
        query = f"""
            SELECT
                status,
                COUNT(*) as count
            FROM `{self.project_id}.{self.dataset}.cleaning_results`
            GROUP BY status
        """

        result = self.client.query(query).result()

        stats = {
            'pending': 0,
            'manual': 0,
            'completed': 0,
            'auto_fixed': 0,
            'ai_fixed': 0,
        }

        for row in result:
            if row.status in stats:
                stats[row.status] = row.count

        return stats
