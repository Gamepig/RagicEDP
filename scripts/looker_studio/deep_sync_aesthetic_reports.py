#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import time
from dataclasses import dataclass

from playwright.sync_api import sync_playwright


@dataclass
class PageSpec:
    id: str
    name: str
    datasource: str
    chart_type: str


def main() -> int:
    p = argparse.ArgumentParser(description="Deep Sync Aesthetic Reports")
    p.add_argument("--report-edit-url", required=True)
    p.add_argument("--headless", action="store_true")
    args = p.parse_args()

    specs = [
        PageSpec("01", "今日營收達成率", "ls_v_01_today_revenue_achievement", "scorecard"),
        PageSpec("02", "昨日銷售 Top 10 品牌", "ls_v_02_top_10_brands_yesterday", "bar"),
    ]

    with sync_playwright() as pwp:
        context = pwp.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=args.headless,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        print(f"Opening report...")
        page.goto(args.report_edit_url, timeout=120000)
        page.wait_for_timeout(15000)
        page.keyboard.press("Escape")

        # 1. 套用核心主題 (確保美觀)
        print("Setting theme...")
        try:
            page.get_by_role("button", name="主題和版面配置").first.click(timeout=5000)
            page.wait_for_timeout(2000)
            # 點擊左側主題列表中的「核心」
            page.get_by_text("核心").first.click(force=True)
            page.wait_for_timeout(2000)
            page.keyboard.press("Escape")
        except:
            pass

        # 2. 處理每一頁
        for i, spec in enumerate(specs):
            print(f"--- Processing Page {i + 1}: {spec.name} ---")

            # 切換或新增頁面
            # 這裡先假設我們要修正現有的第 1, 2 頁
            try:
                page.get_by_role("button", name="下一頁").click()
                page.wait_for_timeout(2000)
            except:
                pass

            # 重新命名頁面 (這是解決『未命名頁面』的關鍵)
            print(f"Renaming current page to {spec.name}...")
            try:
                # 點擊「管理頁面」按鈕 (Button 22 in debug)
                page.get_by_role(
                    "button", name=re.compile(r"管理頁面|Manage pages", re.I)
                ).first.click()
                page.wait_for_timeout(2000)

                # 在側邊欄找到目前的頁面項目的選單
                # 通常是三個點
                menu_trigger = (
                    page.locator("page-list-item")
                    .nth(i)
                    .locator("button[aria-label*='更多']")
                    .first
                )
                menu_trigger.click()
                page.wait_for_timeout(1000)

                # 點擊「重新命名」
                page.get_by_text("重新命名").first.click()
                page.wait_for_timeout(1000)
                page.keyboard.type(f"{spec.id} | {spec.name}")
                page.keyboard.press("Enter")
                page.wait_for_timeout(2000)

                # 關閉管理面板
                page.keyboard.press("Escape")
                print("Rename success.")
            except Exception as e:
                print(f"Rename failed: {e}")

            # 加入圖表
            print(f"Adding {spec.chart_type}...")
            try:
                page.get_by_role("button", name="新增圖表").first.click()
                page.wait_for_timeout(2000)
                label = "計分卡" if spec.chart_type == "scorecard" else "長條圖"
                page.get_by_text(re.compile(label, re.I)).first.click(force=True)
                page.wait_for_timeout(1000)
                page.mouse.click(600, 400)  # 置中放置
                page.wait_for_timeout(5000)

                # 連結資料源
                print(f"Linking datasource {spec.datasource}...")
                ds_chip = page.locator("ng2-legacy-side-panel .cdk-drag.chip").first
                ds_chip.click(force=True)
                page.wait_for_timeout(2000)
                overlay = page.locator(".cdk-overlay-pane").last
                search = overlay.locator(
                    'input[placeholder*="搜尋" i], input[placeholder*="Search" i]'
                ).first
                if search.is_visible():
                    search.fill(spec.datasource)
                    page.wait_for_timeout(2000)
                    page.get_by_text(spec.datasource, exact=False).first.click(force=True)
                    page.wait_for_timeout(5000)
                print("Chart synced.")
            except Exception as e:
                print(f"Chart setup failed: {e}")

            page.screenshot(path=f"_local/looker_studio/sync_page_{spec.id}.png")

        print("Finalizing...")
        page.wait_for_timeout(5000)
        context.close()
    return 0


if __name__ == "__main__":
    main()
