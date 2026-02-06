#!/usr/bin/env python3

import re
import time
from playwright.sync_api import sync_playwright


def main():
    report_url = "https://lookerstudio.google.com/u/0/reporting/53236a77-d857-45b8-8a4d-e6c50029eb71/page/0wmmF/edit"

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        print("正在執行更名 POC...")
        page.goto(report_url, timeout=120000)
        page.wait_for_timeout(15000)
        page.keyboard.press("Escape")

        # 1. 開啟管理面板
        try:
            page.locator('button[aria-label="管理頁面"]').first.click(force=True)
            print("管理面板已開啟")
            page.wait_for_timeout(3000)
        except:
            print("面板開啟失敗")

        # 2. 執行右鍵更名邏輯
        try:
            # 找到第一個頁面項目並點擊右鍵
            page_item = page.locator("page-list-item").first
            page_item.click(button="right", force=True)
            print("已執行右鍵點擊")
            page.wait_for_timeout(1500)

            # 點擊重新命名
            # 在彈出的 Context Menu 中搜尋文字
            rename_opt = page.locator(".cdk-overlay-pane").get_by_text("重新命名").first
            rename_opt.click(force=True)
            print("已點擊重新命名選項")
            page.wait_for_timeout(1000)

            # 輸入名稱
            page.keyboard.type("01 | 今日營收達成率")
            page.keyboard.press("Enter")
            page.wait_for_timeout(3000)

            # 驗證
            page.screenshot(path="_local/looker_studio/rename_poc_final.png")
            print("更名 POC 完成，請檢查截圖")
        except Exception as e:
            print(f"更名失敗: {e}")
            page.screenshot(path="_local/looker_studio/rename_poc_fail.png")

        context.close()


if __name__ == "__main__":
    main()
