#!/usr/bin/env python3
"""
Ragic API 增量抓取範例程式

功能：從 Ragic API 抓取指定時間之後修改的資料

使用方式：
    # 設定環境變數
    export RAGIC_API_KEY="your_api_key_here"

    # 執行增量抓取
    uv run python scripts/incremental_fetch.py
"""

import os
import sys
import json
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import quote

# 加入日誌
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.utils.logger import (
    logger,
    log_section,
    log_file_saved,
    log_no_data,
)


# ============================================================
# 配置區域
# ============================================================

# Ragic API 設定
RAGIC_BASE_URL = "https://ap6.ragic.com/grefun"
RAGIC_API_KEY = os.getenv("RAGIC_API_KEY", "")

# 各表配置：code -> (path, 最後修改日期欄位ID, 表格名稱)
SHEET_CONFIG = {
    "10": ("forms8/5", "1000950", "品牌表"),
    "20": ("forms8/4", "1000939", "通路表"),
    "30": ("forms8/7", "1000961", "金流表"),
    "40": ("forms8/1", "1000750", "物流表"),
    "41": ("forms8/6", "1000972", "郵遞區號表"),
    "50": ("forms8/17", "1000990", "訂單表"),
    "60": ("forms8/2", "1000730", "客戶表"),
    "70": ("forms8/9", "1001013", "商品表"),
    "80": ("forms8/10", "1001030", "活動管理表"),
    "99": ("forms8/3", "1000834", "訂單明細表"),
}

# 輸出目錄
OUTPUT_DIR = Path("data/incremental")

# 時間戳記檔案
TIMESTAMP_FILE = OUTPUT_DIR / "last_sync_timestamps.json"


# ============================================================
# 工具函數
# ============================================================

def format_datetime(dt: datetime) -> str:
    """將 datetime 轉換為 Ragic API 格式"""
    return dt.strftime("%Y/%m/%d %H:%M:%S")


def parse_datetime(date_str: str) -> Optional[datetime]:
    """解析 Ragic 日期字串"""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y/%m/%d %H:%M:%S")
    except ValueError:
        try:
            return datetime.strptime(date_str, "%Y/%m/%d")
        except ValueError:
            return None


