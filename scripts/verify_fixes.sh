#\!/bin/bash
# 修正驗證腳本

echo "=== 1. 備份排程驗證 ==="
SCHEDULE=$(gcloud scheduler jobs describe erp-backup-daily --location=asia-east1 --project=b25h01-ragic --format="value(schedule)" 2>/dev/null)
if [[ "$SCHEDULE" == "0 0 * * *" ]]; then
  echo "✅ 排程正確: $SCHEDULE"
else
  echo "❌ 排程錯誤: $SCHEDULE (預期: 0 0 * * *)"
fi

echo ""
echo "=== 2. main.py 清洗整合驗證 ==="
if grep -q "_execute_cleaning" app/backup/main.py 2>/dev/null; then
  echo "✅ _execute_cleaning 函數存在"
  if grep -q "備份成功後直接執行" app/backup/main.py 2>/dev/null; then
    echo "✅ 備份後清洗邏輯已整合"
  else
    echo "❌ 備份後清洗邏輯未找到"
  fi
else
  echo "❌ _execute_cleaning 函數不存在"
fi

echo ""
echo "=== 3. 清洗排程刪除驗證 ==="
CLEANING_JOB=$(gcloud scheduler jobs list --location=asia-east1 --project=b25h01-ragic --format="value(name)" 2>/dev/null | grep cleaning)
if [[ -z "$CLEANING_JOB" ]]; then
  echo "✅ 清洗排程已刪除"
else
  echo "❌ 清洗排程仍存在: $CLEANING_JOB"
fi

echo ""
echo "=== 4. Cloud Run 存取驗證 ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://data-correction-app-571015722523.asia-east1.run.app/health 2>/dev/null)
if [[ "$HTTP_CODE" == "200" ]]; then
  echo "✅ Cloud Run 可存取 (HTTP $HTTP_CODE)"
else
  echo "❌ Cloud Run 無法存取 (HTTP $HTTP_CODE)"
  echo "   需在 GCP Console 設定公開存取"
fi

echo ""
echo "=== 驗證完成 ==="

