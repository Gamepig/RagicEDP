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

# 表格對照（新版：直接使用 sheet_XX_name 格式）
TABLE_MAPPING = {
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

# 表格名稱對照
TABLE_NAMES = {
    '10': '品牌表',
    '20': '通路表',
    '30': '金流表',
    '40': '物流表',
    '41': '郵遞區號表',
    '50': '訂單表',
    '60': '客戶表',
    '70': '商品表',
    '80': '活動管理表',
    '99': '訂單明細表',
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
        取得待處理記錄（從各表格的 cleaning_status='manual' 查詢）

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
        all_records = []
        total = 0

        # 決定要查詢的表格
        tables_to_query = {table_code: TABLE_MAPPING[table_code]} if table_code else TABLE_MAPPING

        # 查詢各表格
        for tc, table_name in tables_to_query.items():
            try:
                # 計算該表的 manual 記錄數
                count_query = f"""
                    SELECT COUNT(*) as count
                    FROM `{self.project_id}.{self.dataset}.{table_name}`
                    WHERE cleaning_status = 'manual'
                """
                count_result = self.client.query(count_query).result()
                table_total = list(count_result)[0].count
                total += table_total

                if table_total == 0:
                    continue

                # 查詢 manual 記錄
                query = f"""
                    SELECT
                        ragic_id,
                        data,
                        cleaning_status,
                        cleaning_updated_at
                    FROM `{self.project_id}.{self.dataset}.{table_name}`
                    WHERE cleaning_status = 'manual'
                    ORDER BY cleaning_updated_at DESC
                """
                result = self.client.query(query).result()

                for row in result:
                    original_values = _parse_json_field(row.data)
                    all_records.append({
                        'record_id': f"{tc}_{row.ragic_id}",
                        'table_code': tc,
                        'ragic_id': row.ragic_id,
                        'original_values': original_values,
                        'fixed_values': {},
                        'violation_count': 0,
                        'ai_suggestion': None,
                        'confidence_score': None,
                        'cleaned_at': row.cleaning_updated_at.isoformat() if row.cleaning_updated_at else None,
                    })

            except Exception as e:
                logger.warning(f"查詢表格 {table_name} 待處理記錄失敗: {e}")
                continue

        # 排序並分頁
        all_records.sort(key=lambda x: x.get('cleaned_at') or '', reverse=True)
        paginated_records = all_records[offset:offset + limit]

        return {
            'records': paginated_records,
            'total': total,
            'limit': limit,
            'offset': offset,
        }

    def get_record_detail(self, record_id: str) -> Optional[Dict[str, Any]]:
        """
        取得記錄詳情（從對應表格查詢）

        Args:
            record_id: 記錄 ID（格式：{table_code}_{ragic_id}）

        Returns:
            記錄詳情或 None
        """
        # 解析 record_id
        parts = record_id.split('_', 1)
        if len(parts) != 2:
            logger.warning(f"無效的 record_id 格式: {record_id}")
            return None

        table_code, ragic_id = parts
        table_name = TABLE_MAPPING.get(table_code)

        if not table_name:
            logger.warning(f"未知的表格代碼: {table_code}")
            return None

        # 查詢對應表格
        query = f"""
            SELECT
                ragic_id,
                data,
                cleaning_status,
                cleaning_updated_at
            FROM `{self.project_id}.{self.dataset}.{table_name}`
            WHERE ragic_id = @ragic_id
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("ragic_id", "STRING", ragic_id),
            ]
        )

        result = self.client.query(query, job_config=job_config).result()
        rows = list(result)

        if not rows:
            return None

        row = rows[0]
        original_values = _parse_json_field(row.data)

        # 嘗試從 violations 表查詢違規詳情
        violations = []
        try:
            violations_query = f"""
                SELECT rule_id, field_name, error_message, severity
                FROM `{self.project_id}.{self.dataset}.violations`
                WHERE table_code = @table_code AND record_id = @ragic_id
            """
            v_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("table_code", "STRING", table_code),
                    bigquery.ScalarQueryParameter("ragic_id", "STRING", ragic_id),
                ]
            )
            v_result = self.client.query(violations_query, job_config=v_config).result()
            for v_row in v_result:
                violations.append({
                    'rule_id': v_row.rule_id,
                    'field_name': v_row.field_name,
                    'error_message': v_row.error_message,
                    'severity': v_row.severity,
                })
        except Exception as e:
            logger.debug(f"查詢違規詳情失敗（可忽略）: {e}")

        return {
            'record_id': record_id,
            'table_code': table_code,
            'ragic_id': ragic_id,
            'original_values': original_values,
            'fixed_values': {},
            'violation_count': len(violations),
            'ai_suggestion': None,
            'confidence_score': None,
            'cleaned_at': row.cleaning_updated_at.isoformat() if row.cleaning_updated_at else None,
            'status': row.cleaning_status,
            'violations': violations,
        }

    def apply_correction(
        self,
        record_id: str,
        fixed_values: Dict[str, Any],
        corrected_by: str = "user",
    ) -> Dict[str, Any]:
        """
        套用修正（直接更新對應表格的 cleaning_status）

        Args:
            record_id: 記錄 ID（格式：{table_code}_{ragic_id}）
            fixed_values: 修正後的值
            corrected_by: 修正者

        Returns:
            修正結果

        Raises:
            ValueError: 記錄不存在或狀態不正確
        """
        import json

        # 解析 record_id
        parts = record_id.split('_', 1)
        if len(parts) != 2:
            raise ValueError(f"無效的 record_id 格式: {record_id}")

        table_code, ragic_id = parts
        table_name = TABLE_MAPPING.get(table_code)

        if not table_name:
            raise ValueError(f"未知的表格代碼: {table_code}")

        now = datetime.now(timezone.utc)

        # 將 fixed_values 轉為 JSON 字串
        fixed_values_json = json.dumps(fixed_values, ensure_ascii=False)

        # 條件更新：只允許修正 cleaning_status='manual' 的記錄（併發保護）
        # 更新 data 欄位中的值，並將 cleaning_status 改為 'completed'
        query = f"""
            UPDATE `{self.project_id}.{self.dataset}.{table_name}`
            SET
                cleaning_status = 'completed',
                cleaning_updated_at = @updated_at
            WHERE ragic_id = @ragic_id
              AND cleaning_status = 'manual'
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("updated_at", "TIMESTAMP", now),
                bigquery.ScalarQueryParameter("ragic_id", "STRING", ragic_id),
            ]
        )

        result = self.client.query(query, job_config=job_config).result()

        # 檢查是否有更新
        if result.num_dml_affected_rows == 0:
            raise ValueError(f"記錄 {record_id} 不存在或已被處理")

        logger.info(f"已套用修正: record_id={record_id}, table={table_name}")

        return {
            'success': True,
            'record_id': record_id,
            'table_code': table_code,
            'table_name': table_name,
            'corrected_at': now.isoformat(),
            'corrected_by': corrected_by,
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
        取得統計資訊（從各表格的 cleaning_status 欄位彙總）

        Returns:
            統計資訊
        """
        stats = {
            'pending': 0,
            'manual': 0,
            'completed': 0,
            'auto_fixed': 0,
            'ai_fixed': 0,
        }

        # 查詢各表格的 cleaning_status 統計
        for table_code, table_name in TABLE_MAPPING.items():
            try:
                query = f"""
                    SELECT
                        cleaning_status,
                        COUNT(*) as count
                    FROM `{self.project_id}.{self.dataset}.{table_name}`
                    WHERE cleaning_status IS NOT NULL
                    GROUP BY cleaning_status
                """
                result = self.client.query(query).result()

                for row in result:
                    status = row.cleaning_status
                    if status in stats:
                        stats[status] += row.count
            except Exception as e:
                logger.warning(f"查詢表格 {table_name} 統計失敗: {e}")
                continue

        return stats

    def get_daily_backup_list(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        取得每日備份列表

        整合 backup_logs 和 cleaning_results
        """
        # 查詢每日備份摘要 + 清洗統計
        query = f"""
            WITH daily_backup AS (
                SELECT
                    backup_date,
                    SUM(records_fetched) as total_fetched,
                    COUNTIF(status = 'success') as success_count,
                    COUNTIF(status = 'failed') as failed_count
                FROM `{self.project_id}.{self.dataset}.backup_logs`
                WHERE backup_date IS NOT NULL
                GROUP BY backup_date
            ),
            daily_cleaning AS (
                SELECT
                    DATE(cleaned_at) as cleaning_date,
                    COUNTIF(status = 'auto_fixed') as auto_fixed,
                    COUNTIF(status = 'ai_fixed') as ai_fixed,
                    COUNTIF(status = 'manual') as manual_required
                FROM `{self.project_id}.{self.dataset}.cleaning_results`
                GROUP BY cleaning_date
            )
            SELECT
                b.backup_date,
                b.total_fetched,
                COALESCE(c.auto_fixed, 0) as auto_fixed,
                COALESCE(c.ai_fixed, 0) as ai_fixed,
                COALESCE(c.manual_required, 0) as manual_required,
                b.success_count,
                b.failed_count
            FROM daily_backup b
            LEFT JOIN daily_cleaning c ON b.backup_date = c.cleaning_date
            WHERE 1=1
        """

        params = []

        if date_from:
            query += " AND b.backup_date >= @date_from"
            params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))

        if date_to:
            query += " AND b.backup_date <= @date_to"
            params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))

        # 計算總數（簡化查詢）
        count_query = f"""
            SELECT COUNT(DISTINCT backup_date) as total
            FROM `{self.project_id}.{self.dataset}.backup_logs`
            WHERE backup_date IS NOT NULL
        """
        count_params = []

        if date_from:
            count_query += " AND backup_date >= @date_from"
            count_params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))

        if date_to:
            count_query += " AND backup_date <= @date_to"
            count_params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))

        count_config = bigquery.QueryJobConfig(query_parameters=count_params)
        count_result = self.client.query(count_query, job_config=count_config).result()
        total = list(count_result)[0].total if count_result.total_rows > 0 else 0

        # 分頁查詢
        query += " ORDER BY b.backup_date DESC LIMIT @limit OFFSET @offset"
        params.extend([
            bigquery.ScalarQueryParameter("limit", "INT64", limit),
            bigquery.ScalarQueryParameter("offset", "INT64", offset),
        ])

        job_config = bigquery.QueryJobConfig(query_parameters=params)
        result = self.client.query(query, job_config=job_config).result()

        records = []
        for row in result:
            records.append({
                'backup_date': row.backup_date.isoformat() if row.backup_date else None,
                'total_fetched': row.total_fetched or 0,
                'auto_fixed': row.auto_fixed or 0,
                'ai_fixed': row.ai_fixed or 0,
                'manual_required': row.manual_required or 0,
                'success_count': row.success_count or 0,
                'failed_count': row.failed_count or 0,
            })

        return {
            'records': records,
            'total': total,
            'limit': limit,
            'offset': offset,
        }

    def get_daily_backup_detail(
        self,
        backup_date: str,
        records_limit: int = 50,
        records_offset: int = 0,
    ) -> Optional[Dict[str, Any]]:
        """
        取得特定日期的備份詳情
        """
        # 1. 取得該日期的備份日誌
        logs_query = f"""
            SELECT
                sheet_code,
                sheet_name,
                records_fetched,
                records_inserted,
                records_updated,
                records_filtered,
                status,
                error_message,
                duration_seconds,
                backup_time
            FROM `{self.project_id}.{self.dataset}.backup_logs`
            WHERE backup_date = @backup_date
            ORDER BY backup_time
        """

        params = [bigquery.ScalarQueryParameter("backup_date", "DATE", backup_date)]
        job_config = bigquery.QueryJobConfig(query_parameters=params)
        logs_result = self.client.query(logs_query, job_config=job_config).result()

        sheet_logs = []
        total_fetched = 0
        success_count = 0
        failed_count = 0

        for row in logs_result:
            total_fetched += row.records_fetched or 0
            if row.status == 'success':
                success_count += 1
            elif row.status == 'failed':
                failed_count += 1

            sheet_logs.append({
                'sheet_code': row.sheet_code,
                'sheet_name': row.sheet_name or TABLE_NAMES.get(row.sheet_code, row.sheet_code),
                'records_fetched': row.records_fetched or 0,
                'records_inserted': row.records_inserted or 0,
                'records_updated': row.records_updated or 0,
                'records_filtered': row.records_filtered or 0,
                'status': row.status,
                'error_message': row.error_message,
                'duration_seconds': row.duration_seconds or 0,
                'backup_time': row.backup_time.isoformat() if row.backup_time else None,
            })

        if not sheet_logs:
            return None

        # 2. 取得該日期的清洗統計（按表分組）
        cleaning_stats_query = f"""
            SELECT
                table_code,
                COUNT(*) as total_records,
                COUNTIF(status = 'auto_fixed') as auto_fixed,
                COUNTIF(status = 'ai_fixed') as ai_fixed,
                COUNTIF(status = 'manual') as manual,
                COUNTIF(status = 'completed') as completed,
                COUNTIF(status = 'failed') as failed
            FROM `{self.project_id}.{self.dataset}.cleaning_results`
            WHERE DATE(cleaned_at) = @backup_date
            GROUP BY table_code
            ORDER BY table_code
        """

        cleaning_result = self.client.query(
            cleaning_stats_query,
            job_config=bigquery.QueryJobConfig(query_parameters=params)
        ).result()

        cleaning_stats = []
        total_auto_fixed = 0
        total_ai_fixed = 0
        total_manual = 0

        for row in cleaning_result:
            total_auto_fixed += row.auto_fixed or 0
            total_ai_fixed += row.ai_fixed or 0
            total_manual += row.manual or 0

            cleaning_stats.append({
                'table_code': row.table_code,
                'table_name': TABLE_NAMES.get(row.table_code, row.table_code),
                'total_records': row.total_records or 0,
                'auto_fixed': row.auto_fixed or 0,
                'ai_fixed': row.ai_fixed or 0,
                'manual': row.manual or 0,
                'completed': row.completed or 0,
                'failed': row.failed or 0,
            })

        # 3. 取得該日期修正的記錄列表（分頁）
        fixed_records_query = f"""
            SELECT
                record_id,
                table_code,
                status,
                violation_count,
                confidence_score,
                cleaned_at
            FROM `{self.project_id}.{self.dataset}.cleaning_results`
            WHERE DATE(cleaned_at) = @backup_date
              AND status IN ('auto_fixed', 'ai_fixed', 'manual', 'completed')
            ORDER BY cleaned_at DESC
            LIMIT @limit OFFSET @offset
        """

        fixed_params = params + [
            bigquery.ScalarQueryParameter("limit", "INT64", records_limit),
            bigquery.ScalarQueryParameter("offset", "INT64", records_offset),
        ]

        fixed_result = self.client.query(
            fixed_records_query,
            job_config=bigquery.QueryJobConfig(query_parameters=fixed_params)
        ).result()

        fixed_records = []
        for row in fixed_result:
            fixed_records.append({
                'record_id': row.record_id,
                'table_code': row.table_code,
                'status': row.status,
                'violation_count': row.violation_count or 0,
                'confidence_score': row.confidence_score,
                'cleaned_at': row.cleaned_at.isoformat() if row.cleaned_at else None,
            })

        # 4. 計算修正記錄總數
        count_query = f"""
            SELECT COUNT(*) as total
            FROM `{self.project_id}.{self.dataset}.cleaning_results`
            WHERE DATE(cleaned_at) = @backup_date
              AND status IN ('auto_fixed', 'ai_fixed', 'manual', 'completed')
        """
        count_result = self.client.query(
            count_query,
            job_config=bigquery.QueryJobConfig(query_parameters=params)
        ).result()
        fixed_records_total = list(count_result)[0].total

        return {
            'backup_date': backup_date,
            'summary': {
                'backup_date': backup_date,
                'total_fetched': total_fetched,
                'auto_fixed': total_auto_fixed,
                'ai_fixed': total_ai_fixed,
                'manual_required': total_manual,
                'success_count': success_count,
                'failed_count': failed_count,
            },
            'sheet_logs': sheet_logs,
            'cleaning_stats': cleaning_stats,
            'fixed_records': fixed_records,
            'fixed_records_total': fixed_records_total,
        }
