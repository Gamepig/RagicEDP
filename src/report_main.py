"""
Ragic ERP Backup System v2 - 週報 Cloud Function 入口點
"""
import json
import logging
import functions_framework
from flask import Request

from .report_generator import ReportGenerator
from .email_sender import EmailSender

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@functions_framework.http
def send_weekly_report(request: Request):
    """
    Cloud Function HTTP 入口點 - 發送週報
    """
    logger.info("="*60)
    logger.info("Ragic ERP Backup System v2 - Weekly Report")
    logger.info("="*60)

    try:
        # 生成報告
        generator = ReportGenerator()
        report_data = generator.generate_weekly_report()

        # 格式化報告
        text_report = generator.format_text_report(report_data)
        html_report = generator.format_html_report(report_data)

        # 發送郵件
        sender = EmailSender()
        success = sender.send_weekly_report(
            text_report=text_report,
            html_report=html_report,
            start_date=report_data['start_date'],
            end_date=report_data['end_date']
        )

        if success:
            logger.info("Weekly report sent successfully")
            return json.dumps({
                'status': 'success',
                'message': 'Weekly report sent',
                'summary': report_data['summary']
            }, ensure_ascii=False), 200, {'Content-Type': 'application/json'}
        else:
            logger.error("Failed to send weekly report")
            return json.dumps({
                'status': 'error',
                'message': 'Failed to send email'
            }), 500, {'Content-Type': 'application/json'}

    except Exception as e:
        logger.error(f"Report generation failed: {e}", exc_info=True)
        return json.dumps({
            'status': 'error',
            'error': str(e)
        }), 500, {'Content-Type': 'application/json'}
