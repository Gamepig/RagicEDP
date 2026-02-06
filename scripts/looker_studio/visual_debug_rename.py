#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import time
import re


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

        # 1. 點擊管理按鈕
        print("點擊管理頁面按鈕...")
        page.locator('button[aria-label="管理頁面"]').first.click(force=True)
        time.sleep(5)

        # 2. 截圖
        page.screenshot(path="_local/looker_studio/debug_rename_panel.png")

        # 3. 找出所有文字與其座標
        # 我們尋找包含『頁』或『Page』的元素
        elements = page.locator("*:visible").all()
        print("偵測可見元素中包含『頁』的項目:")
        for el in elements:
            try:
                txt = el.inner_text().strip()
                if "頁" in txt or "Page" in txt:
                    box = el.bounding_box()
                    if box and box["width"] > 0:
                        print(f"Text: '{txt}' | Box: {box}")
            except:
                pass

        context.close()


if __name__ == "__main__":
    main()
