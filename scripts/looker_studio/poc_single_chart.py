#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import time
from playwright.sync_api import sync_playwright


def main() -> int:
    p = argparse.ArgumentParser(description="POC: Build Single Standalone Chart and Rename Page")
    p.add_argument("--report-edit-url", required=True)
    p.add_argument("--headless", action="store_true")
    args = p.parse_args()

    # POC 指定報表
    spec_id = "01"
    spec_name = "今日營收達成率"
    datasource_name = "ls_v_01_today_revenue_achievement"

    with sync_playwright() as pwp:
        context = pwp.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=args.headless,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        print(f"開啟報表: {args.report_edit_url}")
        page.goto(args.report_edit_url, timeout=120000)
        page.wait_for_timeout(15000)
        page.keyboard.press("Escape")

        # 1. 重新命名第一頁
        print("步驟 1: 正在重新命名頁面...")
        try:
            # 點擊「管理頁面」按鈕
            page.get_by_role(
                "button", name=re.compile(r"管理頁面|Manage pages", re.I)
            ).first.click()
            page.wait_for_timeout(3000)

            # 找到第一頁的選單按鈕 (三個點)
            # 在 Looker Studio 中，這通常是項目的右側按鈕
            dots_button = page.locator("page-list-item").first.get_by_role("button").last
            dots_button.click(force=True)
            page.wait_for_timeout(1500)

            # 點擊「重新命名」
            rename_option = page.get_by_text("重新命名").first
            rename_option.click(force=True)
            page.wait_for_timeout(1000)

            # 輸入名稱並確認
            page.keyboard.type(f"{spec_id} | {spec_name}")
            page.keyboard.press("Enter")
            page.wait_for_timeout(3000)

            # 關閉管理面板
            page.keyboard.press("Escape")
            print(f"更名成功: {spec_name}")
        except Exception as e:
            print(f"更名失敗: {e}")
            page.keyboard.press("Escape")

        # 2. 加入圖表
        print(f"步驟 2: 正在加入圖表 (計分卡)...")
        try:
            page.get_by_role("button", name="新增圖表").first.click()
            page.wait_for_timeout(2000)
            page.get_by_text("計分卡").first.click(force=True)
            page.wait_for_timeout(1000)
            page.mouse.click(600, 400)  # 置中放置
            page.wait_for_timeout(5000)
            print("圖表已放置")
        except Exception as e:
            print(f"建立圖表失敗: {e}")

        # 3. 連結資料源
        print(f"步驟 3: 正在連結資料源 {datasource_name}...")
        try:
            # 點擊右側面板的資料源晶片
            ds_chip = page.locator("ng2-legacy-side-panel .cdk-drag.chip").first
            ds_chip.click(force=True)
            page.wait_for_timeout(2000)

            overlay = page.locator(".cdk-overlay-pane").last
            search_box = overlay.locator(
                'input[placeholder*="搜尋" i], input[placeholder*="Search" i]'
            ).first
            if search_box.is_visible():
                search_box.fill(datasource_name)
                page.wait_for_timeout(2000)
                # 點擊搜尋結果
                page.get_by_text(datasource_name, exact=False).first.click(force=True)
                page.wait_for_timeout(5000)
                print("資料源已同步")
        except Exception as e:
            print(f"資料源連結失敗: {e}")

        # 4. 驗證截圖
        out_path = f"_local/looker_studio/poc_chart_01_final.png"
        page.screenshot(path=out_path)
        print(f"POC 執行完成，截圖儲存至: {out_path}")

        context.close()
    return 0


if __name__ == "__main__":
    main()
