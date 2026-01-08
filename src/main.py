"""
Ragic ERP Backup System v3 - Cloud Function 入口點

簡化版：
- 使用固定時間基準（昨天 00:00）
- 失敗時發送 Email 通知
"""
import json
import logging
import functions_framework
from flask import Request

from .incremental import IncrementalBackup
from .utils.email import send_failure_notification

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@functions_framework.http
def backup_erp_data(request: Request):
    """
    Cloud Function HTTP 入口點

    可選參數（透過 JSON body 傳入）：
    - sheet_codes: 要備份的表格代碼列表（可選，預設全部）
    """
    logger.info("=" * 60)
    logger.info("Ragic ERP Backup System v3 - Starting")
    logger.info("=" * 60)

    try:
        # 解析請求參數
        request_json = request.get_json(silent=True) or {}
        sheet_codes = request_json.get('sheet_codes')

        if sheet_codes:
            logger.info(f"Requested sheets: {sheet_codes}")
        else:
            logger.info("Backing up all sheets")

        # 執行增量備份
        backup = IncrementalBackup()
        result = backup.run(sheet_codes=sheet_codes)

        # 記錄結果摘要
        _log_summary(result)

        # 檢查是否有失敗
        if result.get('failed_count', 0) > 0:
            logger.warning("Some sheets failed, sending notification...")
            send_failure_notification(result)

        return json.dumps(result, ensure_ascii=False), 200, {
            'Content-Type': 'application/json'
        }

    except Exception as e:
        logger.error(f"Backup failed with error: {e}", exc_info=True)

        # 發送失敗通知
        error_result = {
            'status': 'error',
            'error': str(e),
            'failed_count': 1,
        }
        send_failure_notification(error_result, error_details=str(e))

        return json.dumps(error_result), 500, {
            'Content-Type': 'application/json'
        }


def _log_summary(result: dict):
    """記錄備份摘要"""
    logger.info("=" * 60)
    logger.info("Backup Summary")
    logger.info("=" * 60)
    logger.info(f"Base time: {result.get('base_time', 'N/A')}")
    logger.info(f"Duration: {result.get('duration_seconds', 0):.2f}s")
    logger.info(f"Total fetched: {result.get('total_fetched', 0)}")
    logger.info(f"Total inserted: {result.get('total_inserted', 0)}")
    logger.info(f"Total updated: {result.get('total_updated', 0)}")
    logger.info(f"Total filtered: {result.get('total_filtered', 0)}")
    logger.info(f"Success: {result.get('success_count', 0)}, Failed: {result.get('failed_count', 0)}")
    logger.info("=" * 60)


# 本地測試入口
if __name__ == '__main__':
    from flask import Flask

    app = Flask(__name__)

    @app.route('/backup', methods=['POST'])
    def backup():
        from flask import request
        return backup_erp_data(request)

    @app.route('/health', methods=['GET'])
    def health():
        return {'status': 'ok'}

    app.run(host='0.0.0.0', port=8080, debug=True)
