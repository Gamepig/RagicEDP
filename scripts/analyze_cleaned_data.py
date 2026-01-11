#!/usr/bin/env python3
"""
清洗後資料分析腳本

對清洗後的資料執行清洗規則驗證，檢查規則是否需要調整。

驗證規則：
1. FK - 外鍵參照完整性
2. REQ - 必填欄位
3. FMT - 格式驗證
4. NUM - 數值範圍
5. UNQ - 唯一性
6. TEMP - 時序邏輯

執行方式:
    uv run python scripts/analyze_cleaned_data.py
"""

import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

# ==================== 配置 ====================

SOURCE_DIR = Path('./data/cleaned_backup')

# 欄位名稱/ID 對照
FIELDS = {
    # 品牌表
    'brand_code': ['品牌編號', '1000942'],
    # 通路表
    'channel_code': ['通路編號', '1000921'],
    # 金流表
    'payment_code': ['金流編號', '1000954'],
    # 物流表
    'logistics_code': ['物流編號', '1000736'],
    # 商品表
    'product_code': ['商品編號', '1000998'],
    # 客戶表
    'customer_code': ['客戶編號', '1000710'],
    'customer_phone': ['行動電話', '1000712'],
    'customer_email': ['E-mail', '1000713'],
    'customer_tax_id': ['統一編號', '1000720'],
    # 訂單表
    'order_code': ['訂單編號', '1000976'],
    'order_date': ['訂單成立日期', '1000806'],
    'recipient_name': ['收件人姓名', '1000979'],
    'recipient_phone': ['收件人電話', '1000980'],
    'recipient_address': ['收件地址', '1000983'],
    'zipcode': ['郵遞區號', '1000982'],
    # 訂單明細表
    'detail_order': ['訂單編號', '1000781'],
    'detail_customer': ['客戶編號', '1000780'],
    'detail_brand': ['品牌編號', '1000818'],
    'detail_channel': ['通路編號', '1000793'],
    'detail_payment': ['金流編號', '1000796'],
    'detail_logistics': ['物流編號', '1000795'],
    'detail_product': ['商品編號', '1000811'],
    'detail_product_name': ['商品名稱', '1000812'],
    'detail_quantity': ['數量', '1000815'],
    'detail_amount': ['訂單實收', '1000785'],
    # 通用
    'create_date': ['建立日期', '建檔日期'],
    'modify_date': ['最後修改日期', '最後修改時間'],
}


# ==================== 工具函數 ====================

