#!/usr/bin/env python3
"""
增量資料清洗與合併腳本

功能：
1. 讀取現有清洗後的備份資料
2. 讀取新抓回來的增量資料
3. 對新資料進行清洗
4. 合併舊資料與新資料（根據 _ragicId 更新或新增）
5. 輸出合併後的資料

使用方式：
    uv run python scripts/merge_incremental.py
"""
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple
from collections import defaultdict

# 配置
CLEANED_BACKUP_DIR = Path("data/cleaned_backup")
INCREMENTAL_DIR = Path("data/incremental_20250107/20260107_004242")
OUTPUT_DIR = Path("data/cleaned_backup")

# 表格對應
SHEET_MAPPING = {
    "10": {"old": "10_品牌管理_cleaned_20251231_060426.json", "new": None, "name": "品牌管理"},
    "20": {"old": "20_通路管理_150405_cleaned_20251231_060426.json", "new": "20_通路管理.json", "name": "通路管理"},
    "30": {"old": "30_金流管理_150406_cleaned_20251231_060426.json", "new": None, "name": "金流管理"},
    "40": {"old": "40_物流管理_150406_cleaned_20251231_060426.json", "new": None, "name": "物流管理"},
    "41": {"old": "41_郵遞區號_150407_cleaned_20251231_060426.json", "new": None, "name": "郵遞區號"},
    "50": {"old": "50_訂單管理_cleaned_20251231_060426.json", "new": "50_訂單管理.json", "name": "訂單管理"},
    "60": {"old": "60_客戶管理_cleaned_v2_20251231.json", "new": "60_客戶管理.json", "name": "客戶管理"},
    "70": {"old": "70_商品管理_cleaned_20251231_060426.json", "new": None, "name": "商品管理"},
    "80": {"old": "80_活動管理_152608_cleaned_20251231_060426.json", "new": None, "name": "活動管理"},
    "99": {"old": "99_訂單明細_cleaned_20251231_060426.json", "new": "99_訂單明細.json", "name": "訂單明細"},
}


def load_json(filepath: Path) -> Dict[str, Any]:
    """載入 JSON 檔案"""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Any, filepath: Path):
    """儲存 JSON 檔案"""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ==================== 清洗規則 ====================

def clean_phone(phone: str) -> str:
    """清洗電話號碼"""
    if not phone:
        return ""
    # 移除非數字字元（保留 + - # 擴展號）
    cleaned = re.sub(r'[^\d+\-#]', '', str(phone))
    return cleaned


def clean_email(email: str) -> str:
    """清洗 Email"""
    if not email:
        return ""
    return str(email).strip().lower()


def clean_amount(amount: Any) -> float:
    """清洗金額"""
    if not amount:
        return 0.0
    try:
        return float(str(amount).replace(',', '').replace('$', '').strip())
    except (ValueError, TypeError):
        return 0.0


def validate_email(email: str) -> bool:
    """驗證 Email 格式"""
    if not email:
        return True  # 空值不驗證
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_phone(phone: str) -> bool:
    """驗證台灣手機號碼格式"""
    if not phone:
        return True
    # 台灣手機格式：09 開頭，共 10 碼
    cleaned = re.sub(r'[^\d]', '', phone)
    return len(cleaned) == 10 and cleaned.startswith('09')


def add_cleaning_flag(record: dict, rule_id: str, field: str,
                      original_value: Any, error_message: str,
                      severity: str = "medium"):
    """新增清洗標記"""
    if "_cleaning_flags" not in record:
        record["_cleaning_flags"] = []

    record["_cleaning_flags"].append({
        "rule_id": rule_id,
        "field": field,
        "original_value": str(original_value) if original_value else None,
        "error_message": error_message,
        "severity": severity,
        "flagged_at": datetime.now().isoformat()
    })
    record["_has_issues"] = True
    record["_issue_count"] = len(record["_cleaning_flags"])


# ==================== 表格專用清洗規則 ====================

