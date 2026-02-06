import asyncio
from playwright.async_api import async_playwright
import time


async def create_master_template():
    # 啟動有頭模式 (Headful)，讓使用者可以手動登入
    async with async_playwright() as p:
        print("🚀 啟動瀏覽器... 請準備登入 Google 帳號")
        browser = await p.chromium.launch(headless=False)  # 必須有頭
        context = await browser.new_context()
        page = await context.new_page()

        # 1. 導向 Looker Studio 首頁
        await page.goto("https://lookerstudio.google.com/")

        print("⏳ 等待使用者登入... (請在瀏覽器中完成登入)")
        # 等待直到進入首頁 (檢測 'Create' 按鈕或其他特徵)
        try:
            await page.wait_for_url("**/navigation/reporting", timeout=300000)  # 5分鐘登入時間
            print("✅ 登入偵測成功！開始建立模板...")
        except:
            print("❌ 登入逾時，請重試。")
            return

        # 2. 建立空白報表
        await page.goto("https://lookerstudio.google.com/reporting/create")

        # 處理可能的 "Account Setup" 或 "Terms" 彈窗
        # (這裡可能需要根據實際 UI 調整)

        print("🎨 正在建立圖表組件...")

        # 3. 插入各種圖表 (透過 DOM 操作或模擬點擊)
        # 注意：Looker Studio 的 Canvas 是 Canvas/SVG 混和，Playwright 很難精確操作
        # 我們主要目標是獲得一個 Report ID，圖表可以稍後手動拉，或是嘗試透過 API 插入 (如果不支援則只能手動)

        # 獲取 Report ID
        # URL 格式: https://lookerstudio.google.com/reporting/<ID>/page/<PAGE_ID>/edit
        url = page.url
        report_id = url.split("/reporting/")[1].split("/")[0]

        print(f"\n🎉 模板建立成功！")
        print(f"🆔 Template ID: {report_id}")
        print(f"🔗 URL: {url}")
        print("\n⚠️ 請不要關閉視窗，您現在可以在畫面上手動拉入：")
        print("1. 一個 Scorecard (KPI)")
        print("2. 一個 Table (表格)")
        print("3. 一個 Bar Chart (長條圖)")
        print("4. 一個 Time Series (折線圖)")
        print("完成後，請複製 ID 給我。")

        # 保持開啟一段時間讓用戶操作
        await asyncio.sleep(600)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(create_master_template())
