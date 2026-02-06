from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
import shutil
import os
import time


def create_template_clone():
    # 1. 定義路徑
    original_user_data = os.path.expanduser("~/Library/Application Support/Google/Chrome")
    temp_user_data = os.path.expanduser("~/_temp_chrome_profile")

    print(f"🚀 正在複製 Chrome 設定檔...")
    print(f"   來源: {original_user_data}")
    print(f"   目標: {temp_user_data}")
    print("   (這可能需要幾秒鐘，請稍候...)")

    # 為了速度，我們只複製 Default Profile 的核心部分，或者嘗試直接引用
    # 直接引用會衝突，所以必須複製。但 User Data 很大，我們只複製 Default 目錄

    try:
        if os.path.exists(temp_user_data):
            shutil.rmtree(temp_user_data)

        # 關鍵：我們嘗試只複製 Default Profile，而不是整個 User Data，以節省時間
        # 但 Chrome 結構複雜，最穩是用 --user-data-dir 指向原路徑並確保原 Chrome 關閉
        # 既然原 Chrome 關閉很難，我們嘗試複製 Default

        os.makedirs(temp_user_data, exist_ok=True)
        # 複製 'Default' 資料夾 (包含 Cookie)
        shutil.copytree(
            os.path.join(original_user_data, "Default"),
            os.path.join(temp_user_data, "Default"),
            ignore=shutil.ignore_patterns("Cache*", "Code Cache*"),  # 忽略快取加速
        )
        # 複製 'Local State' (必要設定)
        shutil.copy(os.path.join(original_user_data, "Local State"), temp_user_data)

        print("✅ 複製完成！啟動 Selenium...")

    except Exception as e:
        print(f"⚠️ 複製失敗 (可能檔案被鎖定): {e}")
        print("嘗試直接啟動，可能會要求登入...")

    # 2. 啟動 Selenium
    options = Options()
    options.add_argument(f"--user-data-dir={temp_user_data}")
    options.add_argument("--profile-directory=Default")
    # 嘗試繞過自動化偵測
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    try:
        driver = webdriver.Chrome(options=options)
    except Exception as e:
        print(f"❌ 啟動失敗: {e}")
        return

    # 3. 導向 Looker Studio
    print("🌐 前往 Looker Studio...")
    driver.get("https://lookerstudio.google.com/reporting/create")

    # 4. 等待與抓取
    try:
        # 等待網址包含 reporting
        WebDriverWait(driver, 120).until(lambda d: "/reporting/" in d.current_url)

        url = driver.current_url
        if "/reporting/create" in url:
            print("⚠️ 似乎卡在建立頁面，請手動點選建立...")
            # 等待 URL 變為 ID 格式
            WebDriverWait(driver, 120).until(
                lambda d: "/reporting/0" in d.current_url or "/reporting/1" in d.current_url
            )
            url = driver.current_url

        report_id = url.split("/reporting/")[1].split("/")[0]

        print(f"\n🎉 範本建立成功！")
        print(f"🆔 Template ID: {report_id}")

    except Exception as e:
        print(f"❌ 逾時或失敗: {e}")
        print("請在彈出的視窗中手動完成操作，然後複製網址 ID。")

    # 保持開啟
    print("🛑 腳本結束，視窗保留 5 分鐘。")
    time.sleep(300)
    driver.quit()

    # 清理
    shutil.rmtree(temp_user_data, ignore_errors=True)


if __name__ == "__main__":
    create_template_clone()