def clean_customer_record(record: dict) -> dict:
    """清洗客戶記錄 (表60)"""
    # 清洗電話
    phone_fields = ["行動電話", "電話"]
    for field in phone_fields:
        if field in record and record[field]:
            original = record[field]
            cleaned = clean_phone(original)
            record[field] = cleaned
            if original != cleaned:
                record["_phone_cleaned"] = True

            # 驗證手機格式
            if field == "行動電話" and cleaned and not validate_phone(cleaned):
                add_cleaning_flag(record, "FMT-PHONE", field, original,
                                 f"手機格式異常: {cleaned}", "low")

    # 清洗 Email
    if "E-mail" in record and record["E-mail"]:
        original = record["E-mail"]
        cleaned = clean_email(original)
        record["E-mail"] = cleaned

        if not validate_email(cleaned):
            add_cleaning_flag(record, "FMT-EMAIL", "E-mail", original,
                             f"Email 格式異常: {cleaned}", "low")

    return record


def clean_order_record(record: dict) -> dict:
    """清洗訂單記錄 (表50)"""
    # 清洗金額欄位
    amount_fields = ["訂單實收", "訂單建議售價", "運費"]
    for field in amount_fields:
        if field in record:
            original = record[field]
            cleaned = clean_amount(original)
            record[field] = cleaned

            # 檢查負數
            if cleaned < 0:
                add_cleaning_flag(record, "NUM-NEGATIVE", field, original,
                                 f"金額為負數: {cleaned}", "high")

    return record


def clean_order_detail_record(record: dict) -> dict:
    """清洗訂單明細記錄 (表99)"""
    # 清洗金額欄位
    amount_fields = ["訂單實收", "商品常態售價", "活動售價", "數量"]
    for field in amount_fields:
        if field in record:
            original = record[field]
            cleaned = clean_amount(original)
            record[field] = cleaned

            if cleaned < 0:
                add_cleaning_flag(record, "NUM-NEGATIVE", field, original,
                                 f"數值為負數: {cleaned}", "high")

    # 檢查數量為 0
    if record.get("數量", 0) == 0:
        add_cleaning_flag(record, "NUM-ZERO", "數量", 0,
                         "數量為 0", "medium")

    return record


def clean_channel_record(record: dict) -> dict:
    """清洗通路記錄 (表20)"""
    # 清洗通路名稱空白
    if "通路名稱" in record:
        record["通路名稱"] = str(record["通路名稱"]).strip()

    return record


def clean_records(records: List[dict], sheet_code: str) -> Tuple[List[dict], Dict]:
    """清洗記錄列表"""
    cleaned = []
    stats = {
        "total": len(records),
        "cleaned": 0,
        "flagged": 0,
        "issues": defaultdict(int)
    }

    for record in records:
        # 根據表格類型應用不同清洗規則
        if sheet_code == "60":
            record = clean_customer_record(record)
        elif sheet_code == "50":
            record = clean_order_record(record)
        elif sheet_code == "99":
            record = clean_order_detail_record(record)
        elif sheet_code == "20":
            record = clean_channel_record(record)

        # 統計
        if record.get("_has_issues"):
            stats["flagged"] += 1
            for flag in record.get("_cleaning_flags", []):
                stats["issues"][flag["rule_id"]] += 1

        stats["cleaned"] += 1
        cleaned.append(record)

    return cleaned, stats


# ==================== 合併邏輯 ====================

def merge_records(old_records: List[dict], new_records: List[dict]) -> Tuple[List[dict], Dict]:
    """
    合併舊記錄與新記錄

    邏輯：
    - 根據 _ragicId 識別記錄
    - 新記錄覆蓋舊記錄（更新）
    - 新記錄不存在於舊記錄則新增
    """
    # 建立舊記錄索引
    old_index = {r.get("_ragicId"): i for i, r in enumerate(old_records) if r.get("_ragicId")}

    merged = old_records.copy()
    stats = {
        "old_count": len(old_records),
        "new_count": len(new_records),
        "updated": 0,
        "inserted": 0
    }

    for new_record in new_records:
        ragic_id = new_record.get("_ragicId")
        if not ragic_id:
            continue

        if ragic_id in old_index:
            # 更新現有記錄
            idx = old_index[ragic_id]
            merged[idx] = new_record
            stats["updated"] += 1
        else:
            # 新增記錄
            merged.append(new_record)
            stats["inserted"] += 1

    stats["final_count"] = len(merged)
    return merged, stats


