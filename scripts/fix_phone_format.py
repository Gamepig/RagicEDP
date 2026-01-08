#!/usr/bin/env python3
"""
市話格式修正程式

功能：
1. 判斷電話是否為台灣市話（缺少開頭 0）
2. 自動回填缺少的 0
3. 更新客戶資料

台灣市話格式：
- 02 + 8碼 = 10碼（台北/新北/基隆）
- 03 + 7碼 = 9碼（桃園/新竹/宜蘭/花蓮）
- 04 + 7碼 = 9碼（台中/彰化/南投）（部分 04-2xxx 為 8碼）
- 05 + 7碼 = 9碼（雲林/嘉義）
- 06 + 7碼 = 9碼（台南）
- 07 + 7碼 = 9碼（高雄）
- 08 + 7碼 = 9碼（屏東/台東/澎湖）
- 089 + 6碼 = 9碼（台東）

使用方式：
    uv run python scripts/fix_phone_format.py
"""
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

# 配置
INPUT_FILE = Path("data/cleaned_backup/60_客戶管理_merged_20260107.json")
OUTPUT_FILE = Path("data/cleaned_backup/60_客戶管理_merged_20260107.json")  # 直接更新


# 台灣市話區號規則
TAIWAN_AREA_CODES = {
    # 區號: (區號長度, 號碼總長度, 區域名稱)
    '2': (1, 10, '台北/新北/基隆'),      # 02 + 8碼 = 10碼
    '3': (1, 9, '桃園/新竹/宜蘭/花蓮'),   # 03 + 7碼 = 9碼
    '4': (1, 9, '台中/彰化/南投'),        # 04 + 7-8碼 = 9-10碼
    '5': (1, 9, '雲林/嘉義'),             # 05 + 7碼 = 9碼
    '6': (1, 9, '台南'),                  # 06 + 7碼 = 9碼
    '7': (1, 9, '高雄'),                  # 07 + 7碼 = 9碼
    '8': (1, 9, '屏東/台東/澎湖'),        # 08 + 7碼 = 9碼
    '37': (2, 9, '苗栗'),                 # 037 + 6碼 = 9碼
    '49': (2, 9, '南投'),                 # 049 + 6碼 = 9碼
    '82': (2, 9, '金門'),                 # 082 + 6碼 = 9碼
    '89': (2, 9, '台東'),                 # 089 + 6碼 = 9碼
}


def analyze_phone(phone: str) -> Tuple[str, Optional[str], Optional[str]]:
    """
    分析電話號碼

    Returns:
        (類型, 修正後號碼, 說明)
        類型: 'mobile' | 'landline' | 'landline_missing_0' | 'unknown'
    """
    if not phone:
        return ('empty', None, '空值')

    # 移除非數字
    digits = re.sub(r'[^\d]', '', str(phone))

    if not digits:
        return ('empty', None, '無有效數字')

    # 手機：09 開頭，10 碼
    if digits.startswith('09') and len(digits) == 10:
        return ('mobile', digits, '手機號碼')

    # 市話：0 開頭
    if digits.startswith('0'):
        # 02 開頭，應為 10 碼
        if digits.startswith('02'):
            if len(digits) == 10:
                return ('landline', digits, '台北市話')
            else:
                return ('unknown', None, f'02 開頭但長度異常 ({len(digits)} 碼)')

        # 03-08 開頭，應為 9 碼
        if digits[1] in '345678':
            if len(digits) == 9:
                return ('landline', digits, f'0{digits[1]} 區市話')
            elif len(digits) == 10 and digits[1] == '4':
                # 04 有些是 10 碼
                return ('landline', digits, '04 區市話 (10碼)')
            else:
                return ('unknown', None, f'0{digits[1]} 開頭但長度異常 ({len(digits)} 碼)')

        return ('unknown', None, f'0 開頭但格式不明')

    # 不是 0 開頭，檢查是否為缺少 0 的市話
    # 2 開頭，9 碼 → 可能是 02 + 8碼，缺少開頭 0
    if digits.startswith('2') and len(digits) == 9:
        fixed = '0' + digits
        return ('landline_missing_0', fixed, f'台北市話缺少 0 → {fixed}')

    # 3-8 開頭，8 碼 → 可能是 03-08 + 7碼，缺少開頭 0
    if digits[0] in '345678' and len(digits) == 8:
        fixed = '0' + digits
        return ('landline_missing_0', fixed, f'0{digits[0]} 區市話缺少 0 → {fixed}')

    # 其他情況
    return ('unknown', None, f'格式不明 ({len(digits)} 碼)')


