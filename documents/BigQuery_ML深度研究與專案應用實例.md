# BigQuery ML 深度研究與專案應用實例

**版本**: v1.0  
**建立日期**: 2025-12-30  
**專案**: RagicEDP 資料平台  
**基於**: 資料清洗規則定義_v1.md、GCP_AI服務用於資料判別研究報告.md

---

## 目錄

1. [執行摘要](#1-執行摘要)
2. [BigQuery ML 核心概念](#2-bigquery-ml-核心概念)
3. [支援的模型類型](#3-支援的模型類型)
4. [專案應用實例](#4-專案應用實例)
5. [特徵工程與預處理](#5-特徵工程與預處理)
6. [模型評估與優化](#6-模型評估與優化)
7. [部署與預測](#7-部署與預測)
8. [整合到 ETL 流程](#8-整合到-etl-流程)
9. [成本與效能考量](#9-成本與效能考量)
10. [最佳實踐](#10-最佳實踐)
11. [結論與建議](#11-結論與建議)

---

## 1. 執行摘要

### 1.1 研究目的

本報告深入研究 BigQuery ML 在 RagicEDP 專案資料清洗流程中的應用，提供具體的實作範例和整合方案。

### 1.2 關鍵發現

| 應用場景 | BigQuery ML 方案 | 模型類型 | 專案規則對應 | 優先級 |
|---------|----------------|---------|-------------|--------|
| **數值離群檢測** | 異常檢測模型 | `boosted_tree_classifier` | NUM-001 ~ NUM-007 | P1 |
| **金額一致性檢測** | 邏輯迴歸模型 | `logistic_reg` | NUM-008 ~ NUM-014 | P1 |
| **關聯規則學習** | 關聯預測模型 | `logistic_reg` / `matrix_factorization` | ASSOC-001 ~ ASSOC-010 | P2 |
| **時序異常檢測** | ARIMA 時間序列 | `arima_plus` | TEMP-001 ~ TEMP-004 | P2 |
| **資料品質評分** | 分類模型 | `boosted_tree_classifier` | 整體品質評估 | P2 |

### 1.3 核心優勢

- ✅ **SQL 語法**：無需學習 Python/ML 框架
- ✅ **無需資料移動**：直接在 BigQuery 中訓練和推論
- ✅ **大規模處理**：可處理 PB 級資料
- ✅ **成本效益**：包含在 BigQuery 查詢費用中
- ✅ **自動化**：自動特徵工程和超參數調優

---

## 2. BigQuery ML 核心概念

### 2.1 什麼是 BigQuery ML

BigQuery ML 是 Google Cloud 平台上的服務，允許使用者直接在 BigQuery 中使用標準 SQL 語法建立和執行機器學習模型。這使得資料分析師和工程師無需掌握複雜的程式語言或機器學習框架，即可進行模型訓練和預測。

### 2.2 核心特點

| 特點 | 說明 | 優勢 |
|------|------|------|
| **SQL 整合** | 使用標準 SQL 語法 | 降低學習門檻，資料分析師可直接使用 |
| **無縫資料整合** | 模型直接在 BigQuery 中運行 | 無需資料移動，減少複雜性 |
| **多種模型支援** | 支援 10+ 種模型類型 | 滿足不同業務需求 |
| **可擴展性** | 利用 BigQuery 分散式架構 | 處理大規模資料集 |
| **成本效益** | 包含在 BigQuery 查詢費用中 | 無需額外基礎設施投入 |

### 2.3 基本語法

```sql
-- 建立模型
CREATE OR REPLACE MODEL `project.dataset.model_name`
OPTIONS(model_type='model_type') AS
SELECT
  feature1,
  feature2,
  target
FROM `project.dataset.table_name`;

-- 評估模型
SELECT * FROM ML.EVALUATE(MODEL `project.dataset.model_name`);

-- 預測
SELECT * FROM ML.PREDICT(
  MODEL `project.dataset.model_name`,
  (SELECT * FROM `project.dataset.new_data`)
);
```

---

## 3. 支援的模型類型

### 3.1 分類模型

| 模型類型 | 用途 | 適用場景 | RagicEDP 應用 |
|---------|------|---------|-------------|
| **logistic_reg** | 二元/多元分類 | 異常檢測、關聯預測 | NUM-001 ~ NUM-007, ASSOC-001 ~ ASSOC-010 |
| **boosted_tree_classifier** | 高準確度分類 | 複雜異常檢測 | NUM-001 ~ NUM-007 |
| **dnn_classifier** | 深度學習分類 | 複雜模式識別 | 商品分類、資料品質評分 |
| **automl_classifier** | 自動化分類 | 快速原型開發 | 商品分類 |

### 3.2 迴歸模型

| 模型類型 | 用途 | 適用場景 | RagicEDP 應用 |
|---------|------|---------|-------------|
| **linear_reg** | 線性迴歸 | 數值預測 | 訂單金額預測 |
| **boosted_tree_regressor** | 梯度提升迴歸 | 高準確度預測 | 數值預測 |
| **dnn_regressor** | 深度學習迴歸 | 複雜模式預測 | 複雜數值預測 |
| **automl_regressor** | 自動化迴歸 | 快速原型開發 | 數值預測 |

### 3.3 其他模型

| 模型類型 | 用途 | 適用場景 | RagicEDP 應用 |
|---------|------|---------|-------------|
| **kmeans** | K-means 聚類 | 分群分析 | 客戶分群、商品分類 |
| **matrix_factorization** | 矩陣分解 | 推薦系統 | 品牌-促銷推薦 |
| **arima_plus** | ARIMA 時間序列 | 時序預測與異常檢測 | TEMP-001 ~ TEMP-004 |

---

## 4. 專案應用實例

### 4.1 實例一：數量範圍異常檢測（NUM-001）

#### 4.1.1 業務背景

根據《資料清洗規則定義_v1.md》：
- **規則 ID**: NUM-001
- **適用表格**: 99_訂單明細表
- **適用欄位**: 數量
- **合理範圍**: 1 ~ 4（基於 IQR）
- **極端範圍**: 0 ~ 100（業務允許）
- **統計基線**: 中位數 1, 平均 3, 最大 3,640
- **歷史離群率**: 17.09%

#### 4.1.2 BigQuery ML 實作

**步驟 1：建立異常檢測模型**

```sql
-- 建立數量異常檢測模型
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_outlier'],
  auto_class_weights=true,
  max_iterations=50,
  learn_rate=0.1,
  early_stop=true
) AS
SELECT
  -- 基礎特徵
  quantity,
  order_amount,
  product_id,
  brand_id,
  channel_id,
  
  -- 統計特徵（視窗函數）
  AVG(quantity) OVER (PARTITION BY product_id) AS avg_product_quantity,
  STDDEV(quantity) OVER (PARTITION BY product_id) AS std_product_quantity,
  AVG(quantity) OVER (PARTITION BY brand_id) AS avg_brand_quantity,
  
  -- Z-Score
  (quantity - AVG(quantity) OVER (PARTITION BY product_id)) / 
    NULLIF(STDDEV(quantity) OVER (PARTITION BY product_id), 0) AS z_score_product,
  
  -- 衍生特徵
  order_amount / NULLIF(quantity, 0) AS avg_item_price,
  CASE WHEN quantity = 0 THEN 1 ELSE 0 END AS is_zero,
  CASE WHEN quantity > 100 THEN 1 ELSE 0 END AS is_bulk,
  
  -- 標籤（基於 IQR 和業務規則）
  CASE 
    -- 極端異常：負數或超大值
    WHEN quantity < 0 OR quantity > 1000 THEN 1
    -- IQR 異常：超出合理範圍
    WHEN quantity < 1 OR quantity > 4 THEN 1
    -- Z-Score 異常：超過 3 個標準差
    WHEN ABS((quantity - AVG(quantity) OVER (PARTITION BY product_id)) / 
             NULLIF(STDDEV(quantity) OVER (PARTITION BY product_id), 0)) > 3 THEN 1
    ELSE 0
  END AS is_outlier
  
FROM `b25h01-ragic.erp_backup.raw_orders`
WHERE quantity IS NOT NULL
  AND order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND order_date < CURRENT_DATE();
```

**步驟 2：評估模型**

```sql
-- 評估模型效能
SELECT
  accuracy,
  precision,
  recall,
  f1_score,
  roc_auc,
  log_loss,
  confusion_matrix
FROM ML.EVALUATE(MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`);

-- 查看 ROC 曲線
SELECT
  *
FROM ML.ROC_CURVE(MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`);

-- 查看混淆矩陣
SELECT
  *
FROM ML.CONFUSION_MATRIX(MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`);
```

**步驟 3：使用模型預測異常**

```sql
-- 預測新資料中的異常
CREATE OR REPLACE TABLE `b25h01-ragic.erp_backup.quantity_anomaly_results` AS
SELECT
  order_id,
  _ragicId,
  quantity,
  order_amount,
  product_id,
  brand_id,
  channel_id,
  predicted_is_outlier,
  predicted_is_outlier_probs[OFFSET(0)].prob AS outlier_probability,
  predicted_is_outlier_probs[OFFSET(1)].prob AS normal_probability,
  CURRENT_TIMESTAMP() AS detected_at
FROM ML.PREDICT(
  MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`,
  (
    SELECT 
      order_id,
      _ragicId,
      quantity,
      order_amount,
      product_id,
      brand_id,
      channel_id,
      AVG(quantity) OVER (PARTITION BY product_id) AS avg_product_quantity,
      STDDEV(quantity) OVER (PARTITION BY product_id) AS std_product_quantity,
      AVG(quantity) OVER (PARTITION BY brand_id) AS avg_brand_quantity,
      (quantity - AVG(quantity) OVER (PARTITION BY product_id)) / 
        NULLIF(STDDEV(quantity) OVER (PARTITION BY product_id), 0) AS z_score_product,
      order_amount / NULLIF(quantity, 0) AS avg_item_price,
      CASE WHEN quantity = 0 THEN 1 ELSE 0 END AS is_zero,
      CASE WHEN quantity > 100 THEN 1 ELSE 0 END AS is_bulk
    FROM `b25h01-ragic.erp_backup.raw_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      AND quantity IS NOT NULL
  )
)
WHERE predicted_is_outlier = 1
ORDER BY outlier_probability DESC;
```

**步驟 4：查詢異常結果**

```sql
-- 查詢異常記錄
SELECT
  order_id,
  quantity,
  order_amount,
  product_id,
  brand_id,
  outlier_probability,
  CASE 
    WHEN quantity = 0 THEN '數量為零（可能為取消或贈品）'
    WHEN quantity > 100 THEN '數量過大（可能為批發或團購）'
    WHEN quantity < 0 THEN '數量為負數（資料錯誤）'
    ELSE '數量超出合理範圍'
  END AS anomaly_reason
FROM `b25h01-ragic.erp_backup.quantity_anomaly_results`
WHERE outlier_probability > 0.7  -- 高信心異常
ORDER BY outlier_probability DESC;
```

### 4.2 實例二：訂單金額異常檢測（NUM-002）

#### 4.2.1 業務背景

- **規則 ID**: NUM-002
- **適用表格**: 99_訂單明細表
- **適用欄位**: 訂單實收
- **合理範圍**: 0 ~ 3,384（基於 IQR）
- **極端範圍**: -500 ~ 50,000（業務允許）
- **統計基線**: 中位數 1,584, 平均 2,744, 最大 321,370
- **歷史離群率**: 8.11%

#### 4.2.2 BigQuery ML 實作

```sql
-- 建立訂單金額異常檢測模型
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.order_amount_anomaly_model`
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_anomaly'],
  auto_class_weights=true,
  max_iterations=50,
  learn_rate=0.1
) AS
SELECT
  -- 基礎特徵
  order_amount AS 訂單實收,
  quantity AS 數量,
  customer_id AS 客戶編號,
  brand_id AS 品牌編號,
  channel_id AS 通路編號,
  payment_id AS 金流編號,
  logistics_id AS 物流編號,
  shipping_fee AS 運費,
  
  -- 統計特徵
  AVG(order_amount) OVER (PARTITION BY customer_id) AS avg_customer_order,
  AVG(order_amount) OVER (PARTITION BY brand_id) AS avg_brand_order,
  AVG(order_amount) OVER (PARTITION BY channel_id) AS avg_channel_order,
  STDDEV(order_amount) OVER (PARTITION BY customer_id) AS std_customer_order,
  
  -- Z-Score
  (order_amount - AVG(order_amount) OVER (PARTITION BY customer_id)) / 
    NULLIF(STDDEV(order_amount) OVER (PARTITION BY customer_id), 0) AS z_score_customer,
  
  -- 衍生特徵
  order_amount / NULLIF(quantity, 0) AS avg_item_price,
  CASE WHEN shipping_fee > 0 THEN 1 ELSE 0 END AS has_shipping,
  CASE WHEN order_amount < 0 THEN 1 ELSE 0 END AS is_negative,
  CASE WHEN order_amount = 0 THEN 1 ELSE 0 END AS is_zero,
  
  -- 標籤（基於業務規則和統計）
  CASE 
    -- 極端異常
    WHEN order_amount > 100000 THEN 1  -- 異常高
    WHEN order_amount < -500 THEN 1    -- 異常負數
    -- IQR 異常
    WHEN order_amount < 0 OR order_amount > 3384 THEN 1
    -- Z-Score 異常
    WHEN ABS((order_amount - AVG(order_amount) OVER (PARTITION BY customer_id)) / 
             NULLIF(STDDEV(order_amount) OVER (PARTITION BY customer_id), 0)) > 3 THEN 1
    ELSE 0
  END AS is_anomaly
  
FROM `b25h01-ragic.erp_backup.raw_orders`
WHERE order_amount IS NOT NULL
  AND order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND order_date < CURRENT_DATE();

-- 使用模型預測
SELECT
  order_id,
  _ragicId,
  訂單實收,
  客戶編號,
  品牌編號,
  predicted_is_anomaly,
  predicted_is_anomaly_probs[OFFSET(0)].prob AS anomaly_probability,
  CASE 
    WHEN 訂單實收 < 0 THEN '負數（可能為退款記錄）'
    WHEN 訂單實收 = 0 THEN '零值（可能為贈品或促銷）'
    WHEN 訂單實收 > 100000 THEN '金額異常高'
    ELSE '金額超出合理範圍'
  END AS anomaly_reason
FROM ML.PREDICT(
  MODEL `b25h01-ragic.erp_backup.order_amount_anomaly_model`,
  (
    SELECT 
      order_amount AS 訂單實收,
      quantity AS 數量,
      customer_id AS 客戶編號,
      brand_id AS 品牌編號,
      channel_id AS 通路編號,
      payment_id AS 金流編號,
      logistics_id AS 物流編號,
      shipping_fee AS 運費,
      AVG(order_amount) OVER (PARTITION BY customer_id) AS avg_customer_order,
      AVG(order_amount) OVER (PARTITION BY brand_id) AS avg_brand_order,
      AVG(order_amount) OVER (PARTITION BY channel_id) AS avg_channel_order,
      STDDEV(order_amount) OVER (PARTITION BY customer_id) AS std_customer_order,
      (order_amount - AVG(order_amount) OVER (PARTITION BY customer_id)) / 
        NULLIF(STDDEV(order_amount) OVER (PARTITION BY customer_id), 0) AS z_score_customer,
      order_amount / NULLIF(quantity, 0) AS avg_item_price,
      CASE WHEN shipping_fee > 0 THEN 1 ELSE 0 END AS has_shipping,
      CASE WHEN order_amount < 0 THEN 1 ELSE 0 END AS is_negative,
      CASE WHEN order_amount = 0 THEN 1 ELSE 0 END AS is_zero
    FROM `b25h01-ragic.erp_backup.raw_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  )
)
WHERE predicted_is_anomaly = 1
ORDER BY anomaly_probability DESC;
```

### 4.3 實例三：品牌-促銷關聯規則學習（ASSOC-003）

#### 4.3.1 業務背景

- **規則 ID**: ASSOC-003
- **描述**: 品牌可使用的促銷活動
- **檢查方式**: 驗證品牌-促銷組合是否在歷史允許清單
- **歷史組合數**: 63 種（7 個品牌）
- **錯誤處理**: 新組合標記為待確認

#### 4.3.2 BigQuery ML 實作

```sql
-- 建立品牌-促銷關聯模型
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.brand_promotion_association_model`
OPTIONS(
  model_type='logistic_reg',
  input_label_cols=['is_valid'],
  auto_class_weights=true
) AS
SELECT
  -- 基礎特徵
  brand_id AS 品牌編號,
  promotion_id AS 促銷編號,
  channel_id AS 通路編號,
  
  -- 歷史統計特徵
  COUNT(*) OVER (PARTITION BY brand_id, promotion_id) AS historical_count,
  COUNT(DISTINCT customer_id) OVER (PARTITION BY brand_id, promotion_id) AS unique_customers,
  AVG(order_amount) OVER (PARTITION BY brand_id, promotion_id) AS avg_order_amount,
  MIN(order_date) OVER (PARTITION BY brand_id, promotion_id) AS first_seen_date,
  MAX(order_date) OVER (PARTITION BY brand_id, promotion_id) AS last_seen_date,
  
  -- 時間特徵
  DATE_DIFF(CURRENT_DATE(), MAX(order_date) OVER (PARTITION BY brand_id, promotion_id), DAY) AS days_since_last_seen,
  
  -- 品牌統計
  COUNT(DISTINCT promotion_id) OVER (PARTITION BY brand_id) AS brand_promotion_count,
  
  -- 促銷統計
  COUNT(DISTINCT brand_id) OVER (PARTITION BY promotion_id) AS promotion_brand_count,
  
  -- 標籤（基於歷史出現次數和時間）
  CASE 
    WHEN COUNT(*) OVER (PARTITION BY brand_id, promotion_id) > 10 THEN 1  -- 出現次數多，視為有效
    WHEN COUNT(*) OVER (PARTITION BY brand_id, promotion_id) > 0 
         AND DATE_DIFF(CURRENT_DATE(), MAX(order_date) OVER (PARTITION BY brand_id, promotion_id), DAY) < 180 THEN 1  -- 最近出現過
    ELSE 0
  END AS is_valid
  
FROM `b25h01-ragic.erp_backup.raw_orders`
WHERE brand_id IS NOT NULL
  AND promotion_id IS NOT NULL
  AND order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY);

-- 預測新組合的有效性
CREATE OR REPLACE TABLE `b25h01-ragic.erp_backup.brand_promotion_validation_results` AS
SELECT
  brand_id AS 品牌編號,
  promotion_id AS 促銷編號,
  channel_id AS 通路編號,
  predicted_is_valid,
  predicted_is_valid_probs[OFFSET(0)].prob AS validity_probability,
  historical_count,
  unique_customers,
  days_since_last_seen,
  CASE 
    WHEN predicted_is_valid = 0 AND historical_count = 0 THEN '新組合：歷史上從未出現'
    WHEN predicted_is_valid = 0 AND days_since_last_seen > 180 THEN '舊組合：超過 180 天未使用'
    WHEN predicted_is_valid = 0 THEN '組合異常：出現次數過少'
    ELSE '組合有效'
  END AS validation_status,
  CURRENT_TIMESTAMP() AS validated_at
FROM ML.PREDICT(
  MODEL `b25h01-ragic.erp_backup.brand_promotion_association_model`,
  (
    SELECT DISTINCT
      brand_id AS 品牌編號,
      promotion_id AS 促銷編號,
      channel_id AS 通路編號,
      COUNT(*) OVER (PARTITION BY brand_id, promotion_id) AS historical_count,
      COUNT(DISTINCT customer_id) OVER (PARTITION BY brand_id, promotion_id) AS unique_customers,
      AVG(order_amount) OVER (PARTITION BY brand_id, promotion_id) AS avg_order_amount,
      MIN(order_date) OVER (PARTITION BY brand_id, promotion_id) AS first_seen_date,
      MAX(order_date) OVER (PARTITION BY brand_id, promotion_id) AS last_seen_date,
      DATE_DIFF(CURRENT_DATE(), MAX(order_date) OVER (PARTITION BY brand_id, promotion_id), DAY) AS days_since_last_seen,
      COUNT(DISTINCT promotion_id) OVER (PARTITION BY brand_id) AS brand_promotion_count,
      COUNT(DISTINCT brand_id) OVER (PARTITION BY promotion_id) AS promotion_brand_count
    FROM `b25h01-ragic.erp_backup.raw_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      AND brand_id IS NOT NULL
      AND promotion_id IS NOT NULL
  )
)
WHERE predicted_is_valid = 0  -- 只關注無效組合
ORDER BY validity_probability ASC, historical_count ASC;
```

### 4.4 實例四：時序異常檢測（TEMP-001）

#### 4.4.1 業務背景

- **規則 ID**: TEMP-001
- **適用表格**: 50_訂單表, 60_客戶表
- **檢查公式**: 建立日期 <= 最後修改日期
- **歷史違規率**: 0.18%（153 筆訂單）

#### 4.4.2 BigQuery ML 實作

```sql
-- 建立時序異常檢測模型（使用 ARIMA）
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.temporal_anomaly_model`
OPTIONS(
  model_type='arima_plus',
  time_series_timestamp_col='order_date',
  time_series_data_col='daily_order_count',
  auto_ar=true,
  auto_ar_max_order=5,
  auto_diff=true,
  auto_arima=true,
  holiday_region='TW'
) AS
SELECT
  DATE(order_date) AS order_date,
  COUNT(*) AS daily_order_count
FROM `b25h01-ragic.erp_backup.raw_orders`
WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)
  AND order_date < CURRENT_DATE()
GROUP BY DATE(order_date)
ORDER BY order_date;

-- 使用 ARIMA 預測並檢測異常
SELECT
  order_date,
  forecast_value,
  prediction_interval_lower_bound,
  prediction_interval_upper_bound,
  daily_order_count,
  CASE 
    WHEN daily_order_count < prediction_interval_lower_bound OR 
         daily_order_count > prediction_interval_upper_bound THEN 1
    ELSE 0
  END AS is_anomaly,
  ABS(daily_order_count - forecast_value) AS deviation
FROM ML.FORECAST(
  MODEL `b25h01-ragic.erp_backup.temporal_anomaly_model`,
  STRUCT(30 AS horizon, 0.8 AS confidence_level)
)
WHERE is_anomaly = 1
ORDER BY deviation DESC;

-- 建立時序邏輯異常檢測模型（使用邏輯迴歸）
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.temporal_logic_anomaly_model`
OPTIONS(
  model_type='logistic_reg',
  input_label_cols=['is_anomaly']
) AS
SELECT
  -- 時間差特徵
  TIMESTAMP_DIFF(last_modified_date, created_date, DAY) AS days_between_create_modify,
  TIMESTAMP_DIFF(order_date, created_date, DAY) AS days_between_create_order,
  
  -- 日期特徵
  EXTRACT(DAYOFWEEK FROM created_date) AS create_day_of_week,
  EXTRACT(DAYOFWEEK FROM last_modified_date) AS modify_day_of_week,
  EXTRACT(HOUR FROM created_date) AS create_hour,
  EXTRACT(HOUR FROM last_modified_date) AS modify_hour,
  
  -- 標籤（建立日期不應晚於修改日期）
  CASE 
    WHEN created_date > last_modified_date THEN 1  -- 時序邏輯錯誤
    WHEN TIMESTAMP_DIFF(last_modified_date, created_date, DAY) > 365 THEN 1  -- 時間差過大
    ELSE 0
  END AS is_anomaly
  
FROM `b25h01-ragic.erp_backup.raw_orders`
WHERE created_date IS NOT NULL
  AND last_modified_date IS NOT NULL
  AND order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);
```

### 4.5 實例五：金額一致性檢測（NUM-008 ~ NUM-014）

#### 4.5.1 業務背景

- **規則 ID**: NUM-008 ~ NUM-014
- **檢查項目**: 訂單金額一致、含運金額一致、實收合理性等
- **狀態**: 待實作

#### 4.5.2 BigQuery ML 實作

```sql
-- 建立金額一致性檢測模型
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.amount_consistency_model`
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_inconsistent'],
  auto_class_weights=true
) AS
SELECT
  -- 基礎金額欄位
  order_amount AS 訂單實收,
  shipping_fee AS 運費,
  total_amount AS 含運實收,
  detail_sum AS 明細合計,
  product_msrp AS 商品建議售價,
  product_regular_price AS 商品常態售價,
  quantity AS 數量,
  
  -- 計算欄位
  order_amount + shipping_fee AS calculated_total,
  product_msrp * quantity AS expected_amount,
  order_amount / NULLIF(quantity, 0) AS avg_item_price,
  
  -- 差異計算
  ABS(order_amount - detail_sum) AS detail_diff,
  ABS(total_amount - (order_amount + shipping_fee)) AS shipping_diff,
  ABS(order_amount - (product_msrp * quantity)) AS price_diff,
  
  -- 比例計算
  CASE 
    WHEN detail_sum > 0 THEN ABS(order_amount - detail_sum) / detail_sum
    ELSE 0
  END AS detail_diff_ratio,
  
  -- 標籤（基於業務規則）
  CASE 
    -- NUM-008: 訂單金額一致
    WHEN ABS(order_amount - detail_sum) > 1 AND detail_sum > 0 THEN 1
    -- NUM-009: 含運金額一致
    WHEN ABS(total_amount - (order_amount + shipping_fee)) > 1 THEN 1
    -- NUM-010: 實收合理性
    WHEN order_amount > (product_msrp * quantity * 1.1) THEN 1  -- 實收超過建議售價 10%
    -- NUM-011: 折扣合理性
    WHEN (product_msrp * quantity - order_amount) > (product_msrp * quantity * 0.5) THEN 1  -- 折扣超過 50%
    ELSE 0
  END AS is_inconsistent
  
FROM (
  SELECT 
    o.order_amount,
    o.shipping_fee,
    o.total_amount,
    o.product_msrp,
    o.product_regular_price,
    o.quantity,
    SUM(d.order_amount) AS detail_sum
  FROM `b25h01-ragic.erp_backup.raw_orders` o
  LEFT JOIN `b25h01-ragic.erp_backup.raw_order_details` d
    ON o.order_id = d.order_id
  WHERE o.order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  GROUP BY o.order_id, o.order_amount, o.shipping_fee, o.total_amount, 
           o.product_msrp, o.product_regular_price, o.quantity
)
WHERE order_amount IS NOT NULL
  AND quantity IS NOT NULL;

-- 使用模型檢測金額不一致
SELECT
  order_id,
  訂單實收,
  含運實收,
  明細合計,
  運費,
  calculated_total,
  detail_diff,
  shipping_diff,
  predicted_is_inconsistent,
  predicted_is_inconsistent_probs[OFFSET(0)].prob AS inconsistency_probability,
  CASE 
    WHEN detail_diff > 1 THEN '訂單金額與明細合計不一致'
    WHEN shipping_diff > 1 THEN '含運金額計算不一致'
    WHEN price_diff > (product_msrp * quantity * 0.1) THEN '實收與建議售價差異過大'
    ELSE '其他金額不一致'
  END AS inconsistency_reason
FROM ML.PREDICT(
  MODEL `b25h01-ragic.erp_backup.amount_consistency_model`,
  (
    SELECT 
      o.order_id,
      o.order_amount AS 訂單實收,
      o.shipping_fee AS 運費,
      o.total_amount AS 含運實收,
      o.product_msrp AS 商品建議售價,
      o.product_regular_price AS 商品常態售價,
      o.quantity AS 數量,
      SUM(d.order_amount) AS detail_sum,
      o.order_amount + o.shipping_fee AS calculated_total,
      ABS(o.order_amount - SUM(d.order_amount)) AS detail_diff,
      ABS(o.total_amount - (o.order_amount + o.shipping_fee)) AS shipping_diff,
      ABS(o.order_amount - (o.product_msrp * o.quantity)) AS price_diff,
      CASE 
        WHEN SUM(d.order_amount) > 0 THEN ABS(o.order_amount - SUM(d.order_amount)) / SUM(d.order_amount)
        ELSE 0
      END AS detail_diff_ratio,
      o.product_msrp * o.quantity AS expected_amount,
      o.order_amount / NULLIF(o.quantity, 0) AS avg_item_price
    FROM `b25h01-ragic.erp_backup.raw_orders` o
    LEFT JOIN `b25h01-ragic.erp_backup.raw_order_details` d
      ON o.order_id = d.order_id
    WHERE o.order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    GROUP BY o.order_id, o.order_amount, o.shipping_fee, o.total_amount, 
             o.product_msrp, o.product_regular_price, o.quantity
  )
)
WHERE predicted_is_inconsistent = 1
ORDER BY inconsistency_probability DESC;
```

### 4.6 實例六：通路-物流關聯規則學習（ASSOC-005）

#### 4.6.1 業務背景

- **規則 ID**: ASSOC-005
- **描述**: 通路可使用的物流方式
- **歷史組合數**: 673 種（372 個通路）
- **錯誤處理**: 新組合標記為待確認

#### 4.6.2 BigQuery ML 實作

```sql
-- 建立通路-物流關聯模型
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.channel_logistics_association_model`
OPTIONS(
  model_type='logistic_reg',
  input_label_cols=['is_valid'],
  auto_class_weights=true
) AS
SELECT
  -- 基礎特徵
  channel_id AS 通路編號,
  logistics_id AS 物流編號,
  postal_code AS 郵遞區號,
  
  -- 歷史統計特徵
  COUNT(*) OVER (PARTITION BY channel_id, logistics_id) AS historical_count,
  COUNT(DISTINCT customer_id) OVER (PARTITION BY channel_id, logistics_id) AS unique_customers,
  AVG(order_amount) OVER (PARTITION BY channel_id, logistics_id) AS avg_order_amount,
  MIN(order_date) OVER (PARTITION BY channel_id, logistics_id) AS first_seen_date,
  MAX(order_date) OVER (PARTITION BY channel_id, logistics_id) AS last_seen_date,
  
  -- 通路統計
  COUNT(DISTINCT logistics_id) OVER (PARTITION BY channel_id) AS channel_logistics_count,
  
  -- 物流統計
  COUNT(DISTINCT channel_id) OVER (PARTITION BY logistics_id) AS logistics_channel_count,
  
  -- 區域統計
  COUNT(*) OVER (PARTITION BY channel_id, logistics_id, postal_code) AS region_count,
  
  -- 標籤
  CASE 
    WHEN COUNT(*) OVER (PARTITION BY channel_id, logistics_id) > 10 THEN 1
    WHEN COUNT(*) OVER (PARTITION BY channel_id, logistics_id) > 0 
         AND DATE_DIFF(CURRENT_DATE(), MAX(order_date) OVER (PARTITION BY channel_id, logistics_id), DAY) < 180 THEN 1
    ELSE 0
  END AS is_valid
  
FROM `b25h01-ragic.erp_backup.raw_orders`
WHERE channel_id IS NOT NULL
  AND logistics_id IS NOT NULL
  AND order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 180 DAY);

-- 預測新組合的有效性
SELECT
  通路編號,
  物流編號,
  郵遞區號,
  predicted_is_valid,
  predicted_is_valid_probs[OFFSET(0)].prob AS validity_probability,
  historical_count,
  CASE 
    WHEN predicted_is_valid = 0 AND historical_count = 0 THEN '新組合：歷史上從未出現'
    WHEN predicted_is_valid = 0 THEN '組合異常：出現次數過少或過久未使用'
    ELSE '組合有效'
  END AS validation_status
FROM ML.PREDICT(
  MODEL `b25h01-ragic.erp_backup.channel_logistics_association_model`,
  (
    SELECT DISTINCT
      channel_id AS 通路編號,
      logistics_id AS 物流編號,
      postal_code AS 郵遞區號,
      COUNT(*) OVER (PARTITION BY channel_id, logistics_id) AS historical_count,
      COUNT(DISTINCT customer_id) OVER (PARTITION BY channel_id, logistics_id) AS unique_customers,
      AVG(order_amount) OVER (PARTITION BY channel_id, logistics_id) AS avg_order_amount,
      MIN(order_date) OVER (PARTITION BY channel_id, logistics_id) AS first_seen_date,
      MAX(order_date) OVER (PARTITION BY channel_id, logistics_id) AS last_seen_date,
      COUNT(DISTINCT logistics_id) OVER (PARTITION BY channel_id) AS channel_logistics_count,
      COUNT(DISTINCT channel_id) OVER (PARTITION BY logistics_id) AS logistics_channel_count,
      COUNT(*) OVER (PARTITION BY channel_id, logistics_id, postal_code) AS region_count
    FROM `b25h01-ragic.erp_backup.raw_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      AND channel_id IS NOT NULL
      AND logistics_id IS NOT NULL
  )
)
WHERE predicted_is_valid = 0
ORDER BY validity_probability ASC;
```

### 4.7 實例七：商品價格合理性檢測（NUM-004, NUM-005）

#### 4.7.1 業務背景

- **規則 ID**: NUM-004, NUM-005
- **適用欄位**: 商品建議售價、商品常態售價
- **合理範圍**: 16 ~ 308（建議售價）、0 ~ 318（常態售價）
- **歷史離群率**: 15.75%（建議售價）、15.03%（常態售價）

#### 4.7.2 BigQuery ML 實作

```sql
-- 建立商品價格異常檢測模型
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.product_price_anomaly_model`
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_anomaly'],
  auto_class_weights=true
) AS
SELECT
  -- 基礎特徵
  product_msrp AS 商品建議售價,
  product_regular_price AS 商品常態售價,
  product_id AS 商品編號,
  brand_id AS 品牌編號,
  product_category AS 商品類別,
  
  -- 價格差異
  product_msrp - product_regular_price AS price_diff,
  CASE 
    WHEN product_regular_price > 0 THEN (product_msrp - product_regular_price) / product_regular_price
    ELSE 0
  END AS price_diff_ratio,
  
  -- 統計特徵
  AVG(product_msrp) OVER (PARTITION BY brand_id) AS avg_brand_msrp,
  AVG(product_msrp) OVER (PARTITION BY product_category) AS avg_category_msrp,
  STDDEV(product_msrp) OVER (PARTITION BY brand_id) AS std_brand_msrp,
  
  -- Z-Score
  (product_msrp - AVG(product_msrp) OVER (PARTITION BY brand_id)) / 
    NULLIF(STDDEV(product_msrp) OVER (PARTITION BY brand_id), 0) AS z_score_brand,
  
  -- 標籤（基於 IQR 和業務規則）
  CASE 
    -- 極端異常
    WHEN product_msrp > 10000 OR product_msrp < 0 THEN 1
    WHEN product_regular_price > 10000 OR product_regular_price < 0 THEN 1
    -- IQR 異常
    WHEN product_msrp < 16 OR product_msrp > 308 THEN 1
    WHEN product_regular_price < 0 OR product_regular_price > 318 THEN 1
    -- 邏輯異常：建議售價應 >= 常態售價
    WHEN product_msrp < product_regular_price THEN 1
    -- Z-Score 異常
    WHEN ABS((product_msrp - AVG(product_msrp) OVER (PARTITION BY brand_id)) / 
             NULLIF(STDDEV(product_msrp) OVER (PARTITION BY brand_id), 0)) > 3 THEN 1
    ELSE 0
  END AS is_anomaly
  
FROM `b25h01-ragic.erp_backup.raw_orders`
WHERE product_msrp IS NOT NULL
  AND order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);
```

### 4.8 實例八：運費合理性檢測（NUM-006）

#### 4.8.1 業務背景

- **規則 ID**: NUM-006
- **適用欄位**: 運費收入
- **合理範圍**: 0 ~ 75（基於 IQR）
- **極端範圍**: 0 ~ 500
- **統計基線**: 中位數 0, 平均 38, 最大 8,200
- **歷史離群率**: 23.03%
- **零值比例**: 74.13%（免運活動）

#### 4.8.2 BigQuery ML 實作

```sql
-- 建立運費異常檢測模型
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.shipping_fee_anomaly_model`
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_anomaly'],
  auto_class_weights=true
) AS
SELECT
  -- 基礎特徵
  shipping_fee AS 運費收入,
  order_amount AS 訂單金額,
  logistics_id AS 物流編號,
  postal_code AS 郵遞區號,
  order_date AS 訂單日期,
  
  -- 運費比例
  CASE 
    WHEN order_amount > 0 THEN shipping_fee / order_amount
    ELSE 0
  END AS shipping_fee_ratio,
  
  -- 統計特徵
  AVG(shipping_fee) OVER (PARTITION BY logistics_id) AS avg_logistics_fee,
  AVG(shipping_fee) OVER (PARTITION BY postal_code) AS avg_region_fee,
  STDDEV(shipping_fee) OVER (PARTITION BY logistics_id) AS std_logistics_fee,
  
  -- 時間特徵
  EXTRACT(DAYOFWEEK FROM order_date) AS day_of_week,
  EXTRACT(MONTH FROM order_date) AS month,
  
  -- 標籤（基於 IQR 和業務規則）
  CASE 
    -- 極端異常
    WHEN shipping_fee > 500 OR shipping_fee < 0 THEN 1
    -- IQR 異常（但考慮免運活動）
    WHEN shipping_fee > 75 AND shipping_fee <= 500 THEN 1
    -- 運費比例異常（運費不應超過訂單金額的 50%）
    WHEN shipping_fee > (order_amount * 0.5) AND order_amount > 0 THEN 1
    ELSE 0
  END AS is_anomaly
  
FROM `b25h01-ragic.erp_backup.raw_orders`
WHERE shipping_fee IS NOT NULL
  AND order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);
```

---

## 5. 特徵工程與預處理

### 5.1 TRANSFORM 子句

BigQuery ML 支援使用 `TRANSFORM` 子句進行特徵工程，這些轉換會自動應用到訓練和預測階段。

```sql
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.order_anomaly_with_transform`
TRANSFORM(
  -- 標準化數值特徵
  ML.STANDARD_SCALER(order_amount) OVER() AS scaled_order_amount,
  ML.MIN_MAX_SCALER(quantity) OVER() AS scaled_quantity,
  
  -- 類別編碼
  ML.ONE_HOT_ENCODER(brand_id) OVER() AS encoded_brand,
  ML.LABEL_ENCODER(channel_id) OVER() AS encoded_channel,
  
  -- 特徵組合
  order_amount / NULLIF(quantity, 0) AS avg_item_price,
  
  -- 時間特徵
  EXTRACT(DAYOFWEEK FROM order_date) AS day_of_week,
  EXTRACT(MONTH FROM order_date) AS month,
  EXTRACT(QUARTER FROM order_date) AS quarter
)
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_anomaly']
) AS
SELECT
  order_amount,
  quantity,
  brand_id,
  channel_id,
  order_date,
  is_anomaly
FROM `b25h01-ragic.erp_backup.raw_orders`;
```

### 5.2 特徵選擇

使用 `ML.FEATURE_IMPORTANCE` 選擇重要特徵：

```sql
-- 查看特徵重要性
SELECT
  input,
  importance
FROM ML.FEATURE_IMPORTANCE(MODEL `b25h01-ragic.erp_backup.order_anomaly_model`)
ORDER BY importance DESC
LIMIT 10;
```

### 5.3 資料分割

```sql
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.order_anomaly_split`
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_anomaly'],
  data_split_method='RANDOM',  -- 或 'CUSTOM', 'SEQUENTIAL', 'AUTO_SPLIT'
  data_split_eval_fraction=0.2  -- 20% 用於評估
) AS
SELECT
  -- 特徵和標籤
  ...
FROM `b25h01-ragic.erp_backup.raw_orders`;
```

---

## 6. 模型評估與優化

### 6.1 評估指標

#### 6.1.1 分類模型評估

```sql
-- 評估分類模型
SELECT
  accuracy,
  precision,
  recall,
  f1_score,
  roc_auc,
  log_loss,
  confusion_matrix
FROM ML.EVALUATE(MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`);

-- ROC 曲線
SELECT
  threshold,
  recall,
  false_positive_rate,
  true_positive_rate
FROM ML.ROC_CURVE(MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`);

-- 混淆矩陣
SELECT
  *
FROM ML.CONFUSION_MATRIX(MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`);
```

#### 6.1.2 迴歸模型評估

```sql
-- 評估迴歸模型
SELECT
  mean_absolute_error,
  mean_squared_error,
  mean_squared_log_error,
  median_absolute_error,
  r2_score,
  explained_variance
FROM ML.EVALUATE(MODEL `b25h01-ragic.erp_backup.order_amount_prediction_model`);
```

### 6.2 交叉驗證

```sql
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.order_anomaly_cv`
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_anomaly'],
  data_split_method='CROSS_VALIDATION',
  num_folds=5  -- 5 折交叉驗證
) AS
SELECT
  -- 特徵和標籤
  ...
FROM `b25h01-ragic.erp_backup.raw_orders`;
```

### 6.3 超參數調優

```sql
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.order_anomaly_tuned`
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_anomaly'],
  max_iterations=100,  -- 增加迭代次數
  learn_rate=0.05,     -- 降低學習率
  l1_reg=0.1,          -- L1 正則化
  l2_reg=0.1,          -- L2 正則化
  min_rel_progress=0.01  -- 最小相對進度
) AS
SELECT
  -- 特徵和標籤
  ...
