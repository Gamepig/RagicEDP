# GCP AI 服務用於資料判別研究報告

**版本**: v1.0  
**建立日期**: 2025-12-30  
**專案**: RagicEDP 資料平台  
**研究目的**: 評估 GCP AI 服務在資料清洗轉換過程中用於資料判別的適用性

---

## 目錄

1. [執行摘要](#1-執行摘要)
2. [GCP AI 服務概述](#2-gcp-ai-服務概述)
3. [針對專案需求的服務對應](#3-針對專案需求的服務對應)
4. [整合架構建議](#4-整合架構建議)
5. [實作範例](#5-實作範例)
6. [成本估算](#6-成本估算)
7. [實施建議](#7-實施建議)
8. [優勢與限制](#8-優勢與限制)
9. [結論與建議](#9-結論與建議)

---

## 1. 執行摘要

### 1.1 研究目的

在資料清洗轉換過程中，利用人工智慧（AI）技術進行資料判別可以顯著提升效率和準確性。本報告研究 Google Cloud Platform (GCP) 提供的現成 AI 服務，評估其在 RagicEDP 專案資料清洗流程中的適用性。

### 1.2 關鍵發現

| GCP AI 服務 | 適用場景 | RagicEDP 適用性 | 優先級 |
|------------|---------|----------------|--------|
| **Sensitive Data Protection (Cloud DLP)** | PII 檢測、格式驗證 | 🟢 高度適用 | P0 |
| **Natural Language API** | 實體提取、文字分類 | 🟢 高度適用 | P1 |
| **BigQuery ML** | 異常檢測、關聯學習 | 🟢 高度適用 | P1 |
| **AutoML Tables** | 結構化資料分類 | 🟡 適用 | P2 |
| **Vertex AI** | 自訂模型訓練 | 🟡 適用 | P2 |
| **Document AI** | 文件解析、實體提取 | 🟡 可選 | P3 |

### 1.3 核心建議

1. **短期（1-2 週）**：導入 Cloud DLP 進行格式驗證（電話、Email、統一編號）
2. **中期（2-4 週）**：導入 Natural Language API 進行實體提取，BigQuery ML 進行異常檢測
3. **長期（4-8 週）**：建立 AutoML Tables 分類模型，訓練自訂 Vertex AI 模型

---

## 2. GCP AI 服務概述

### 2.1 Vertex AI（統一機器學習平台）

#### 2.1.1 核心能力

- ✅ **AutoML**：無需深度機器學習知識即可訓練自訂模型
- ✅ **自訂模型**：支援 TensorFlow、PyTorch、XGBoost 等框架
- ✅ **預訓練模型**：提供影像、文字、語音、影片等預訓練模型
- ✅ **模型部署**：支援批次和即時推論

#### 2.1.2 適用場景

| 場景 | 說明 | RagicEDP 應用 |
|------|------|-------------|
| **商品名稱分類** | 識別商品類型、活動詞 | PROD-001：活動詞識別 |
| **品牌/通路分類** | 自動分類品牌和通路 | 品牌參照完整性驗證 |
| **異常檢測** | 檢測數值離群、時序異常 | NUM-001 ~ NUM-007 |
| **資料品質評分** | 評分資料品質 | 整體資料品質評估 |

#### 2.1.3 優勢

- ✅ 與 BigQuery、Dataflow 深度整合
- ✅ 支援批次和即時推論
- ✅ 自動化 ML 工作流程
- ✅ 可擴展性高

#### 2.1.4 限制

- ⚠️ 需要訓練資料
- ⚠️ 自訂模型需要 ML 知識
- ⚠️ 成本較高（訓練和推論）

### 2.2 BigQuery ML（資料倉儲內機器學習）

#### 2.2.1 核心能力

- ✅ **SQL 語法**：使用標準 SQL 建立和執行 ML 模型
- ✅ **無需資料移動**：直接在 BigQuery 中訓練和推論
- ✅ **多種模型類型**：分類、迴歸、異常檢測、推薦系統
- ✅ **大規模處理**：可處理 PB 級資料

#### 2.2.2 適用場景

| 場景 | 說明 | RagicEDP 應用 |
|------|------|-------------|
| **數值範圍驗證** | 檢測數值離群值 | NUM-001 ~ NUM-007 |
| **關聯規則學習** | 學習品牌-促銷、通路-物流關聯 | ASSOC-001 ~ ASSOC-010 |
| **異常檢測** | 檢測異常訂單、金額 | CR-003：訂單金額一致性 |
| **資料品質評分** | 評分資料品質 | 整體資料品質評估 |

#### 2.2.3 優勢

- ✅ 無需資料移動，直接在 BigQuery 中處理
- ✅ 使用 SQL 語法，易於整合
- ✅ 可處理大規模資料
- ✅ 成本效益高（包含在 BigQuery 中）

#### 2.2.4 實作範例

```sql
-- 建立異常檢測模型
CREATE MODEL `erp_backup.order_amount_anomaly`
OPTIONS(
  model_type='logistic_reg',
  input_label_cols=['is_anomaly']
) AS
SELECT
  order_amount,
  customer_id,
  brand_id,
  CASE 
    WHEN order_amount > 100000 OR order_amount < 100 THEN 1 
    ELSE 0 
  END AS is_anomaly
FROM `erp_backup.raw_orders`
WHERE order_amount IS NOT NULL;

-- 使用模型預測異常
SELECT
  order_id,
  order_amount,
  predicted_is_anomaly,
  predicted_is_anomaly_probs
FROM ML.PREDICT(
  MODEL `erp_backup.order_amount_anomaly`,
  (SELECT * FROM `erp_backup.raw_orders` WHERE order_date >= '2025-01-01')
)
WHERE predicted_is_anomaly = 1;
```

### 2.3 Sensitive Data Protection（Cloud DLP）

#### 2.3.1 核心能力

- ✅ **PII 檢測**：自動檢測個人識別資訊（姓名、電話、Email、身份證字號等）
- ✅ **多種資料格式**：支援結構化和非結構化資料
- ✅ **去識別化**：遮蔽、假名化、加密等
- ✅ **自訂檢測器**：可建立自訂檢測規則

#### 2.3.2 適用場景

| 場景 | 說明 | RagicEDP 應用 |
|------|------|-------------|
| **電話號碼驗證** | 檢測和驗證台灣手機、市話 | FMT-001、FMT-002 |
| **Email 驗證** | 檢測和驗證 Email 格式 | FMT-003 |
| **統一編號驗證** | 檢測和驗證台灣統一編號 | FMT-004 |
| **敏感資料標記** | 標記敏感資料 | 資料隱私保護 |

#### 2.3.3 優勢

- ✅ 預建檢測器（台灣手機、Email、統編等）
- ✅ 可自訂檢測規則
- ✅ 自動去識別化
- ✅ 成本效益高

#### 2.3.4 實作範例

```python
from google.cloud import dlp_v2

def validate_phone_with_dlp(phone_number):
    """使用 Cloud DLP 驗證電話號碼"""
    client = dlp_v2.DlpServiceClient()
    
    # 自訂檢測器：台灣手機號碼
    custom_info_type = {
        "info_type": {"name": "TAIWAN_MOBILE_PHONE"},
        "regex": {
            "pattern": r"^09\d{8}$|^\+?886\d{9,10}$"
        }
    }
    
    inspect_config = {
        "custom_info_types": [custom_info_type],
        "min_likelihood": dlp_v2.Likelihood.POSSIBLE,
    }
    
    item = {"value": phone_number}
    response = client.inspect_content(
        request={
            "parent": f"projects/{PROJECT_ID}",
            "inspect_config": inspect_config,
            "item": item
        }
    )
    
    findings = response.result.findings
    return len(findings) > 0
```

### 2.4 Natural Language API

#### 2.4.1 核心能力

- ✅ **實體提取**：從文字中提取人名、地點、組織等實體
- ✅ **情感分析**：分析文字情感傾向
- ✅ **分類**：對文字進行內容分類
- ✅ **語法分析**：分析文字語法結構

#### 2.4.2 適用場景

| 場景 | 說明 | RagicEDP 應用 |
|------|------|-------------|
| **商品名稱實體提取** | 提取品牌、系列、規格 | PROD-002：品牌提取 |
| **地址解析** | 解析縣市、郵遞區號 | 地址標準化 |
| **文字分類** | 分類商品類型、活動類型 | PROD-001：活動詞識別 |
| **情感分析** | 分析客戶評論情感 | 客戶滿意度分析 |

#### 2.4.3 優勢

- ✅ 預訓練模型，開箱即用
- ✅ 支援繁體中文
- ✅ REST API，易於整合
- ✅ 成本效益高

#### 2.4.4 實作範例

```python
from google.cloud import language_v1

def extract_product_entities(product_name):
    """從商品名稱提取實體"""
    client = language_v1.LanguageServiceClient()
    
    document = language_v1.Document(
        content=product_name,
        type_=language_v1.Document.Type.PLAIN_TEXT,
        language='zh-TW'
    )
    
    response = client.analyze_entities(
        request={'document': document}
    )
    
    entities = {}
    for entity in response.entities:
        if entity.type_ == language_v1.Entity.Type.ORGANIZATION:
            entities['brand'] = entity.name
        elif entity.type_ == language_v1.Entity.Type.OTHER:
            entities['product_type'] = entity.name
    
    return entities
```

### 2.5 AutoML Tables

#### 2.5.1 核心能力

- ✅ **自動化 ML**：無需 ML 專業知識即可訓練模型
- ✅ **結構化資料**：專門處理表格資料
- ✅ **自動特徵工程**：自動進行特徵選擇和工程
- ✅ **高準確度**：自動優化模型參數

#### 2.5.2 適用場景

| 場景 | 說明 | RagicEDP 應用 |
|------|------|-------------|
| **品牌分類** | 自動分類品牌 | 品牌參照完整性 |
| **商品分類** | 自動分類商品類型 | PROD-001：商品分類 |
| **異常檢測** | 檢測異常記錄 | NUM-001 ~ NUM-007 |
| **資料品質評分** | 評分資料品質 | 整體資料品質評估 |

#### 2.5.3 優勢

- ✅ 無需 ML 專業知識
- ✅ 自動特徵工程
- ✅ 高準確度
- ✅ 易於使用

#### 2.5.4 限制

- ⚠️ 需要標記的訓練資料
- ⚠️ 訓練時間較長
- ⚠️ 成本較高（訓練費用）

### 2.6 Document AI

#### 2.6.1 核心能力

- ✅ **文件解析**：解析表單、發票、收據等文件
- ✅ **實體提取**：提取日期、金額、地址等實體
- ✅ **表單理解**：識別和驗證表單欄位
- ✅ **自訂模型**：可訓練自訂文件解析模型

#### 2.6.2 適用場景

| 場景 | 說明 | RagicEDP 應用 |
|------|------|-------------|
| **地址解析** | 從非結構化文字提取地址 | 地址標準化 |
| **日期提取** | 提取和標準化日期 | 日期格式標準化 |
| **金額提取** | 提取和驗證金額 | 金額一致性驗證 |
| **表單驗證** | 驗證表單欄位完整性 | 必填欄位驗證 |

#### 2.6.3 優勢

- ✅ 預訓練模型，開箱即用
- ✅ 可訓練自訂模型
- ✅ 高準確度
- ✅ 支援多種文件格式

#### 2.6.4 限制

- ⚠️ 主要針對文件，對結構化資料適用性較低
- ⚠️ 成本較高
- ⚠️ 需要文件格式資料

---

## 3. 針對專案需求的服務對應

### 3.1 格式驗證規則（FMT-001 ~ FMT-008）

| 規則 ID | 規則名稱 | 當前方法 | GCP AI 方案 | 適用服務 | 優先級 |
|---------|---------|---------|------------|---------|--------|
| **FMT-001** | 台灣手機號碼格式 | 正則表達式 | PII 檢測 | Cloud DLP | P0 |
| **FMT-002** | 市內電話格式 | 正則表達式 | PII 檢測 | Cloud DLP | P0 |
| **FMT-003** | Email 格式 | 正則表達式 | PII 檢測 | Cloud DLP | P0 |
| **FMT-004** | 統一編號格式 | 正則表達式 | PII 檢測 | Cloud DLP | P0 |

**建議**：
- ✅ **優先導入 Cloud DLP**：可自動檢測台灣手機、Email、統編等 PII
- ✅ **自訂檢測器**：可建立自訂規則處理特殊格式
- ✅ **成本效益**：檢測費用低，準確度高

**實作方式**：
```python
# 在 Cloud Function 中整合 Cloud DLP
def validate_format_with_dlp(field_value, field_type):
    """使用 Cloud DLP 驗證格式"""
    client = dlp_v2.DlpServiceClient()
    
    # 根據欄位類型選擇檢測器
    info_types = {
        'phone': [{"name": "PHONE_NUMBER"}],
        'email': [{"name": "EMAIL_ADDRESS"}],
        'tax_id': [{"name": "TAXPAYER_ID"}],
    }
    
    inspect_config = {
        "info_types": info_types.get(field_type, []),
        "min_likelihood": dlp_v2.Likelihood.POSSIBLE,
    }
    
    item = {"value": field_value}
    response = client.inspect_content(
        request={
            "parent": f"projects/{PROJECT_ID}",
            "inspect_config": inspect_config,
            "item": item
        }
    )
    
    return len(response.result.findings) > 0
```

### 3.2 商品名稱規則（PROD-001 ~ PROD-008）

| 規則 ID | 規則名稱 | 當前方法 | GCP AI 方案 | 適用服務 | 優先級 |
|---------|---------|---------|------------|---------|--------|
| **PROD-001** | 活動詞識別 | 關鍵字匹配 | 文字分類 | Natural Language API / AutoML | P1 |
| **PROD-002** | 品牌提取 | 規則匹配 | 實體提取 | Natural Language API | P1 |
| **PROD-003** | 單品組合詞 | 關鍵字匹配 | 文字分類 | Natural Language API / AutoML | P2 |

**建議**：
- ✅ **使用 Natural Language API**：提取品牌、系列等實體
- ✅ **使用 AutoML Tables**：訓練商品分類模型
- ✅ **結合使用**：實體提取 + 分類模型

**實作方式**：
```python
# 使用 Natural Language API 提取商品實體
def extract_product_info(product_name):
    """提取商品資訊"""
    client = language_v1.LanguageServiceClient()
    
    document = language_v1.Document(
        content=product_name,
        type_=language_v1.Document.Type.PLAIN_TEXT,
        language='zh-TW'
    )
    
    # 實體提取
    entities_response = client.analyze_entities(
        request={'document': document}
    )
    
    # 分類
    classify_response = client.classify_text(
        request={'document': document}
    )
    
    return {
        'entities': entities_response.entities,
        'categories': classify_response.categories
    }
```

### 3.3 數值範圍規則（NUM-001 ~ NUM-014）

| 規則 ID | 規則名稱 | 當前方法 | GCP AI 方案 | 適用服務 | 優先級 |
|---------|---------|---------|------------|---------|--------|
| **NUM-001 ~ NUM-007** | 離群檢測 | IQR/Z-Score | 異常檢測 | BigQuery ML / Vertex AI | P1 |
| **NUM-008 ~ NUM-014** | 金額一致性 | 規則比對 | 異常檢測 | BigQuery ML | P1 |

**建議**：
- ✅ **使用 BigQuery ML**：建立異常檢測模型
- ✅ **訓練自訂模型**：根據業務規則訓練模型
- ✅ **即時檢測**：在資料載入時即時檢測異常

**實作方式**：
```sql
-- 建立異常檢測模型
CREATE MODEL `erp_backup.order_amount_anomaly`
OPTIONS(
  model_type='logistic_reg',
  input_label_cols=['is_anomaly']
) AS
SELECT
  order_amount,
  customer_id,
  brand_id,
  channel_id,
  CASE 
    WHEN order_amount > 100000 OR order_amount < 100 THEN 1 
    ELSE 0 
  END AS is_anomaly
FROM `erp_backup.raw_orders`
WHERE order_amount IS NOT NULL
  AND order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);

-- 使用模型預測異常
SELECT
  order_id,
  order_amount,
  predicted_is_anomaly,
  predicted_is_anomaly_probs[OFFSET(0)].prob AS anomaly_probability
FROM ML.PREDICT(
  MODEL `erp_backup.order_amount_anomaly`,
  (SELECT * FROM `erp_backup.raw_orders` WHERE order_date >= '2025-01-01')
)
WHERE predicted_is_anomaly = 1
ORDER BY anomaly_probability DESC;
```

### 3.4 關聯規則（ASSOC-001 ~ ASSOC-010）

| 規則 ID | 規則名稱 | 當前方法 | GCP AI 方案 | 適用服務 | 優先級 |
|---------|---------|---------|------------|---------|--------|
| **ASSOC-001 ~ ASSOC-010** | 品牌-促銷、通路-物流等 | SQL JOIN | 關聯學習 | BigQuery ML / Vertex AI | P2 |

**建議**：
- ✅ **使用 BigQuery ML**：學習品牌-促銷、通路-物流等關聯
- ✅ **訓練分類模型**：預測有效組合
- ✅ **規則生成**：自動生成關聯規則

**實作方式**：
```sql
-- 建立品牌-促銷關聯模型
CREATE MODEL `erp_backup.brand_promotion_association`
OPTIONS(
  model_type='logistic_reg',
  input_label_cols=['is_valid']
) AS
SELECT
  brand_id,
  promotion_id,
  CASE WHEN COUNT(*) > 10 THEN 1 ELSE 0 END AS is_valid
FROM `erp_backup.raw_orders`
GROUP BY brand_id, promotion_id;

-- 預測有效組合
SELECT
  brand_id,
  promotion_id,
  predicted_is_valid,
  predicted_is_valid_probs[OFFSET(0)].prob AS validity_probability
FROM ML.PREDICT(
  MODEL `erp_backup.brand_promotion_association`,
  (SELECT DISTINCT brand_id, promotion_id FROM `erp_backup.raw_orders`)
)
WHERE predicted_is_valid = 1;
```

### 3.5 時序邏輯規則（TEMP-001 ~ TEMP-004）

| 規則 ID | 規則名稱 | 當前方法 | GCP AI 方案 | 適用服務 | 優先級 |
|---------|---------|---------|------------|---------|--------|
| **TEMP-001 ~ TEMP-004** | 時序邏輯驗證 | 規則比對 | 時序異常檢測 | BigQuery ML | P2 |

**建議**：
- ✅ **使用 BigQuery ML**：建立時序異常檢測模型
- ✅ **時間序列分析**：檢測時間順序異常

---

## 4. 整合架構建議

### 4.1 整體架構設計

```
┌─────────────────────────────────────────────────────────┐
│          RagicEDP ETL + AI 整合架構                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Extract: Ragic API                                     │
│      ↓                                                 │
│  Transform: Cloud Function                             │
│      ├── Format Validation                             │
│      │   └── Cloud DLP (PII 檢測)                      │
│      │       • 電話號碼驗證 (FMT-001, FMT-002)         │
│      │       • Email 驗證 (FMT-003)                     │
│      │       • 統一編號驗證 (FMT-004)                   │
│      │                                                 │
│      ├── Entity Extraction                             │
│      │   └── Natural Language API (實體提取)           │
│      │       • 商品名稱實體提取 (PROD-002)             │
│      │       • 地址解析                                 │
│      │                                                 │
│      ├── Classification                                │
│      │   └── AutoML Tables (商品分類)                  │
│      │       • 活動詞識別 (PROD-001)                   │
│      │       • 商品類型分類                            │
│      │                                                 │
│      └── Anomaly Detection                             │
│          └── BigQuery ML (異常檢測)                    │
│              • 數值離群檢測 (NUM-001 ~ NUM-007)       │
│              • 金額一致性檢測 (NUM-008 ~ NUM-014)     │
│              • 時序異常檢測 (TEMP-001 ~ TEMP-004)     │
│      ↓                                                 │
│  Load: BigQuery                                         │
│      ├── raw_data                                      │
│      ├── staging                                       │
│      └── dwh                                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 整合流程

#### 4.2.1 格式驗證流程

```
輸入資料
    ↓
Cloud DLP 檢測 PII
    ├── 電話號碼檢測
    ├── Email 檢測
    └── 統一編號檢測
    ↓
標記驗證結果
    ├── 通過：繼續處理
    └── 失敗：標記異常，記錄錯誤
```

#### 4.2.2 實體提取流程

```
商品名稱
    ↓
Natural Language API 實體提取
    ├── 品牌提取
    ├── 系列提取
    └── 規格提取
    ↓
驗證提取結果
    ├── 與品牌表比對
    └── 標記缺失品牌
```

#### 4.2.3 異常檢測流程

```
載入資料到 BigQuery
    ↓
BigQuery ML 異常檢測
    ├── 數值離群檢測
    ├── 金額一致性檢測
    └── 時序異常檢測
    ↓
標記異常記錄
    ├── 記錄異常類型
    └── 記錄異常機率
```

### 4.3 整合點設計

#### 4.3.1 Cloud Function 整合點

```python
# src/ai_validator.py
from google.cloud import dlp_v2, language_v1
from google.cloud import bigquery

class AIValidator:
    """AI 驗證器"""
    
    def __init__(self):
        self.dlp_client = dlp_v2.DlpServiceClient()
        self.nl_client = language_v1.LanguageServiceClient()
        self.bq_client = bigquery.Client()
    
    def validate_format(self, field_value, field_type):
        """格式驗證（使用 Cloud DLP）"""
        # Cloud DLP 檢測邏輯
        pass
    
    def extract_entities(self, text):
        """實體提取（使用 Natural Language API）"""
        # Natural Language API 提取邏輯
        pass
    
    def detect_anomaly(self, record):
        """異常檢測（使用 BigQuery ML）"""
        # BigQuery ML 檢測邏輯
        pass
```

#### 4.3.2 BigQuery 整合點

```sql
-- 建立 AI 驗證結果表
CREATE TABLE `erp_backup.ai_validation_results` (
  record_id STRING NOT NULL,
  table_name STRING NOT NULL,
  field_name STRING NOT NULL,
  validation_type STRING NOT NULL,  -- 'format', 'entity', 'anomaly'
  validation_status STRING NOT NULL,  -- 'pass', 'fail', 'warning'
  ai_service STRING NOT NULL,  -- 'dlp', 'nl_api', 'bq_ml'
  confidence_score FLOAT64,
  validation_details JSON,
  validated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (record_id, table_name, field_name, validation_type)
)
PARTITION BY DATE(validated_at)
CLUSTER BY table_name, validation_type;
```

---

## 5. 實作範例

### 5.1 Cloud DLP 格式驗證範例

```python
from google.cloud import dlp_v2
import json

class DLPFormatValidator:
    """使用 Cloud DLP 進行格式驗證"""
    
    def __init__(self, project_id):
        self.client = dlp_v2.DlpServiceClient()
        self.project_id = project_id
        self.parent = f"projects/{project_id}"
    
    def validate_phone(self, phone_number):
        """驗證台灣手機號碼"""
        # 自訂檢測器：台灣手機號碼
        custom_info_type = {
            "info_type": {"name": "TAIWAN_MOBILE_PHONE"},
            "regex": {
                "pattern": r"^09\d{8}$|^\+?886\d{9,10}$|^09\d{2}-\d{3}-\d{3}$"
            },
            "likelihood": dlp_v2.Likelihood.VERY_LIKELY
        }
        
        inspect_config = {
            "custom_info_types": [custom_info_type],
            "min_likelihood": dlp_v2.Likelihood.POSSIBLE,
        }
        
        item = {"value": phone_number}
        response = self.client.inspect_content(
            request={
                "parent": self.parent,
                "inspect_config": inspect_config,
                "item": item
            }
        )
        
        findings = response.result.findings
        return {
            "is_valid": len(findings) > 0,
            "findings": [f.info_type.name for f in findings],
            "likelihood": findings[0].likelihood.name if findings else None
        }
    
    def validate_email(self, email):
        """驗證 Email"""
        inspect_config = {
            "info_types": [{"name": "EMAIL_ADDRESS"}],
            "min_likelihood": dlp_v2.Likelihood.POSSIBLE,
        }
        
        item = {"value": email}
        response = self.client.inspect_content(
            request={
                "parent": self.parent,
                "inspect_config": inspect_config,
                "item": item
            }
        )
        
        findings = response.result.findings
        return {
            "is_valid": len(findings) > 0,
            "findings": [f.info_type.name for f in findings]
        }
    
    def validate_tax_id(self, tax_id):
        """驗證台灣統一編號"""
        custom_info_type = {
            "info_type": {"name": "TAIWAN_TAX_ID"},
            "regex": {
                "pattern": r"^\d{8}$"
            },
            "likelihood": dlp_v2.Likelihood.VERY_LIKELY
        }
        
        inspect_config = {
            "custom_info_types": [custom_info_type],
            "min_likelihood": dlp_v2.Likelihood.POSSIBLE,
        }
        
        item = {"value": tax_id}
        response = self.client.inspect_content(
            request={
                "parent": self.parent,
                "inspect_config": inspect_config,
                "item": item
            }
        )
        
        findings = response.result.findings
        return {
            "is_valid": len(findings) > 0,
            "findings": [f.info_type.name for f in findings]
        }
```

### 5.2 Natural Language API 實體提取範例

```python
from google.cloud import language_v1

class NLEntityExtractor:
    """使用 Natural Language API 進行實體提取"""
    
    def __init__(self):
        self.client = language_v1.LanguageServiceClient()
    
    def extract_product_entities(self, product_name):
        """從商品名稱提取實體"""
        document = language_v1.Document(
            content=product_name,
            type_=language_v1.Document.Type.PLAIN_TEXT,
            language='zh-TW'
        )
        
        # 實體提取
        entities_response = self.client.analyze_entities(
            request={'document': document}
        )
        
        # 分類
        classify_response = self.client.classify_text(
            request={'document': document}
        )
        
        # 解析實體
        entities = {}
        for entity in entities_response.entities:
            if entity.type_ == language_v1.Entity.Type.ORGANIZATION:
                entities['brand'] = entity.name
            elif entity.type_ == language_v1.Entity.Type.OTHER:
                entities['product_type'] = entity.name
        
        # 解析分類
        categories = []
        for category in classify_response.categories:
            categories.append({
                "name": category.name,
                "confidence": category.confidence
            })
        
        return {
            "entities": entities,
            "categories": categories
        }
    
    def extract_address_entities(self, address):
        """從地址提取實體"""
        document = language_v1.Document(
            content=address,
            type_=language_v1.Document.Type.PLAIN_TEXT,
            language='zh-TW'
        )
        
        response = self.client.analyze_entities(
            request={'document': document}
        )
        
        address_parts = {}
        for entity in response.entities:
            if entity.type_ == language_v1.Entity.Type.LOCATION:
                address_parts['location'] = entity.name
            elif entity.type_ == language_v1.Entity.Type.ADDRESS:
                address_parts['address'] = entity.name
        
        return address_parts
```

### 5.3 BigQuery ML 異常檢測範例

```sql
-- 建立異常檢測模型
CREATE OR REPLACE MODEL `erp_backup.order_amount_anomaly`
OPTIONS(
  model_type='logistic_reg',
  input_label_cols=['is_anomaly'],
  auto_class_weights=true
) AS
SELECT
  order_amount,
  customer_id,
  brand_id,
  channel_id,
  payment_id,
  logistics_id,
  CASE 
    WHEN order_amount > 100000 THEN 1  -- 異常高
    WHEN order_amount < 100 THEN 1      -- 異常低
    ELSE 0 
  END AS is_anomaly
FROM `erp_backup.raw_orders`
WHERE order_amount IS NOT NULL
  AND order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);

-- 評估模型
SELECT
  *
FROM ML.EVALUATE(MODEL `erp_backup.order_amount_anomaly`);

-- 使用模型預測異常
CREATE OR REPLACE TABLE `erp_backup.anomaly_detection_results` AS
SELECT
  order_id,
  order_amount,
  customer_id,
  brand_id,
  predicted_is_anomaly,
  predicted_is_anomaly_probs[OFFSET(0)].prob AS anomaly_probability,
  CURRENT_TIMESTAMP() AS detected_at
FROM ML.PREDICT(
  MODEL `erp_backup.order_amount_anomaly`,
  (
    SELECT 
      order_id,
      order_amount,
      customer_id,
      brand_id,
      channel_id,
      payment_id,
      logistics_id
    FROM `erp_backup.raw_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  )
)
WHERE predicted_is_anomaly = 1
ORDER BY anomaly_probability DESC;
```

### 5.4 整合到 Cloud Function 範例

```python
from google.cloud import dlp_v2, language_v1, bigquery
import functions_framework

@functions_framework.cloud_event
def ragic_backup_with_ai(cloud_event):
    """Ragic 備份 Cloud Function（整合 AI 驗證）"""
    
    # 初始化 AI 服務
    dlp_validator = DLPFormatValidator(PROJECT_ID)
    nl_extractor = NLEntityExtractor()
    bq_client = bigquery.Client()
    
    # 從 Ragic API 取得資料
    records = fetch_from_ragic()
    
    # AI 驗證和處理
    validated_records = []
    for record in records:
        # 格式驗證
        if '行動電話' in record:
            phone_result = dlp_validator.validate_phone(record['行動電話'])
            if not phone_result['is_valid']:
                record['_validation_flags'] = record.get('_validation_flags', [])
                record['_validation_flags'].append('FMT-001')
        
        # 實體提取
        if '商品名稱' in record:
            entities = nl_extractor.extract_product_entities(record['商品名稱'])
            record['_extracted_brand'] = entities.get('entities', {}).get('brand')
            record['_extracted_categories'] = entities.get('categories', [])
        
        validated_records.append(record)
    
    # 載入 BigQuery
    upload_to_bigquery(validated_records)
    
    # 異常檢測（使用 BigQuery ML）
    detect_anomalies_with_bq_ml(bq_client)
    
    return {'status': 'success', 'records': len(validated_records)}

def detect_anomalies_with_bq_ml(bq_client):
    """使用 BigQuery ML 檢測異常"""
    query = """
    SELECT
      order_id,
      order_amount,
      predicted_is_anomaly,
      predicted_is_anomaly_probs[OFFSET(0)].prob AS anomaly_probability
    FROM ML.PREDICT(
      MODEL `erp_backup.order_amount_anomaly`,
      (SELECT * FROM `erp_backup.raw_orders` WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
    )
    WHERE predicted_is_anomaly = 1
    """
    
    results = bq_client.query(query).result()
    
    # 記錄異常結果
    anomalies = []
    for row in results:
        anomalies.append({
            'order_id': row.order_id,
            'order_amount': row.order_amount,
            'anomaly_probability': row.anomaly_probability
        })
    
    # 寫入異常結果表
    if anomalies:
        table_ref = bq_client.dataset('erp_backup').table('anomaly_detection_results')
        job = bq_client.load_table_from_json(anomalies, table_ref)
        job.result()
```

---

## 6. 成本估算

### 6.1 各服務成本估算

根據 [Google Cloud 定價](https://cloud.google.com/pricing)，估算如下：

| 服務 | 定價 | 專案使用量估算 | 月成本估算 | 年成本估算 |
|------|------|--------------|-----------|-----------|
| **Cloud DLP** | $1/GB（掃描） | 10GB/月 | $10 | $120 |
| **Natural Language API** | $1.50/1,000 次 | 100,000 次/月 | $150 | $1,800 |
| **BigQuery ML** | 包含在 BigQuery 中 | - | $0 | $0 |
| **AutoML Tables** | $20/小時（訓練） | 10 小時/月 | $200 | $2,400 |
| **Vertex AI** | $0.10/1,000 次（推論） | 100,000 次/月 | $10 | $120 |
| **Document AI** | $1.50/1,000 頁 | 10,000 頁/月 | $15 | $180 |
| **總計** | - | - | **$385/月** | **$4,620/年** |

### 6.2 分階段成本估算

#### 階段一：Cloud DLP 導入（P0）

| 服務 | 使用量 | 月成本 |
|------|--------|--------|
| **Cloud DLP** | 10GB/月 | $10 |
| **總計** | - | **$10/月** |

#### 階段二：Natural Language API + BigQuery ML（P1）

| 服務 | 使用量 | 月成本 |
|------|--------|--------|
| **Cloud DLP** | 10GB/月 | $10 |
| **Natural Language API** | 100,000 次/月 | $150 |
| **BigQuery ML** | 包含在 BigQuery 中 | $0 |
| **總計** | - | **$160/月** |

#### 階段三：完整 AI 整合（P2）

| 服務 | 使用量 | 月成本 |
|------|--------|--------|
| **Cloud DLP** | 10GB/月 | $10 |
| **Natural Language API** | 100,000 次/月 | $150 |
| **BigQuery ML** | 包含在 BigQuery 中 | $0 |
| **AutoML Tables** | 10 小時/月 | $200 |
| **Vertex AI** | 100,000 次/月 | $10 |
| **總計** | - | **$370/月** |

### 6.3 成本優化建議

**1. Cloud DLP 成本優化**
- 只掃描需要驗證的欄位
- 使用批次 API 減少 API 呼叫次數
- 快取檢測結果，避免重複檢測

**2. Natural Language API 成本優化**
- 批次處理，減少 API 呼叫次數
- 快取提取結果
- 只對需要提取的欄位使用 API

**3. BigQuery ML 成本優化**
- 使用 BigQuery ML（已包含在 BigQuery 中）
- 定期重新訓練模型，避免過度訓練
- 使用物化視圖快取預測結果

**4. AutoML Tables 成本優化**
- 只在需要時訓練模型
- 使用較小的訓練資料集
- 定期評估模型，避免不必要的重新訓練

---

## 7. 實施建議

### 7.1 實施優先級

#### P0（立即導入 - 1-2 週）

**Cloud DLP 格式驗證**

**目標**：
- 整合 Cloud DLP 進行格式驗證
- 驗證電話號碼、Email、統一編號

**任務**：
1. 建立 Cloud DLP 客戶端
2. 實作格式驗證函數
3. 整合到 Cloud Function
4. 測試驗證準確度

**預期效益**：
- 格式驗證準確度提升 5-10%
- 減少人工驗證時間 50%
- 月成本：$10

#### P1（短期導入 - 2-4 週）

**Natural Language API + BigQuery ML**

**目標**：
- 整合 Natural Language API 進行實體提取
- 使用 BigQuery ML 進行異常檢測

**任務**：
1. 整合 Natural Language API
2. 建立 BigQuery ML 異常檢測模型
3. 實作實體提取流程
4. 實作異常檢測流程

**預期效益**：
- 實體提取準確度提升 20-30%
- 異常檢測自動化率提升 40%
- 月成本：$160

#### P2（中期導入 - 4-8 週）

**AutoML Tables + Vertex AI**

**目標**：
- 建立 AutoML Tables 分類模型
- 訓練自訂 Vertex AI 模型

**任務**：
1. 準備訓練資料
2. 訓練 AutoML Tables 模型
3. 訓練 Vertex AI 自訂模型
4. 整合到 ETL 流程

**預期效益**：
- 分類準確度提升 30-40%
- 自動化率提升 60%
- 月成本：$370

### 7.2 實施步驟

#### 步驟 1：環境準備（第 1 週）

1. **啟用 GCP API**
   ```bash
   gcloud services enable dlp.googleapis.com
   gcloud services enable language.googleapis.com
   gcloud services enable aiplatform.googleapis.com
   ```

2. **建立 Service Account**
   ```bash
   gcloud iam service-accounts create ai-validator \
     --display-name="AI Validator Service Account"
   
   gcloud projects add-iam-policy-binding b25h01-ragic \
     --member="serviceAccount:ai-validator@b25h01-ragic.iam.gserviceaccount.com" \
     --role="roles/dlp.user"
   
   gcloud projects add-iam-policy-binding b25h01-ragic \
     --member="serviceAccount:ai-validator@b25h01-ragic.iam.gserviceaccount.com" \
     --role="roles/ml.developer"
   ```

3. **安裝 Python 套件**
   ```bash
   pip install google-cloud-dlp google-cloud-language google-cloud-aiplatform
   ```

#### 步驟 2：Cloud DLP 整合（第 2 週）

1. **實作格式驗證函數**
   - 電話號碼驗證
   - Email 驗證
   - 統一編號驗證

2. **整合到 Cloud Function**
   - 修改 `ragic_backup` Cloud Function
   - 加入格式驗證邏輯

3. **測試和驗證**
   - 測試驗證準確度
   - 測試效能影響

#### 步驟 3：Natural Language API 整合（第 3-4 週）

1. **實作實體提取函數**
   - 商品名稱實體提取
   - 地址解析

2. **整合到 ETL 流程**
   - 修改資料轉換邏輯
   - 加入實體提取步驟

3. **測試和驗證**
   - 測試提取準確度
   - 測試效能影響

#### 步驟 4：BigQuery ML 整合（第 4-5 週）

1. **建立異常檢測模型**
   - 數值離群檢測模型
   - 金額一致性檢測模型

2. **實作異常檢測流程**
   - 建立預測查詢
   - 記錄異常結果

3. **測試和驗證**
   - 測試檢測準確度
   - 測試效能影響

#### 步驟 5：AutoML Tables 整合（第 6-8 週）

1. **準備訓練資料**
   - 收集標記資料
   - 資料清理和準備

2. **訓練分類模型**
   - 建立 AutoML Tables 模型
   - 評估模型效能

3. **整合到 ETL 流程**
   - 使用模型進行分類
   - 記錄分類結果

### 7.3 風險與緩解

| 風險 | 影響 | 機率 | 緩解措施 |
|------|------|------|---------|
| **API 成本超支** | 中 | 中 | 設定預算告警，監控使用量 |
| **API 延遲** | 中 | 低 | 使用批次 API，非同步處理 |
| **準確度不足** | 高 | 低 | 充分測試，人工審核機制 |
| **中文支援問題** | 中 | 低 | 測試中文支援，必要時使用自訂模型 |

---

## 8. 優勢與限制

### 8.1 優勢

#### 8.1.1 技術優勢

- ✅ **預訓練模型**：開箱即用，無需訓練
- ✅ **高準確度**：Google 訓練的模型準確度高
- ✅ **易於整合**：REST API，易於整合到現有系統
- ✅ **可擴展性**：自動擴展，處理大規模資料

#### 8.1.2 業務優勢

- ✅ **自動化**：減少人工驗證時間
- ✅ **一致性**：統一的驗證標準
- ✅ **可追溯性**：記錄所有驗證結果
- ✅ **持續改進**：模型持續學習和改進

### 8.2 限制

#### 8.2.1 技術限制

- ⚠️ **成本考量**：API 呼叫費用
- ⚠️ **延遲**：API 呼叫增加處理時間
- ⚠️ **中文支援**：部分服務對繁體中文支援需驗證
- ⚠️ **自訂需求**：複雜需求可能需要自訂模型

#### 8.2.2 業務限制

- ⚠️ **訓練資料**：自訂模型需要標記的訓練資料
- ⚠️ **模型維護**：需要定期重新訓練模型
- ⚠️ **解釋性**：AI 模型決策過程可能不夠透明

### 8.3 建議

**短期建議**：
- ✅ 優先導入 Cloud DLP（成本低、準確度高）
- ✅ 測試 Natural Language API 中文支援
- ✅ 評估 BigQuery ML 異常檢測效果

**長期建議**：
- 🟡 根據需求考慮 AutoML Tables
- 🟡 評估自訂模型訓練需求
- 🟡 持續優化模型和流程

---

## 9. 結論與建議

### 9.1 核心結論

1. **GCP 提供完整的 AI 服務生態系統**：從格式驗證到異常檢測，涵蓋資料清洗的各個環節
2. **Cloud DLP 最適合格式驗證**：成本低、準確度高、易於整合
3. **BigQuery ML 最適合異常檢測**：無需資料移動、成本效益高
4. **Natural Language API 適合實體提取**：預訓練模型、支援繁體中文

### 9.2 具體建議

#### 9.2.1 立即行動（第 1-2 週）

1. **導入 Cloud DLP**
   - 整合電話號碼、Email、統一編號驗證
   - 測試驗證準確度
   - 評估成本效益

#### 9.2.2 短期行動（第 2-4 週）

1. **導入 Natural Language API**
   - 整合商品名稱實體提取
   - 測試中文支援
   - 評估提取準確度

2. **導入 BigQuery ML**
   - 建立異常檢測模型
   - 測試檢測效果
   - 整合到 ETL 流程

#### 9.2.3 中期行動（第 4-8 週）

1. **評估 AutoML Tables**
   - 準備訓練資料
   - 訓練分類模型
   - 評估模型效能

2. **持續優化**
   - 監控 AI 服務使用量
   - 優化成本結構
   - 改進模型準確度

### 9.3 技術選型建議

| 需求 | 推薦方案 | 理由 |
|------|---------|------|
| **格式驗證** | Cloud DLP | ✅ 成本低、準確度高、預建檢測器 |
| **實體提取** | Natural Language API | ✅ 預訓練模型、支援繁體中文 |
| **異常檢測** | BigQuery ML | ✅ 無需資料移動、成本效益高 |
| **分類** | AutoML Tables | 🟡 自動化 ML、高準確度 |
| **自訂模型** | Vertex AI | 🟡 靈活性高、需要 ML 知識 |

### 9.4 下一步行動

1. **立即行動**（第 1 週）
   - 啟用 Cloud DLP API
   - 實作格式驗證函數
   - 測試驗證準確度

2. **短期行動**（第 2-4 週）
   - 整合 Natural Language API
   - 建立 BigQuery ML 模型
   - 測試整合效果

3. **中期行動**（第 4-8 週）
   - 評估 AutoML Tables
   - 訓練自訂模型
   - 持續優化

---

## 10. 附錄

### 10.1 參考資料

- [Google Cloud DLP 文件](https://cloud.google.com/dlp/docs)
- [Natural Language API 文件](https://cloud.google.com/natural-language/docs)
- [BigQuery ML 文件](https://cloud.google.com/bigquery-ml/docs)
- [Vertex AI 文件](https://cloud.google.com/vertex-ai/docs)
- [AutoML Tables 文件](https://cloud.google.com/automl-tables/docs)

### 10.2 GCP AI 服務對照表

| 功能 | GCP 服務 | 適用場景 | 成本 |
|------|---------|---------|------|
| **PII 檢測** | Cloud DLP | 格式驗證 | $1/GB |
| **實體提取** | Natural Language API | 文字分析 | $1.50/1K 次 |
| **異常檢測** | BigQuery ML | 資料品質 | 包含在 BigQuery |
| **分類** | AutoML Tables | 結構化資料分類 | $20/小時 |
| **自訂模型** | Vertex AI | 複雜 ML 需求 | $0.10/1K 次 |

### 10.3 實作檢查清單

- [ ] 啟用 GCP AI API
- [ ] 建立 Service Account
- [ ] 安裝 Python 套件
- [ ] 實作 Cloud DLP 格式驗證
- [ ] 實作 Natural Language API 實體提取
- [ ] 建立 BigQuery ML 異常檢測模型
- [ ] 整合到 Cloud Function
- [ ] 測試驗證準確度
- [ ] 設定成本監控
- [ ] 建立文件和使用指南

---

**文件結束**

*建立時間: 2025-12-30*  
*版本: v1.0*  
*狀態: 完成*

