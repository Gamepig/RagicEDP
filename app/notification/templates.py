"""
通知訊息模板

定義清洗報告的訊息格式
"""
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple

from .config import get_config
from ..config import now_taipei

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


def build_cleaning_report_email(result: Dict[str, Any]) -> Tuple[str, str]:
    """
    建構清洗報告 Email

    Args:
        result: 清洗結果

    Returns:
        (subject, body)
    """
    config = get_config()

    date_str = result.get('date', 'Unknown')
    manual_count = result.get('manual_required', 0)

    subject = f"[RagicEDP] 資料清洗報告 - {date_str}"
    if manual_count > 0:
        subject += f" ({manual_count} 筆待處理)"

    # 建構 Email 內容
    lines = [
        "=" * 60,
        "RagicEDP 資料清洗報告",
        "=" * 60,
        "",
        f"日期: {date_str}",
        f"處理時間: {result.get('duration_seconds', 0):.1f} 秒",
        "",
        "【處理統計】",
        f"  總處理筆數: {result.get('total_processed', 0)}",
        f"  自動修正: {result.get('auto_fixed', 0)}",
        f"  AI 修正: {result.get('ai_fixed', 0)}",
        f"  需人工處理: {manual_count}",
        "",
    ]

    # 各表統計
    tables = result.get('tables', {})
    if tables:
        lines.append("【各表統計】")
        for table_code, table_result in tables.items():
            table_name = TABLE_NAMES.get(table_code, f"表格{table_code}")
            status = table_result.get('status', 'unknown')

            if status == 'skipped':
                lines.append(f"  {table_name}: 略過 ({table_result.get('reason', '')})")
            else:
                processed = table_result.get('processed', 0)
                manual = table_result.get('manual_required', 0)
                if manual > 0:
                    lines.append(f"  {table_name}: {processed} 筆 (待處理: {manual})")
                else:
                    lines.append(f"  {table_name}: {processed} 筆")
        lines.append("")

    # 錯誤資訊
    errors = result.get('errors', [])
    if errors:
        lines.append("【錯誤資訊】")
        for error in errors[:5]:  # 最多顯示 5 個
            lines.append(f"  - {error}")
        if len(errors) > 5:
            lines.append(f"  ... 還有 {len(errors) - 5} 個錯誤")
        lines.append("")

    # 待處理連結
    if manual_count > 0:
        lines.extend([
            "【待處理清單】",
            f"請登入資料修正介面處理：",
            f"{config.correction_app_url}",
            "",
        ])

    lines.extend([
        "=" * 60,
        "此郵件由 RagicEDP 系統自動發送，請勿直接回覆",
        "=" * 60,
    ])

    body = "\n".join(lines)
    return subject, body


def build_cleaning_report_line(result: Dict[str, Any]) -> str:
    """
    建構清洗報告 LINE 訊息

    Args:
        result: 清洗結果

    Returns:
        LINE 訊息文字
    """
    config = get_config()

    date_str = result.get('date', 'Unknown')
    total = result.get('total_processed', 0)
    auto_fixed = result.get('auto_fixed', 0)
    ai_fixed = result.get('ai_fixed', 0)
    manual = result.get('manual_required', 0)

    # 根據結果決定標題圖示
    if manual > 0:
        icon = "!!"
        status = "需人工處理"
    elif total == 0:
        icon = "[]"
        status = "無新資料"
    else:
        icon = "OK"
        status = "處理完成"

    lines = [
        f"{icon} RagicEDP 清洗報告",
        f"日期: {date_str}",
        "",
        f"處理統計:",
        f"  總處理: {total} 筆",
        f"  自動修正: {auto_fixed} 筆",
        f"  AI修正: {ai_fixed} 筆",
        f"  待人工: {manual} 筆",
    ]

    if manual > 0:
        lines.extend([
            "",
            f"處理連結:",
            f"{config.correction_app_url}",
        ])

    return "\n".join(lines)


def build_error_notification_email(
    error_type: str,
    error_message: str,
    context: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """
    建構錯誤通知 Email

    Args:
        error_type: 錯誤類型
        error_message: 錯誤訊息（應已遮罩敏感資訊）
        context: 額外上下文（應已遮罩敏感資訊）

    Returns:
        (subject, body)
    """
    # 使用 UTC 時間
    now = now_taipei()

    subject = f"[RagicEDP 錯誤] {error_type}"

    lines = [
        "=" * 60,
        "RagicEDP 錯誤通知",
        "=" * 60,
        "",
        f"發生時間: {now.isoformat()}",
        f"錯誤類型: {error_type}",
        "",
        "【錯誤訊息】",
        error_message,
        "",
    ]

    if context:
        lines.append("【上下文資訊】")
        for key, value in context.items():
            lines.append(f"  {key}: {value}")
        lines.append("")

    lines.extend([
        "=" * 60,
        "請盡速處理此錯誤",
        "=" * 60,
    ])

    body = "\n".join(lines)
    return subject, body
