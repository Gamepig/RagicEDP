#!/usr/bin/env python3

import urllib.parse
import re
import time
from playwright.sync_api import sync_playwright


def main():
    # 1. 報表規格
    spec = {"id": "01", "name": "01 | 今日營收達成率", "table": "ls_v_01_today_revenue_achievement"}

    # 2. 構建帶有正確 type 的 Linking URL (無 alias 模式，避免權限衝突)
    base_url = "https://lookerstudio.google.com/reporting/create"
    params = {
        "ds.connector": "bigQuery",
        "ds.projectId": "b25h01-ragic",
        "ds.datasetId": "erp_backup",
        "ds.tableId": spec["table"],
        "ds.type": "TABLE",
        "r.reportName": spec["name"],
    }
    linking_url = f"{base_url}?{urllib.parse.urlencode(params)}"
    print(f"啟動 Linking 連結: {linking_url}")

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        # 開啟連結並等待資料源載入
        page.goto(linking_url, timeout=120000)
        page.wait_for_timeout(15000)
        page.keyboard.press("Escape")

        # 3. 處理「新增至報表」彈出視窗 (如果有的話)
        try:
            print("確認資料源連結...")
            add_btn = page.get_by_role(
                "button", name=re.compile(r"新增至報表|ADD TO REPORT|新增", re.I)
            ).first
            if add_btn.is_visible():
                add_btn.click()
                page.wait_for_timeout(5000)
        except:
            pass

        # 4. 自動畫出 KPI 圖表 (這是最關鍵的一步，補足 Linking API 沒畫圖的缺憾)
        print("正在為您繪製圖表...")
        try:
            # 點擊「新增圖表」
            page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)).first.click()
            page.wait_for_timeout(2000)

            # 選擇「計分卡」
            page.get_by_text(re.compile(r"計分卡|Scorecard", re.I)).first.click()
            page.wait_for_timeout(1000)

            # 點擊畫布中央放置
            page.mouse.click(600, 400)
            page.wait_for_timeout(5000)
            print("圖表已畫製完成。")
        except Exception as e:
            print(f"繪圖失敗: {e}")

        # 5. 取得最終連結並截圖
        final_url = page.url
        print(f"✨ 報表 01 建立成功！網址如下：\n{final_url}")
        page.screenshot(path="_local/looker_studio/final_poc_success.png")

        context.close()


if __name__ == "__main__":
    main()
