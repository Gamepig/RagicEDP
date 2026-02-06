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
        print("正在開啟報表進行更名測試...")
        page.goto(report_url, timeout=120000)
        page.wait_for_timeout(15000)
        page.keyboard.press("Escape")

        # 嘗試點擊『管理頁面』
        print("步驟 1: 開啟頁面管理員...")
        try:
            # 使用 aria-label 定位
            manage_btn = page.locator('button[aria-label="管理頁面"]').first
            manage_btn.scroll_into_view_if_needed()
            manage_btn.click(force=True, timeout=10000)
            print("管理面板已點擊")
            page.wait_for_timeout(3000)
        except Exception as e:
            print(f"無法開啟管理面板: {e}")
            page.screenshot(path="_local/looker_studio/rename_error_step1.png")

        # 嘗試更名
        print("步驟 2: 尋找更名按鈕並執行...")
        try:
            # 在頁面清單項目中尋找更多選項 (三個點)
            # 我們嘗試直接尋找帶有『更多』或『選項』字眼的按鈕
            first_page_item = page.locator("page-list-item").first
            more_btn = first_page_item.locator("button").last
            more_btn.click(force=True)
            page.wait_for_timeout(1500)

            # 點擊『重新命名』
            rename_btn = page.get_by_text("重新命名").first
            rename_btn.click(force=True)
            page.wait_for_timeout(1000)

            # 輸入中文名稱
            page.keyboard.type("01 | 今日營收達成率")
            page.keyboard.press("Enter")
            print("更名指令已送出")
            page.wait_for_timeout(3000)

            # 儲存截圖驗證
            page.screenshot(path="_local/looker_studio/rename_success_poc.png")
            print("已儲存更名驗證截圖: _local/looker_studio/rename_success_poc.png")
        except Exception as e:
            print(f"更名流程失敗: {e}")
            page.screenshot(path="_local/looker_studio/rename_error_step2.png")

        context.close()


if __name__ == "__main__":
    main()
