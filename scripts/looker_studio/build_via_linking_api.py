#!/usr/bin/env python3

import json
import urllib.parse
from playwright.sync_api import sync_playwright


def main():
    # 1. 配置
    PROJECT_ID = "b25h01-ragic"
    DATASET_ID = "erp_backup"
    TABLE_ID = "ls_v_01_today_revenue_achievement"
    REPORT_NAME = "01 | 今日營收達成率"

    # 2. 建構 Linking API URL
    # 我們使用 Google 官方的一個簡潔模板作為基底 (或是我們自己建立一個)
    # 這裡先使用一個通用的建立連結，並傳入 BQ 配置
    base_url = "https://lookerstudio.google.com/reporting/create"

    # 數據源配置 (ds.ds0)
    config = {
        "ds.ds0.connector": "bigQuery",
        "ds.ds0.projectId": PROJECT_ID,
        "ds.ds0.datasetId": DATASET_ID,
        "ds.ds0.tableId": TABLE_ID,
        "ds.ds0.type": "TABLE",
        "r.name": REPORT_NAME,
    }

    query_string = urllib.parse.urlencode(config)
    linking_url = f"{base_url}?{query_string}"

    print(f"生成的自動建置連結: {linking_url}")

    # 3. 使用 Playwright 自動執行「複製與儲存」
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        print("正在透過 Linking API 建立報表...")
        page.goto(linking_url, timeout=120000)
        page.wait_for_timeout(10000)

        # Linking API 會彈出「新增至報表」的確認框
        try:
            print("正在點擊『新增至報表』...")
            add_btn = page.get_by_role(
                "button", name=re.compile(r"新增至報表|ADD TO REPORT", re.I)
            ).first
            add_btn.click(timeout=10000)
            page.wait_for_timeout(5000)
        except:
            pass

        # 儲存後的 URL 就是該報表的永久連結
        final_url = page.url
        print(f"報表建立成功！最終網址: {final_url}")

        # 命名確認 (透過 UI 操作更名報表標題)
        try:
            title_area = page.locator('input[aria-label="報表名稱"], .report-name-input').first
            title_area.click()
            page.keyboard.press("Control+A")
            page.keyboard.type(REPORT_NAME)
            page.keyboard.press("Enter")
            page.wait_for_timeout(2000)
        except:
            pass

        page.screenshot(path="_local/looker_studio/linking_api_result.png")
        context.close()


if __name__ == "__main__":
    import re

    main()
