from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time


def create_template_selenium():
    print("🚀 啟動 Selenium (連線至 localhost:9222)...")

    options = Options()
    # 關鍵：接管已開啟的 Chrome
    options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")

    try:
        driver = webdriver.Chrome(options=options)
    except Exception as e:
        print(f"❌ 連線失敗: {e}")
        print(
            "請確認您已執行: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222"
        )
        return

    print("✅ 成功連線！導向 Looker Studio...")

    # 1. 建立報表
    driver.get("https://lookerstudio.google.com/reporting/create")

    print("⏳ 等待編輯器載入...")
    try:
        # 等待網址變化 (包含 reporting/ID)
        WebDriverWait(driver, 60).until(
            lambda d: "/reporting/" in d.current_url and "/page/" in d.current_url
        )

        url = driver.current_url
        report_id = url.split("/reporting/")[1].split("/")[0]

        print(f"\n🎉 範本建立成功！")
        print(f"🆔 Template ID: {report_id}")
        print(f"🔗 URL: {url}")

        print("\n⚠️ 請手動拉入 Scorecard 與 Table，完成後複製 ID 給我。")

    except Exception as e:
        print(f"❌ 建立逾時或失敗: {e}")

    # 不關閉 driver，讓使用者繼續操作
    # driver.quit()


if __name__ == "__main__":
    create_template_selenium()
