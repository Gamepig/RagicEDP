#!/usr/bin/env python3

import urllib.parse
from playwright.sync_api import sync_playwright
import re


def main():
    # 配置
    PROJECT_ID = "b25h01-ragic"
    DATASET_ID = "erp_backup"
    TABLE_ID = "ls_v_01_today_revenue_achievement"
    REPORT_NAME = "01 | 今日營收達成率"

    # 建立無別名的 Linking URL (針對從頭開始建立報表)
    base_url = "https://lookerstudio.google.com/reporting/create"

    # 直接使用 ds. 前綴，不加 ds0
    params = {
        "ds.connector": "bigQuery",
        "ds.projectId": PROJECT_ID,
        "ds.datasetId": DATASET_ID,
        "ds.tableId": TABLE_ID,
        "ds.type": "TABLE",
        "r.reportName": REPORT_NAME,
    }

    query_string = urllib.parse.urlencode(params)
    linking_url = f"{base_url}?{query_string}"

    print(f"生成的修復版連結: {linking_url}")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        print("正在嘗試建立報表...")
        page.goto(linking_url, timeout=120000)
        page.wait_for_timeout(15000)

        # 截圖確認錯誤是否消失
        page.screenshot(path="_local/looker_studio/linking_fix_test.png")

        # 如果成功進入編輯器，嘗試儲存
        if "create" not in page.url or page.locator("report-editing-tools").count() > 0:
            print("看起來成功進入了編輯介面！")
        else:
            print("依然遇到問題，正在檢查畫面內容...")

        context.close()


if __name__ == "__main__":
    main()