def load_timestamps() -> dict:
    """載入上次同步的時間戳記"""
    if TIMESTAMP_FILE.exists():
        with open(TIMESTAMP_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_timestamps(timestamps: dict) -> None:
    """儲存時間戳記"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(TIMESTAMP_FILE, "w", encoding="utf-8") as f:
        json.dump(timestamps, f, ensure_ascii=False, indent=2)


# ============================================================
# API 呼叫函數
# ============================================================

class RagicClient:
    """Ragic API 客戶端"""

    def __init__(self, api_key: str, base_url: str = RAGIC_BASE_URL):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Basic {api_key}"
        })

    def fetch_incremental(
        self,
        sheet_path: str,
        modified_field_id: str,
        since_time: str,
        page_size: int = 1000
    ) -> list:
        """
        增量抓取：抓取指定時間之後修改的資料

        Args:
            sheet_path: 表格路徑，如 "forms8/3"
            modified_field_id: 最後修改日期欄位 ID
            since_time: 起始時間，格式 "yyyy/MM/dd HH:mm:ss"
            page_size: 每頁筆數

        Returns:
            符合條件的所有資料
        """
        all_data = []
        offset = 0

        # URL 編碼時間字串中的空格
        encoded_time = quote(since_time, safe="/:")

        while True:
            url = f"{self.base_url}/{sheet_path}"
            params = {
                "api": "",
                "v": 3,
                "limit": page_size,
                "offset": offset,
                "where": f"{modified_field_id},gt,{since_time}",
                "order": f"{modified_field_id},ASC"
            }

            logger.debug(f"抓取 offset={offset}...")

            try:
                response = self.session.get(url, params=params, timeout=60)
                response.raise_for_status()
                result = response.json()
            except requests.RequestException as e:
                logger.error(f"API 請求失敗: {e}")
                break
            except json.JSONDecodeError as e:
                logger.error(f"JSON 解析失敗: {e}")
                break

            # Ragic 回傳格式是 {ragic_id: record, ...}
            if isinstance(result, dict):
                data = list(result.values())
            else:
                data = []

            logger.debug(f"取得 {len(data)} 筆")

            if not data:
                break

            all_data.extend(data)

            if len(data) < page_size:
                break  # 最後一頁

            offset += page_size

        return all_data

    def fetch_all(
        self,
        sheet_path: str,
        page_size: int = 1000
    ) -> list:
        """
        全量抓取：抓取表格所有資料

        Args:
            sheet_path: 表格路徑
            page_size: 每頁筆數

        Returns:
            所有資料
        """
        all_data = []
        offset = 0

        while True:
            url = f"{self.base_url}/{sheet_path}"
            params = {
                "api": "",
                "v": 3,
                "limit": page_size,
                "offset": offset
            }

            logger.debug(f"抓取 offset={offset}...")

            try:
                response = self.session.get(url, params=params, timeout=60)
                response.raise_for_status()
                result = response.json()
            except requests.RequestException as e:
                logger.error(f"API 請求失敗: {e}")
                break
            except json.JSONDecodeError as e:
                logger.error(f"JSON 解析失敗: {e}")
                break

            if isinstance(result, dict):
                data = list(result.values())
            else:
                data = []

            logger.debug(f"取得 {len(data)} 筆")

            if not data:
                break

            all_data.extend(data)

            if len(data) < page_size:
                break

            offset += page_size

        return all_data


# ============================================================
# 主程式
# ============================================================

def run_incremental_sync(sheet_codes: list[str] = None):
    """
    執行增量同步

    Args:
        sheet_codes: 要同步的表格代碼列表，None 表示全部
    """
    if not RAGIC_API_KEY:
        logger.error("請設定環境變數 RAGIC_API_KEY")
        logger.error("  export RAGIC_API_KEY='your_api_key_here'")
        return

    # 初始化
    client = RagicClient(RAGIC_API_KEY)
    timestamps = load_timestamps()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 決定要同步的表格
    if sheet_codes is None:
        sheet_codes = list(SHEET_CONFIG.keys())

    now = datetime.now()
    now_str = format_datetime(now)

    log_section(f"Ragic 增量同步開始 - 時間: {now_str}")

    results = {}

    for code in sheet_codes:
        if code not in SHEET_CONFIG:
            logger.warning(f"未知的表格代碼 {code}，跳過")
            continue

        path, field_id, name = SHEET_CONFIG[code]
        last_sync = timestamps.get(code)

        logger.info(f"\n[{code}] {name}")
        logger.info(f"  路徑: {path}")
        logger.info(f"  欄位 ID: {field_id}")

        if last_sync:
            logger.info(f"  上次同步: {last_sync}")
            logger.info(f"  模式: 增量抓取 (>{last_sync})")
            data = client.fetch_incremental(path, field_id, last_sync)
        else:
            logger.info(f"  上次同步: 無記錄")
            logger.info(f"  模式: 全量抓取")
            data = client.fetch_all(path)

        # 儲存資料
        if data:
            output_file = OUTPUT_DIR / f"{code}_{name}_incremental.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            log_file_saved(str(output_file), len(data))

            # 找出最新的修改時間
            max_date = None
            for record in data:
                for key in ["最後修改日期", "最後修改時間"]:
                    if record.get(key):
                        dt = parse_datetime(record[key])
                        if dt and (max_date is None or dt > max_date):
                            max_date = dt

            if max_date:
                timestamps[code] = format_datetime(max_date)
        else:
            logger.warning(f"無新資料")

        results[code] = len(data) if data else 0

    # 儲存時間戳記
    save_timestamps(timestamps)

    # 摘要
    log_section("同步完成摘要")
    for code in sheet_codes:
        if code in SHEET_CONFIG:
            _, _, name = SHEET_CONFIG[code]
            count = results.get(code, 0)
            logger.info(f"  [{code}] {name}: {count} 筆")
    logger.info(f"\n時間戳記已更新: {TIMESTAMP_FILE}")


def show_status():
    """顯示目前的同步狀態"""
    timestamps = load_timestamps()

    log_section("各表最後同步時間")
    logger.info(f"{'Code':<6} {'表格名稱':<15} {'最後同步時間':<25}")
    logger.info("-" * 50)

    for code, (_, _, name) in SHEET_CONFIG.items():
        last_sync = timestamps.get(code, "尚未同步")
        logger.info(f"{code:<6} {name:<15} {last_sync:<25}")


# ============================================================
# 範例使用
# ============================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        if sys.argv[1] == "status":
            show_status()
        elif sys.argv[1] == "all":
            # 同步全部表格
            run_incremental_sync()
        else:
            # 同步指定表格
            codes = sys.argv[1:]
            run_incremental_sync(codes)
    else:
        # 預設：顯示使用說明
        logger.info("""
Ragic 增量抓取工具

使用方式:
    # 設定 API Key
    export RAGIC_API_KEY="your_api_key_here"

    # 顯示同步狀態
    uv run python scripts/incremental_fetch.py status

    # 同步全部表格
    uv run python scripts/incremental_fetch.py all

    # 同步指定表格
    uv run python scripts/incremental_fetch.py 50 99

可用表格代碼:
    10 - 品牌表
    20 - 通路表
    30 - 金流表
    40 - 物流表
    41 - 郵遞區號表
    50 - 訂單表
    60 - 客戶表
    70 - 商品表
    80 - 活動管理表
    99 - 訂單明細表
""")
