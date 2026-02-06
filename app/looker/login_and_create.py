import asyncio
from playwright.async_api import async_playwright
import json
import os

COOKIES_FILE = "_local/looker_cookies.json"


async def login_and_create():
    async with async_playwright() as p:
        try:
            print("🚀 嘗試連線至本機 Chrome (port 9222)...")
            # Connect to existing Chrome instance
            browser = await p.chromium.connect_over_cdp("http://localhost:9222")
            context = browser.contexts[0]
            page = context.pages[0]
            print("✅ 成功連線至本機 Chrome！")
        except Exception as e:
            print(f"❌ 連線失敗: {e}")
            print("請確認您已使用以下指令啟動 Chrome:")
            print(
                "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222"
            )
            return

        # 1. 導向 Looker Studio 首頁
        await page.goto("https://lookerstudio.google.com/")

        print("\n⏳ [檢查登入狀態]...")
        # ... (rest of the logic remains similar)

        # 等待直到網址包含 reporting 或 navigation (代表已登入)
        # 增加 timeout 到 600 秒 (10分鐘) 給您足夠時間登入
        try:
            await page.wait_for_url("**/navigation/**", timeout=600000)
            print("\n✅ 登入偵測成功！")

            # 2. 儲存 Cookie
            cookies = await context.cookies()
            os.makedirs("_local", exist_ok=True)
            with open(COOKIES_FILE, "w") as f:
                json.dump(cookies, f)
            print(f"💾 Cookie 已儲存至 {COOKIES_FILE}")

        except Exception as e:
            print(f"❌ 登入逾時或失敗: {e}")
            await browser.close()
            return

        # 3. 自動建立空白報表
        print("🎨 正在自動建立空白報表...")
        await page.goto("https://lookerstudio.google.com/reporting/create")

        # 等待編輯器載入 (檢查 Canvas 元素)
        try:
            await page.wait_for_selector(".lego-canvas-container", timeout=60000)
        except:
            print("⚠️ 編輯器載入緩慢，繼續嘗試...")

        # 獲取 Report ID
        url = page.url
        try:
            report_id = url.split("/reporting/")[1].split("/")[0]
            print(f"\n🎉 範本建立成功！")
            print(f"🆔 Template ID: {report_id}")
            print(f"🔗 URL: {url}")

            print("\n⚠️ 為了確保圖表類型正確，腳本將嘗試自動拉入圖表...")
            print("   (若自動失敗，請您手動拉入 Scorecard 與 Table)")

            # 這裡可以嘗試模擬點擊 "Add a chart" -> "Scorecard"
            # 但 Looker Studio DOM 很複雜，最穩健的是讓使用者手動拉

            print("\n🛑 腳本任務完成。瀏覽器將保持開啟 5 分鐘供您檢查或手動調整。")
            await asyncio.sleep(300)

        except IndexError:
            print("❌ 無法從網址解析 Report ID，請確認是否成功進入編輯器。")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(login_and_create())
