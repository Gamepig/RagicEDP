#!/usr/bin/env python3

import urllib.parse
import re
import time
from playwright.sync_api import sync_playwright


def main():
    # 1. 定義 SQL (保持全中文別名)
    sql = """
    SELECT 
      SUM(order_amount) AS `今日實收金額`,
      50000 AS `今日目標額`,
      ROUND(SAFE_DIVIDE(SUM(order_amount), 50000) * 100, 2) AS `達成率百分比`
    FROM `b25h01-ragic.erp_backup.fact_orders`
    WHERE order_date = CURRENT_DATE('Asia/Taipei')
    """

    # 2. 建構修復版 Linking API 連結 (移除所有 .ds0)
    report_name = "01 | 今日營收達成率"
    params = {
        "ds.connector": "bigQuery",
        "ds.projectId": "b25h01-ragic",
        "ds.type": "CUSTOM_QUERY",
        "ds.sql": sql,
        "ds.billingProjectId": "b25h01-ragic",
        "r.reportName": report_name,
    }

    query_string = urllib.parse.urlencode(params)
    linking_url = f"https://lookerstudio.google.com/reporting/create?{query_string}"

    print(f"生成的修復版連結:\n{linking_url}")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        print("正在進行自動化驗證...")
        page.goto(linking_url, timeout=120000)
        page.wait_for_timeout(15000)
        page.keyboard.press("Escape")

        # 檢查是否還有錯誤視窗
        error_probe = page.get_by_text("建立報表時發生錯誤").is_visible()
        if error_probe:
            print("❌ 驗證失敗：依然出現錯誤視窗。")
        else:
            print("✅ 驗證通過：報表已成功載入且無錯誤。")

        page.screenshot(path="_local/looker_studio/fix_no_alias_verification.png")
        context.close()


if __name__ == "__main__":
    main()