def load_cleaned_json(pattern: str) -> tuple[list[dict], str]:
    """載入清洗後的 JSON 檔案"""
    files = list(SOURCE_DIR.glob(pattern))
    if not files:
        raise FileNotFoundError(f"找不到符合 {pattern} 的檔案")

    latest = max(files, key=lambda f: f.stat().st_mtime)

    with open(latest, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if isinstance(data, dict) and 'records' in data:
        return data['records'], latest.name
    return data, latest.name


def get_field(record: dict, field_key: str) -> str:
    """取得欄位值"""
    field_names = FIELDS.get(field_key, [field_key])
    for name in field_names:
        value = record.get(name, '')
        if value:
            return str(value).strip()
    return ''


def parse_date(date_str: str) -> datetime | None:
    """解析日期字串"""
    if not date_str:
        return None
    for fmt in ['%Y/%m/%d', '%Y-%m-%d', '%Y/%m/%d %H:%M:%S', '%Y-%m-%d %H:%M:%S']:
        try:
            return datetime.strptime(date_str.strip()[:19], fmt)
        except ValueError:
            continue
    return None


# ==================== 驗證規則 ====================

class RuleValidator:
    """規則驗證器"""

    def __init__(self):
        self.issues = defaultdict(list)
        self.stats = defaultdict(lambda: {'total': 0, 'issues': 0})

    def add_issue(self, rule_id: str, table: str, record_id: str, field: str, value: str, message: str):
        """記錄問題"""
        self.issues[rule_id].append({
            'table': table,
            'record_id': record_id,
            'field': field,
            'value': value[:100] if value else '',
            'message': message,
        })

    # ---------- FK: 外鍵參照 ----------

    def fk_check(self, records: list[dict], table_name: str, field_key: str, ref_set: set, rule_id: str):
        """檢查外鍵參照"""
        self.stats[rule_id]['total'] = len(records)
        for r in records:
            value = get_field(r, field_key)
            if value and value not in ref_set:
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:  # 只記錄前 10 筆
                    self.add_issue(rule_id, table_name, get_field(r, 'detail_order') or r.get('_ragicId', ''),
                                   field_key, value, f'外鍵 {value} 不存在於參照表')

    # ---------- REQ: 必填欄位 ----------

    def req_check(self, records: list[dict], table_name: str, field_key: str, rule_id: str):
        """檢查必填欄位"""
        self.stats[rule_id]['total'] = len(records)
        for r in records:
            value = get_field(r, field_key)
            if not value:
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:
                    self.add_issue(rule_id, table_name, r.get('_ragicId', ''),
                                   field_key, '', '必填欄位為空')

    # ---------- FMT: 格式驗證 ----------

    def fmt_phone(self, records: list[dict], table_name: str, field_key: str, rule_id: str):
        """驗證手機號碼格式"""
        pattern = re.compile(r'^09\d{8}$')
        self.stats[rule_id]['total'] = 0

        for r in records:
            value = get_field(r, field_key)
            if not value:
                continue
            self.stats[rule_id]['total'] += 1

            # 清理後驗證
            digits = re.sub(r'[^\d]', '', value)
            if not pattern.match(digits) and not digits.startswith('0'):
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:
                    self.add_issue(rule_id, table_name, r.get('_ragicId', ''),
                                   field_key, value, '手機號碼格式不符')

    def fmt_email(self, records: list[dict], table_name: str, field_key: str, rule_id: str):
        """驗證 Email 格式"""
        pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        self.stats[rule_id]['total'] = 0

        for r in records:
            value = get_field(r, field_key)
            if not value:
                continue
            self.stats[rule_id]['total'] += 1

            if not pattern.match(value):
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:
                    self.add_issue(rule_id, table_name, r.get('_ragicId', ''),
                                   field_key, value, 'Email 格式不符')

    def fmt_tax_id(self, records: list[dict], table_name: str, field_key: str, rule_id: str):
        """驗證統一編號格式"""
        pattern = re.compile(r'^\d{8}$')
        self.stats[rule_id]['total'] = 0

        for r in records:
            value = get_field(r, field_key)
            if not value:
                continue
            self.stats[rule_id]['total'] += 1

            if not pattern.match(value):
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:
                    self.add_issue(rule_id, table_name, r.get('_ragicId', ''),
                                   field_key, value, '統一編號應為 8 位數字')

    # ---------- NUM: 數值範圍 ----------

    def num_range(self, records: list[dict], table_name: str, field_key: str,
                  min_val: float | None, max_val: float | None, rule_id: str):
        """檢查數值範圍"""
        self.stats[rule_id]['total'] = 0

        for r in records:
            value_str = get_field(r, field_key)
            if not value_str:
                continue

            try:
                value = float(value_str.replace(',', ''))
            except ValueError:
                continue

            self.stats[rule_id]['total'] += 1

            if (min_val is not None and value < min_val) or (max_val is not None and value > max_val):
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:
                    self.add_issue(rule_id, table_name, r.get('_ragicId', ''),
                                   field_key, value_str, f'數值 {value} 超出範圍 [{min_val}, {max_val}]')

    def num_zero_qty(self, records: list[dict], table_name: str, rule_id: str):
        """檢查數量為零"""
        self.stats[rule_id]['total'] = len(records)

        for r in records:
            value_str = get_field(r, 'detail_quantity')
            if not value_str:
                continue

            try:
                value = float(value_str.replace(',', ''))
            except ValueError:
                continue

            if value == 0:
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:
                    order = get_field(r, 'detail_order')
                    product = get_field(r, 'detail_product')
                    self.add_issue(rule_id, table_name, r.get('_ragicId', ''),
                                   'detail_quantity', '0', f'訂單 {order} 商品 {product} 數量為零')

    def num_negative(self, records: list[dict], table_name: str, field_key: str, rule_id: str):
        """檢查負數金額"""
        self.stats[rule_id]['total'] = 0

        for r in records:
            value_str = get_field(r, field_key)
            if not value_str:
                continue

            try:
                value = float(value_str.replace(',', ''))
            except ValueError:
                continue

            self.stats[rule_id]['total'] += 1

            if value < 0:
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:
                    order = get_field(r, 'detail_order')
                    self.add_issue(rule_id, table_name, r.get('_ragicId', ''),
                                   field_key, value_str, f'訂單 {order} 金額為負數（可能為退款）')

    # ---------- UNQ: 唯一性 ----------

    def unq_check(self, records: list[dict], table_name: str, field_key: str, rule_id: str):
        """檢查唯一性"""
        self.stats[rule_id]['total'] = len(records)
        seen = {}

        for r in records:
            value = get_field(r, field_key)
            if not value:
                continue

            if value in seen:
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:
                    self.add_issue(rule_id, table_name, r.get('_ragicId', ''),
                                   field_key, value, f'重複值（首次出現於 {seen[value]}）')
            else:
                seen[value] = r.get('_ragicId', '')

    # ---------- TEMP: 時序邏輯 ----------

    def temp_create_before_modify(self, records: list[dict], table_name: str, rule_id: str):
        """檢查建立日期不晚於修改日期"""
        self.stats[rule_id]['total'] = 0

        for r in records:
            create_str = get_field(r, 'create_date')
            modify_str = get_field(r, 'modify_date')

            if not create_str or not modify_str:
                continue

            create_dt = parse_date(create_str)
            modify_dt = parse_date(modify_str)

            if not create_dt or not modify_dt:
                continue

            self.stats[rule_id]['total'] += 1

            if create_dt > modify_dt:
                self.stats[rule_id]['issues'] += 1
                if len(self.issues[rule_id]) < 10:
                    self.add_issue(rule_id, table_name, r.get('_ragicId', ''),
                                   'create_date', f'{create_str} > {modify_str}',
                                   '建立日期晚於修改日期')


# ==================== 主程式 ====================

def main():
    print("=" * 70)
    print("清洗後資料分析")
    print("=" * 70)
    print(f"開始時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    validator = RuleValidator()

    # Step 1: 載入資料
    print("Step 1: 載入清洗後資料...")

    brands, _ = load_cleaned_json('10_品牌*cleaned*.json')
    channels, _ = load_cleaned_json('20_通路*cleaned*.json')
    payments, _ = load_cleaned_json('30_金流*cleaned*.json')
    logistics, _ = load_cleaned_json('40_物流*cleaned*.json')
    products, _ = load_cleaned_json('70_商品*cleaned*.json')
    customers, _ = load_cleaned_json('60_客戶*cleaned*.json')
    orders, _ = load_cleaned_json('50_訂單*cleaned*.json')
    details, _ = load_cleaned_json('99_訂單明細*cleaned*.json')

    print(f"  品牌表: {len(brands):,} 筆")
    print(f"  通路表: {len(channels):,} 筆")
    print(f"  金流表: {len(payments):,} 筆")
    print(f"  物流表: {len(logistics):,} 筆")
    print(f"  商品表: {len(products):,} 筆")
    print(f"  客戶表: {len(customers):,} 筆")
    print(f"  訂單表: {len(orders):,} 筆")
    print(f"  訂單明細表: {len(details):,} 筆")
    print()

    # 建立參照集合
    brand_codes = {get_field(r, 'brand_code') for r in brands if get_field(r, 'brand_code')}
    channel_codes = {get_field(r, 'channel_code') for r in channels if get_field(r, 'channel_code')}
    payment_codes = {get_field(r, 'payment_code') for r in payments if get_field(r, 'payment_code')}
    logistics_codes = {get_field(r, 'logistics_code') for r in logistics if get_field(r, 'logistics_code')}
    product_codes = {get_field(r, 'product_code') for r in products if get_field(r, 'product_code')}
    customer_codes = {get_field(r, 'customer_code') for r in customers if get_field(r, 'customer_code')}
    order_codes = {get_field(r, 'order_code') for r in orders if get_field(r, 'order_code')}

    print(f"  有效品牌: {len(brand_codes)} 個")
    print(f"  有效通路: {len(channel_codes)} 個")
    print(f"  有效金流: {len(payment_codes)} 個")
    print(f"  有效物流: {len(logistics_codes)} 個")
    print(f"  有效商品: {len(product_codes)} 個")
    print(f"  有效客戶: {len(customer_codes):,} 個")
    print(f"  有效訂單: {len(order_codes):,} 個")
    print()

    # Step 2: 執行規則驗證
    print("Step 2: 執行規則驗證...")
    print()

    # FK 規則 - 訂單明細表外鍵
    print("  [FK] 外鍵參照完整性...")
    validator.fk_check(details, '訂單明細', 'detail_brand', brand_codes, 'FK-001')
    validator.fk_check(details, '訂單明細', 'detail_customer', customer_codes, 'FK-002')
    validator.fk_check(details, '訂單明細', 'detail_channel', channel_codes, 'FK-003')
    validator.fk_check(details, '訂單明細', 'detail_payment', payment_codes, 'FK-004')
    validator.fk_check(details, '訂單明細', 'detail_logistics', logistics_codes, 'FK-005')
    validator.fk_check(details, '訂單明細', 'detail_product', product_codes, 'FK-007')

    # REQ 規則 - 必填欄位
    print("  [REQ] 必填欄位...")
    validator.req_check(details, '訂單明細', 'detail_order', 'REQ-021')
    validator.req_check(details, '訂單明細', 'detail_customer', 'REQ-022')
    validator.req_check(details, '訂單明細', 'detail_brand', 'REQ-023')
    validator.req_check(details, '訂單明細', 'detail_product', 'REQ-025')
    validator.req_check(orders, '訂單', 'order_code', 'REQ-001')
    validator.req_check(orders, '訂單', 'recipient_name', 'REQ-003')
    validator.req_check(orders, '訂單', 'recipient_phone', 'REQ-004')
    validator.req_check(customers, '客戶', 'customer_code', 'REQ-011')
    validator.req_check(customers, '客戶', 'customer_phone', 'REQ-013')

    # FMT 規則 - 格式驗證
    print("  [FMT] 格式驗證...")
    validator.fmt_phone(customers, '客戶', 'customer_phone', 'FMT-001-客戶')
    validator.fmt_phone(orders, '訂單', 'recipient_phone', 'FMT-001-訂單')
    validator.fmt_email(customers, '客戶', 'customer_email', 'FMT-003')
    validator.fmt_tax_id(customers, '客戶', 'customer_tax_id', 'FMT-004')

    # NUM 規則 - 數值範圍
    print("  [NUM] 數值範圍...")
    validator.num_zero_qty(details, '訂單明細', 'NUM-001-零數量')
    validator.num_negative(details, '訂單明細', 'detail_amount', 'NUM-002-負金額')
    validator.num_range(details, '訂單明細', 'detail_quantity', 1, 100, 'NUM-001-數量範圍')

    # UNQ 規則 - 唯一性
    print("  [UNQ] 唯一性...")
    validator.unq_check(orders, '訂單', 'order_code', 'UNQ-001')
    validator.unq_check(customers, '客戶', 'customer_code', 'UNQ-002')
    validator.unq_check(products, '商品', 'product_code', 'UNQ-003')

    # TEMP 規則 - 時序邏輯
    print("  [TEMP] 時序邏輯...")
    validator.temp_create_before_modify(orders, '訂單', 'TEMP-001-訂單')
    validator.temp_create_before_modify(customers, '客戶', 'TEMP-001-客戶')

    print()

    # Step 3: 輸出結果
    print("=" * 70)
    print("驗證結果摘要")
    print("=" * 70)
    print()

    # 按類別分組
    categories = {
        'FK': '外鍵參照',
        'REQ': '必填欄位',
        'FMT': '格式驗證',
        'NUM': '數值範圍',
        'UNQ': '唯一性',
        'TEMP': '時序邏輯',
    }

    total_issues = 0

    for cat_prefix, cat_name in categories.items():
        print(f"### {cat_name} ({cat_prefix})")
        print()
        print("| 規則 ID | 檢查數 | 問題數 | 問題率 | 狀態 |")
        print("|---------|-------:|-------:|-------:|------|")

        cat_rules = [(k, v) for k, v in validator.stats.items() if k.startswith(cat_prefix)]
        cat_rules.sort(key=lambda x: x[0])

        for rule_id, stat in cat_rules:
            total = stat['total']
            issues = stat['issues']
            rate = (issues / total * 100) if total > 0 else 0
            status = '✅' if issues == 0 else ('⚠️' if rate < 1 else '❌')
            print(f"| {rule_id} | {total:,} | {issues:,} | {rate:.2f}% | {status} |")
            total_issues += issues

        print()

    # 問題詳情
    print("=" * 70)
    print("問題詳情（每類最多 10 筆）")
    print("=" * 70)
    print()

    for rule_id, issue_list in sorted(validator.issues.items()):
        if not issue_list:
            continue
        print(f"### {rule_id} ({len(issue_list)} 筆問題)")
        print()
        for issue in issue_list[:5]:
            print(f"  - [{issue['table']}] {issue['record_id']}: {issue['message']}")
            if issue['value']:
                print(f"    值: {issue['value']}")
        if len(issue_list) > 5:
            print(f"  ... 及其他 {len(issue_list) - 5} 筆")
        print()

    # 總結
    print("=" * 70)
    print("分析總結")
    print("=" * 70)
    print()
    print(f"總問題數: {total_issues:,}")
    print()

    # 規則調整建議
    print("### 規則調整建議")
    print()

    suggestions = []

    # 檢查各規則是否需要調整
    for rule_id, stat in validator.stats.items():
        total = stat['total']
        issues = stat['issues']
        if total == 0:
            continue
        rate = issues / total * 100

        if issues == 0:
            continue
        elif rate < 0.1:
            suggestions.append(f"- **{rule_id}**: 問題率極低 ({rate:.3f}%)，可考慮人工處理例外")
        elif rate < 1:
            suggestions.append(f"- **{rule_id}**: 問題率低 ({rate:.2f}%)，建議保持現有規則")
        elif rate < 5:
            suggestions.append(f"- **{rule_id}**: 問題率中等 ({rate:.1f}%)，建議檢視問題樣本決定是否調整")
        else:
            suggestions.append(f"- **{rule_id}**: 問題率較高 ({rate:.1f}%)，**建議重新評估規則或資料**")

    if suggestions:
        for s in suggestions:
            print(s)
    else:
        print("- 所有規則運作正常，無需調整")

    print()
    print(f"完成時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == '__main__':
    main()
