"""
Ragic ERP 資料平台 - Cloud Function 入口點

功能：
- 增量備份系統 (backup_erp_data)
- 資料清洗系統 (clean_erp_data)
"""
import json
import logging
import os
from datetime import datetime, date, timezone, timedelta
import functions_framework
from flask import Request
from google.cloud import bigquery

# 台北時區 (UTC+8)
TAIPEI_TZ = timezone(timedelta(hours=8))


def get_taipei_today() -> date:
    """取得台北時區的今天日期（避免 Cloud Function 使用 UTC）"""
    return datetime.now(TAIPEI_TZ).date()


# 使用絕對導入 (Cloud Function 需要)
from app.backup.incremental import IncrementalBackup
from app.utils.email import send_failure_notification

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

        # 備份成功後直接執行資料清洗
        skip_cleaning = request_json.get('skip_cleaning', False)
        if not skip_cleaning and result.get('failed_count', 0) == 0:
            logger.info("Backup completed successfully, starting data cleaning...")
            cleaning_result = _execute_cleaning(backup_date=get_taipei_today())
            result['cleaning'] = cleaning_result
        elif skip_cleaning:
            logger.info("Cleaning skipped by request")
        else:
            logger.warning("Cleaning skipped due to backup failures")

        return json.dumps(result, ensure_ascii=False, default=str), 200, {
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


def _log_cleaning_summary(result: dict):
    """記錄清洗摘要"""
    logger.info("=" * 60)
    logger.info("Cleaning Summary")
    logger.info("=" * 60)
    logger.info(f"Date: {result.get('date', 'N/A')}")
    logger.info(f"Duration: {result.get('duration_seconds', 0):.2f}s")
    logger.info(f"Total processed: {result.get('total_processed', 0)}")
    logger.info(f"Auto fixed: {result.get('auto_fixed', 0)}")
    logger.info(f"AI fixed: {result.get('ai_fixed', 0)}")
    logger.info(f"Manual required: {result.get('manual_required', 0)}")
    if result.get('errors'):
        logger.warning(f"Errors: {result['errors']}")
    logger.info("=" * 60)


def _execute_cleaning(backup_date: date, send_notification: bool = True) -> dict:
    """
    內部清洗執行函數

    Args:
        backup_date: 清洗日期
        send_notification: 是否發送通知

    Returns:
        清洗結果字典
    """
    logger.info("=" * 60)
    logger.info("Ragic ERP Cleaning System - Starting (Internal)")
    logger.info("=" * 60)

    try:
        project_id = os.getenv('GCP_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT')
        dataset = os.getenv('BQ_DATASET')

        if not project_id:
            raise ValueError("GCP_PROJECT_ID 或 GOOGLE_CLOUD_PROJECT 環境變數未設定")
        if not dataset:
            raise ValueError("BQ_DATASET 環境變數未設定")

        bq_client = bigquery.Client(project=project_id)

        from app.cleaning.engine import CleaningEngine
        engine = CleaningEngine(
            bq_client=bq_client,
            project_id=project_id,
            dataset=dataset,
            rules_dir='rules',
            enable_notification=send_notification,
        )

        result = engine.run_daily_cleaning(
            backup_date=backup_date,
            send_notification=send_notification,
        )

        _log_cleaning_summary(result)
        return result

    except Exception as e:
        logger.error(f"Cleaning failed: {type(e).__name__}: {e}")
        return {
            'status': 'error',
            'error': str(e),
        }


# ============================================================
# 資料清洗系統入口點
# ============================================================

@functions_framework.http
def clean_erp_data(request: Request):
    """
    Cloud Function HTTP 入口點 - 資料清洗

    可選參數（透過 JSON body 傳入）：
    - backup_date: 清洗日期 (YYYY-MM-DD)，預設今天
    - table_codes: 要清洗的表格代碼列表（可選，預設全部）
    - send_notification: 是否發送通知（預設 True）
    """
    logger.info("=" * 60)
    logger.info("Ragic ERP Cleaning System - Starting")
    logger.info("=" * 60)

    try:
        # 解析請求參數
        request_json = request.get_json(silent=True) or {}

        # 解析日期
        backup_date_str = request_json.get('backup_date')
        if backup_date_str:
            backup_date = datetime.strptime(backup_date_str, '%Y-%m-%d').date()
        else:
            backup_date = get_taipei_today()

        send_notification = request_json.get('send_notification', True)

        logger.info(f"Cleaning date: {backup_date}")
        logger.info(f"Send notification: {send_notification}")

        # 必須明確設定環境變數，不使用硬編預設值
        project_id = os.getenv('GCP_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT')
        dataset = os.getenv('BQ_DATASET')

        if not project_id:
            raise ValueError("GCP_PROJECT_ID 或 GOOGLE_CLOUD_PROJECT 環境變數未設定")
        if not dataset:
            raise ValueError("BQ_DATASET 環境變數未設定")

        bq_client = bigquery.Client(project=project_id)

        # 初始化清洗引擎
        from app.cleaning.engine import CleaningEngine
        engine = CleaningEngine(
            bq_client=bq_client,
            project_id=project_id,
            dataset=dataset,
            rules_dir='rules',
            enable_notification=send_notification,
        )

        # 執行清洗
        result = engine.run_daily_cleaning(
            backup_date=backup_date,
            send_notification=send_notification,
        )

        # 記錄結果摘要
        _log_cleaning_summary(result)

        return json.dumps(result, ensure_ascii=False, default=str), 200, {
            'Content-Type': 'application/json'
        }

    except ValueError as e:
        # 參數驗證錯誤返回 400
        logger.warning(f"Invalid request: {e}")
        return json.dumps({'status': 'error', 'error': str(e)}), 400, {
            'Content-Type': 'application/json'
        }
    except Exception as e:
        # 不記錄完整 exc_info，避免敏感資訊洩漏
        logger.error(f"Cleaning failed: {type(e).__name__}")

        error_result = {
            'status': 'error',
            'error': '內部錯誤，請稍後再試',
        }

        # 通知失敗不應覆蓋原錯誤
        try:
            send_failure_notification(error_result, error_details=f"清洗系統錯誤: {type(e).__name__}")
        except Exception:
            logger.warning("發送失敗通知時出錯")

        return json.dumps(error_result), 500, {
            'Content-Type': 'application/json'
        }


# ============================================================
# 本地測試入口
# ============================================================

if __name__ == '__main__':
    from flask import Flask

    app = Flask(__name__)

    @app.route('/backup', methods=['POST'])
    def backup():
        from flask import request
        return backup_erp_data(request)

    @app.route('/clean', methods=['POST'])
    def clean():
        from flask import request
        return clean_erp_data(request)

    @app.route('/health', methods=['GET'])
    def health():
        return {'status': 'ok'}

    app.run(host='0.0.0.0', port=8080, debug=True)
