#!/usr/bin/env python3
"""
行銷數據分析清洗腳本

目的：將清洗後資料進一步處理，使其適合行銷數據分析
處理策略：
1. 自動修復可修復的資料
2. 標記無法修復的資料（新增 _flag 欄位）
3. 補充計算欄位（如地區解析）

執行方式:
    uv run python scripts/clean_for_marketing.py
"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from collections import Counter

# ==================== 配置 ====================

SOURCE_DIR = Path('./data/cleaned_backup')
OUTPUT_DIR = Path('./data/marketing_ready')

# 台灣縣市列表（用於地址解析）
TAIWAN_CITIES = [
    '台北市', '臺北市', '新北市', '桃園市', '台中市', '臺中市',
    '台南市', '臺南市', '高雄市', '基隆市', '新竹市', '嘉義市',
    '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣',
    '屏東縣', '宜蘭縣', '花蓮縣', '台東縣', '臺東縣', '澎湖縣',
    '金門縣', '連江縣',
]

# 手機格式正則
PHONE_PATTERN = re.compile(r'^09\d{8}$')
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
TAX_ID_PATTERN = re.compile(r'^\d{8}$')


# ==================== 工具函數 ====================

def load_json(pattern: str) -> tuple[list[dict], str]:
    """載入符合 pattern 的最新 JSON 檔案"""
    files = list(SOURCE_DIR.glob(pattern))
    if not files:
        raise FileNotFoundError(f"找不到符合 {pattern} 的檔案")
    latest = max(files, key=lambda f: f.stat().st_mtime)
    with open(latest, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if isinstance(data, dict) and 'records' in data:
        return data['records'], latest.name
    return data, latest.name


def save_json(data: list[dict], filename: str, stats: dict):
    """儲存處理後的 JSON"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output = {
        'processed_at': datetime.now().isoformat(),
        'record_count': len(data),
        'processing_stats': stats,
        'records': data,
    }

    filepath = OUTPUT_DIR / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    return filepath


def parse_city_from_address(address: str) -> str:
    """從地址解析縣市"""
    if not address:
        return ''
    for city in TAIWAN_CITIES:
        if city in address:
            # 標準化台/臺
            return city.replace('臺', '台')
    return ''


