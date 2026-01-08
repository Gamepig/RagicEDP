# ETL 轉換深度研究報告

**版本**: v1.0  
**建立日期**: 2025-12-30  
**基於**: ETL 中的轉換 (Transform) 整合指南  
**專案**: RagicEDP 資料平台

---

## 目錄

1. [研究概述](#1-研究概述)
2. [數據清洗 (Data Cleaning) 深度分析](#2-數據清洗-data-cleaning-深度分析)
3. [數據驗證 (Data Validation) 深度分析](#3-數據驗證-data-validation-深度分析)
4. [數據標準化 (Data Standardization) 深度分析](#4-數據標準化-data-standardization-深度分析)
5. [數據匹配與對應 (Data Mapping) 深度分析](#5-數據匹配與對應-data-mapping-深度分析)
6. [數據聚合與計算 (Data Aggregation) 深度分析](#6-數據聚合與計算-data-aggregation-深度分析)
7. [數據富集 (Data Enrichment) 深度分析](#7-數據富集-data-enrichment-深度分析)
8. [ETL 工具適用性研究](#8-etl-工具適用性研究)
9. [整合實施建議](#9-整合實施建議)
10. [結論與下一步](#10-結論與下一步)

---

## 1. 研究概述

### 1.1 研究目標

根據《ETL 中的轉換 (Transform) 整合指南》，針對 RagicEDP 專案進行深度研究，分析每個 Transform 操作在專案中的具體應用、實作策略和最佳實踐。

### 1.2 專案現況

| 項目 | 內容 |
|------|------|
| **資料來源** | Ragic ERP 系統（REST API） |
| **資料量** | 461,750 筆（10 個表格） |
| **週增量** | ~9,500 筆（2.1%） |
| **目標系統** | Google BigQuery |
| **當前架構** | Ragic API → Cloud Function → BigQuery |
| **清洗規則** | 87 條已定義規則 |
| **問題解決率** | 98.1%（139,615 / 142,288） |

### 1.3 研究方法

- **現況分析**：檢視現有清洗規則和實作程式碼
- **技術研究**：分析 ETL 工具和轉換模式
- **最佳實踐**：參考業界標準和專案經驗
- **實作建議**：提出具體的技術方案和實施計劃

---

## 2. 數據清洗 (Data Cleaning) 深度分析

### 2.1 專案現況

RagicEDP 專案已定義 **87 條清洗規則**，涵蓋以下類別：

| 類別 | 規則數 | 自動化率 | 狀態 |
|------|--------|---------|------|
| 格式驗證規則 | 8 | 100% | ✅ 已實作 |
| 外鍵參照規則 | 7 | 100% | ✅ 已實作 |
| 數值範圍規則 | 14 | 50% | 🟡 部分實作 |
| 關聯規則 | 10 | 50% | 🟡 部分實作 |
| 時序邏輯規則 | 4 | 100% | ✅ 已實作 |
| 唯一性規則 | 4 | 100% | ✅ 已實作 |
| 必填欄位規則 | 32 | 100% | ✅ 已實作 |
| 商品名稱規則 | 8 | 100% | ✅ 已實作 |

### 2.2 實作架構

#### 2.2.1 當前實作方式

```python
# 測試程式架構（test_workspace/cleaning_test/cleaning_test_v1.py）
class CleaningEngine:
    def __init__(self):
        self.rules = self._load_rules()
    
    def clean(self, records):
        flagged_records = []
        for record in records:
            flags = []
            for rule in self.rules:
                if not rule.validate(record):
                    flags.append(rule.id)
            if flags:
                record['_cleaning_flags'] = flags
                flagged_records.append(record)
        return flagged_records
```

#### 2.2.2 分層清洗策略

專案採用**三層治理**架構：

| 層級 | 名稱 | 目標 | 處理方式 |
|------|------|------|---------|
| L1 | raw_data | 忠實接收 | 允許 NULL，錯值轉 NULL |
| L2 | staging | 格式統一 | 型別轉換，格式標準化 |
| L3 | dwh | 分析就緒 | 預設值填充，完整性檢查 |

### 2.3 具體清洗操作

#### 2.3.1 去除空值和重複記錄

**實作方式**：
- **空值處理**：使用 `COALESCE` 或預設值填充
- **重複檢測**：基於主鍵（訂單編號、客戶編號）的唯一性檢查

**專案案例**：
```python
# 唯一性檢查（UNQ-001 ~ UNQ-004）
def check_uniqueness(records, key_field):
    seen = set()
    duplicates = []
    for record in records:
        key = record.get(key_field)
        if key in seen:
            duplicates.append(record)
        seen.add(key)
    return duplicates
```

**統計結果**：
- 訂單編號重複率：0.00%（無重複）
- 客戶編號重複率：0.00%（無重複）
- 客戶電話重複：35 組（0.06%），需人工確認

#### 2.3.2 處理異常值和離群值

**實作方式**：
- **統計方法**：使用 IQR（四分位距）和 Z-Score
- **業務規則**：定義合理範圍和極端範圍

**專案案例**（NUM-001: 數量範圍檢查）：
```python
# 數量範圍檢查
def check_quantity_range(quantity):
    # 合理範圍：1 ~ 4（基於 IQR）
    if 1 <= quantity <= 4:
        return 'NORMAL'
    # 極端範圍：0 ~ 100（業務允許）
    elif 0 <= quantity <= 100:
        return 'WARNING'
    else:
        return 'ERROR'
```

**統計結果**：
- 數量離群率：17.09%
- 訂單實收離群率：8.11%
- 運費收入離群率：23.03%（74.13% 為零值，免運活動）

#### 2.3.3 修正格式不一致的數據

**實作方式**：
- **正則表達式**：格式驗證和標準化
- **格式轉換**：統一日期、電話、Email 格式

**專案案例**（FMT-001: 台灣手機號碼格式）：
```python
import re

def standardize_phone(phone):
    # 移除所有非數字字符
    digits = re.sub(r'\D', '', phone)
    
    # 台灣手機：09XXXXXXXX
    if len(digits) == 10 and digits.startswith('09'):
        return digits
    # 國際格式：+886XXXXXXXXX
    elif digits.startswith('886'):
        return '0' + digits[3:]
    else:
        return None  # 格式異常
```

**統計結果**：
- 客戶手機格式有效率：99.24%
- 訂單電話格式有效率：98.41%
- 統一編號格式有效率：97.56%

### 2.4 改進建議

#### 2.4.1 規則引擎化

**現況**：規則硬編碼在程式中  
**建議**：建立規則配置系統（YAML/JSON）

```yaml
# rules/format_rules.yaml
rules:
  - id: FMT-001
    name: 台灣手機號碼格式
    type: format_validation
    pattern: '^09\d{8}$'
    auto_fix: true
    fix_strategy: extract_digits
    severity: ERROR
```

#### 2.4.2 增量處理優化

**現況**：每次全量檢查  
**建議**：只檢查新增/變更的資料

```python
def incremental_clean(new_records, last_clean_date):
    # 只處理新增或修改的記錄
    filtered = [
        r for r in new_records 
        if r['最後修改日期'] > last_clean_date
    ]
    return clean(filtered)
```

#### 2.4.3 自動修補機制

**現況**：僅標記問題  
**建議**：可自動修補的問題自動處理

```python
def auto_fix(record, rule):
    if rule.auto_fix:
        if rule.fix_strategy == 'extract_digits':
            return extract_digits(record[rule.field])
        elif rule.fix_strategy == 'default_value':
            return rule.default_value
    return record
```

---

## 3. 數據驗證 (Data Validation) 深度分析

### 3.1 專案現況

專案已實作多層驗證機制：

| 驗證層級 | 驗證項目 | 實作狀態 |
|---------|---------|---------|
| **格式驗證** | 電話、Email、統一編號格式 | ✅ 已實作 |
| **完整性驗證** | 必填欄位檢查 | ✅ 已實作 |
| **參照完整性** | 外鍵參照檢查 | ✅ 已實作 |
| **業務規則驗證** | 關聯規則、時序邏輯 | 🟡 部分實作 |
| **數值範圍驗證** | IQR、Z-Score 檢查 | ✅ 已實作 |

### 3.2 驗證檢查點設計

#### 3.2.1 Extract 階段驗證

**位置**：從 Ragic API 取得資料後  
**檢查項目**：
- API 回應格式正確性
- 必要欄位存在
- 資料型別正確

```python
def validate_extract(response):
    if not response.get('data'):
        raise ValueError("API 回應缺少 data 欄位")
    if not isinstance(response['data'], list):
        raise ValueError("data 應為列表格式")
    return True
```

#### 3.2.2 Transform 階段驗證

**位置**：資料轉換過程中  
**檢查項目**：
- 格式標準化結果
- 型別轉換正確性
- 業務規則符合性

```python
def validate_transform(record):
    errors = []
    
    # 格式驗證
    if not validate_phone(record.get('電話')):
        errors.append('FMT-001')
    
    # 參照完整性
    if not validate_fk(record.get('品牌編號'), '品牌表'):
        errors.append('FK-001')
    
    # 業務規則
    if not validate_business_rule(record):
        errors.append('ASSOC-001')
    
    return errors
```

#### 3.2.3 Load 階段驗證

**位置**：載入 BigQuery 前  
**檢查項目**：
- 資料型別符合 Schema
- 必填欄位不為 NULL
- 唯一性約束

```python
def validate_load(record, schema):
    errors = []
    
    # 型別檢查
    for field, field_type in schema.items():
        value = record.get(field)
        if value is not None:
            if not isinstance(value, field_type):
                errors.append(f'{field} 型別錯誤')
    
    # 必填欄位檢查
    for field in schema.get('required', []):
        if record.get(field) is None:
            errors.append(f'{field} 為必填欄位')
    
    return errors
```

### 3.3 驗證規則實作

#### 3.3.1 數據完整性檢查

**專案案例**（REQ-001 ~ REQ-032: 必填欄位規則）：

| 表格 | 必填欄位 | 空值率 | 狀態 |
|------|---------|--------|------|
| 訂單表 | 訂單編號 | 0.00% | ✅ |
| 訂單表 | 訂單日期 | 0.00% | ✅ |
| 客戶表 | 客戶編號 | 0.00% | ✅ |
| 客戶表 | E-mail | 8.47% | ⚠️ 容許 10% |
| 客戶表 | 生日 | 100.00% | ⚠️ 全空（需確認需求） |

#### 3.3.2 數據類型和範圍驗證

**專案案例**（NUM-001 ~ NUM-007: 數值範圍規則）：

```python
def validate_numeric_range(value, rule):
    """
    驗證數值範圍
    
    Args:
        value: 要驗證的值
        rule: 規則定義
            - reasonable_range: (min, max) 合理範圍
            - extreme_range: (min, max) 極端範圍
    """
    if value is None:
        return 'MISSING'
    
    min_reasonable, max_reasonable = rule.reasonable_range
    min_extreme, max_extreme = rule.extreme_range
    
    if min_reasonable <= value <= max_reasonable:
        return 'NORMAL'
    elif min_extreme <= value <= max_extreme:
        return 'WARNING'
    else:
        return 'ERROR'
```

#### 3.3.3 業務規則驗證

**專案案例**（ASSOC-001: 品牌-商品組合限制）：

```python
def validate_brand_product(record):
    """
    驗證品牌-商品組合是否合法
    
    規則：商品只能屬於其對應的品牌
    """
    brand_id = record.get('品牌編號')
    product_id = record.get('商品編號')
    
    # 從商品表查詢商品對應的品牌
    product_brand = get_product_brand(product_id)
    
    if product_brand != brand_id:
        return False, 'ASSOC-001'
    
    return True, None
```

### 3.4 改進建議

#### 3.4.1 驗證結果追蹤

**建議**：建立驗證結果表，追蹤驗證歷史

```sql
CREATE TABLE `erp_backup.validation_results` (
  validation_id STRING,
  table_name STRING,
  record_id STRING,
  rule_id STRING,
  validation_status STRING,
  error_message STRING,
  validated_at TIMESTAMP
);
```

#### 3.4.2 驗證規則版本控制

**建議**：規則變更時記錄版本，支援回溯

```yaml
# rules/version_control.yaml
rule_versions:
  FMT-001:
    - version: 1.0
      effective_date: '2025-01-01'
      pattern: '^09\d{8}$'
    - version: 1.1
      effective_date: '2025-06-01'
      pattern: '^09\d{8}$|^\+886\d{9}$'
```

---

## 4. 數據標準化 (Data Standardization) 深度分析

### 4.1 專案現況

專案已實作部分標準化功能，主要集中在格式統一：

| 標準化項目 | 實作狀態 | 覆蓋率 |
|-----------|---------|--------|
| 日期時間格式 | 🟡 部分實作 | 60% |
| 文本標準化 | ✅ 已實作 | 80% |
| 電話格式 | ✅ 已實作 | 95% |
| Email 格式 | ✅ 已實作 | 90% |
| 貨幣單位 | ❌ 未實作 | 0% |

### 4.2 標準化技術實作

#### 4.2.1 統一日期時間格式

**現況問題**：
- Ragic API 回傳多種日期格式：`YYYY/MM/DD`、`YYYY/MM/DD HH:MM:SS`
- BigQuery 需要 `TIMESTAMP` 型別

**實作方案**：

```python
from datetime import datetime
from typing import Optional

def standardize_date(date_str: Optional[str]) -> Optional[datetime]:
    """
    統一日期格式為 TIMESTAMP
    
    支援格式：
    - YYYY/MM/DD
    - YYYY/MM/DD HH:MM:SS
    - YYYY-MM-DD
    """
    if not date_str:
        return None
    
    formats = [
        '%Y/%m/%d %H:%M:%S',
        '%Y/%m/%d %H:%M',
        '%Y/%m/%d',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d',
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    
    return None  # 無法解析
```

**BigQuery 實作**：

```sql
-- 建立標準化函數
CREATE OR REPLACE FUNCTION `erp_backup.parse_date_flexible`(date_str STRING)
RETURNS TIMESTAMP AS (
  COALESCE(
    SAFE.PARSE_TIMESTAMP('%Y/%m/%d %H:%M:%S', date_str),
    SAFE.PARSE_TIMESTAMP('%Y/%m/%d', date_str),
    SAFE.PARSE_TIMESTAMP('%Y-%m-%d %H:%M:%S', date_str),
    SAFE.PARSE_TIMESTAMP('%Y-%m-%d', date_str)
  )
);

-- 使用範例
SELECT
  order_date_str,
  `erp_backup.parse_date_flexible`(order_date_str) AS order_date
FROM raw_orders;
```

#### 4.2.2 標準化文本（大小寫、去除空格）

**實作方案**：

```python
import re
from typing import Optional

def standardize_string(value: Optional[str]) -> Optional[str]:
    """
    標準化字串：
    - 去除前後空白
    - 多空白變單空白
    - 統一大小寫（可選）
    """
    if value is None or not isinstance(value, str):
        return None
    
    # 去除前後空白
    result = value.strip()
    
    # 多空白變單空白
    result = re.sub(r'\s+', ' ', result)
    
    # 統一大小寫（根據需求選擇）
    # result = result.upper()  # 全大寫
    # result = result.lower()  # 全小寫
    # result = result.title()   # 首字母大寫
    
    return result if result else None
```

**專案應用**：
- 客戶名稱標準化
- 商品名稱清理（去除活動關鍵字）
- 地址格式統一

#### 4.2.3 統一貨幣、單位等單位轉換

**現況**：專案尚未實作貨幣單位轉換  
**建議實作**：

```python
def standardize_currency(amount: Optional[float], currency: str = 'TWD') -> Optional[float]:
    """
    統一貨幣單位為新台幣（TWD）
    
    目前專案所有金額皆為 TWD，未來若擴展可加入匯率轉換
    """
    if amount is None:
        return None
    
    # 目前專案所有金額皆為 TWD
    if currency == 'TWD':
        return round(amount, 2)
    
    # 未來可加入匯率轉換
    # exchange_rate = get_exchange_rate(currency, 'TWD')
    # return round(amount * exchange_rate, 2)
    
    return amount
```

### 4.3 標準化流程設計

#### 4.3.1 分階段標準化

```
原始資料 (Ragic API)
    ↓
階段 1: 型別轉換
    - 字串 → 數字
    - 字串 → 日期
    - 字串 → 布林值
    ↓
階段 2: 格式統一
    - 日期格式標準化
    - 電話格式標準化
    - Email 格式標準化
    ↓
階段 3: 內容清理
    - 去除特殊字符
    - 統一空白處理
    - 大小寫統一
    ↓
標準化資料 (BigQuery)
```

#### 4.3.2 標準化規則配置

**建議**：建立標準化規則配置檔

```yaml
# rules/standardization_rules.yaml
standardization:
  date_fields:
    - field: 訂單日期
      formats:
        - '%Y/%m/%d %H:%M:%S'
        - '%Y/%m/%d'
      target_type: TIMESTAMP
      timezone: Asia/Taipei
  
  phone_fields:
    - field: 行動電話
      pattern: '^09\d{8}$'
      format: digits_only
      validation: true
  
  email_fields:
    - field: E-mail
      lowercase: true
      trim: true
      validation: true
  
  string_fields:
    - field: 客戶名稱
      trim: true
      normalize_whitespace: true
      remove_special_chars: false
```

### 4.4 改進建議

#### 4.4.1 建立標準化函數庫

**建議**：建立可重用的標準化函數庫

```python
# src/utils/standardization.py
class StandardizationEngine:
    def __init__(self, config_path='rules/standardization_rules.yaml'):
        self.config = self._load_config(config_path)
    
    def standardize_record(self, record, table_name):
        """標準化單筆記錄"""
        table_config = self.config.get(table_name, {})
        
        for field, rules in table_config.items():
            if field in record:
                record[field] = self._standardize_field(
                    record[field], 
                    rules
                )
        
        return record
    
    def _standardize_field(self, value, rules):
        """標準化單一欄位"""
        if value is None:
            return None
        
        # 根據規則類型選擇標準化方法
        if rules.get('type') == 'date':
            return self._standardize_date(value, rules)
        elif rules.get('type') == 'phone':
            return self._standardize_phone(value, rules)
        elif rules.get('type') == 'email':
            return self._standardize_email(value, rules)
        elif rules.get('type') == 'string':
            return self._standardize_string(value, rules)
        
        return value
```

#### 4.4.2 標準化結果驗證

**建議**：標準化後驗證結果正確性

```python
def validate_standardization(original, standardized, rules):
    """驗證標準化結果"""
    errors = []
    
    for field, rule in rules.items():
        orig_value = original.get(field)
        std_value = standardized.get(field)
        
        # 驗證型別
        if rule.get('target_type'):
            if not isinstance(std_value, rule['target_type']):
                errors.append(f'{field} 型別錯誤')
        
        # 驗證格式
        if rule.get('pattern'):
            if not re.match(rule['pattern'], str(std_value)):
                errors.append(f'{field} 格式不符合規則')
    
    return errors
```

---

## 5. 數據匹配與對應 (Data Mapping) 深度分析

### 5.1 專案現況

專案已實作部分欄位映射功能：

| 映射類型 | 實作狀態 | 說明 |
|---------|---------|------|
| **欄位名稱映射** | ✅ 已實作 | Ragic 欄位名 → BigQuery 欄位名 |
| **欄位 ID 映射** | ✅ 已實作 | Ragic 欄位 ID → 欄位名稱 |
| **值映射** | 🟡 部分實作 | 代碼值 → 中文名稱 |
| **跨系統對應** | ❌ 未實作 | 未來擴展需求 |

### 5.2 映射實作方式

#### 5.2.1 欄位名稱映射

**現況**：使用 `FIELD_NAME_TO_ID` 對照表

```python
# src/config.py
FIELD_NAME_TO_ID = {
    '訂單編號': 'field_1',
    '訂單日期': 'field_2',
    '客戶編號': 'field_3',
    # ...
}
```

**改進建議**：建立完整的映射配置

```yaml
# config/field_mapping.yaml
mappings:
  ragic_to_bq:
    # 訂單表 (50)
    '50':
      '訂單編號': 'order_id'
      '訂單日期': 'order_date'
      '客戶編號': 'customer_id'
      # ...
    
    # 客戶表 (60)
    '60':
      '客戶編號': 'customer_id'
      '客戶名稱': 'customer_name'
      '行動電話': 'mobile_phone'
      # ...
```

#### 5.2.2 值映射（代碼對應）

**專案案例**：品牌編號 → 品牌名稱

```python
# 品牌代碼映射
BRAND_CODE_TO_NAME = {
    'GMK': '品牌A',
    'SPH': '品牌B',
    'SUN': '品牌C',
    # ...
}

def map_brand_code(code):
    """品牌代碼映射為名稱"""
    return BRAND_CODE_TO_NAME.get(code, '未知品牌')
```

**建議**：建立值映射配置系統

```yaml
# config/value_mapping.yaml
value_mappings:
  brand_code:
    source_field: 品牌編號
    target_field: 品牌名稱
    mappings:
      'GMK': '品牌A'
      'SPH': '品牌B'
      'SUN': '品牌C'
    default: '未知品牌'
  
  channel_code:
    source_field: 通路編號
    target_field: 通路名稱
    mappings:
      # 從通路表動態載入
    lookup_table: 'ragic_20_通路表'
    lookup_key: '通路編號'
    lookup_value: '通路名稱'
```

#### 5.2.3 跨系統數據對應

**未來需求**：整合其他系統資料

**設計方案**：

```python
class CrossSystemMapper:
    """跨系統數據對應器"""
    
    def __init__(self):
        self.mappings = self._load_mappings()
    
    def map_customer_id(self, ragic_customer_id, target_system):
        """
        將 Ragic 客戶編號映射到目標系統
        
        Args:
            ragic_customer_id: Ragic 客戶編號
            target_system: 目標系統名稱（如 'CRM', 'ERP'）
        """
        mapping = self.mappings.get(target_system, {}).get('customer_id')
        if mapping:
            return mapping.get(ragic_customer_id)
        return None
    
    def map_product_id(self, ragic_product_id, target_system):
        """產品編號映射"""
        # 類似實作
        pass
```

### 5.3 映射規則設計

#### 5.3.1 一對一映射

**最簡單的映射類型**：直接對應

```python
def one_to_one_mapping(source_value, mapping_dict):
    """一對一映射"""
    return mapping_dict.get(source_value, source_value)
```

#### 5.3.2 一對多映射

**複雜映射**：一個來源值對應多個目標值

```python
def one_to_many_mapping(source_value, mapping_dict):
    """一對多映射"""
    result = mapping_dict.get(source_value, {})
    return {
        'primary': result.get('primary'),
        'secondary': result.get('secondary', []),
    }
```

#### 5.3.3 動態映射（查表）

**專案應用**：從維度表查詢對應值

```python
def lookup_mapping(source_value, lookup_table, lookup_key, lookup_value):
    """
    動態查表映射
    
    Args:
        source_value: 來源值
        lookup_table: 查詢表（BigQuery 表名）
        lookup_key: 查詢鍵欄位
        lookup_value: 查詢值欄位
    """
    query = f"""
    SELECT {lookup_value}
    FROM `{lookup_table}`
    WHERE {lookup_key} = @source_value
    LIMIT 1
    """
    
    result = bigquery_client.query(query, source_value).result()
    if result:
        return result[0][lookup_value]
    return None
```

### 5.4 改進建議

#### 5.4.1 建立映射配置系統

**建議**：統一管理所有映射規則

```python
# src/utils/mapping_engine.py
class MappingEngine:
    def __init__(self, config_path='config/mapping_config.yaml'):
        self.config = self._load_config(config_path)
    
    def map_record(self, record, source_table, target_table):
        """映射整筆記錄"""
        mapping_config = self.config.get(f'{source_table}_to_{target_table}')
        if not mapping_config:
            return record
        
        mapped_record = {}
        for source_field, target_field in mapping_config['fields'].items():
            value = record.get(source_field)
            
            # 值轉換
            if target_field in mapping_config.get('value_transforms', {}):
                transform = mapping_config['value_transforms'][target_field]
                value = self._apply_transform(value, transform)
            
            mapped_record[target_field] = value
        
        return mapped_record
```

#### 5.4.2 映射驗證機制

**建議**：驗證映射結果正確性

```python
def validate_mapping(source_record, mapped_record, mapping_config):
    """驗證映射結果"""
    errors = []
    
    # 檢查必填欄位是否映射
    required_fields = mapping_config.get('required_fields', [])
    for field in required_fields:
        if field not in mapped_record or mapped_record[field] is None:
            errors.append(f'必填欄位 {field} 未映射')
    
    # 檢查值轉換正確性
    for field, transform in mapping_config.get('value_transforms', {}).items():
        if transform.get('validation'):
            if not validate_value(mapped_record[field], transform['validation']):
                errors.append(f'{field} 值不符合驗證規則')
    
    return errors
```

---

## 6. 數據聚合與計算 (Data Aggregation) 深度分析

### 6.1 專案現況

專案目標是建立**星狀模型**（Star Schema），需要進行資料聚合：

| 聚合類型 | 實作狀態 | 說明 |
|---------|---------|------|
| **事實表建立** | 🟡 規劃中 | 訂單事實表 |
| **維度表建立** | ✅ 部分實作 | 品牌、通路、客戶等維度表 |
| **統計匯總** | ❌ 未實作 | 待實作 |
| **衍生指標** | ❌ 未實作 | 待實作 |

### 6.2 星狀模型設計

#### 6.2.1 事實表設計

**訂單事實表（Fact Orders）**：

```sql
CREATE TABLE `erp_backup.fact_orders` (
  order_id STRING NOT NULL,
  order_date DATE NOT NULL,
  customer_id STRING NOT NULL,
  brand_id STRING NOT NULL,
  channel_id STRING NOT NULL,
  product_id STRING NOT NULL,
  payment_id STRING NOT NULL,
  logistics_id STRING NOT NULL,
  
  -- 度量值
  quantity INT64,
  order_amount NUMERIC(10, 2),
  shipping_fee NUMERIC(10, 2),
  total_amount NUMERIC(10, 2),
  
  -- 時間戳記
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### 6.2.2 維度表設計

**品牌維度表（Dim Brands）**：

```sql
CREATE TABLE `erp_backup.dim_brands` (
  brand_id STRING NOT NULL,
  brand_name STRING,
  brand_category STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**客戶維度表（Dim Customers）**：

```sql
CREATE TABLE `erp_backup.dim_customers` (
  customer_id STRING NOT NULL,
  customer_name STRING,
  mobile_phone STRING,
  email STRING,
  address STRING,
  postal_code STRING,
  first_order_date DATE,
  last_order_date DATE,
  total_orders INT64,
  total_amount NUMERIC(10, 2),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 6.3 聚合計算實作

#### 6.3.1 匯總統計數據

**專案案例**：訂單金額匯總

```sql
-- 每日訂單統計
CREATE OR REPLACE VIEW `erp_backup.v_daily_order_stats` AS
SELECT
  DATE(order_date) AS order_date,
  COUNT(DISTINCT order_id) AS order_count,
  COUNT(DISTINCT customer_id) AS customer_count,
  SUM(quantity) AS total_quantity,
  SUM(order_amount) AS total_amount,
  AVG(order_amount) AS avg_order_amount
FROM `erp_backup.fact_orders`
GROUP BY DATE(order_date);
```

**Python 實作**：

```python
def aggregate_daily_stats(orders_df):
    """每日訂單統計"""
    daily_stats = orders_df.groupby(
        orders_df['order_date'].dt.date
    ).agg({
        'order_id': 'nunique',
        'customer_id': 'nunique',
        'quantity': 'sum',
        'order_amount': ['sum', 'mean'],
    }).reset_index()
    
    return daily_stats
```

#### 6.3.2 執行複雜計算和衍生指標

**專案案例**：客戶價值指標

```sql
-- 客戶 RFM 分析
CREATE OR REPLACE VIEW `erp_backup.v_customer_rfm` AS
WITH customer_stats AS (
  SELECT
    customer_id,
    MAX(order_date) AS last_order_date,
    COUNT(DISTINCT order_id) AS frequency,
    SUM(order_amount) AS monetary_value
  FROM `erp_backup.fact_orders`
  GROUP BY customer_id
)
SELECT
  customer_id,
  last_order_date,
  frequency,
  monetary_value,
  DATE_DIFF(CURRENT_DATE(), last_order_date, DAY) AS recency_days,
  -- RFM 分數（1-5 分）
  CASE
    WHEN DATE_DIFF(CURRENT_DATE(), last_order_date, DAY) <= 30 THEN 5
    WHEN DATE_DIFF(CURRENT_DATE(), last_order_date, DAY) <= 60 THEN 4
    WHEN DATE_DIFF(CURRENT_DATE(), last_order_date, DAY) <= 90 THEN 3
    WHEN DATE_DIFF(CURRENT_DATE(), last_order_date, DAY) <= 180 THEN 2
    ELSE 1
  END AS recency_score,
  CASE
    WHEN frequency >= 10 THEN 5
    WHEN frequency >= 5 THEN 4
    WHEN frequency >= 3 THEN 3
    WHEN frequency >= 2 THEN 2
    ELSE 1
  END AS frequency_score,
  CASE
    WHEN monetary_value >= 10000 THEN 5
    WHEN monetary_value >= 5000 THEN 4
    WHEN monetary_value >= 2000 THEN 3
    WHEN monetary_value >= 1000 THEN 2
    ELSE 1
  END AS monetary_score
FROM customer_stats;
```

#### 6.3.3 建立維度表和事實表

**ETL 流程**：

```python
def build_star_schema(raw_data):
    """
    建立星狀模型
    
    流程：
    1. 建立維度表
    2. 建立事實表
    3. 建立關聯
    """
    # Step 1: 建立維度表
    dim_brands = build_dim_brands(raw_data['brands'])
    dim_customers = build_dim_customers(raw_data['customers'])
    dim_channels = build_dim_channels(raw_data['channels'])
    
    # Step 2: 建立事實表
    fact_orders = build_fact_orders(
        raw_data['orders'],
        dim_brands,
        dim_customers,
        dim_channels
    )
    
    # Step 3: 載入 BigQuery
    load_to_bigquery('dim_brands', dim_brands)
    load_to_bigquery('dim_customers', dim_customers)
    load_to_bigquery('dim_channels', dim_channels)
    load_to_bigquery('fact_orders', fact_orders)
    
    return {
        'dim_brands': dim_brands,
        'dim_customers': dim_customers,
        'dim_channels': dim_channels,
        'fact_orders': fact_orders,
    }
```

### 6.4 改進建議

#### 6.4.1 增量聚合

**建議**：只處理新增資料的聚合

```python
def incremental_aggregate(new_orders, last_aggregate_date):
    """增量聚合"""
    # 只處理新增的訂單
    new_orders_filtered = new_orders[
        new_orders['order_date'] > last_aggregate_date
    ]
    
    # 計算增量統計
    incremental_stats = aggregate_stats(new_orders_filtered)
    
    # 合併到歷史統計
    historical_stats = load_historical_stats(last_aggregate_date)
    updated_stats = merge_stats(historical_stats, incremental_stats)
    
    return updated_stats
```

#### 6.4.2 物化視圖優化

**建議**：使用 BigQuery 物化視圖提升查詢效能

```sql
-- 建立物化視圖
CREATE MATERIALIZED VIEW `erp_backup.mv_daily_order_stats`
PARTITION BY order_date
CLUSTER BY brand_id, channel_id
AS
SELECT
  DATE(order_date) AS order_date,
  brand_id,
  channel_id,
  COUNT(DISTINCT order_id) AS order_count,
  SUM(order_amount) AS total_amount
FROM `erp_backup.fact_orders`
GROUP BY DATE(order_date), brand_id, channel_id;
```

---

## 7. 數據富集 (Data Enrichment) 深度分析

### 7.1 專案現況

專案已實作部分資料富集功能：

| 富集類型 | 實作狀態 | 說明 |
|---------|---------|------|
| **缺失品牌補充** | ✅ 已實作 | CR-002 修補，新增 S27/SPH/FLM |
| **缺失活動補充** | 🟡 規劃中 | 表 80 活動管理表修補 |
| **外部資料整合** | ❌ 未實作 | 未來擴展需求 |
| **參考資料補充** | 🟡 部分實作 | 郵遞區號對應 |

### 7.2 富集實作方式

#### 7.2.1 添加參考數據

**專案案例**：品牌參照缺失修補

```python
# test_workspace/cleaning_test/add_missing_brands.py
def add_missing_brands():
    """
    新增缺失的品牌記錄
    
    問題：139,360 筆訂單明細的品牌編號不存在於品牌表
    解決：新增 S27, SPH, FLM 三個品牌
    """
    missing_brands = [
        {
            '品牌編號': 'S27',
            '品牌名稱': '品牌S27',
            '建立日期': '2025/01/01',
        },
        {
            '品牌編號': 'SPH',
            '品牌名稱': '品牌SPH',
            '建立日期': '2025/01/01',
        },
        {
            '品牌編號': 'FLM',
            '品牌名稱': '品牌FLM',
            '建立日期': '2025/01/01',
        },
    ]
    
    # 寫入品牌表
    for brand in missing_brands:
        insert_brand(brand)
    
    return missing_brands
```

**結果**：
- 解決 139,360 筆品牌參照缺失問題
- 品牌參照完整性從 55% 提升至 100%

#### 7.2.2 補充缺失信息

**專案案例**：活動管理表品牌編號補全

```python
def enrich_activity_brands(activities):
    """
    為活動管理表補充品牌編號
    
    策略：
    1. 從訂單明細表查詢活動對應的品牌
    2. 使用最常見的品牌作為預設值
    """
    enriched_activities = []
    
    for activity in activities:
        if not activity.get('品牌編號'):
            # 從訂單明細查詢此活動最常使用的品牌
            brand_id = get_most_common_brand_for_activity(
                activity['活動編號']
            )
            
            if brand_id:
                activity['品牌編號'] = brand_id
                activity['_enriched'] = True
        
        enriched_activities.append(activity)
    
    return enriched_activities
```

#### 7.2.3 外部數據整合

**未來需求**：整合外部 API 資料

**設計方案**：

```python
class ExternalDataEnricher:
    """外部資料富集器"""
    
    def __init__(self):
        self.apis = {
            'postal_code': PostalCodeAPI(),
            'address_validation': AddressValidationAPI(),
        }
    
    def enrich_postal_code(self, address):
        """
        從地址補充郵遞區號
        
        使用外部 API 或地址解析服務
        """
        if not address:
            return None
        
        # 呼叫外部 API
        result = self.apis['postal_code'].lookup(address)
        
        if result and result.get('postal_code'):
            return result['postal_code']
        
        return None
    
    def enrich_customer_info(self, customer_id):
        """
        從 CRM 系統補充客戶資訊
        
        未來可整合其他系統的客戶資料
        """
        # 呼叫 CRM API
        crm_data = self.apis['crm'].get_customer(customer_id)
        
        if crm_data:
            return {
                'customer_segment': crm_data.get('segment'),
                'customer_lifetime_value': crm_data.get('ltv'),
                'last_contact_date': crm_data.get('last_contact'),
            }
        
        return None
```

### 7.3 富集策略設計

#### 7.3.1 推斷策略

**三層推斷機制**：

```
層級 1: 精確匹配
    - 從歷史資料查詢精確對應
    - 準確率：100%
    
層級 2: 模糊匹配
    - 使用相似度演算法
    - 準確率：80-90%
    
層級 3: 預設值
    - 使用業務規則預設值
    - 準確率：60-70%
```

**實作範例**：

```python
def infer_brand_for_activity(activity_code):
    """推斷活動對應的品牌"""
    
    # 層級 1: 精確匹配
    exact_match = get_exact_brand_match(activity_code)
    if exact_match:
        return exact_match, 'EXACT'
    
    # 層級 2: 模糊匹配
    fuzzy_match = get_fuzzy_brand_match(activity_code)
    if fuzzy_match and fuzzy_match['confidence'] > 0.8:
        return fuzzy_match['brand_id'], 'FUZZY'
    
    # 層級 3: 預設值
    default_brand = get_default_brand()
    return default_brand, 'DEFAULT'
```

#### 7.3.2 驗證機制

**建議**：富集後驗證資料正確性

```python
def validate_enrichment(original_record, enriched_record):
    """驗證富集結果"""
    errors = []
    warnings = []
    
    # 檢查富集欄位
    enriched_fields = enriched_record.get('_enriched_fields', [])
    
    for field in enriched_fields:
        original_value = original_record.get(field)
        enriched_value = enriched_record.get(field)
        
        # 如果原始值存在，不應被覆蓋
        if original_value and original_value != enriched_value:
            errors.append(f'{field} 原始值被覆蓋')
        
        # 檢查富集值合理性
        if not validate_field_value(field, enriched_value):
            warnings.append(f'{field} 富集值可能不正確')
    
    return {
        'errors': errors,
        'warnings': warnings,
        'is_valid': len(errors) == 0,
    }
```

### 7.4 改進建議

#### 7.4.1 建立富集規則庫

**建議**：統一管理富集規則

```yaml
# rules/enrichment_rules.yaml
enrichment_rules:
  - id: ENR-001
    name: 活動品牌推斷
    source_table: 80_活動管理表
    target_field: 品牌編號
    strategy: inference
    inference_method: most_common_from_orders
    confidence_threshold: 0.8
    fallback: default_brand
  
  - id: ENR-002
    name: 郵遞區號補充
    source_table: 99_訂單明細表
    target_field: 郵遞區號
    strategy: external_api
    api: postal_code_lookup
    cache: true
```

#### 7.4.2 富集結果追蹤

**建議**：記錄所有富集操作

```sql
CREATE TABLE `erp_backup.enrichment_log` (
  enrichment_id STRING,
  table_name STRING,
  record_id STRING,
  rule_id STRING,
  field_name STRING,
  original_value STRING,
  enriched_value STRING,
  enrichment_method STRING,
  confidence_score FLOAT64,
  enriched_at TIMESTAMP
);
```

---

## 8. ETL 工具適用性研究

### 8.1 工具比較分析

| 工具 | 適用場景 | 優點 | 缺點 | RagicEDP 適用性 |
|------|---------|------|------|----------------|
| **Google Cloud Dataflow** | 大規模批次/串流處理 | GCP 原生整合、自動擴展 | 學習曲線高、成本較高 | 🟡 中期考慮 |
| **Apache Airflow** | 工作流調度 | 開源、靈活、豐富生態 | 需要自行管理基礎設施 | 🟢 適合排程 |
| **Cloud Functions** | 輕量級 ETL | 簡單、成本低、快速開發 | 擴展性有限 | 🟢 當前使用 |
| **dbt / Dataform** | 資料轉換 | SQL 為基礎、版本控制 | 需要資料已在資料庫 | 🟡 後期考慮 |

### 8.2 Google Cloud Dataflow 深度分析

#### 8.2.1 適用性評估

**專案現況**：
- 資料量：461,750 筆（10 表）
- 週增量：~9,500 筆（2.1%）
- 當前架構：Cloud Function 已足夠

**Dataflow 適用場景**：

| 場景 | 適用性 | 說明 |
|------|--------|------|
| **當前增量處理** | ❌ 不適用 | Cloud Function 已足夠 |
| **全量資料分析** | 🟡 可考慮 | 50 萬筆全量分析時 |
| **即時資料處理** | 🟢 適用 | 未來若需即時處理 |
| **複雜多階段轉換** | 🟡 可考慮 | 星狀模型建立時 |

#### 8.2.2 Pipeline 設計範例

**假設未來導入 Dataflow 的 Pipeline 設計**：

```python
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions

def run_pipeline():
    """Dataflow Pipeline 範例"""
    
    options = PipelineOptions()
    
    with beam.Pipeline(options=options) as p:
        # Step 1: 讀取原始資料
        raw_data = (
            p
            | 'Read from BigQuery' >> beam.io.ReadFromBigQuery(
                query='SELECT * FROM `erp_backup.raw_orders`'
            )
        )
        
        # Step 2: 資料清洗
        cleaned_data = (
            raw_data
            | 'Clean Data' >> beam.ParDo(CleanDataFn())
            | 'Validate Data' >> beam.ParDo(ValidateDataFn())
        )
        
        # Step 3: 資料轉換
        transformed_data = (
            cleaned_data
            | 'Standardize Format' >> beam.ParDo(StandardizeFormatFn())
            | 'Enrich Data' >> beam.ParDo(EnrichDataFn())
        )
        
        # Step 4: 建立星狀模型
        fact_records = (
            transformed_data
            | 'Build Fact Table' >> beam.ParDo(BuildFactTableFn())
        )
        
        dim_records = (
            transformed_data
            | 'Build Dim Tables' >> beam.ParDo(BuildDimTablesFn())
        )
        
        # Step 5: 寫入 BigQuery
        fact_records | 'Write Fact Table' >> beam.io.WriteToBigQuery(
            table='erp_backup.fact_orders',
            write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND
        )
        
        dim_records | 'Write Dim Tables' >> beam.io.WriteToBigQuery(
            table='erp_backup.dim_*',
            write_disposition=beam.io.BigQueryDisposition.WRITE_TRUNCATE
        )

class CleanDataFn(beam.DoFn):
    """資料清洗函數"""
    def process(self, element):
        # 實作清洗邏輯
        cleaned = clean_record(element)
        yield cleaned

class ValidateDataFn(beam.DoFn):
    """資料驗證函數"""
    def process(self, element):
        errors = validate_record(element)
        if not errors:
            yield element
        else:
            # 寫入錯誤記錄
            yield beam.pvalue.TaggedOutput('errors', element)
```

#### 8.2.3 成本估算

| 方案 | 月估計成本 | 適用場景 |
|------|-----------|---------|
| **Cloud Function** | $1-5 | 週執行一次，9,500 筆 |
| **Dataflow（批次）** | $10-30 | 週執行一次，50 萬筆全量 |
| **Dataflow（串流）** | $100+ | 24/7 運行 |

**結論**：目前階段 Cloud Function 足夠且成本低，Dataflow 列為中期技術選項。

### 8.3 Apache Airflow 適用性分析

#### 8.3.1 適用場景

**Airflow 適合**：
- 複雜工作流調度
- 多步驟 ETL 流程
- 依賴關係管理
- 錯誤重試機制

**專案應用**：

```python
# DAG 範例
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'ragic_edp',
    'depends_on_past': False,
    'start_date': datetime(2025, 1, 1),
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'ragic_etl_pipeline',
    default_args=default_args,
    description='Ragic ETL Pipeline',
    schedule_interval='0 0 * * *',  # 每日凌晨執行
)

# Task 1: 備份資料
backup_task = PythonOperator(
    task_id='backup_from_ragic',
    python_callable=backup_from_ragic,
    dag=dag,
)

# Task 2: 資料清洗
clean_task = PythonOperator(
    task_id='clean_data',
    python_callable=clean_data,
    dag=dag,
)

# Task 3: 資料轉換
transform_task = PythonOperator(
    task_id='transform_data',
    python_callable=transform_data,
    dag=dag,
)

# Task 4: 載入 BigQuery
load_task = PythonOperator(
    task_id='load_to_bigquery',
    python_callable=load_to_bigquery,
    dag=dag,
)

# 定義依賴關係
backup_task >> clean_task >> transform_task >> load_task
```

#### 8.3.2 建議

**短期**：維持 Cloud Scheduler + Cloud Function  
**中期**：考慮導入 Airflow 管理複雜工作流  
**長期**：Airflow + Dataflow 組合使用

### 8.4 dbt / Dataform 適用性分析

#### 8.4.1 適用場景

**dbt/Dataform 適合**：
- 資料已在 BigQuery
- SQL 為基礎的轉換
- 版本控制和測試
- 文件自動生成

**專案應用**：

```sql
-- models/staging/stg_orders.sql
{{ config(materialized='view') }}

SELECT
  order_id,
  order_date,
  customer_id,
  brand_id,
  -- 標準化欄位
  {{ standardize_phone('customer_phone') }} AS customer_phone,
  {{ standardize_date('order_date') }} AS order_date_standardized,
FROM {{ source('raw', 'ragic_orders') }}
WHERE order_date >= '2025-01-01'
```

**建議**：後期考慮導入，用於 BigQuery 內的資料轉換。

---

## 9. 整合實施建議

### 9.1 實施階段規劃

#### 階段一：基礎建設（1-2 個月）

**目標**：建立完整的 Transform 基礎架構

| 任務 | 說明 | 優先級 |
|------|------|--------|
| 規則引擎實作 | 建立可配置的規則系統 | P0 |
| 標準化函數庫 | 建立可重用的標準化函數 | P0 |
| 驗證檢查點 | 在 Extract/Transform/Load 各階段加入驗證 | P1 |
| 日誌記錄系統 | 記錄所有轉換步驟和異常 | P1 |

#### 階段二：功能擴展（2-3 個月）

**目標**：實作進階 Transform 功能

| 任務 | 說明 | 優先級 |
|------|------|--------|
| 映射配置系統 | 建立欄位和值映射配置 | P1 |
| 富集規則庫 | 建立資料富集規則系統 | P1 |
| 增量處理優化 | 只處理新增/變更資料 | P2 |
| 自動修補機制 | 可自動修補的問題自動處理 | P2 |

#### 階段三：進階功能（3-4 個月）

**目標**：建立星狀模型和進階分析

| 任務 | 說明 | 優先級 |
|------|------|--------|
| 星狀模型建立 | 建立事實表和維度表 | P1 |
| 聚合計算實作 | 實作統計匯總和衍生指標 | P1 |
| 物化視圖優化 | 建立物化視圖提升查詢效能 | P2 |
| 外部資料整合 | 整合外部 API 資料 | P3 |

#### 階段四：工具整合（4-6 個月）

**目標**：導入專業 ETL 工具

| 任務 | 說明 | 優先級 |
|------|------|--------|
| Airflow 導入 | 導入 Airflow 管理工作流 | P2 |
| dbt/Dataform 導入 | 導入 dbt 進行 SQL 轉換 | P2 |
| Dataflow 評估 | 評估 Dataflow 適用性 | P3 |

### 9.2 技術架構建議

#### 9.2.1 當前架構（維持）

```
Ragic API
    ↓
Cloud Function (Python)
    ├── Extract: 取得資料
    ├── Transform: 清洗、轉換、驗證
    └── Load: 寫入 BigQuery
    ↓
BigQuery (raw_data → dwh)
```

#### 9.2.2 中期架構（建議）

```
Ragic API
    ↓
Cloud Function / Cloud Run
    ├── Extract: 取得資料
    └── Load: 寫入 BigQuery (raw_data)
    ↓
BigQuery (raw_data)
    ↓
Airflow DAG
    ├── Transform: 清洗、轉換
    ├── Validate: 驗證
    └── Load: 寫入 BigQuery (dwh)
    ↓
BigQuery (dwh)
    ├── dbt Models: SQL 轉換
    └── Materialized Views: 聚合
    ↓
BigQuery (analytics)
```

#### 9.2.3 長期架構（未來）

```
Ragic API / Pub/Sub
    ↓
Dataflow Pipeline (Streaming)
    ├── Real-time Transform
    ├── Real-time Validation
    └── Real-time Load
    ↓
BigQuery (real-time)
    ↓
Airflow DAG (Batch)
    ├── Daily Aggregation
    └── Weekly Reports
    ↓
BigQuery (analytics)
```

### 9.3 實施優先順序

#### P0 - 立即實施

1. **規則引擎實作**：建立可配置的規則系統
2. **標準化函數庫**：建立可重用的標準化函數
3. **驗證檢查點**：在關鍵階段加入驗證

#### P1 - 短期實施（1-3 個月）

1. **映射配置系統**：統一管理欄位映射
2. **富集規則庫**：建立資料富集規則
3. **星狀模型建立**：建立事實表和維度表

#### P2 - 中期實施（3-6 個月）

1. **增量處理優化**：只處理新增/變更資料
2. **自動修補機制**：可自動修補的問題自動處理
3. **Airflow 導入**：管理複雜工作流

#### P3 - 長期實施（6 個月以上）

1. **Dataflow 評估**：評估大規模處理需求
2. **dbt/Dataform 導入**：SQL 為基礎的轉換
3. **外部資料整合**：整合外部 API 資料

---

## 10. 結論與下一步

### 10.1 研究結論

1. **數據清洗**：專案已有 87 條規則，建議規則引擎化和自動修補
2. **數據驗證**：已實作多層驗證，建議建立驗證結果追蹤系統
3. **數據標準化**：部分實作，建議建立標準化函數庫和配置系統
4. **數據匹配與對應**：基本實作，建議建立映射配置系統
5. **數據聚合與計算**：規劃中，建議建立星狀模型和物化視圖
6. **數據富集**：部分實作，建議建立富集規則庫和追蹤系統
7. **ETL 工具**：當前 Cloud Function 足夠，中期考慮 Airflow，長期評估 Dataflow

### 10.2 關鍵建議

1. **建立規則引擎**：將硬編碼規則改為配置化系統
2. **標準化函數庫**：建立可重用的標準化函數
3. **驗證追蹤系統**：記錄所有驗證結果，支援回溯
4. **增量處理優化**：只處理新增/變更資料，提升效率
5. **星狀模型建立**：建立事實表和維度表，支援分析

### 10.3 下一步行動

1. **立即行動**：
   - 設計規則引擎架構
   - 建立標準化函數庫
   - 實作驗證檢查點

2. **短期行動**（1-3 個月）：
   - 實作映射配置系統
   - 建立富集規則庫
   - 開始建立星狀模型

3. **中期行動**（3-6 個月）：
   - 導入 Airflow 管理工作流
   - 優化增量處理
   - 建立自動修補機制

4. **長期行動**（6 個月以上）：
   - 評估 Dataflow 適用性
   - 導入 dbt/Dataform
   - 整合外部資料來源

---

**文件結束**

*建立時間: 2025-12-30*  
*版本: v1.0*  
*狀態: 完成*