FROM `b25h01-ragic.erp_backup.raw_orders`;
```

---

## 7. 部署與預測

### 7.1 批次預測

```sql
-- 批次預測並儲存結果
CREATE OR REPLACE TABLE `b25h01-ragic.erp_backup.anomaly_predictions` AS
SELECT
  order_id,
  _ragicId,
  order_date,
  predicted_is_anomaly,
  predicted_is_anomaly_probs[OFFSET(0)].prob AS anomaly_probability,
  CURRENT_TIMESTAMP() AS predicted_at
FROM ML.PREDICT(
  MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`,
  (
    SELECT 
      order_id,
      _ragicId,
      order_date,
      quantity,
      order_amount,
      product_id,
      brand_id,
      channel_id,
      AVG(quantity) OVER (PARTITION BY product_id) AS avg_product_quantity,
      STDDEV(quantity) OVER (PARTITION BY product_id) AS std_product_quantity,
      (quantity - AVG(quantity) OVER (PARTITION BY product_id)) / 
        NULLIF(STDDEV(quantity) OVER (PARTITION BY product_id), 0) AS z_score_product,
      order_amount / NULLIF(quantity, 0) AS avg_item_price,
      CASE WHEN quantity = 0 THEN 1 ELSE 0 END AS is_zero,
      CASE WHEN quantity > 100 THEN 1 ELSE 0 END AS is_bulk
    FROM `b25h01-ragic.erp_backup.raw_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      AND quantity IS NOT NULL
  )
)
WHERE predicted_is_anomaly = 1;
```

### 7.2 即時預測

```sql
-- 在 ETL 流程中即時預測
SELECT
  *,
  ML.PREDICT(
    MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`,
    (SELECT AS STRUCT * FROM UNNEST([record]))
  ) AS prediction
FROM `b25h01-ragic.erp_backup.raw_orders` AS record
WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY);
```

### 7.3 預測結果查詢

```sql
-- 查詢異常預測結果
SELECT
  p.order_id,
  p._ragicId,
  p.order_date,
  o.quantity,
  o.order_amount,
  o.product_id,
  o.brand_id,
  p.anomaly_probability,
  p.predicted_at,
  CASE 
    WHEN p.anomaly_probability > 0.9 THEN '高信心異常'
    WHEN p.anomaly_probability > 0.7 THEN '中信心異常'
    ELSE '低信心異常'
  END AS confidence_level
FROM `b25h01-ragic.erp_backup.anomaly_predictions` p
JOIN `b25h01-ragic.erp_backup.raw_orders` o
  ON p.order_id = o.order_id
WHERE p.predicted_is_anomaly = 1
ORDER BY p.anomaly_probability DESC;
```

---

## 8. 整合到 ETL 流程

### 8.1 Cloud Function 整合

```python
# src/bigquery_ml_validator.py
from google.cloud import bigquery
from typing import List, Dict, Any

class BigQueryMLValidator:
    """BigQuery ML 驗證器"""
    
    def __init__(self, project_id='b25h01-ragic', dataset_id='erp_backup'):
        self.client = bigquery.Client(project=project_id)
        self.project_id = project_id
        self.dataset_id = dataset_id
    
    def detect_quantity_anomalies(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """檢測數量異常"""
        # 建立臨時表
        temp_table = self._create_temp_table(records)
        
        # 使用模型預測
        query = f"""
        SELECT
          order_id,
          _ragicId,
          predicted_is_outlier,
          predicted_is_outlier_probs[OFFSET(0)].prob AS outlier_probability
        FROM ML.PREDICT(
          MODEL `{self.project_id}.{self.dataset_id}.quantity_anomaly_model`,
          (SELECT * FROM `{temp_table}`)
        )
        WHERE predicted_is_outlier = 1
        """
        
        results = self.client.query(query).result()
        
        # 標記異常記錄
        anomalies = []
        for row in results:
            anomalies.append({
                'order_id': row.order_id,
                '_ragicId': row._ragicId,
                'anomaly_type': 'quantity_outlier',
                'probability': row.outlier_probability
            })
        
        return anomalies
    
    def detect_amount_anomalies(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """檢測金額異常"""
        # 類似實作
        pass
    
    def _create_temp_table(self, records: List[Dict[str, Any]]) -> str:
        """建立臨時表"""
        table_id = f"{self.project_id}.{self.dataset_id}.temp_validation_{int(time.time())}"
        
        job = self.client.load_table_from_json(
            records,
            table_id,
            job_config=bigquery.LoadJobConfig(
                autodetect=True,
                write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE
            )
        )
        job.result()
        
        return table_id
```

### 8.2 ETL 流程整合

```python
# src/etl_with_ml.py
from src.bigquery_ml_validator import BigQueryMLValidator

def ragic_backup_with_ml(request):
    """Ragic 備份 Cloud Function（整合 BigQuery ML）"""
    
    # 初始化驗證器
    ml_validator = BigQueryMLValidator()
    
    # 從 Ragic API 取得資料
    records = fetch_from_ragic()
    
    # BigQuery ML 異常檢測
    quantity_anomalies = ml_validator.detect_quantity_anomalies(records)
    amount_anomalies = ml_validator.detect_amount_anomalies(records)
    
    # 標記異常記錄
    for record in records:
        record['_ml_flags'] = []
        
        # 檢查數量異常
        for anomaly in quantity_anomalies:
            if record.get('_ragicId') == anomaly['_ragicId']:
                record['_ml_flags'].append({
                    'type': 'quantity_anomaly',
                    'probability': anomaly['probability'],
                    'rule_id': 'NUM-001'
                })
        
        # 檢查金額異常
        for anomaly in amount_anomalies:
            if record.get('_ragicId') == anomaly['_ragicId']:
                record['_ml_flags'].append({
                    'type': 'amount_anomaly',
                    'probability': anomaly['probability'],
                    'rule_id': 'NUM-002'
                })
    
    # 載入 BigQuery
    upload_to_bigquery(records)
    
    return {
        'status': 'success',
        'records': len(records),
        'anomalies': {
            'quantity': len(quantity_anomalies),
            'amount': len(amount_anomalies)
        }
    }
```

### 8.3 Airflow DAG 整合

```python
# dags/ragic_ml_validation_dag.py
from airflow import DAG
from airflow.providers.google.cloud.operators.bigquery import BigQueryOperator
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'ragic_edp',
    'depends_on_past': False,
    'start_date': datetime(2025, 1, 1),
    'email_on_failure': True,
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'ragic_ml_validation',
    default_args=default_args,
    description='Ragic ML 驗證流程',
    schedule_interval='0 1 * * *',  # 每日凌晨 1 點執行
    catchup=False,
)

# Task 1: 備份資料
backup_task = PythonOperator(
    task_id='backup_from_ragic',
    python_callable=backup_from_ragic,
    dag=dag,
)

# Task 2: 數量異常檢測
quantity_anomaly_task = BigQueryOperator(
    task_id='detect_quantity_anomalies',
    sql='''
    CREATE OR REPLACE TABLE `b25h01-ragic.erp_backup.quantity_anomaly_results` AS
    SELECT
      order_id,
      _ragicId,
      predicted_is_outlier,
      predicted_is_outlier_probs[OFFSET(0)].prob AS outlier_probability
    FROM ML.PREDICT(
      MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`,
      (SELECT * FROM `b25h01-ragic.erp_backup.raw_orders` 
       WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
    )
    WHERE predicted_is_outlier = 1;
    ''',
    dag=dag,
)

# Task 3: 金額異常檢測
amount_anomaly_task = BigQueryOperator(
    task_id='detect_amount_anomalies',
    sql='''
    CREATE OR REPLACE TABLE `b25h01-ragic.erp_backup.amount_anomaly_results` AS
    SELECT
      order_id,
      _ragicId,
      predicted_is_anomaly,
      predicted_is_anomaly_probs[OFFSET(0)].prob AS anomaly_probability
    FROM ML.PREDICT(
      MODEL `b25h01-ragic.erp_backup.order_amount_anomaly_model`,
      (SELECT * FROM `b25h01-ragic.erp_backup.raw_orders` 
       WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
    )
    WHERE predicted_is_anomaly = 1;
    ''',
    dag=dag,
)

# Task 4: 產生報告
generate_report_task = PythonOperator(
    task_id='generate_ml_report',
    python_callable=generate_ml_report,
    dag=dag,
)

# 定義依賴關係
backup_task >> [quantity_anomaly_task, amount_anomaly_task] >> generate_report_task
```

---

## 9. 成本與效能考量

### 9.1 成本分析

BigQuery ML 的成本包含在 BigQuery 查詢費用中：

| 操作 | 成本 | 說明 |
|------|------|------|
| **模型訓練** | $5/TB（查詢費用） | 按掃描的資料量計費 |
| **模型預測** | $5/TB（查詢費用） | 按掃描的資料量計費 |
| **模型儲存** | $0.02/GB/月 | 模型儲存費用 |

**專案成本估算**：

| 模型 | 訓練資料量 | 訓練成本 | 預測頻率 | 預測成本/月 | 儲存成本/月 |
|------|-----------|---------|---------|-----------|-----------|
| **數量異常模型** | 50GB | $0.25 | 每週 1 次 | $0.10 | $0.01 |
| **金額異常模型** | 50GB | $0.25 | 每週 1 次 | $0.10 | $0.01 |
| **關聯規則模型** | 30GB | $0.15 | 每週 1 次 | $0.06 | $0.01 |
| **時序異常模型** | 20GB | $0.10 | 每週 1 次 | $0.04 | $0.01 |
| **總計** | - | **$0.75** | - | **$0.30** | **$0.04** |

**月總成本**：約 **$1.09/月**（非常經濟）

### 9.2 效能優化

#### 9.2.1 查詢優化

```sql
-- 使用分割區過濾
SELECT * FROM ML.PREDICT(
  MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`,
  (
    SELECT * FROM `b25h01-ragic.erp_backup.raw_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)  -- 分割區過濾
      AND quantity IS NOT NULL
  )
);

-- 使用叢集過濾
SELECT * FROM ML.PREDICT(
  MODEL `b25h01-ragic.erp_backup.order_amount_anomaly_model`,
  (
    SELECT * FROM `b25h01-ragic.erp_backup.raw_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      AND brand_id = 'GMK'  -- 叢集過濾
  )
);
```

#### 9.2.2 模型優化

```sql
-- 限制特徵數量
CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.order_anomaly_optimized`
OPTIONS(
  model_type='boosted_tree_classifier',
  input_label_cols=['is_anomaly'],
  max_iterations=30,  -- 減少迭代次數
  learn_rate=0.1,
  early_stop=true  -- 早期停止
) AS
SELECT
  -- 只選擇重要特徵
  order_amount,
  quantity,
  brand_id,
  channel_id,
  is_anomaly
FROM `b25h01-ragic.erp_backup.raw_orders`;
```

---

## 10. 最佳實踐

### 10.1 資料準備

1. **使用足夠的歷史資料**
   - 建議至少 90 天以上的資料
   - 確保資料量足夠（至少 10,000 筆）

2. **處理缺失值**
   ```sql
   -- 在訓練資料中處理缺失值
   SELECT
     COALESCE(order_amount, 0) AS order_amount,
     COALESCE(quantity, 1) AS quantity,
     ...
   FROM `b25h01-ragic.erp_backup.raw_orders`
   ```

3. **平衡類別分佈**
   ```sql
   OPTIONS(
     auto_class_weights=true  -- 自動平衡類別權重
   )
   ```

### 10.2 模型選擇

| 問題類型 | 推薦模型 | 理由 |
|---------|---------|------|
| **簡單二元分類** | `logistic_reg` | 快速、易於解釋 |
| **複雜分類** | `boosted_tree_classifier` | 高準確度 |
| **異常檢測** | `boosted_tree_classifier` | 捕捉複雜模式 |
| **時序預測** | `arima_plus` | 專門處理時間序列 |
| **關聯學習** | `logistic_reg` / `matrix_factorization` | 適合關聯規則 |

### 10.3 模型維護

1. **定期重新訓練**
   ```sql
   -- 每週重新訓練模型
   CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`
   OPTIONS(...) AS
   SELECT ... FROM `b25h01-ragic.erp_backup.raw_orders`
   WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);
   ```

2. **監控模型效能**
   ```sql
   -- 定期評估模型
   SELECT * FROM ML.EVALUATE(MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`);
   ```

3. **版本控制**
   ```sql
   -- 使用版本號命名模型
   CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model_v2`
   ```

### 10.4 錯誤處理

```sql
-- 使用 TRY...EXCEPT 處理錯誤
BEGIN
  CREATE OR REPLACE MODEL `b25h01-ragic.erp_backup.quantity_anomaly_model`
  OPTIONS(...) AS
  SELECT ... FROM `b25h01-ragic.erp_backup.raw_orders`;
EXCEPTION WHEN ERROR THEN
  SELECT
    @@error.message AS error_message,
    @@error.statement_text AS statement_text;
END;
```

---

## 11. 結論與建議

### 11.1 核心結論

1. **BigQuery ML 非常適合專案需求**：SQL 語法、無需資料移動、成本效益高
2. **異常檢測是主要應用場景**：數量、金額、價格等數值異常檢測
3. **關聯規則學習可自動化**：品牌-促銷、通路-物流等關聯規則
4. **時序異常檢測可提升準確度**：ARIMA 模型處理時序邏輯異常

### 11.2 具體建議

#### 11.2.1 立即行動（第 1-2 週）

1. **建立數量異常檢測模型**
   - 實作 NUM-001 規則
   - 測試模型準確度
   - 整合到 ETL 流程

2. **建立金額異常檢測模型**
   - 實作 NUM-002 規則
   - 測試模型準確度
   - 整合到 ETL 流程

#### 11.2.2 短期行動（第 2-4 週）

1. **建立關聯規則模型**
   - 實作 ASSOC-003（品牌-促銷）
   - 實作 ASSOC-005（通路-物流）
   - 測試模型準確度

2. **建立時序異常檢測模型**
   - 實作 TEMP-001 規則
   - 測試 ARIMA 模型效果

#### 11.2.3 中期行動（第 4-8 週）

1. **建立完整異常檢測系統**
   - 整合所有異常檢測模型
   - 建立統一異常報告系統
   - 優化模型效能

2. **建立資料品質評分模型**
   - 綜合評分資料品質
   - 自動化品質報告

### 11.3 技術選型建議

| 應用場景 | 推薦模型 | 理由 |
|---------|---------|------|
| **數量異常檢測** | `boosted_tree_classifier` | 高準確度，捕捉複雜模式 |
| **金額異常檢測** | `boosted_tree_classifier` | 高準確度，處理多種異常類型 |
| **關聯規則學習** | `logistic_reg` | 快速、易於解釋 |
| **時序異常檢測** | `arima_plus` | 專門處理時間序列 |
| **資料品質評分** | `boosted_tree_classifier` | 綜合評分 |

### 11.4 下一步行動

1. **立即行動**（第 1 週）
   - 建立數量異常檢測模型
   - 測試模型準確度
   - 整合到 Cloud Function

2. **短期行動**（第 2-4 週）
   - 建立金額異常檢測模型
   - 建立關聯規則模型
   - 整合到 Airflow DAG

3. **中期行動**（第 4-8 週）
   - 建立完整異常檢測系統
   - 優化模型效能
   - 建立監控和報告機制

---

## 12. 附錄

### 12.1 參考資料

- [BigQuery ML 文件](https://cloud.google.com/bigquery-ml/docs)
- [BigQuery ML SQL 參考](https://cloud.google.com/bigquery-ml/docs/reference/standard-sql/bigqueryml-syntax)
- [資料清洗規則定義_v1.md](./資料清洗規則定義_v1.md)
- [GCP_AI服務用於資料判別研究報告.md](./GCP_AI服務用於資料判別研究報告.md)

### 12.2 模型類型對照表

| 模型類型 | SQL 語法 | 適用場景 |
|---------|---------|---------|
| **線性迴歸** | `linear_reg` | 數值預測 |
| **邏輯迴歸** | `logistic_reg` | 二元/多元分類 |
| **K-means** | `kmeans` | 聚類分析 |
| **矩陣分解** | `matrix_factorization` | 推薦系統 |
| **深度神經網路分類** | `dnn_classifier` | 複雜分類 |
| **深度神經網路迴歸** | `dnn_regressor` | 複雜迴歸 |
| **梯度提升樹分類** | `boosted_tree_classifier` | 高準確度分類 |
| **梯度提升樹迴歸** | `boosted_tree_regressor` | 高準確度迴歸 |
| **ARIMA Plus** | `arima_plus` | 時間序列預測 |
| **AutoML 分類** | `automl_classifier` | 自動化分類 |
| **AutoML 迴歸** | `automl_regressor` | 自動化迴歸 |

### 12.3 專案規則對照表

| 規則類別 | 規則 ID | BigQuery ML 模型 | 模型類型 |
|---------|---------|----------------|---------|
| **數值範圍** | NUM-001 | `quantity_anomaly_model` | `boosted_tree_classifier` |
| **數值範圍** | NUM-002 | `order_amount_anomaly_model` | `boosted_tree_classifier` |
| **數值範圍** | NUM-003 | `total_amount_anomaly_model` | `boosted_tree_classifier` |
| **數值範圍** | NUM-004 | `product_price_anomaly_model` | `boosted_tree_classifier` |
| **數值範圍** | NUM-005 | `product_price_anomaly_model` | `boosted_tree_classifier` |
| **數值範圍** | NUM-006 | `shipping_fee_anomaly_model` | `boosted_tree_classifier` |
| **數值範圍** | NUM-007 | `cod_amount_anomaly_model` | `boosted_tree_classifier` |
| **金額一致性** | NUM-008 ~ NUM-014 | `amount_consistency_model` | `boosted_tree_classifier` |
| **關聯規則** | ASSOC-003 | `brand_promotion_association_model` | `logistic_reg` |
| **關聯規則** | ASSOC-005 | `channel_logistics_association_model` | `logistic_reg` |
| **時序邏輯** | TEMP-001 | `temporal_anomaly_model` | `arima_plus` / `logistic_reg` |

### 12.4 實作檢查清單

- [ ] 建立數量異常檢測模型（NUM-001）
- [ ] 建立金額異常檢測模型（NUM-002）
- [ ] 建立價格異常檢測模型（NUM-004, NUM-005）
- [ ] 建立運費異常檢測模型（NUM-006）
- [ ] 建立金額一致性檢測模型（NUM-008 ~ NUM-014）
- [ ] 建立品牌-促銷關聯模型（ASSOC-003）
- [ ] 建立通路-物流關聯模型（ASSOC-005）
- [ ] 建立時序異常檢測模型（TEMP-001）
- [ ] 整合到 Cloud Function
- [ ] 整合到 Airflow DAG
- [ ] 建立異常報告系統
- [ ] 設定模型重新訓練排程

---

**文件結束**

*建立時間: 2025-12-30*  
*版本: v1.0*  
*狀態: 完成*

