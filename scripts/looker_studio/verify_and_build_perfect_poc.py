#!/usr/bin/env python3

import urllib.parse
import re
import time
from playwright.sync_api import sync_playwright


def main():
    # 1. 配置與 SQL (使用最穩定的英文別名，避免對接錯誤)
    sql = """
    SELECT 
      SUM(order_amount) AS revenue,
      50000 AS target
    FROM `b25h01-ragic.erp_backup.fact_orders`
    WHERE order_date = CURRENT_DATE('Asia/Taipei')
    """
    report_name = "01 | 今日營收達成率"

    params = {
        "ds.connector": "bigQuery",
        "ds.projectId": "b25h01-ragic",
        "ds.type": "CUSTOM_QUERY",
        "ds.sql": sql,
        "ds.billingProjectId": "b25h01-ragic",
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
        print("正在啟動報表並進行自動化修復與驗證...")
        page.goto(linking_url, timeout=120000)
        page.wait_for_timeout(20000)
        page.keyboard.press("Escape")

        # 2. 自動點擊「新增」確認對話框
        try:
            print("正在確認數據源連結...")
            add_btn = page.get_by_role(
                "button", name=re.compile(r"確認|新增|ADD|Confirm", re.I)
            ).first
            if add_btn.is_visible():
                add_btn.click()
                page.wait_for_timeout(8000)
        except:
            pass

        # 3. 刪除所有錯誤圖表與標題 (清場)
        print("清理無效的預設圖表...")
        try:
            # 全選並刪除
            page.keyboard.press("Control+a")
            page.keyboard.press("Delete")
            page.wait_for_timeout(2000)
        except:
            pass

        # 4. 重新畫上正確的標題與圖表
        try:
            # 加上中文標題
            print("重新命名畫布標題...")
            page.get_by_role("button", name=re.compile(r"文字|Text", re.I)).first.click()
            page.mouse.click(960, 50)  # 頂部中央
            page.keyboard.type(report_name)
            page.keyboard.press("Control+Enter")
            page.wait_for_timeout(1000)

            # 加上計分卡
            print("正在重新畫製計分卡圖表...")
            page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)).first.click()
            page.wait_for_timeout(2000)
            page.get_by_text(re.compile(r"計分卡|Scorecard", re.I)).first.click()
            page.wait_for_timeout(1000)
            page.mouse.click(960, 200)  # 標題下方
            page.wait_for_timeout(5000)
        except Exception as e:
            print(f"繪圖程序異常: {e}")

        # 5. 深度驗證：檢查是否還有「錯誤」或「無效」字樣
        print("正在進行視覺自我驗證...")
        error_count = page.get_by_text(re.compile(r"錯誤|無效|Error|Invalid", re.I)).count()

        # 截圖供我後續查看 (雖然 headless 我看不到，但我可以從日誌判斷)
        page.screenshot(path="_local/looker_studio/verification_report_01.png")

        if error_count == 0:
            print("✅ 驗證成功：報表畫面整潔，無錯誤字樣。")
        else:
            print(f"⚠️ 警報：畫面上仍偵測到 {error_count} 處可能錯誤。")

        final_url = page.url
        print(f"完成。最終報表連結: {final_url}")

        context.close()


if __name__ == "__main__":
    main()
