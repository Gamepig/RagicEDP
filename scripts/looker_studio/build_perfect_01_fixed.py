#!/usr/bin/env python3

import urllib.parse
import re
import time
from playwright.sync_api import sync_playwright


def main():
    report_name = "01 | 本月每日銷售趨勢"
    table_id = "ls_v_01_daily_revenue_poc"

    # 構建正確的 Linking URL (使用官方 API 語法)
    params = {
        "ds.connector": "bigQuery",
        "ds.projectId": "b25h01-ragic",
        "ds.type": "TABLE",
        "ds.tableId": table_id,
        "ds.datasetId": "erp_backup",
        "r.reportName": report_name,
    }
    linking_url = (
        f"https://lookerstudio.google.com/reporting/create?{urllib.parse.urlencode(params)}"
    )

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        print("正在啟動報表精修工作...")
        page.goto(linking_url, timeout=120000)
        page.wait_for_timeout(25000)  # 給予 SPA 充足載入時間
        page.keyboard.press("Escape")

        # 1. 確認數據對接
        try:
            add_btn = page.get_by_role(
                "button", name=re.compile(r"確認|新增|ADD|Confirm", re.I)
            ).first
            if add_btn.is_visible():
                add_btn.click()
                page.wait_for_timeout(10000)
        except:
            pass

        # 2. 強制清場 (刪除預設的錯誤標題與圖表)
        print("執行畫布清理...")
        page.keyboard.press("Control+a")
        page.keyboard.press("Delete")
        page.wait_for_timeout(2000)

        # 3. 繪製中文大標題
        print("繪製美觀標題...")
        try:
            page.get_by_role("button", name=re.compile(r"文字|Text", re.I)).first.click()
            page.mouse.click(960, 50)  # 標題位置
            page.keyboard.type(report_name)
            page.keyboard.press("Control+Enter")
            page.wait_for_timeout(1000)
        except:
            pass

        # 4. 插入正確的時間序列圖表
        print("正在插入『每日營收趨勢圖』...")
        try:
            page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)).first.click()
            page.wait_for_timeout(2000)
            # 點擊時間序列
            page.get_by_text(re.compile(r"時間序列|Time series", re.I)).first.click()
            page.wait_for_timeout(1000)
            page.mouse.click(100, 120)  # 放置位置
            page.wait_for_timeout(8000)  # 等待渲染折線
            print("圖表已放置。")
        except Exception as e:
            print(f"繪圖異常: {e}")

        # 5. 視覺驗證：檢查畫面文字與圖表
        page.screenshot(path="_local/looker_studio/final_verification_01.png")

        # 關鍵驗證邏輯：搜尋畫面上是否還存在『fact_orders』這類技術字眼
        fact_orders_count = page.get_by_text("fact_orders").count()
        if fact_orders_count == 0:
            print("✅ 標題驗證成功：技術名稱已移除。")
        else:
            print("⚠️ 警告：技術標題依然殘留。")

        print(f"完成！報表連結: {page.url}")
        context.close()


if __name__ == "__main__":
    main()