def fix_customer_phones(data: dict) -> Tuple[dict, list]:
    """
    修正客戶電話格式

    Returns:
        (修正後資料, 修正記錄列表)
    """
    records = data.get('records', [])
    fix_log = []

    for record in records:
        phone = record.get('行動電話', '')
        if not phone:
            continue

        phone_type, fixed_phone, description = analyze_phone(phone)

        if phone_type == 'landline_missing_0':
            # 記錄修正
            fix_log.append({
                '_ragicId': record.get('_ragicId'),
                '客戶編號': record.get('客戶編號'),
                '客戶名稱': record.get('客戶名稱'),
                '原始電話': phone,
                '修正後電話': fixed_phone,
                '說明': description
            })

            # 執行修正
            record['行動電話'] = fixed_phone
            record['_phone_fixed'] = True
            record['_phone_fix_note'] = description

            # 移除相關的清洗標記
            if '_cleaning_flags' in record:
                record['_cleaning_flags'] = [
                    f for f in record['_cleaning_flags']
                    if not (f.get('rule_id') == 'FMT-PHONE' and f.get('field') == '行動電話')
                ]
                if not record['_cleaning_flags']:
                    del record['_cleaning_flags']
                    record['_has_issues'] = False
                    if '_issue_count' in record:
                        del record['_issue_count']

    return data, fix_log


def main():
    print("=" * 60)
    print("市話格式修正程式")
    print("=" * 60)

    # 載入資料
    print(f"\n載入: {INPUT_FILE}")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    total_records = len(data.get('records', []))
    print(f"總記錄數: {total_records}")

    # 先分析所有電話
    print("\n分析電話格式...")
    stats = {
        'mobile': 0,
        'landline': 0,
        'landline_missing_0': 0,
        'unknown': 0,
        'empty': 0
    }

    for record in data.get('records', []):
        phone = record.get('行動電話', '')
        phone_type, _, _ = analyze_phone(phone)
        stats[phone_type] += 1

    print(f"  手機: {stats['mobile']}")
    print(f"  市話: {stats['landline']}")
    print(f"  市話缺 0: {stats['landline_missing_0']}")
    print(f"  未知: {stats['unknown']}")
    print(f"  空值: {stats['empty']}")

    # 執行修正
    print("\n執行修正...")
    data, fix_log = fix_customer_phones(data)

    print(f"修正筆數: {len(fix_log)}")

    if fix_log:
        print("\n修正記錄:")
        for fix in fix_log:
            print(f"  {fix['客戶編號']} {fix['客戶名稱']}: {fix['原始電話']} → {fix['修正後電話']}")

    # 儲存修正後的資料
    print(f"\n儲存: {OUTPUT_FILE}")
    data['phone_fix_at'] = datetime.now().isoformat()
    data['phone_fix_count'] = len(fix_log)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # 儲存修正記錄
    if fix_log:
        log_file = Path("data/cleaned_backup/phone_fix_log_20260107.json")
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump({
                'fixed_at': datetime.now().isoformat(),
                'total_fixed': len(fix_log),
                'records': fix_log
            }, f, ensure_ascii=False, indent=2)
        print(f"修正記錄: {log_file}")

    print("\n完成!")


if __name__ == "__main__":
    main()
