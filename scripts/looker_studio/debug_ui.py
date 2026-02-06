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
        page.screenshot(path="_local/looker_studio/full_editor_debug.png", full_page=True)
        # Dump buttons
        buttons = page.locator("button").all()
        for i, b in enumerate(buttons):
            try:
                print(f"Btn {i}: {b.get_attribute('aria-label')} | {b.inner_text()}")
            except:
                pass
        context.close()


if __name__ == "__main__":
    main()
