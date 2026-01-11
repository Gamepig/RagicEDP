#!/usr/bin/env python3
"""
品牌資料清洗腳本

根據品牌保留清單清洗本地備份資料：
1. 品牌表 → 只保留指定品牌
2. 商品表 → 只保留指定品牌的商品
3. 訂單明細表 → 只保留指定品牌的明細
4. 訂單表 → 只保留有對應明細的訂單
5. 客戶表 → 只保留有訂單記錄的客戶

執行方式:
    uv run python scripts/clean_by_brand.py
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

# ==================== 配置 ====================

# 保留品牌清單
KEEP_BRANDS = {'GMK', 'YAS', 'SUN', 'BDF', 'HYA', 'HHH'}

# 資料目錄
SOURCE_DIR = Path('./data/full_backup')
OUTPUT_DIR = Path('./data/cleaned_backup')

# 欄位 ID 對照
FIELD_IDS = {
    'brand_code': '1000942',      # 品牌編號 (品牌表)
    'product_brand': '1000999',   # 品牌編號 (商品表)
    'detail_brand': '1000818',    # 品牌編號 (訂單明細表)
    'order_code': '1000781',      # 訂單編號
    'customer_code': '1000710',   # 客戶編號
    'detail_customer': '1000780', # 客戶編號 (訂單明細表)
}


# ==================== 工具函數 ====================

def load_json(pattern: str) -> tuple[list[dict], str]:
    """載入符合 pattern 的最新 JSON 檔案"""
    files = list(SOURCE_DIR.glob(pattern))
    if not files:
        raise FileNotFoundError(f"找不到符合 {pattern} 的檔案")

    # 選擇最新的檔案
    latest = max(files, key=lambda f: f.stat().st_mtime)

    with open(latest, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 檢查是否為包裝格式
    if isinstance(data, dict) and 'records' in data:
        return data['records'], latest.name
    return data, latest.name


def save_json(data: list[dict], filename: str, metadata: dict):
    """儲存清洗後的 JSON"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output = {
        'cleaned_at': datetime.now().isoformat(),
        'source_file': metadata.get('source_file', ''),
        'original_count': metadata.get('original_count', 0),
        'cleaned_count': len(data),
        'removed_count': metadata.get('original_count', 0) - len(data),
        'records': data,
    }

    filepath = OUTPUT_DIR / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    return filepath


def get_field(record: dict, *field_names: str) -> str:
    """取得欄位值（支援多個欄位名稱/ID）"""
    for name in field_names:
        value = record.get(name, '')
        if value:
            return str(value).strip()
    return ''


# ==================== 清洗函數 ====================

def clean_brands(records: list[dict]) -> list[dict]:
    """清洗品牌表：只保留指定品牌"""
    cleaned = []
    for r in records:
        brand_code = get_field(r, '品牌編號', FIELD_IDS['brand_code'])
        if brand_code in KEEP_BRANDS:
            cleaned.append(r)
    return cleaned


def clean_products(records: list[dict]) -> list[dict]:
    """清洗商品表：只保留指定品牌的商品"""
    cleaned = []
    for r in records:
        brand_code = get_field(r, '品牌編號', FIELD_IDS['product_brand'])
        if brand_code in KEEP_BRANDS:
            cleaned.append(r)
    return cleaned


def clean_order_details(records: list[dict]) -> tuple[list[dict], set, set]:
    """
    清洗訂單明細表：只保留指定品牌的明細

    Returns:
        (cleaned_records, valid_order_codes, valid_customer_codes)
    """
    cleaned = []
    valid_orders = set()
    valid_customers = set()

    for r in records:
        brand_code = get_field(r, '品牌編號', FIELD_IDS['detail_brand'])

        # 只保留在保留清單中的品牌（空值也排除）
        if brand_code in KEEP_BRANDS:
            cleaned.append(r)

            # 收集有效的訂單編號和客戶編號
            order_code = get_field(r, '訂單編號', FIELD_IDS['order_code'])
            customer_code = get_field(r, '客戶編號', FIELD_IDS['detail_customer'])

            if order_code:
                valid_orders.add(order_code)
            if customer_code:
                valid_customers.add(customer_code)

    return cleaned, valid_orders, valid_customers


def clean_orders(records: list[dict], valid_order_codes: set) -> list[dict]:
    """清洗訂單表：只保留有對應明細的訂單"""
    cleaned = []
    for r in records:
        order_code = get_field(r, '訂單編號', FIELD_IDS['order_code'])
        if order_code in valid_order_codes:
            cleaned.append(r)
    return cleaned


def clean_customers(records: list[dict], valid_customer_codes: set) -> list[dict]:
    """清洗客戶表：只保留有訂單記錄的客戶"""
    cleaned = []
    for r in records:
        customer_code = get_field(r, '客戶編號', FIELD_IDS['customer_code'])
        if customer_code in valid_customer_codes:
            cleaned.append(r)
    return cleaned


# ==================== 主程式 ====================

