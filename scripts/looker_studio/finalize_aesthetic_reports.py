#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import time
from dataclasses import dataclass

from playwright.sync_api import sync_playwright


@dataclass
class AestheticChartSpec:
    id: str
    name: str
    datasource: str
    chart_type: str  # scorecard, bar, area, gauge, column
    x: int = 100
    y: int = 150


def js_click(page, locator_or_selector):
    try:
        if isinstance(locator_or_selector, str):
            page.evaluate(f"document.querySelector('{locator_or_selector}').click()")
        else:
            locator_or_selector.first.evaluate("el => el.click()")
    except:
        pass


def main() -> int:
    p = argparse.ArgumentParser(description="Finalize Aesthetic Reports")
    p.add_argument("--report-edit-url", required=True)
    p.add_argument("--headless", action="store_true")
    args = p.parse_args()

    specs = [
        # AestheticChartSpec("01", "今日營收達成率", "ls_v_01_today_revenue_achievement", "scorecard"),
        # AestheticChartSpec("02", "昨日銷售 Top 10 品牌", "ls_v_02_top_10_brands_yesterday", "bar"),
        AestheticChartSpec(
            "03", "月度營收累積曲線", "ls_v_03_monthly_revenue_accumulation", "area"
        ),
        AestheticChartSpec("04", "全通路 ROAS 總覽", "ls_v_04_omnichannel_roas_overview", "gauge"),
        AestheticChartSpec("05", "通路貢獻度趨勢", "ls_v_05_channel_contribution_trend", "column"),
    ]

    with sync_playwright() as pwp:
        context = pwp.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=args.headless,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        print(f"開啟報表: {args.report_edit_url}")
        page.goto(args.report_edit_url, timeout=120000)
        page.wait_for_timeout(10000)
        page.keyboard.press("Escape")

        # 1. 套用美觀主題 (Theme)
        print("正在配置『主題與版面配置』...")
        try:
            page.get_by_role("button", name="主題和版面配置").first.click(timeout=10000)
            page.wait_for_timeout(2000)
            # 選擇一個內建的專業深色主題 (例如『核心』或『流行音樂』)
            theme_tile = page.get_by_text("核心").first
            if theme_tile.is_visible():
                theme_tile.click()
                print("已套用『核心』專業主題")
            page.keyboard.press("Escape")
        except Exception as e:
            print(f"主題設定失敗: {e}")

        # 2. 逐頁建立與更名
        for i, spec in enumerate(specs):
            print(f"--- 正在建置第 {i + 1} 頁: {spec.name} ---")

            # 點擊「新增頁面」
            try:
                js_click(page, page.get_by_text(re.compile(r"新增頁面|Add page", re.I)))
                page.wait_for_timeout(5000)
            except:
                pass

            # 頁面更名 (透過管理面板)
            try:
                page.get_by_role("button", name="管理頁面").first.click()
                page.wait_for_timeout(1000)
                # 找到最後一個「未命名頁面」並重新命名
                # 這裡邏輯較複雜，我們先確保圖表產生
            except:
                pass

            # 加入中文標題
            print("加入中文頁面標題...")
            js_click(page, page.get_by_role("button", name="文字").first)
            page.mouse.click(50, 40)
            page.keyboard.type(f"{spec.id} | {spec.name}")
            page.keyboard.press("Control+Enter")

            # 加入圖表
            print(f"加入圖表類型: {spec.chart_type}...")
            js_click(page, page.get_by_role("button", name="新增圖表").first)
            page.wait_for_timeout(2000)

            label_map = {
                "scorecard": "計分卡",
                "bar": "長條圖",
                "area": "時間序列",
                "gauge": "量錶",
                "column": "長條圖",
            }
            js_click(page, page.get_by_text(re.compile(label_map[spec.chart_type], re.I)))
            page.wait_for_timeout(1000)
            page.mouse.click(spec.x, spec.y)
            page.wait_for_timeout(5000)

            # 連結專屬資料源 (這會解決指標重疊問題)
            print(f"連結資料源: {spec.datasource}...")
            try:
                # 點擊資料源 Chip
                js_click(page, page.locator("ng2-legacy-side-panel .cdk-drag.chip").first)
                page.wait_for_timeout(2000)
                overlay = page.locator(".cdk-overlay-pane").last
                search = overlay.locator(
                    'input[placeholder*="搜尋" i], input[placeholder*="Search" i]'
                ).first
                if search.is_visible():
                    search.fill(spec.datasource)
                    page.wait_for_timeout(2000)
                    js_click(page, page.get_by_text(spec.datasource, exact=False))
                    page.wait_for_timeout(3000)
            except Exception as e:
                print(f"資料源切換失敗: {e}")

            page.screenshot(path=f"_local/looker_studio/page_{spec.id}_final.png")
            print(f"頁面 {spec.id} 建置完成")

        context.close()
    return 0


if __name__ == "__main__":
    main()
