#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import time


def main():
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        page.goto(
            "https://lookerstudio.google.com/u/0/reporting/53236a77-d857-45b8-8a4d-e6c50029eb71/page/0wmmF/edit"
        )
        time.sleep(15)
        page.keyboard.press("Escape")

        # 1. 開啟管理面板
        print("開啟管理面板...")
        page.locator('button[aria-label="管理頁面"]').first.click(force=True)
        time.sleep(3)

        # 2. 對第一頁項目位置點擊右鍵 (根據偵測到的 Box: {'x': 1360, 'y': 230, 'width': 240, 'height': 42})
        # 我們點擊項目的中心位置
        print("右鍵點擊第一頁項目...")
        page.mouse.click(1480, 250, button="right")
        time.sleep(1)

        # 3. 鍵盤向下移動並按 Enter (通常第一個選項或搜尋重新命名)
        # 在 Looker Studio 中，右鍵選單的『重新命名』通常是第一個或需要向下按幾次
        # 為了保險，我們直接使用文字點擊
        print("點擊『重新命名』...")
        try:
            page.get_by_text("重新命名").first.click(force=True, timeout=5000)
        except:
            # 備案：鍵盤導航
            page.keyboard.press("ArrowDown")
            page.keyboard.press("Enter")

        time.sleep(1)

        # 4. 輸入名稱
        print("輸入新名稱...")
        page.keyboard.type("01 | 今日營收達成率")
        page.keyboard.press("Enter")
        time.sleep(3)

        # 5. 驗證並截圖
        page.screenshot(path="_local/looker_studio/rename_final_verification.png")
        print("更名完成，截圖已儲存")

        context.close()


if __name__ == "__main__":
    main()