def main():
    print("=" * 60)
    print("品牌資料清洗")
    print("=" * 60)
    print(f"開始時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"保留品牌: {', '.join(sorted(KEEP_BRANDS))}")
    print()

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results = {}

    # Step 1: 載入資料
    print("Step 1: 載入資料...")

    brands, brands_file = load_json('10_品牌*')
    products, products_file = load_json('70_商品*')
    details, details_file = load_json('99_訂單明細*')
    orders, orders_file = load_json('50_訂單*')
    customers, customers_file = load_json('60_客戶*')

    # 原樣保留的表格
    channels, channels_file = load_json('20_通路*')
    payments, payments_file = load_json('30_金流*')
    logistics, logistics_file = load_json('40_物流*')
    zipcodes, zipcodes_file = load_json('41_郵遞*')
    campaigns, campaigns_file = load_json('80_活動*')

    print(f"  品牌表: {len(brands):,} 筆 ({brands_file})")
    print(f"  商品表: {len(products):,} 筆 ({products_file})")
    print(f"  訂單明細表: {len(details):,} 筆 ({details_file})")
    print(f"  訂單表: {len(orders):,} 筆 ({orders_file})")
    print(f"  客戶表: {len(customers):,} 筆 ({customers_file})")
    print()

    # Step 2: 清洗品牌表
    print("Step 2: 清洗品牌表...")
    cleaned_brands = clean_brands(brands)
    print(f"  原始: {len(brands):,} → 保留: {len(cleaned_brands):,} (移除: {len(brands) - len(cleaned_brands):,})")
    results['brands'] = {'original': len(brands), 'cleaned': len(cleaned_brands)}

    # Step 3: 清洗商品表
    print("Step 3: 清洗商品表...")
    cleaned_products = clean_products(products)
    print(f"  原始: {len(products):,} → 保留: {len(cleaned_products):,} (移除: {len(products) - len(cleaned_products):,})")
    results['products'] = {'original': len(products), 'cleaned': len(cleaned_products)}

    # Step 4: 清洗訂單明細表（同時收集有效的訂單和客戶）
    print("Step 4: 清洗訂單明細表...")
    cleaned_details, valid_orders, valid_customers = clean_order_details(details)
    print(f"  原始: {len(details):,} → 保留: {len(cleaned_details):,} (移除: {len(details) - len(cleaned_details):,})")
    print(f"  有效訂單編號: {len(valid_orders):,} 個")
    print(f"  有效客戶編號: {len(valid_customers):,} 個")
    results['details'] = {'original': len(details), 'cleaned': len(cleaned_details)}

    # Step 5: 清洗訂單表
    print("Step 5: 清洗訂單表...")
    cleaned_orders = clean_orders(orders, valid_orders)
    print(f"  原始: {len(orders):,} → 保留: {len(cleaned_orders):,} (移除: {len(orders) - len(cleaned_orders):,})")
    results['orders'] = {'original': len(orders), 'cleaned': len(cleaned_orders)}

    # Step 6: 清洗客戶表
    print("Step 6: 清洗客戶表...")
    cleaned_customers = clean_customers(customers, valid_customers)
    print(f"  原始: {len(customers):,} → 保留: {len(cleaned_customers):,} (移除: {len(customers) - len(cleaned_customers):,})")
    results['customers'] = {'original': len(customers), 'cleaned': len(cleaned_customers)}
    print()

    # Step 7: 儲存清洗後資料
    print("Step 7: 儲存清洗後資料...")

    # 清洗後的表格
    save_json(cleaned_brands, f'10_品牌管理_cleaned_{timestamp}.json',
              {'source_file': brands_file, 'original_count': len(brands)})
    save_json(cleaned_products, f'70_商品管理_cleaned_{timestamp}.json',
              {'source_file': products_file, 'original_count': len(products)})
    save_json(cleaned_details, f'99_訂單明細_cleaned_{timestamp}.json',
              {'source_file': details_file, 'original_count': len(details)})
    save_json(cleaned_orders, f'50_訂單管理_cleaned_{timestamp}.json',
              {'source_file': orders_file, 'original_count': len(orders)})
    save_json(cleaned_customers, f'60_客戶管理_cleaned_{timestamp}.json',
              {'source_file': customers_file, 'original_count': len(customers)})

    # 原樣保留的表格
    save_json(channels, f'20_通路管理_cleaned_{timestamp}.json',
              {'source_file': channels_file, 'original_count': len(channels)})
    save_json(payments, f'30_金流管理_cleaned_{timestamp}.json',
              {'source_file': payments_file, 'original_count': len(payments)})
    save_json(logistics, f'40_物流管理_cleaned_{timestamp}.json',
              {'source_file': logistics_file, 'original_count': len(logistics)})
    save_json(zipcodes, f'41_郵遞區號_cleaned_{timestamp}.json',
              {'source_file': zipcodes_file, 'original_count': len(zipcodes)})
    save_json(campaigns, f'80_活動管理_cleaned_{timestamp}.json',
              {'source_file': campaigns_file, 'original_count': len(campaigns)})

    print(f"  輸出目錄: {OUTPUT_DIR}")
    print()

    # 摘要
    print("=" * 60)
    print("清洗摘要")
    print("=" * 60)
    print()
    print("| 資料表 | 原始筆數 | 保留筆數 | 移除筆數 | 移除比例 |")
    print("|--------|--------:|--------:|--------:|--------:|")

    total_original = 0
    total_cleaned = 0

    table_names = {
        'brands': '品牌表',
        'products': '商品表',
        'details': '訂單明細表',
        'orders': '訂單表',
        'customers': '客戶表',
    }

    for key, name in table_names.items():
        orig = results[key]['original']
        clean = results[key]['cleaned']
        removed = orig - clean
        pct = (removed / orig * 100) if orig > 0 else 0
        print(f"| {name} | {orig:,} | {clean:,} | {removed:,} | {pct:.1f}% |")
        total_original += orig
        total_cleaned += clean

    total_removed = total_original - total_cleaned
    total_pct = (total_removed / total_original * 100) if total_original > 0 else 0
    print(f"| **總計** | **{total_original:,}** | **{total_cleaned:,}** | **{total_removed:,}** | **{total_pct:.1f}%** |")
    print()
    print(f"完成時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == '__main__':
    main()