# ==================== 主程式 ====================

def process_sheet(sheet_code: str, mapping: dict) -> dict:
    """處理單一表格"""
    result = {
        "sheet_code": sheet_code,
        "name": mapping["name"],
        "status": "skipped"
    }

    # 檢查是否有新資料
    if not mapping["new"]:
        print(f"  {sheet_code} {mapping['name']}: 無增量資料，跳過")
        return result

    new_file = INCREMENTAL_DIR / mapping["new"]
    if not new_file.exists():
        print(f"  {sheet_code} {mapping['name']}: 增量檔案不存在，跳過")
        return result

    # 載入舊資料
    old_file = CLEANED_BACKUP_DIR / mapping["old"]
    if old_file.exists():
        old_data = load_json(old_file)
        if isinstance(old_data, dict) and "records" in old_data:
            old_records = old_data["records"]
        else:
            old_records = old_data if isinstance(old_data, list) else []
    else:
        old_records = []

    # 載入新資料
    new_data = load_json(new_file)
    new_records = new_data.get("records", [])

    print(f"  {sheet_code} {mapping['name']}: 舊資料 {len(old_records)} 筆, 新資料 {len(new_records)} 筆")

    # 清洗新資料
    cleaned_new, clean_stats = clean_records(new_records, sheet_code)
    print(f"    清洗完成: {clean_stats['flagged']} 筆有問題")

    # 合併資料
    merged, merge_stats = merge_records(old_records, cleaned_new)
    print(f"    合併完成: 更新 {merge_stats['updated']} 筆, 新增 {merge_stats['inserted']} 筆")
    print(f"    最終資料: {merge_stats['final_count']} 筆")

    # 儲存合併後的資料
    timestamp = datetime.now().strftime("%Y%m%d")
    output_file = OUTPUT_DIR / f"{sheet_code}_{mapping['name']}_merged_{timestamp}.json"

    output_data = {
        "sheet_code": sheet_code,
        "sheet_name": mapping["name"],
        "merged_at": datetime.now().isoformat(),
        "old_count": merge_stats["old_count"],
        "new_count": merge_stats["new_count"],
        "updated": merge_stats["updated"],
        "inserted": merge_stats["inserted"],
        "total_records": merge_stats["final_count"],
        "cleaning_stats": {
            "flagged": clean_stats["flagged"],
            "issues": dict(clean_stats["issues"])
        },
        "records": merged
    }

    save_json(output_data, output_file)
    print(f"    已儲存: {output_file}")

    result["status"] = "success"
    result["old_count"] = merge_stats["old_count"]
    result["new_count"] = merge_stats["new_count"]
    result["updated"] = merge_stats["updated"]
    result["inserted"] = merge_stats["inserted"]
    result["final_count"] = merge_stats["final_count"]
    result["flagged"] = clean_stats["flagged"]
    result["output_file"] = str(output_file)

    return result


def main():
    """主程式"""
    print("=" * 60)
    print("增量資料清洗與合併")
    print("=" * 60)
    print(f"來源目錄: {CLEANED_BACKUP_DIR}")
    print(f"增量目錄: {INCREMENTAL_DIR}")
    print(f"輸出目錄: {OUTPUT_DIR}")
    print("=" * 60)

    results = []

    for sheet_code, mapping in SHEET_MAPPING.items():
        result = process_sheet(sheet_code, mapping)
        results.append(result)

    # 輸出摘要
    print("\n" + "=" * 60)
    print("處理摘要")
    print("=" * 60)

    for r in results:
        if r["status"] == "success":
            print(f"✅ {r['sheet_code']} {r['name']}: "
                  f"舊 {r['old_count']} + 新 {r['new_count']} → {r['final_count']} 筆 "
                  f"(更新 {r['updated']}, 新增 {r['inserted']}, 問題 {r['flagged']})")
        else:
            print(f"⏭️  {r['sheet_code']} {r['name']}: 跳過")

    # 儲存處理報告
    report_file = OUTPUT_DIR / f"merge_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    save_json({
        "processed_at": datetime.now().isoformat(),
        "results": results
    }, report_file)
    print(f"\n報告已儲存: {report_file}")


if __name__ == "__main__":
    main()
