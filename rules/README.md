# Rules 規則配置目錄

> **更新日期**: 2026-01-11
> **用途**: 資料清洗規則 YAML 配置檔

---

## 規則清單

| 檔案 | 規則數 | 類型 | 說明 |
|------|--------|------|------|
| **fill_rules.yaml** | 20 | 自動補足 | ⭐ 客戶統計、訂單關聯、衍生欄位 |
| format_rules.yaml | 9 | 格式驗證 | 電話、Email、日期格式 |
| fk_rules.yaml | 5 | 外鍵參照 | 品牌、通路、物流、客戶 |
| numeric_rules.yaml | 15 | 數值範圍 | 金額、數量、折扣 |
| required_rules.yaml | 28 | 必填欄位 | 各表必填檢查 |
| unique_rules.yaml | 4 | 唯一性 | 編號唯一性 |
| temporal_rules.yaml | 4 | 時序驗證 | 日期順序 |
| association_rules.yaml | 10 | 關聯驗證 | 表間關聯 |
| **總計** | **95** | | |

---

## 規則結構

### 標準規則格式

```yaml
rules:
  - id: "RULE-001"
    name: "規則名稱"
    type: "validation"  # validation | auto_fill | lookup_fill
    priority: "high"    # high | medium | low
    target:
      table: "sheet_50_order"
      field: "customer_phone"
    condition: "欄位為空"
    action: "標記錯誤"
    error_message: "電話不得為空"
```

### 自動補足規則格式 (fill_rules.yaml)

```yaml
rules:
  - id: "FILL-CUST-001"
    name: "補足首購日期"
    type: "auto_fill"
    phase: 2
    schedule: "daily"
    target:
      table: "sheet_60_customer"
      field: "first_purchase_date"
    source:
      table: "sheet_50_order"
      aggregation: "MIN(order_date)"
    condition: "欄位為空"
```

---

## 執行順序

### Phase 1: 基礎驗證
- format_rules.yaml
- required_rules.yaml

### Phase 2: 參照驗證
- fk_rules.yaml
- unique_rules.yaml

### Phase 3: 邏輯驗證
- numeric_rules.yaml
- temporal_rules.yaml
- association_rules.yaml

### Phase 4-5: 自動補足
- fill_rules.yaml (FILL-CUST, FILL-OD, FILL-DERIVED)

---

## 使用方式

```python
from src.cleaning.engine import CleaningEngine

# 載入規則
engine = CleaningEngine()
engine.load_rules("rules/")

# 執行清洗
result = engine.clean(data)
```

---

## 相關文件

| 文件 | 位置 |
|------|------|
| 169 條規則手冊 | `_docs/planning/資料清洗/自動化清洗規則完整手冊_v2.md` |
| 開發規劃 | `_docs/planning/資料清洗/資料清洗程式開發規劃_v2.md` |
| 行銷規則 | `_docs/planning/資料清洗/行銷數據清洗規則手冊.md` |

---

*最後更新: 2026-01-11*
