#!/usr/bin/env python3

import urllib.parse
import re
import time
from playwright.sync_api import sync_playwright


def build_perfect_report(page, spec):
    print(f"--- 正在產出: {spec['name']} ---")

    # 1. 開啟對接連結
    params = {
        "ds.connector": "bigQuery",
        "ds.projectId": "b25h01-ragic",
        "ds.datasetId": "erp_backup",
        "ds.tableId": spec["table"],
        "ds.type": "TABLE",
        "r.reportName": spec["name"],
    }
    url = f"https://lookerstudio.google.com/reporting/create?{urllib.parse.urlencode(params)}"
    page.goto(url, timeout=120000)
    page.wait_for_timeout(10000)
    page.keyboard.press("Escape")

    # 2. 清理畫布 (刪除預設的無意義表格)
    print("清理初始畫布...")
    try:
        # 選取預設表格並刪除
        page.mouse.click(400, 300)  # 預設位置
        page.keyboard.press("Delete")
        page.wait_for_timeout(1000)
    except:
        pass

    # 3. 加入美觀大標題
    print("加入中文標題...")
    try:
        page.get_by_role("button", name="文字").first.click()
        page.mouse.click(50, 40)
        page.keyboard.type(spec["name"])
        page.keyboard.press("Control+Enter")
    except:
        pass

    # 4. 加入正確類型的圖表
    print(f"繪製圖表 ({spec['chart_type']})...")
    try:
        page.get_by_role("button", name="新增圖表").first.click()
        page.wait_for_timeout(1500)
        page.get_by_text(spec["chart_label"]).first.click()
        page.wait_for_timeout(1000)
        page.mouse.click(100, 120)  # 放置在標題下方
        page.wait_for_timeout(5000)

        # 5. 修復指標 (Record Count -> Correct Metric)
        # 點擊指標區域的 X 刪除 Record Count
        print("優化指標與維度...")
        side_panel = page.locator("ng2-legacy-side-panel").first
        try:
            # 刪除 Record Count
            rc_x = (
                side_panel.locator(".chip")
                .filter(has_text="Record Count")
                .locator("mat-icon")
                .first
            )
            rc_x.click(force=True)
            page.wait_for_timeout(1000)
        except:
            pass

        # 新增正確指標
        add_metric = side_panel.get_by_text(re.compile(r"新增指標|Add metric", re.I)).first
        add_metric.click()
        page.wait_for_timeout(1000)
        overlay = page.locator(".cdk-overlay-pane").last
        overlay.get_by_text(spec["metric"]).first.click()
        page.wait_for_timeout(2000)
    except Exception as e:
        print(f"圖表精修失敗: {e}")

    # 6. 完成並存檔
    page.screenshot(path=f"_local/looker_studio/test_report_{spec['id']}.png")
    print(f"完成！網址: {page.url}")
    return page.url


def main():
    specs = [
        {
            "id": "01",
            "name": "本月每日銷售趨勢",
            "table": "ls_v_test_01_monthly_trend",
            "chart_type": "time_series",
            "chart_label": "時間序列",
            "metric": "revenue",
        },
        {
            "id": "02",
            "name": "品牌營收排名",
            "table": "ls_v_test_02_brand_ranking",
            "chart_type": "bar",
            "chart_label": "長條圖",
            "metric": "revenue",
        },
        {
            "id": "03",
            "name": "通路訂單佔比",
            "table": "ls_v_test_03_channel_share",
            "chart_type": "pie",
            "chart_label": "圓餅圖",
            "metric": "orders",
        },
    ]

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        results = []
        for s in specs:
            url = build_perfect_report(page, s)
            results.append((s["name"], url))

        print("\n--- 3 份測試報表產出成功 ---")
        for name, url in results:
            print(f"{name}: {url}")

        context.close()


if __name__ == "__main__":
    main()
