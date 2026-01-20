# erp_backup 資料表欄位說明

**專案**: b25h01-ragic  
**資料集**: erp_backup  
**最後更新**: 2026-01-20

---

## 目錄

1. [來源資料表 (sheet_*)](#1-來源資料表-sheet_)
2. [維度表 (dim_*)](#2-維度表-dim_)
3. [事實表 (fact_*)](#3-事實表-fact_)
4. [清洗系統表](#4-清洗系統表)
5. [檢視表 (view_* / v_*)](#5-檢視表-view_-v_)
6. [欄位類型說明](#6-欄位類型說明)

---

## 1. 來源資料表 (sheet_*)

這些表直接儲存從 Ragic API 抓取的原始資料，包含完整 JSON 資料欄位。

### 📋 共用欄位說明

所有 sheet_* 表都包含以下共用欄位：

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `ragic_id` | STRING | Ragic 記錄唯一識別碼 |
| `data` | STRING | 原始 JSON 資料（包含所有 Ragic 欄位） |
| `ragic_created` | TIMESTAMP | Ragic 建立時間 |
| `ragic_modified` | TIMESTAMP | Ragic 最後修改時間 |
| `backup_time` | TIMESTAMP | 備份時間 |
| `cleaning_status` | STRING | 清洗狀態 (pending/completed/auto_fixed/manual/filtered) |
| `cleaning_updated_at` | TIMESTAMP | 清洗狀態更新時間 |
| `cleaning_batch_id` | STRING | 清洗批次 ID |
| `is_filtered` | BOOLEAN | 是否已被過濾（資料品質問題） |
| `filter_reason` | STRING | 過濾原因 |

### 1.1 sheet_10_brand (品牌表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `brand_code` | STRING | 品牌編號 |
| `brand_name` | STRING | 品牌名稱 |
| `status` | STRING | 狀態 |

### 1.2 sheet_20_channel (通路表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `channel_code` | STRING | 通路編號 |
| `channel_name` | STRING | 通路名稱 |
| `status` | STRING | 狀態 |

### 1.3 sheet_30_payment (金流表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `payment_code` | STRING | 金流編號 |
| `payment_name` | STRING | 金流名稱 |
| `status` | STRING | 狀態 |

### 1.4 sheet_40_logistics (物流表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `logistics_code` | STRING | 物流編號 |
| `logistics_name` | STRING | 物流名稱 |
| `status` | STRING | 狀態 |

### 1.5 sheet_41_zipcode (郵遞區號表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `zipcode` | STRING | 郵遞區號 |
| `city` | STRING | 縣市 |
| `district` | STRING | 區域 |
| `status` | STRING | 狀態 |

### 1.6 sheet_50_order (訂單表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `order_code` | STRING | 訂單編號（主鍵） |
| `customer_code` | STRING | 客戶編號（FK → sheet_60） |
| `order_date` | DATE | 訂單日期 |
| `order_amount` | FLOAT | 訂單金額 |
| `status` | STRING | 狀態 |

### 1.7 sheet_60_customer (客戶表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `customer_code` | STRING | 客戶編號（主鍵） |
| `customer_name` | STRING | 客戶名稱 |
| `phone` | STRING | 手機 |
| `email` | STRING | 電子郵件 |
| `landline` | STRING | 市話 |
| `status` | STRING | 狀態 |

### 1.8 sheet_70_product (商品表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `product_code` | STRING | 商品編號（主鍵） |
| `product_name` | STRING | 商品名稱 |
| `price` | FLOAT | 單價 |
| `status` | STRING | 狀態 |

### 1.9 sheet_80_campaign (活動管理表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `campaign_code` | STRING | 活動編號（主鍵） |
| `campaign_name` | STRING | 活動名稱 |
| `start_date` | DATE | 開始日期 |
| `end_date` | DATE | 結束日期 |
| `status` | STRING | 狀態 |

### 1.10 sheet_99_order_detail (訂單明細表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `order_code` | STRING | 訂單編號（複合主鍵, FK → sheet_50） |
| `product_code` | STRING | 商品編號（複合主鍵, FK → sheet_70） |
| `quantity` | FLOAT | 數量 |
| `unit_price` | FLOAT | 單價 |
| `subtotal` | FLOAT | 小計 |
| `order_amount` | FLOAT | 訂單金額 |
| `status` | STRING | 狀態 |

---

## 2. 維度表 (dim_*)

這些表是經過 ETL 處理後的乾淨維度資料，用於資料分析。

### 📋 共用欄位說明

所有 dim_* 表都包含以下共用欄位：

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `ragic_id` | STRING | Ragic 記錄唯一識別碼 |
| `ragic_created` | TIMESTAMP | Ragic 建立時間 |
| `ragic_modified` | TIMESTAMP | Ragic 最後修改時間 |
| `etl_loaded_at` | TIMESTAMP | ETL 首次載入時間 |
| `etl_updated_at` | TIMESTAMP | ETL 最後更新時間 |

### 2.1 dim_brand (品牌維度)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `brand_code` | STRING | 品牌編號 |
| `brand_name` | STRING | 品牌名稱 |
| `status` | STRING | 狀態 |

### 2.2 dim_channel (通路維度)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `channel_code` | STRING | 通路編號 |
| `channel_name` | STRING | 通路名稱 |
| `status` | STRING | 狀態 |

### 2.3 dim_payment (金流維度)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `payment_code` | STRING | 金流編號 |
| `payment_name` | STRING | 金流名稱 |
| `status` | STRING | 狀態 |

### 2.4 dim_logistics (物流維度)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `logistics_code` | STRING | 物流編號 |
| `logistics_name` | STRING | 物流名稱 |
| `status` | STRING | 狀態 |

### 2.5 dim_postal (郵遞區號維度)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `zipcode` | STRING | 郵遞區號 |
| `city` | STRING | 縣市 |
| `district` | STRING | 區域 |
| `status` | STRING | 狀態 |

### 2.6 dim_customer (客戶維度)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `customer_code` | STRING | 客戶編號 |
| `customer_name` | STRING | 客戶名稱 |
| `phone` | STRING | 電話 |
| `email` | STRING | 電子郵件 |
| `status` | STRING | 狀態 |

### 2.7 dim_product (商品維度)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `product_code` | STRING | 商品編號 |
| `product_name` | STRING | 商品名稱 |
| `price` | FLOAT | 單價 |
| `status` | STRING | 狀態 |

### 2.8 dim_campaign (活動維度)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `campaign_code` | STRING | 活動編號 |
| `campaign_name` | STRING | 活動名稱 |
| `start_date` | DATE | 開始日期 |
| `end_date` | DATE | 結束日期 |
| `status` | STRING | 狀態 |

---

## 3. 事實表 (fact_*)

這些表是經過 ETL 處理後的事實資料，用於資料分析與報表。

### 3.1 fact_orders (訂單事實表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `ragic_id` | STRING | Ragic 記錄唯一識別碼 |
| `order_code` | STRING | 訂單編號 |
| `customer_code` | STRING | 客戶編號 |
| `order_date` | DATE | 訂單日期 |
| `order_amount` | FLOAT | 訂單金額 |
| `status` | STRING | 狀態 |
| `ragic_created` | TIMESTAMP | Ragic 建立時間 |
| `ragic_modified` | TIMESTAMP | Ragic 最後修改時間 |
| `etl_loaded_at` | TIMESTAMP | ETL 首次載入時間 |
| `etl_updated_at` | TIMESTAMP | ETL 最後更新時間 |

### 3.2 fact_order_details (訂單明細事實表)

| 欄位名稱 | 類型 | 說明 |
|---------|------|------|
| `ragic_id` | STRING | Ragic 記錄唯一識別碼 |
| `order_code` | STRING | 訂單編號 |
| `product_code` | STRING | 商品編號 |
| `quantity` | INTEGER | 數量 |
| `unit_price` | FLOAT | 單價 |
| `subtotal` | FLOAT | 小計 |
| `status` | STRING | 狀態 |
| `ragic_created` | TIMESTAMP | Ragic 建立時間 |
| `ragic_modified` | TIMESTAMP | Ragic 最後修改時間 |
| `etl_loaded_at` | TIMESTAMP | ETL 首次載入時間 |
| `etl_updated_at` | TIMESTAMP | ETL 最後更新時間 |

---

## 4. 清洗系統表

這些表用於追蹤資料清洗過程與結果。

### 4.1 cleaning_batches (清洗批次)

記錄每次清洗執行的批次資訊。

### 4.2 cleaning_results (清洗結果)

記錄每筆記錄的清洗狀態。

### 4.3 cleaning_history (清洗歷史)

記錄所有清洗操作的變更歷史。

### 4.4 violations (違規記錄)

記錄所有資料品質違規項目。

### 4.5 fill_results (回填結果)

記錄自動回填操作的結果。

### 4.6 backup_logs (備份日誌)

記錄每次備份執行的詳細資訊。

---

## 5. 檢視表 (view_* / v_*)

這些是 BigQuery View，提供常用查詢的預建立檢視。

| 檢視名稱 | 說明 |
|---------|------|
| `v_orders` | 訂單檢視（含客戶資訊） |
| `v_customer_rfm` | 客戶 RFM 分析檢視 |
| `v_daily_order_stats` | 每日訂單統計 |
| `v_daily_cleaning_stats` | 每日清洗統計 |
| `v_pending_violations` | 待處理違規檢視 |
| `v_rule_stats` | 規則統計檢視 |
| `view_customer_brand` | 客戶品牌檢視 |
| `view_customer_primary_brand` | 客戶主要品牌檢視 |
| `view_order_customer` | 訂單客戶關聯檢視 |

---

## 6. 欄位類型說明

| BigQuery 類型 | 說明 | 範例 |
|--------------|------|------|
| `STRING` | 字串 | "ABC123" |
| `INTEGER` | 整數 | 42 |
| `FLOAT` | 浮點數 | 99.95 |
| `DATE` | 日期 | 2026-01-20 |
| `TIMESTAMP` | 時間戳 | 2026-01-20 14:30:00 UTC |
| `BOOLEAN` | 布林值 | TRUE / FALSE |

---

**文件結束**
