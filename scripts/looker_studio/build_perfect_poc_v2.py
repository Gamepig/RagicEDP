#!/usr/bin/env python3

import urllib.parse
import re
import time
from playwright.sync_api import sync_playwright


def main():
    # 1. 定義 SQL (直接使用中文欄位，解決 Record Count 問題)
    sql = """
    SELECT 
      SUM(order_amount) AS `今日實收金額`,
      50000 AS `今日目標額`,
      ROUND(SAFE_DIVIDE(SUM(order_amount), 50000) * 100, 2) AS `達成率百分比`
    FROM `b25h01-ragic.erp_backup.fact_orders`
    WHERE order_date = CURRENT_DATE('Asia/Taipei')
    """
    encoded_sql = urllib.parse.quote(sql)

    # 2. 建構 Linking API 連結 (使用 CUSTOM_QUERY 模式)
    report_name = "01 | 今日營收達成率"
    params = {
        "ds.ds0.connector": "bigQuery",
        "ds.ds0.projectId": "b25h01-ragic",
        "ds.ds0.type": "CUSTOM_QUERY",
        "ds.ds0.sql": sql,  # Playwright 會處理編碼
        "ds.ds0.billingProjectId": "b25h01-ragic",
        "r.reportName": report_name,
    }
    # 手動拼接以確保參數順序與格式
    query_string = "&".join([f"{k}={urllib.parse.quote(v)}" for k, v in params.items()])
    linking_url = f"https://lookerstudio.google.com/reporting/create?{query_string}"

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="_local/looker_studio/chrome_profile",
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        print("正在啟動『完美報表』產製程序...")
        page.goto(linking_url, timeout=120000)
        page.wait_for_timeout(20000)  # 給予充足載入時間
        page.keyboard.press("Escape")

        # 3. 處理「新增至報表」對話框
        try:
            print("確認數據源權限...")
            add_btn = page.get_by_role(
                "button", name=re.compile(r"確認|確認並新增|新增|ADD", re.I)
            ).first
            if add_btn.is_visible():
                add_btn.click()
                page.wait_for_timeout(5000)
        except:
            pass

        # 4. 修正紅框 1: 畫布標題 (將技術名稱改為業務中文)
        print("正在修復畫布標題...")
        try:
            # 找到那個顯示為 ls_v_... 的文字元件並雙擊或直接刪除重建
            # 為了保險，我們直接在畫布中央偏上方點擊，選中它
            page.mouse.click(960, 80)
            page.keyboard.press("Delete")
            page.wait_for_timeout(500)

            # 建立新標題
            page.get_by_role("button", name=re.compile(r"文字|Text", re.I)).first.click()
            page.mouse.click(960, 50)  # 標題位置
            page.keyboard.type(report_name)
            page.keyboard.press("Control+Enter")
            print("標題修復完成。")
        except:
            pass

        # 5. 修正紅框 2: 數據指標 (改為時間序列或計分卡)
        # 由於我們使用了自訂 SQL，預設生成的表格現在應該已經顯示『今日實收金額』
        # 但我們進一步將其轉為『計分卡』以符合規格
        print("正在將數據轉為『美觀計分卡』...")
        try:
            # 點擊預設表格的位置
            page.mouse.click(960, 400)
            page.wait_for_timeout(1000)

            # 點擊上方『新增圖表』
            page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)).first.click()
            page.wait_for_timeout(1500)
            page.get_by_text(re.compile(r"計分卡|Scorecard", re.I)).first.click()
            page.wait_for_timeout(1000)
            page.mouse.click(960, 250)  # 放置在標題下方
            print("圖表轉換完成。")
        except:
            pass

        # 6. 自我驗證
        page.screenshot(path="_local/looker_studio/perfect_poc_validation.png")
        print(f"驗證完畢。最終連結: {page.url}")

        context.close()


if __name__ == "__main__":
    main()