def parse_date(date_str: str) -> datetime | None:
    """解析日期字串"""
    if not date_str:
        return None
    try:
        # 嘗試多種格式
        for fmt in ['%Y/%m/%d %H:%M:%S', '%Y/%m/%d', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d']:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
    except:
        pass
    return None


# ==================== 清洗函數 ====================

def clean_phone(phone: str) -> tuple[str, dict]:
    """
    清洗手機號碼

    Returns:
        (cleaned_value, flags)
    """
    flags = {}
    if not phone:
        return '', {'_phone_empty': True}

    phone = phone.strip()

    # 平台隱蔽資料
    if '隱蔽' in phone or '隱藏' in phone or phone == '平台資料隱蔽':
        return phone, {'_phone_masked': True}

    # 有效手機格式
    if PHONE_PATTERN.match(phone):
        return phone, {}

    # 市話（0開頭）- 保留但標記
    if phone.startswith('0') and len(phone) >= 9:
        return phone, {'_phone_landline': True}

    # 其他無效格式
    return phone, {'_phone_invalid': True}


def clean_email(email: str) -> tuple[str, dict]:
    """清洗 Email"""
    if not email:
        return '', {}

    email = email.strip().lower()

    if EMAIL_PATTERN.match(email):
        return email, {}

    # 無效格式 - 清空並標記
    return '', {'_email_invalid': True, '_email_original': email}


def clean_tax_id(tax_id: str) -> tuple[str, dict]:
    """清洗統一編號"""
    if not tax_id:
        return '', {}

    tax_id = tax_id.strip()

    if TAX_ID_PATTERN.match(tax_id):
        return tax_id, {}

    # 無效格式 - 清空並標記
    return '', {'_tax_id_invalid': True, '_tax_id_original': tax_id}


def clean_quantity(qty: Any) -> tuple[int, dict]:
    """清洗數量"""
    flags = {}
    try:
        qty_val = int(float(qty)) if qty else 0
    except (ValueError, TypeError):
        return 0, {'_qty_invalid': True, '_qty_original': str(qty)}

    if qty_val == 0:
        flags['_qty_zero'] = True
    elif qty_val < 0:
        flags['_qty_negative'] = True
    elif qty_val > 100:
        flags['_qty_bulk'] = True  # 大量訂購，可能是批發

    return qty_val, flags


def clean_amount(amt: Any) -> tuple[float, dict]:
    """清洗金額"""
    flags = {}
    try:
        amt_val = float(amt) if amt else 0.0
    except (ValueError, TypeError):
        return 0.0, {'_amt_invalid': True, '_amt_original': str(amt)}

    if amt_val < 0:
        flags['_is_refund'] = True
    elif amt_val == 0:
        flags['_amt_zero'] = True

    return amt_val, flags


def fix_date_order(create_date: str, modify_date: str) -> tuple[str, str, dict]:
    """
    修復日期順序問題（建立日期應該 <= 修改日期）
    """
    flags = {}
    create_dt = parse_date(create_date)
    modify_dt = parse_date(modify_date)

    if create_dt and modify_dt and create_dt > modify_dt:
        # 交換日期
        flags['_date_swapped'] = True
        return modify_date, create_date, flags

    return create_date, modify_date, flags


# ==================== 主清洗邏輯 ====================

def process_customers(records: list[dict]) -> tuple[list[dict], dict]:
    """處理客戶表"""
    stats = Counter()
    processed = []

    for r in records:
        new_r = r.copy()

        # 清洗手機
        phone = r.get('行動電話', '')
        cleaned_phone, phone_flags = clean_phone(phone)
        new_r['行動電話'] = cleaned_phone
        new_r.update(phone_flags)
        for f in phone_flags:
            stats[f] += 1

        # 清洗 Email
        email = r.get('E-mail', '')
        cleaned_email, email_flags = clean_email(email)
        new_r['E-mail'] = cleaned_email
        new_r.update(email_flags)
        for f in email_flags:
            stats[f] += 1

        # 清洗統一編號
        tax_id = r.get('統一編號', '')
        cleaned_tax, tax_flags = clean_tax_id(tax_id)
        new_r['統一編號'] = cleaned_tax
        new_r.update(tax_flags)
        for f in tax_flags:
            stats[f] += 1

        # 從地址解析縣市
        address = r.get('通訊完整地址', '')
        city = parse_city_from_address(address)
        if city:
            new_r['_parsed_city'] = city
            stats['_city_parsed'] += 1

        # 日期順序修復
        create_date = r.get('建檔日期', '')
        modify_date = r.get('最後修改日期', '')
        fixed_create, fixed_modify, date_flags = fix_date_order(create_date, modify_date)
        if date_flags:
            new_r['建檔日期'] = fixed_create
            new_r['最後修改日期'] = fixed_modify
            new_r.update(date_flags)
            for f in date_flags:
                stats[f] += 1

        processed.append(new_r)

    return processed, dict(stats)


def process_orders(records: list[dict]) -> tuple[list[dict], dict]:
    """處理訂單表"""
    stats = Counter()
    processed = []

    for r in records:
        new_r = r.copy()

        # 清洗收件人電話
        phone = r.get('收件人電話', '')
        cleaned_phone, phone_flags = clean_phone(phone)
        new_r['收件人電話'] = cleaned_phone
        new_r.update(phone_flags)
        for f in phone_flags:
            stats[f] += 1

        # 清洗 Email
        email = r.get('E-mail', '')
        cleaned_email, email_flags = clean_email(email)
        new_r['E-mail'] = cleaned_email
        new_r.update(email_flags)
        for f in email_flags:
            stats[f] += 1

        # 清洗統一編號
        tax_id = r.get('統一編號', '')
        cleaned_tax, tax_flags = clean_tax_id(tax_id)
        new_r['統一編號'] = cleaned_tax
        new_r.update(tax_flags)
        for f in tax_flags:
            stats[f] += 1

        # 清洗金額
        amount = r.get('訂單實收', 0)
        cleaned_amt, amt_flags = clean_amount(amount)
        new_r['訂單實收'] = cleaned_amt
        new_r.update(amt_flags)
        for f in amt_flags:
            stats[f] += 1

        # 日期順序修復
        create_date = r.get('建立日期', '')
        modify_date = r.get('最後修改日期', '')
        fixed_create, fixed_modify, date_flags = fix_date_order(create_date, modify_date)
        if date_flags:
            new_r['建立日期'] = fixed_create
            new_r['最後修改日期'] = fixed_modify
            new_r.update(date_flags)
            for f in date_flags:
                stats[f] += 1

        # 從地址解析縣市（備份用）
        address = r.get('送貨完整地址', '')
        parsed_city = parse_city_from_address(address)
        if parsed_city:
            new_r['_parsed_city'] = parsed_city

        processed.append(new_r)

    return processed, dict(stats)


def process_order_details(records: list[dict], valid_customers: set) -> tuple[list[dict], dict]:
    """處理訂單明細表"""
    stats = Counter()
    processed = []

    for r in records:
        new_r = r.copy()

        # 檢查客戶參照
        customer_code = r.get('客戶編號', '')
        if customer_code and customer_code not in valid_customers:
            new_r['_customer_missing'] = True
            stats['_customer_missing'] += 1

        # 清洗數量
        qty = r.get('數量', 0)
        cleaned_qty, qty_flags = clean_quantity(qty)
        new_r['數量'] = cleaned_qty
        new_r.update(qty_flags)
        for f in qty_flags:
            stats[f] += 1

        # 清洗金額
        amount = r.get('訂單實收', 0)
        cleaned_amt, amt_flags = clean_amount(amount)
        new_r['訂單實收'] = cleaned_amt
        new_r.update(amt_flags)
        for f in amt_flags:
            stats[f] += 1

        # 清洗手機
        phone = r.get('行動電話', r.get('收件人電話', ''))
        cleaned_phone, phone_flags = clean_phone(phone)
        new_r['_cleaned_phone'] = cleaned_phone
        new_r.update(phone_flags)
        for f in phone_flags:
            stats[f] += 1

        # 清洗 Email
        email = r.get('E-mail', '')
        cleaned_email, email_flags = clean_email(email)
        new_r['E-mail'] = cleaned_email
        new_r.update(email_flags)
        for f in email_flags:
            stats[f] += 1

        # 日期順序修復
        create_date = r.get('建立日期', '')
        modify_date = r.get('最後修改日期', '')
        fixed_create, fixed_modify, date_flags = fix_date_order(create_date, modify_date)
        if date_flags:
            new_r['建立日期'] = fixed_create
            new_r['最後修改日期'] = fixed_modify
            new_r.update(date_flags)
            for f in date_flags:
                stats[f] += 1

        # 新增計算欄位
        # 商品單價
        try:
            unit_price = float(r.get('商品常態售價', 0) or 0)
            qty_val = float(r.get('數量', 0) or 0)
            if qty_val > 0:
                new_r['_unit_price'] = round(unit_price / qty_val, 2)
        except:
            pass

        processed.append(new_r)

    return processed, dict(stats)


# ==================== 主程式 ====================

def main():
    print("=" * 60)
    print("行銷數據分析清洗")
    print("=" * 60)
    print(f"開始時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    all_stats = {}

    # Step 1: 載入資料
    print("Step 1: 載入清洗後資料...")

    customers, cust_file = load_json('60_客戶*')
    orders, order_file = load_json('50_訂單*')
    details, detail_file = load_json('99_訂單明細*')

    # 原樣保留的表格
    brands, _ = load_json('10_品牌*')
    channels, _ = load_json('20_通路*')
    payments, _ = load_json('30_金流*')
    logistics, _ = load_json('40_物流*')
    products, _ = load_json('70_商品*')

    print(f"  客戶表: {len(customers):,} 筆")
    print(f"  訂單表: {len(orders):,} 筆")
    print(f"  訂單明細表: {len(details):,} 筆")
    print()

    # 建立有效客戶集合
    valid_customers = {c.get('客戶編號', '') for c in customers if c.get('客戶編號')}

    # Step 2: 處理各表格
    print("Step 2: 執行行銷數據清洗...")

    print("  處理客戶表...")
    processed_customers, cust_stats = process_customers(customers)
    all_stats['customers'] = cust_stats

    print("  處理訂單表...")
    processed_orders, order_stats = process_orders(orders)
    all_stats['orders'] = order_stats

    print("  處理訂單明細表...")
    processed_details, detail_stats = process_order_details(details, valid_customers)
    all_stats['details'] = detail_stats
    print()

    # Step 3: 儲存結果
    print("Step 3: 儲存處理後資料...")

    save_json(processed_customers, f'60_客戶_marketing_{timestamp}.json', cust_stats)
    save_json(processed_orders, f'50_訂單_marketing_{timestamp}.json', order_stats)
    save_json(processed_details, f'99_訂單明細_marketing_{timestamp}.json', detail_stats)

    # 原樣保留的表格也複製過去
    save_json(brands, f'10_品牌_marketing_{timestamp}.json', {})
    save_json(channels, f'20_通路_marketing_{timestamp}.json', {})
    save_json(payments, f'30_金流_marketing_{timestamp}.json', {})
    save_json(logistics, f'40_物流_marketing_{timestamp}.json', {})
    save_json(products, f'70_商品_marketing_{timestamp}.json', {})

    print(f"  輸出目錄: {OUTPUT_DIR}")
    print()

    # Step 4: 輸出統計報告
    print("=" * 60)
    print("清洗統計報告")
    print("=" * 60)

    flag_descriptions = {
        '_phone_empty': '手機空值',
        '_phone_masked': '手機隱蔽（平台保護）',
        '_phone_landline': '市話號碼',
        '_phone_invalid': '手機格式無效',
        '_email_invalid': 'Email 格式無效（已清空）',
        '_tax_id_invalid': '統一編號無效（已清空）',
        '_qty_zero': '數量為零',
        '_qty_negative': '數量為負',
        '_qty_bulk': '大量訂購（>100）',
        '_amt_zero': '金額為零',
        '_is_refund': '退款（負金額）',
        '_date_swapped': '日期順序已修復',
        '_customer_missing': '客戶參照缺失',
        '_city_parsed': '縣市已從地址解析',
    }

    for table_name, stats in all_stats.items():
        if not stats:
            continue

        table_display = {'customers': '客戶表', 'orders': '訂單表', 'details': '訂單明細表'}
        print(f"\n### {table_display.get(table_name, table_name)}")
        print()
        print("| 標記 | 說明 | 數量 |")
        print("|------|------|-----:|")

        for flag, count in sorted(stats.items(), key=lambda x: -x[1]):
            desc = flag_descriptions.get(flag, flag)
            print(f"| {flag} | {desc} | {count:,} |")

    # 資料品質摘要
    print()
    print("=" * 60)
    print("資料品質摘要")
    print("=" * 60)

    total_records = len(customers) + len(orders) + len(details)
    total_issues = sum(sum(s.values()) for s in all_stats.values())

    # 計算嚴重問題（需要注意的）
    serious_flags = ['_phone_invalid', '_email_invalid', '_customer_missing', '_qty_negative']
    serious_count = sum(
        stats.get(f, 0)
        for stats in all_stats.values()
        for f in serious_flags
    )

    # 計算已修復問題
    fixed_flags = ['_date_swapped', '_city_parsed']
    fixed_count = sum(
        stats.get(f, 0)
        for stats in all_stats.values()
        for f in fixed_flags
    )

    # 計算可接受問題（標記但不影響分析）
    acceptable_flags = ['_phone_masked', '_phone_landline', '_qty_bulk', '_qty_zero', '_amt_zero', '_is_refund']
    acceptable_count = sum(
        stats.get(f, 0)
        for stats in all_stats.values()
        for f in acceptable_flags
    )

    print()
    print(f"總記錄數: {total_records:,}")
    print(f"處理標記數: {total_issues:,}")
    print()
    print(f"  ✅ 已自動修復: {fixed_count:,}")
    print(f"  ⚠️ 已標記（可接受）: {acceptable_count:,}")
    print(f"  ❌ 需注意問題: {serious_count:,}")
    print()

    # 行銷分析可用性評估
    print("### 行銷分析可用性")
    print()

    # 客戶分析
    valid_phone_cust = len(customers) - all_stats['customers'].get('_phone_invalid', 0) - all_stats['customers'].get('_phone_empty', 0)
    valid_email_cust = len(customers) - all_stats['customers'].get('_email_invalid', 0) - sum(1 for c in customers if not c.get('E-mail'))

    print(f"- 客戶聯絡資訊可用率: {valid_phone_cust/len(customers)*100:.1f}% (手機)")
    print(f"- 客戶 Email 可用率: {valid_email_cust/len(customers)*100:.1f}%")
    print(f"- 客戶地區解析率: {all_stats['customers'].get('_city_parsed', 0)/len(customers)*100:.1f}%")

    # 訂單分析
    valid_orders = len(orders) - all_stats['orders'].get('_amt_zero', 0)
    print(f"- 有效訂單率: {valid_orders/len(orders)*100:.1f}%")

    # 明細分析
    valid_details = len(details) - all_stats['details'].get('_qty_zero', 0) - all_stats['details'].get('_customer_missing', 0)
    print(f"- 有效明細率: {valid_details/len(details)*100:.1f}%")

    print()
    print(f"完成時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == '__main__':
    main()
