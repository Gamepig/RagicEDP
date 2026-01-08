"""
Ragic ERP Backup System v2 - 週報生成模組
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

from google.cloud import bigquery

from .config import BIGQUERY_CONFIG, SHEET_CONFIG

logger = logging.getLogger(__name__)


class ReportGenerator:
    """週報生成器"""

    def __init__(self):
        self.client = bigquery.Client(project=BIGQUERY_CONFIG['project_id'])
        self.dataset = BIGQUERY_CONFIG['dataset']
        self.project = BIGQUERY_CONFIG['project_id']

    def _get_table_id(self, table_name: str) -> str:
        return f"{self.project}.{self.dataset}.{table_name}"

    def generate_weekly_report(
        self,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        生成週報資料

        Args:
            end_date: 報告結束日期（預設為今天）

        Returns:
            週報資料字典
        """
        if end_date is None:
            end_date = datetime.now()

        # 計算報告期間（過去 7 天）
        start_date = end_date - timedelta(days=7)

        report = {
            'start_date': start_date.strftime('%Y/%m/%d'),
            'end_date': end_date.strftime('%Y/%m/%d'),
            'generated_at': datetime.now().strftime('%Y/%m/%d %H:%M:%S'),
            'summary': {},
            'sheets': [],
            'daily': [],
        }

        # 取得期間內的備份日誌
        logs = self._get_backup_logs(start_date, end_date)

        # 計算總覽
        report['summary'] = self._calculate_summary(logs)

        # 各表統計
        report['sheets'] = self._calculate_sheet_stats(logs)

        # 每日明細
        report['daily'] = self._calculate_daily_stats(logs, start_date, end_date)

        return report

    def _get_backup_logs(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """取得期間內的備份日誌"""
        query = f"""
        SELECT
            backup_date,
            sheet_code,
            sheet_name,
            records_fetched,
            records_inserted,
            records_updated,
            records_filtered,
            status,
            error_message,
            duration_seconds
        FROM `{self._get_table_id('backup_logs')}`
        WHERE backup_date >= @start_date
          AND backup_date <= @end_date
        ORDER BY backup_date, sheet_code
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter(
                    "start_date", "DATE", start_date.strftime('%Y-%m-%d')
                ),
                bigquery.ScalarQueryParameter(
                    "end_date", "DATE", end_date.strftime('%Y-%m-%d')
                ),
            ]
        )

        try:
            result = self.client.query(query, job_config=job_config).result()
            return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error fetching backup logs: {e}")
            return []

    def _calculate_summary(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """計算總覽統計"""
        # 按日期分組計算執行次數
        dates = set()
        success_count = 0
        failed_count = 0
        total_inserted = 0
        total_updated = 0
        total_filtered = 0

        for log in logs:
            dates.add(log['backup_date'])
            if log['status'] == 'success':
                success_count += 1
            elif log['status'] == 'failed':
                failed_count += 1
            total_inserted += log['records_inserted'] or 0
            total_updated += log['records_updated'] or 0
            total_filtered += log['records_filtered'] or 0

        return {
            'execution_count': len(dates),
            'success_count': success_count,
            'failed_count': failed_count,
            'total_inserted': total_inserted,
            'total_updated': total_updated,
            'total_filtered': total_filtered,
        }

    def _calculate_sheet_stats(
        self,
        logs: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """計算各表統計"""
        sheet_stats = {}

        for log in logs:
            sheet_code = log['sheet_code']
            if sheet_code not in sheet_stats:
                config = SHEET_CONFIG.get(sheet_code, {})
                sheet_stats[sheet_code] = {
                    'code': sheet_code,
                    'name': config.get('name', log['sheet_name']),
                    'inserted': 0,
                    'updated': 0,
                    'filtered': 0,
                    'last_backup': None,
                }

            sheet_stats[sheet_code]['inserted'] += log['records_inserted'] or 0
            sheet_stats[sheet_code]['updated'] += log['records_updated'] or 0
            sheet_stats[sheet_code]['filtered'] += log['records_filtered'] or 0

            # 更新最後備份時間
            if log['status'] == 'success' and log['records_fetched'] > 0:
                backup_date = log['backup_date']
                if isinstance(backup_date, str):
                    backup_date = datetime.strptime(backup_date, '%Y-%m-%d')
                sheet_stats[sheet_code]['last_backup'] = backup_date.strftime('%Y/%m/%d')

        # 轉換為列表並排序
        result = list(sheet_stats.values())
        result.sort(key=lambda x: x['code'])

        return result

    def _calculate_daily_stats(
        self,
        logs: List[Dict[str, Any]],
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """計算每日統計"""
        daily_stats = {}

        # 初始化每一天
        current = start_date
        while current <= end_date:
            date_str = current.strftime('%Y-%m-%d')
            daily_stats[date_str] = {
                'date': current.strftime('%m/%d'),
                'weekday': self._get_weekday(current),
                'inserted': 0,
                'updated': 0,
                'filtered': 0,
                'status': '無備份',
            }
            current += timedelta(days=1)

        # 填入資料
        for log in logs:
            backup_date = log['backup_date']
            if isinstance(backup_date, datetime):
                date_str = backup_date.strftime('%Y-%m-%d')
            else:
                date_str = str(backup_date)

            if date_str in daily_stats:
                daily_stats[date_str]['inserted'] += log['records_inserted'] or 0
                daily_stats[date_str]['updated'] += log['records_updated'] or 0
                daily_stats[date_str]['filtered'] += log['records_filtered'] or 0

                if log['status'] == 'failed':
                    daily_stats[date_str]['status'] = '✗ 失敗'
                elif log['status'] == 'success':
                    if daily_stats[date_str]['status'] != '✗ 失敗':
                        daily_stats[date_str]['status'] = '✓ 成功'

        # 轉換為列表
        result = list(daily_stats.values())
        return result

    def _get_weekday(self, dt: datetime) -> str:
        """取得星期幾"""
        weekdays = ['一', '二', '三', '四', '五', '六', '日']
        return f"({weekdays[dt.weekday()]})"

    def format_text_report(self, report: Dict[str, Any]) -> str:
        """格式化為純文字報告"""
        lines = [
            "=" * 60,
            "Ragic ERP 備份週報",
            "=" * 60,
            f"報告期間: {report['start_date']} ~ {report['end_date']}",
            f"產生時間: {report['generated_at']}",
            "",
            "【總覽】",
            "┌" + "─" * 44 + "┐",
            f"│  執行次數: {report['summary']['execution_count']} 次" + " " * 28 + "│",
            f"│  成功: {report['summary']['success_count']} 次 | 失敗: {report['summary']['failed_count']} 次" + " " * 22 + "│",
            f"│  新增資料: {report['summary']['total_inserted']:,} 筆" + " " * 24 + "│",
            f"│  更新資料: {report['summary']['total_updated']:,} 筆" + " " * 24 + "│",
            f"│  過濾資料: {report['summary']['total_filtered']:,} 筆" + " " * 24 + "│",
            "└" + "─" * 44 + "┘",
            "",
            "【各表備份統計】",
        ]

        # 表頭
        lines.append("┌──────┬────────────┬───────┬───────┬───────┬─────────────┐")
        lines.append("│ Code │ 表格名稱    │ 新增  │ 更新  │ 過濾  │ 最後備份     │")
        lines.append("├──────┼────────────┼───────┼───────┼───────┼─────────────┤")

        total_inserted = 0
        total_updated = 0
        total_filtered = 0

        for sheet in report['sheets']:
            code = sheet['code'].ljust(4)
            name = sheet['name'].ljust(8)[:8]
            inserted = str(sheet['inserted']).rjust(5)
            updated = str(sheet['updated']).rjust(5)
            filtered = str(sheet['filtered']).rjust(5)
            last_backup = (sheet['last_backup'] or '(無新資料)').ljust(11)[:11]

            lines.append(
                f"│ {code} │ {name} │ {inserted} │ {updated} │ {filtered} │ {last_backup} │"
            )

            total_inserted += sheet['inserted']
            total_updated += sheet['updated']
            total_filtered += sheet['filtered']

        lines.append("├──────┼────────────┼───────┼───────┼───────┼─────────────┤")
        lines.append(
            f"│ 合計 │            │ {str(total_inserted).rjust(5)} │ "
            f"{str(total_updated).rjust(5)} │ {str(total_filtered).rjust(5)} │             │"
        )
        lines.append("└──────┴────────────┴───────┴───────┴───────┴─────────────┘")

        lines.append("")
        lines.append("【每日明細】")
        lines.append("┌────────────┬───────┬───────┬───────┬────────┐")
        lines.append("│ 日期        │ 新增  │ 更新  │ 過濾  │ 狀態   │")
        lines.append("├────────────┼───────┼───────┼───────┼────────┤")

        for day in report['daily']:
            date = f"{day['date']} {day['weekday']}".ljust(10)
            inserted = str(day['inserted']).rjust(5)
            updated = str(day['updated']).rjust(5)
            filtered = str(day['filtered']).rjust(5)
            status = day['status'].ljust(6)

            lines.append(
                f"│ {date} │ {inserted} │ {updated} │ {filtered} │ {status} │"
            )

        lines.append("└────────────┴───────┴───────┴───────┴────────┘")

        lines.extend([
            "",
            "【過濾記錄說明】",
            "過濾掉的記錄為關鍵欄位（如訂單編號、品牌編號等）為空的資料，",
            "這些資料無分析價值，已被跳過但不影響備份完整性。",
            "",
            "=" * 60,
            "此報告由系統自動產生，請勿直接回覆",
            "=" * 60,
        ])

        return "\n".join(lines)

    def format_html_report(self, report: Dict[str, Any]) -> str:
        """格式化為 HTML 報告"""
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: 'Microsoft JhengHei', Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .header {{ background: #4CAF50; color: white; padding: 20px; border-radius: 5px; text-align: center; }}
        .summary {{ background: #E3F2FD; padding: 15px; border-left: 5px solid #2196F3; border-radius: 5px; margin: 20px 0; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #f8f9fa; }}
        .success {{ color: #4CAF50; }}
        .failed {{ color: #f44336; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; text-align: center; }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0; }}
        .stat-box {{ background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }}
        .stat-value {{ font-size: 24px; font-weight: bold; color: #2196F3; }}
        .stat-label {{ font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Ragic ERP 備份週報</h1>
            <p>{report['start_date']} ~ {report['end_date']}</p>
        </div>

        <div class="summary">
            <h3>📈 總覽</h3>
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-value">{report['summary']['execution_count']}</div>
                    <div class="stat-label">執行次數</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">{report['summary']['total_inserted']:,}</div>
                    <div class="stat-label">新增資料</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">{report['summary']['total_updated']:,}</div>
                    <div class="stat-label">更新資料</div>
                </div>
            </div>
            <p>✅ 成功: {report['summary']['success_count']} 次 | ❌ 失敗: {report['summary']['failed_count']} 次</p>
        </div>

        <h3>📋 各表備份統計</h3>
        <table>
            <thead>
                <tr>
                    <th>Code</th>
                    <th>表格名稱</th>
                    <th>新增</th>
                    <th>更新</th>
                    <th>過濾</th>
                    <th>最後備份</th>
                </tr>
            </thead>
            <tbody>
"""
        for sheet in report['sheets']:
            last_backup = sheet['last_backup'] or '(無新資料)'
            html += f"""
                <tr>
                    <td>{sheet['code']}</td>
                    <td>{sheet['name']}</td>
                    <td>{sheet['inserted']:,}</td>
                    <td>{sheet['updated']:,}</td>
                    <td>{sheet['filtered']:,}</td>
                    <td>{last_backup}</td>
                </tr>
"""

        html += """
            </tbody>
        </table>

        <h3>📅 每日明細</h3>
        <table>
            <thead>
                <tr>
                    <th>日期</th>
                    <th>新增</th>
                    <th>更新</th>
                    <th>過濾</th>
                    <th>狀態</th>
                </tr>
            </thead>
            <tbody>
"""
        for day in report['daily']:
            status_class = 'success' if '成功' in day['status'] else ('failed' if '失敗' in day['status'] else '')
            html += f"""
                <tr>
                    <td>{day['date']} {day['weekday']}</td>
                    <td>{day['inserted']:,}</td>
                    <td>{day['updated']:,}</td>
                    <td>{day['filtered']:,}</td>
                    <td class="{status_class}">{day['status']}</td>
                </tr>
"""

        html += f"""
            </tbody>
        </table>

        <div class="footer">
            <p>📧 此報告由系統自動產生</p>
            <p>產生時間: {report['generated_at']}</p>
        </div>
    </div>
</body>
</html>
"""
        return html
