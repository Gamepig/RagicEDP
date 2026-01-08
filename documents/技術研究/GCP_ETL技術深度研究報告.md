# GCP ETL 技術深度研究報告

**版本**: v1.0  
**建立日期**: 2025-12-30  
**基於**: Google Cloud Platform ETL 最佳實踐  
**專案**: RagicEDP 資料平台  
**參考文件**: ETL_轉換改進計劃.md、三大雲端平台ETL技術融入分析報告.md

---

## 目錄

1. [執行摘要](#1-執行摘要)
2. [GCP ETL 服務生態系統](#2-gcp-etl-服務生態系統)
3. [專案現況與 GCP 技術對應](#3-專案現況與-gcp-技術對應)
4. [GCP ETL 技術深度分析](#4-gcp-etl-技術深度分析)
5. [實際應用方案](#5-實際應用方案)
6. [實施路線圖](#6-實施路線圖)
7. [成本效益分析](#7-成本效益分析)
8. [最佳實踐與優化](#8-最佳實踐與優化)
9. [風險與挑戰](#9-風險與挑戰)
10. [結論與建議](#10-結論與建議)

---

## 1. 執行摘要

### 1.1 報告目的

本報告深度研究 Google Cloud Platform (GCP) 的 ETL 技術與最佳實踐，並結合 RagicEDP 專案的實際情況，提出具體的技術應用策略和實施方案。

### 1.2 關鍵發現

根據 [Google Cloud ETL 文件](https://cloud.google.com/learn/what-is-etl?hl=zh-TW)，GCP 提供完整的 ETL 服務生態系統：

| GCP 服務 | 功能定位 | RagicEDP 適用性 | 優先級 |
|---------|---------|----------------|--------|
| **Cloud Functions** | 輕量級 ETL，事件驅動 | 🟢 當前使用 | P0 |
| **Cloud Dataflow** | 大規模批次/串流處理 | 🟡 中期導入 | P2 |
| **BigQuery** | 資料倉儲和分析 | 🟢 當前使用 | P0 |
| **Cloud Composer** | 工作流編排（Airflow） | 🟡 中期導入 | P2 |
| **Pub/Sub** | 即時訊息傳遞 | 🟡 未來需求 | P3 |
| **BigQuery Data Transfer Service** | 自動化資料移轉 | 🟡 中期評估 | P2 |
| **Cloud Data Fusion** | 視覺化 ETL | 🟡 可選方案 | P3 |

### 1.3 核心建議

1. **短期（1-3 個月）**：優化 Cloud Functions，建立規則引擎和標準化函數庫
2. **中期（3-6 個月）**：導入 Cloud Composer (Airflow)，建立星狀模型，評估 Dataflow
3. **長期（6 個月以上）**：導入 Dataflow 大規模處理，評估串流處理（Pub/Sub + Dataflow）

---

## 2. GCP ETL 服務生態系統

### 2.1 核心 ETL 服務架構

```
┌─────────────────────────────────────────────────────────┐
│              GCP ETL 服務生態系統                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Extract（擷取）                                        │
│  ├── Cloud Functions（輕量級、事件驅動）                │
│  ├── Cloud Run（容器化、長時間執行）                    │
│  ├── Pub/Sub（即時訊息傳遞）                            │
│  └── BigQuery Data Transfer Service（自動化移轉）      │
│                                                         │
│  Transform（轉換）                                       │
│  ├── Cloud Dataflow（批次/串流處理）                    │
│  ├── Cloud Functions（輕量級轉換）                      │
│  ├── Cloud Data Fusion（視覺化 ETL）                    │
│  └── Cloud Dataprep（資料準備）                         │
│                                                         │
│  Load（載入）                                            │
│  ├── BigQuery（資料倉儲）                                │
│  ├── Cloud Storage（資料湖）                            │
│  └── Cloud SQL（關聯式資料庫）                          │
│                                                         │
│  Orchestration（編排）                                   │
│  ├── Cloud Composer（Airflow）                          │
│  ├── Cloud Scheduler（排程）                            │
│  └── Cloud Workflows（工作流）                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 服務詳細說明

#### 2.2.1 Extract（擷取）服務

| 服務 | 功能 | 適用場景 | RagicEDP 應用 |
|------|------|---------|-------------|
| **Cloud Functions** | 無伺服器函數，事件驅動 | 輕量級資料擷取，API 呼叫 | ✅ 當前使用：Ragic API 擷取 |
| **Cloud Run** | 容器化服務，彈性擴展 | 長時間執行任務，複雜邏輯 | 🟡 可考慮：長時間 ETL 任務 |
| **Pub/Sub** | 即時訊息傳遞 | 串流資料擷取，事件驅動 | 🟡 未來：即時資料處理 |
| **Data Transfer Service** | 自動化資料移轉 | 定期資料同步，多來源整合 | 🟡 中期：自動化資料移轉 |

#### 2.2.2 Transform（轉換）服務

| 服務 | 功能 | 適用場景 | RagicEDP 應用 |
|------|------|---------|-------------|
| **Cloud Dataflow** | Apache Beam，批次/串流 | 大規模資料處理，複雜轉換 | 🟡 中期：大規模全量分析 |
| **Cloud Functions** | 無伺服器函數 | 輕量級轉換，規則引擎 | ✅ 當前使用：資料清洗 |
| **Cloud Data Fusion** | 視覺化 ETL 設計 | 降低技術門檻，快速開發 | 🟡 可選：視覺化需求 |
| **Cloud Dataprep** | 互動式資料準備 | 資料探索，清理準備 | 🟡 可選：資料探索階段 |

#### 2.2.3 Load（載入）服務

| 服務 | 功能 | 適用場景 | RagicEDP 應用 |
|------|------|---------|-------------|
| **BigQuery** | 無伺服器資料倉儲 | 大規模分析，星狀模型 | ✅ 當前使用：資料倉儲 |
| **Cloud Storage** | 物件儲存 | 資料湖，原始資料儲存 | ✅ 當前使用：資料暫存 |
| **Cloud SQL** | 關聯式資料庫 | 交易型資料，小規模資料 | ❌ 不適用：專案使用 BigQuery |

#### 2.2.4 Orchestration（編排）服務

| 服務 | 功能 | 適用場景 | RagicEDP 應用 |
|------|------|---------|-------------|
| **Cloud Composer** | 託管 Airflow | 複雜工作流，任務依賴 | 🟡 中期：工作流管理 |
| **Cloud Scheduler** | 排程服務 | 簡單排程，定時觸發 | ✅ 當前使用：每日備份 |
| **Cloud Workflows** | 無伺服器工作流 | 簡單工作流，API 編排 | 🟡 可選：簡單工作流 |

---

## 3. 專案現況與 GCP 技術對應

### 3.1 RagicEDP 專案現況

根據《ETL_轉換改進計劃.md》，專案現況如下：

| 項目 | 當前狀態 | GCP 技術架構 |
|------|---------|-------------|
| **資料來源** | Ragic ERP 系統（REST API） | Ragic API → Cloud Function → BigQuery |
| **資料量** | 461,750 筆（10 個表格） | 週增量 ~9,500 筆（2.1%） |
| **清洗規則** | 87 條規則（硬編碼） | Python 腳本（Cloud Function） |
| **資料倉儲** | BigQuery | raw_data → staging → dwh |
| **工作流管理** | Cloud Scheduler | 簡單排程 |

### 3.2 ETL 三階段技術對應

#### 3.2.1 Extract（擷取）階段

**當前實作**：
```python
# src/ragic_client.py
class RagicClient:
    def fetch_data(self, sheet_code, last_backup_date):
        """從 Ragic API 擷取資料"""
        # 增量擷取邏輯
        params = {
            'api': True,
            'v': 3,
            'limit': 1000,
            'lastModified': last_backup_date
        }
        return self._make_request(sheet_code, params)
```

**GCP 技術對應**：

| 技術 | 應用建議 | 優先級 | 說明 |
|------|---------|--------|------|
| **Cloud Function** | ✅ 當前使用，優化 | P0 | 輕量級 API 呼叫，成本低 |
| **Cloud Run** | 🟡 可考慮 | P2 | 如需長時間執行或複雜邏輯 |
| **Pub/Sub** | 🟡 未來需求 | P3 | 即時資料處理需求 |
| **Data Transfer Service** | 🟡 中期評估 | P2 | 自動化資料移轉 |

**改進建議**：
- **短期**：優化 Cloud Function 的增量擷取邏輯，加入重試機制
- **中期**：評估 Cloud Run 處理長時間執行任務
- **長期**：評估 Pub/Sub + Dataflow 串流處理

#### 3.2.2 Transform（轉換）階段

**當前實作**：
```python
# test_workspace/cleaning_test/cleaning_test_v1.py
class CleaningRules:
    def cr002_brand_reference(self, record, brand_codes):
        """品牌參照完整性檢查"""
        brand_code = record.get("品牌編號", "").strip()
        if brand_code and brand_code not in brand_codes:
            # 標記問題
            add_flag(record, "CR-002", ...)
```

**GCP 技術對應**：

| 技術 | 應用建議 | 優先級 | 說明 |
|------|---------|--------|------|
| **Cloud Functions** | ✅ 當前使用，優化 | P0 | 規則引擎，標準化函數庫 |
| **Cloud Dataflow** | 🟡 中期導入 | P2 | 大規模全量分析，複雜轉換 |
| **Cloud Data Fusion** | 🟡 可選方案 | P3 | 視覺化 ETL 設計 |
| **Cloud Dataprep** | 🟡 可選方案 | P3 | 資料探索和準備 |

**改進建議**：
- **短期**：建立規則引擎和標準化函數庫（階段一）
- **中期**：使用 Dataflow Pipeline 處理複雜轉換（階段四）
- **長期**：評估 Cloud Data Fusion 降低技術門檻

#### 3.2.3 Load（載入）階段

**當前實作**：
```python
# src/bigquery_uploader.py
class BigQueryUploader:
    def upload_table(self, table_name, records):
        """上傳資料到 BigQuery"""
        job_config = bigquery.LoadJobConfig(
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON
        )
        job = client.load_table_from_json(records, table_ref, job_config=job_config)
```

**GCP 技術對應**：

| 技術 | 應用建議 | 優先級 | 說明 |
|------|---------|--------|------|
| **BigQuery** | ✅ 當前使用，優化 | P0 | 資料倉儲，星狀模型 |
| **Cloud Storage** | ✅ 當前使用 | P0 | 資料暫存，備份 |
| **BigQuery Data Transfer Service** | 🟡 中期評估 | P2 | 自動化資料移轉 |

**改進建議**：
- **短期**：優化 BigQuery 載入策略（批次、分割區、叢集）
- **中期**：建立星狀模型（階段三）
- **長期**：評估 Data Transfer Service 自動化

---

## 4. GCP ETL 技術深度分析

### 4.1 Cloud Functions 深度分析

#### 4.1.1 技術特點

根據 [Google Cloud Functions 文件](https://cloud.google.com/functions/docs)：

**優勢**：
- ✅ **無伺服器架構**：自動擴展，按使用量計費
- ✅ **事件驅動**：支援 HTTP、Pub/Sub、Cloud Storage 觸發
- ✅ **快速部署**：支援 Python、Node.js、Go、Java
- ✅ **成本效益**：免費額度 200 萬次/月

**限制**：
- ⚠️ **執行時間限制**：最大 60 分鐘（Gen 2）
- ⚠️ **記憶體限制**：最大 32GB（Gen 2）
- ⚠️ **冷啟動延遲**：首次執行可能較慢

#### 4.1.2 RagicEDP 專案應用

**當前使用場景**：
```python
# Cloud Function 觸發器：Cloud Scheduler
# 執行頻率：每日凌晨 00:00
# 執行時間：約 5-10 分鐘
# 資料量：週增量 ~9,500 筆

def ragic_backup(request):
    """Ragic 備份 Cloud Function"""
    # Step 1: 查詢最後備份時間
    last_backup = get_last_backup_time()
    
    # Step 2: 從 Ragic API 擷取資料
    new_data = ragic_client.fetch_incremental(last_backup)
    
    # Step 3: 資料清洗和轉換
    cleaned_data = clean_data(new_data)
    
    # Step 4: 載入 BigQuery
    upload_to_bigquery(cleaned_data)
    
    return {'status': 'success', 'records': len(cleaned_data)}
```

**優化建議**：

1. **使用 Gen 2 Functions**
   ```python
   # 支援更長的執行時間和更大的記憶體
   # 適合處理大量資料
   ```

2. **並行處理**
   ```python
   import concurrent.futures
   
   def process_tables_parallel(tables):
       """並行處理多個表格"""
       with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
           futures = {
               executor.submit(process_table, table): table 
               for table in tables
           }
           results = []
           for future in concurrent.futures.as_completed(futures):
               results.append(future.result())
       return results
   ```

3. **批次處理優化**
   ```python
   def upload_to_bigquery_batch(records, batch_size=1000):
       """批次上傳 BigQuery"""
       for i in range(0, len(records), batch_size):
           batch = records[i:i+batch_size]
           job = client.load_table_from_json(
               batch, 
               table_ref,
               job_config=job_config
           )
           job.result()  # 等待完成
   ```

#### 4.1.3 最佳實踐

1. **錯誤處理和重試**
   ```python
   from google.api_core import retry
   
   @retry.Retry(predicate=retry.if_exception_type(Exception))
   def fetch_with_retry(url, max_retries=3):
       """帶重試的 API 呼叫"""
       response = requests.get(url, timeout=30)
       response.raise_for_status()
       return response.json()
   ```

2. **日誌記錄**
   ```python
   import logging
   from google.cloud import logging as cloud_logging
   
   client = cloud_logging.Client()
   client.setup_logging()
   logger = logging.getLogger(__name__)
   
   def ragic_backup(request):
       logger.info(f"開始備份，時間: {datetime.now()}")
       try:
           # 備份邏輯
           logger.info(f"備份完成，記錄數: {len(records)}")
       except Exception as e:
           logger.error(f"備份失敗: {str(e)}", exc_info=True)
           raise
   ```

3. **環境變數管理**
   ```python
   import os
   from google.cloud import secret_manager
   
   def get_secret(secret_id):
       """從 Secret Manager 取得機密資訊"""
       client = secret_manager.SecretManagerServiceClient()
       name = f"projects/{PROJECT_ID}/secrets/{secret_id}/versions/latest"
       response = client.access_secret_version(request={"name": name})
       return response.payload.data.decode("UTF-8")
   ```

### 4.2 Cloud Dataflow 深度分析

#### 4.2.1 技術特點

根據 [Google Cloud Dataflow 文件](https://cloud.google.com/dataflow/docs)：

**核心能力**：
- ✅ **Apache Beam SDK**：統一批次和串流處理模型
- ✅ **自動擴展**：根據資料量動態調整 worker 數量
- ✅ **容錯機制**：exactly-once 語義，自動重試失敗的任務
- ✅ **深度 GCP 整合**：原生支援 BigQuery、GCS、Pub/Sub

**適用場景**：
- 大規模批次處理（50 萬筆以上）
- 即時資料串流處理
- 複雜多階段轉換 Pipeline
- 需要精確一次處理語義

#### 4.2.2 RagicEDP 專案應用

**適用場景分析**：

| 場景 | 當前方案 | Dataflow 方案 | 效益 |
|------|---------|-------------|------|
| **增量處理** | Cloud Function | Cloud Function | ✅ 維持現狀 |
| **全量分析** | Cloud Function（慢） | Dataflow（快） | 🟡 處理時間減少 50-70% |
| **複雜轉換** | Python 腳本 | Dataflow Pipeline | 🟡 可並行處理 |
| **即時處理** | 不支援 | Pub/Sub + Dataflow | 🟡 未來需求 |

**Dataflow Pipeline 設計範例**：

```python
# dataflow/pipelines/ragic_etl_pipeline.py
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions
from apache_beam.io.gcp.bigquery import WriteToBigQuery

def run_pipeline():
    """Ragic ETL Dataflow Pipeline"""
    
    options = PipelineOptions(
        project='b25h01-ragic',
        region='asia-east1',
        temp_location='gs://ragic-temp/temp',
        staging_location='gs://ragic-temp/staging',
    )
    
    with beam.Pipeline(options=options) as p:
        # Step 1: 讀取原始資料
        raw_data = (
            p
            | 'Read from BigQuery' >> beam.io.ReadFromBigQuery(
                query='''
                    SELECT * 
                    FROM `b25h01-ragic.erp_backup.raw_orders`
                    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                ''',
                use_standard_sql=True
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
        fact_records | 'Write Fact Table' >> WriteToBigQuery(
            table='b25h01-ragic:erp_backup.fact_orders',
            write_disposition=WriteToBigQuery.WriteDisposition.WRITE_APPEND,
            create_disposition=WriteToBigQuery.CreateDisposition.CREATE_IF_NEEDED
        )
        
        dim_records | 'Write Dim Tables' >> WriteToBigQuery(
            table='b25h01-ragic:erp_backup.dim_*',
            write_disposition=WriteToBigQuery.WriteDisposition.WRITE_TRUNCATE,
            create_disposition=WriteToBigQuery.CreateDisposition.CREATE_IF_NEEDED
        )

class CleanDataFn(beam.DoFn):
    """資料清洗函數"""
    def __init__(self):
        self.rule_engine = RuleEngine()
    
    def process(self, element):
        """處理單筆記錄"""
        errors = self.rule_engine.validate(element)
        if errors:
            # 標記錯誤記錄
            element['_cleaning_flags'] = [e.rule_id for e in errors]
        else:
            # 自動修補
            element = self.rule_engine.auto_fix(element)
        yield element

class StandardizeFormatFn(beam.DoFn):
    """格式標準化函數"""
    def __init__(self):
        self.standardizer = StandardizationEngine()
    
    def process(self, element):
        """標準化記錄"""
        standardized = self.standardizer.standardize_record(element, 'orders')
        yield standardized
```

#### 4.2.3 成本優化策略

**1. 使用 FlexRS（Flexible Resource Scheduling）**
```python
options = PipelineOptions(
    flexrs_goal=FlexRSGoal.COST_OPTIMIZED,  # 成本優化模式
    # 使用預先購買的容量，降低成本
)
```

**2. 批次處理優化**
```python
# 累積批次處理，減少啟動成本
options = PipelineOptions(
    max_num_workers=10,  # 限制 worker 數量
    worker_machine_type='n1-standard-4',  # 選擇合適的機器類型
)
```

**3. 使用 Streaming Engine**
```python
# 串流處理時使用 Streaming Engine，降低延遲
options = PipelineOptions(
    enable_streaming_engine=True,
)
```

### 4.3 BigQuery 深度分析

#### 4.3.1 技術特點

根據 [BigQuery 文件](https://cloud.google.com/bigquery/docs)：

**核心能力**：
- ✅ **無伺服器架構**：自動擴展，無需管理基礎設施
- ✅ **大規模分析**：可處理 PB 級資料
- ✅ **快速查詢**：列式儲存，分散式查詢
- ✅ **標準 SQL**：支援標準 SQL 和 BigQuery ML

**進階功能**：
- ✅ **分割區表**：按日期或整數分割，提升查詢效能
- ✅ **叢集表**：按欄位叢集，優化查詢
- ✅ **物化視圖**：預計算結果，加速查詢
- ✅ **BigQuery ML**：內建機器學習功能

#### 4.3.2 RagicEDP 專案應用

**當前使用**：
```python
# 三層架構
raw_data → staging → dwh
```

**優化建議**：

**1. 分割區表設計**
```sql
-- 訂單表按日期分割
CREATE TABLE `erp_backup.raw_orders`
(
  order_id STRING,
  order_date DATE,
  customer_id STRING,
  -- 其他欄位
)
PARTITION BY order_date
CLUSTER BY brand_id, channel_id;
```

**2. 物化視圖優化**
```sql
-- 每日訂單統計物化視圖
CREATE MATERIALIZED VIEW `erp_backup.mv_daily_order_stats`
PARTITION BY order_date
CLUSTER BY brand_id, channel_id
AS
SELECT
  DATE(order_date) AS order_date,
  brand_id,
  channel_id,
  COUNT(DISTINCT order_id) AS order_count,
  SUM(order_amount) AS total_amount,
  AVG(order_amount) AS avg_order_amount
FROM `erp_backup.fact_orders`
GROUP BY DATE(order_date), brand_id, channel_id;
```

**3. 查詢優化**
```sql
-- 使用分割區過濾
SELECT * 
FROM `erp_backup.raw_orders`
WHERE order_date >= '2025-01-01'  -- 分割區過濾
  AND brand_id = 'GMK'            -- 叢集過濾
LIMIT 1000;
```

#### 4.3.3 載入策略優化

**1. 批次載入**
```python
from google.cloud import bigquery

def load_table_from_json_batch(client, table_id, records, batch_size=10000):
    """批次載入 BigQuery"""
    table_ref = client.dataset('erp_backup').table(table_id)
    
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        autodetect=True,
        # 分割區表設定
        time_partitioning=bigquery.TimePartitioning(
            field='order_date',
            type_=bigquery.TimePartitioningType.DAY
        ),
        # 叢集設定
        clustering_fields=['brand_id', 'channel_id']
    )
    
    # 分批載入
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        job = client.load_table_from_json(
            batch,
            table_ref,
            job_config=job_config
        )
        job.result()  # 等待完成
```

**2. 串流插入**
```python
def stream_insert(client, table_id, rows):
    """串流插入 BigQuery（即時資料）"""
    table_ref = client.dataset('erp_backup').table(table_id)
    errors = client.insert_rows_json(table_ref, rows)
    
    if errors:
        raise Exception(f"插入錯誤: {errors}")
```

**3. 使用 BigQuery Storage Write API**
```python
from google.cloud import bigquery_storage_v1

def write_with_storage_api(client, table_id, records):
    """使用 Storage Write API（高效能）"""
    write_client = bigquery_storage_v1.BigQueryWriteClient()
    stream_name = write_client.create_write_stream(
        parent=f"projects/{PROJECT_ID}/datasets/erp_backup/tables/{table_id}",
        write_stream=bigquery_storage_v1.types.WriteStream(
            type_=bigquery_storage_v1.types.WriteStream.Type.COMMITTED
        )
    )
    
    # 批次寫入
    request = bigquery_storage_v1.types.AppendRowsRequest(
        write_stream=stream_name.name,
        proto_rows=bigquery_storage_v1.types.AppendRowsRequest.ProtoData(
            rows=bigquery_storage_v1.types.ProtoRows(serialized_rows=records)
        )
    )
    
    write_client.append_rows(iter([request]))
```

### 4.4 Cloud Composer (Airflow) 深度分析

#### 4.4.1 技術特點

根據 [Cloud Composer 文件](https://cloud.google.com/composer/docs)：

**核心能力**：
- ✅ **託管 Airflow**：完全託管，無需管理基礎設施
- ✅ **GCP 整合**：原生整合 BigQuery、Dataflow、Cloud Functions
- ✅ **可擴展性**：自動擴展 worker 節點
- ✅ **監控和日誌**：整合 Cloud Monitoring 和 Cloud Logging

**適用場景**：
- 複雜工作流編排
- 多步驟 ETL 流程
- 任務依賴管理
- 錯誤重試和告警

#### 4.4.2 RagicEDP 專案應用

**當前架構**：
```
Cloud Scheduler → Cloud Function → BigQuery
```

**Airflow DAG 設計**：

```python
# dags/ragic_etl_dag.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.google.cloud.operators.bigquery import BigQueryOperator
from airflow.providers.google.cloud.operators.dataflow import DataflowStartFlexTemplateOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'ragic_edp',
    'depends_on_past': False,
    'start_date': datetime(2025, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'ragic_etl_pipeline',
    default_args=default_args,
    description='Ragic ETL Pipeline',
    schedule_interval='0 0 * * *',  # 每日凌晨執行
    catchup=False,
    tags=['ragic', 'etl'],
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

# Task 3: 資料轉換（使用 Dataflow）
transform_task = DataflowStartFlexTemplateOperator(
    task_id='transform_with_dataflow',
    template='gs://ragic-templates/ragic-etl-template.json',
    parameters={
        'input_table': 'erp_backup.raw_orders',
        'output_table': 'erp_backup.dwh_orders',
    },
    dag=dag,
)

# Task 4: 建立星狀模型
build_star_schema_task = BigQueryOperator(
    task_id='build_star_schema',
    sql='''
    INSERT INTO `erp_backup.fact_orders`
    SELECT
      order_id,
      order_date,
      customer_id,
      brand_id,
      channel_id,
      product_id,
      payment_id,
      logistics_id,
      quantity,
      order_amount,
      shipping_fee,
      total_amount
    FROM `erp_backup.dwh_orders`
    WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    ''',
    dag=dag,
)

# Task 5: 更新物化視圖
refresh_mv_task = BigQueryOperator(
    task_id='refresh_materialized_views',
    sql='''
    CALL `erp_backup.refresh_materialized_views`();
    ''',
    dag=dag,
)

# Task 6: 產生報告
generate_report_task = PythonOperator(
    task_id='generate_report',
    python_callable=generate_report,
    dag=dag,
)

# 定義依賴關係
backup_task >> clean_task >> transform_task >> build_star_schema_task >> refresh_mv_task >> generate_report_task
```

#### 4.4.3 最佳實踐

**1. 任務依賴管理**
```python
# 使用 TaskGroup 組織任務
from airflow.utils.task_group import TaskGroup

with TaskGroup("extract_group") as extract_group:
    backup_orders = PythonOperator(...)
    backup_customers = PythonOperator(...)
    backup_products = PythonOperator(...)

with TaskGroup("transform_group") as transform_group:
    clean_orders = PythonOperator(...)
    clean_customers = PythonOperator(...)
    clean_products = PythonOperator(...)

extract_group >> transform_group
```

**2. 錯誤處理和重試**
```python
# 自訂重試邏輯
def retry_on_failure(context):
    """自訂重試邏輯"""
    task_instance = context['task_instance']
    retry_count = task_instance.try_number
    
    if retry_count <= 3:
        return timedelta(minutes=5 * retry_count)  # 指數退避
    return None

task = PythonOperator(
    task_id='backup_task',
    python_callable=backup_function,
    retries=3,
    retry_delay=timedelta(minutes=5),
    on_retry_callback=retry_on_failure,
)
```

**3. 監控和告警**
```python
# 使用 Airflow Sensors 監控條件
from airflow.sensors.bash import BashSensor

check_data_ready = BashSensor(
    task_id='check_data_ready',
    bash_command='bq query --use_legacy_sql=false "SELECT COUNT(*) FROM `erp_backup.raw_orders`"',
    poke_interval=60,  # 每 60 秒檢查一次
    timeout=600,  # 10 分鐘超時
)
```

### 4.5 Pub/Sub + Dataflow 串流處理

#### 4.5.1 技術特點

**Pub/Sub 核心能力**：
- ✅ **全球訊息傳遞**：低延遲，高可用性
- ✅ **至少一次傳遞**：確保訊息不遺失
- ✅ **自動擴展**：根據訊息量自動調整
- ✅ **與 GCP 深度整合**：支援多種觸發器

**串流處理架構**：
```
Ragic API → Pub/Sub Topic → Dataflow Streaming → BigQuery
```

#### 4.5.2 RagicEDP 專案應用

**適用場景**：
- 即時資料處理需求
- 事件驅動架構
- 即時分析和告警

**實作範例**：

```python
# pubsub/ragic_streaming_pipeline.py
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions
from apache_beam.io.gcp.pubsub import ReadFromPubSub

def run_streaming_pipeline():
    """Ragic 串流處理 Pipeline"""
    
    options = PipelineOptions(
        project='b25h01-ragic',
        region='asia-east1',
        streaming=True,  # 啟用串流模式
    )
    
    with beam.Pipeline(options=options) as p:
        # Step 1: 從 Pub/Sub 讀取訊息
        messages = (
            p
            | 'Read from Pub/Sub' >> ReadFromPubSub(
                topic='projects/b25h01-ragic/topics/ragic-orders'
            )
        )
        
        # Step 2: 解析 JSON
        records = (
            messages
            | 'Parse JSON' >> beam.Map(lambda x: json.loads(x.decode('utf-8')))
        )
        
        # Step 3: 資料清洗和轉換
        cleaned = (
            records
            | 'Clean Data' >> beam.ParDo(CleanDataFn())
            | 'Standardize Format' >> beam.ParDo(StandardizeFormatFn())
        )
        
        # Step 4: 寫入 BigQuery（串流插入）
        cleaned | 'Write to BigQuery' >> beam.io.WriteToBigQuery(
            table='b25h01-ragic:erp_backup.raw_orders',
            write_disposition=beam.io.BigQueryDisposition.WRITE_APPEND,
            create_disposition=beam.io.BigQueryCreateDisposition.CREATE_IF_NEEDED,
            method=beam.io.BigQueryWriteMethod.STREAMING_INSERTS  # 串流插入
        )
```

**觸發機制**：

```python
# Cloud Function 觸發 Pub/Sub
def ragic_webhook(request):
    """Ragic Webhook 觸發器"""
    data = request.get_json()
    
    # 發布到 Pub/Sub
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path('b25h01-ragic', 'ragic-orders')
    
    message_data = json.dumps(data).encode('utf-8')
    future = publisher.publish(topic_path, message_data)
    
    return {'message_id': future.result()}
```

### 4.6 BigQuery Data Transfer Service

#### 4.6.1 技術特點

**核心能力**：
- ✅ **自動化資料移轉**：預建連接器，排程自動化
- ✅ **多種資料來源**：支援 Google Ads、Amazon S3、Salesforce 等
- ✅ **增量同步**：自動偵測變更，只同步新資料
- ✅ **錯誤處理**：自動重試，錯誤通知

#### 4.6.2 RagicEDP 專案應用

**適用場景**：
- 自動化資料移轉
- 定期資料同步
- 多來源資料整合

**實作方式**：

```python
# 使用 BigQuery Data Transfer API
from google.cloud import bigquery_datatransfer

def create_transfer_config():
    """建立資料移轉配置"""
    client = bigquery_datatransfer.DataTransferServiceClient()
    
    # 注意：Ragic API 不在預建連接器中
    # 需要自訂連接器或使用 Cloud Function
    
    parent = client.common_project_path('b25h01-ragic')
    
    transfer_config = bigquery_datatransfer.TransferConfig(
        destination_dataset_id='erp_backup',
        display_name='Ragic Orders Transfer',
        data_source_id='scheduled_query',  # 使用排程查詢
        params={
            'query': '''
                SELECT * 
                FROM EXTERNAL_QUERY(
                    'ragic-connection',
                    'SELECT * FROM orders WHERE updated_at > @last_run_time'
                )
            ''',
        },
        schedule='every 24 hours',
    )
    
    response = client.create_transfer_config(
        parent=parent,
        transfer_config=transfer_config
    )
    
    return response
```

**替代方案**：使用 Cloud Function + Cloud Scheduler

```python
# Cloud Function 模擬 Data Transfer Service
def ragic_transfer_scheduler(request):
    """定期資料移轉"""
    # 查詢最後移轉時間
    last_transfer = get_last_transfer_time()
    
    # 從 Ragic API 取得資料
    new_data = ragic_client.fetch_incremental(last_transfer)
    
    # 載入 BigQuery
    upload_to_bigquery(new_data)
    
    # 更新最後移轉時間
    update_last_transfer_time()
    
    return {'status': 'success'}
```

### 4.7 Cloud Data Fusion（視覺化 ETL）

#### 4.7.1 技術特點

**核心能力**：
- ✅ **視覺化設計**：拖放式介面，降低技術門檻
- ✅ **預建連接器**：支援多種資料來源和目標
- ✅ **自動擴展**：根據資料量自動調整資源
- ✅ **版本控制**：支援 Pipeline 版本管理

**適用場景**：
- 降低技術門檻
- 快速開發 ETL Pipeline
- 非技術人員使用

#### 4.7.2 RagicEDP 專案應用

**評估考量**：

| 項目 | 評估 | 說明 |
|------|------|------|
| **技術門檻** | 🟡 可降低 | 視覺化介面，非技術人員可使用 |
| **成本** | ⚠️ 較高 | 基礎費用 $120/月 + 使用費 |
| **靈活性** | ⚠️ 較低 | 受限於預建連接器和功能 |
| **Ragic 整合** | ⚠️ 需自訂 | Ragic API 不在預建連接器中 |

**建議**：
- 🟡 目前階段不建議導入
- 🟡 未來如有非技術人員需求再考慮
- ✅ 優先使用程式碼方式（Cloud Functions、Dataflow）

---

## 5. 實際應用方案

### 5.1 方案一：當前架構優化（短期）

#### 5.1.1 架構設計

```
┌─────────────────────────────────────────────────────────┐
│            RagicEDP ETL 架構（優化版）                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Cloud Scheduler                                        │
│      ↓                                                 │
│  Cloud Function (Gen 2)                                 │
│      ├── Extract: Ragic API 擷取                      │
│      ├── Transform: 規則引擎 + 標準化函數庫             │
│      └── Load: BigQuery 批次載入                        │
│      ↓                                                 │
│  BigQuery                                               │
│      ├── raw_data (分割區表)                           │
│      ├── staging (暫存層)                              │
│      └── dwh (分析層)                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 5.1.2 優化重點

**1. Cloud Function 優化**
- 升級至 Gen 2（支援更長執行時間）
- 實作並行處理（多表格同時處理）
- 優化批次載入（減少 API 呼叫次數）

**2. BigQuery 優化**
- 建立分割區表（按日期分割）
- 建立叢集表（按品牌、通路叢集）
- 優化載入策略（批次大小、並行載入）

**3. 規則引擎化**
- 將 87 條規則遷移至 YAML 配置
- 建立規則執行引擎
- 支援自動修補

#### 5.1.3 實施步驟

**步驟 1：升級 Cloud Function（第 1 個月）**

```python
# 使用 Gen 2 Functions
# requirements.txt
functions-framework==3.*
google-cloud-bigquery==3.*
google-cloud-logging==3.*

# main.py
import functions_framework
from google.cloud import bigquery, logging

@functions_framework.cloud_event
def ragic_backup(cloud_event):
    """Gen 2 Cloud Function"""
    # 使用 CloudEvent 觸發
    # 支援更長的執行時間和更大的記憶體
    pass
```

**步驟 2：實作規則引擎（第 1-2 個月）**

```python
# src/rules/rule_engine.py
import yaml
from typing import List, Dict, Any

class RuleEngine:
    def __init__(self, config_path='rules/'):
        self.rules = self._load_rules(config_path)
    
    def _load_rules(self, config_path):
        """載入規則配置"""
        rules = []
        for file in Path(config_path).glob('*.yaml'):
            with open(file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                for rule_config in config.get('rules', []):
                    rules.append(Rule.from_config(rule_config))
        return rules
    
    def validate(self, record: Dict[str, Any]) -> List[ValidationResult]:
        """驗證記錄"""
        results = []
        for rule in self.rules:
            if rule.applies_to(record):
                if not rule.validate(record):
                    results.append(ValidationResult(rule, record))
        return results
    
    def auto_fix(self, record: Dict[str, Any], rule: Rule) -> Dict[str, Any]:
        """自動修補"""
        if rule.auto_fix:
            return rule.fix_strategy.apply(record)
        return record
```

**步驟 3：優化 BigQuery 載入（第 2 個月）**

```python
# src/bigquery_uploader.py
from google.cloud import bigquery

class OptimizedBigQueryUploader:
    def __init__(self, project_id='b25h01-ragic', dataset_id='erp_backup'):
        self.client = bigquery.Client(project=project_id)
        self.dataset_id = dataset_id
    
    def upload_table_optimized(self, table_id, records):
        """優化載入策略"""
        table_ref = self.client.dataset(self.dataset_id).table(table_id)
        
        # 檢查表是否存在，如不存在則建立
        try:
            table = self.client.get_table(table_ref)
        except NotFound:
            # 建立分割區表
            schema = self._get_schema(table_id)
            table = bigquery.Table(table_ref, schema=schema)
            table.time_partitioning = bigquery.TimePartitioning(
                field='order_date',
                type_=bigquery.TimePartitioningType.DAY
            )
            table.clustering_fields = ['brand_id', 'channel_id']
            table = self.client.create_table(table)
        
        # 批次載入
        job_config = bigquery.LoadJobConfig(
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            autodetect=False,
            schema=table.schema,
        )
        
        # 分批載入，每批 10,000 筆
        batch_size = 10000
        for i in range(0, len(records), batch_size):
            batch = records[i:i+batch_size]
            job = self.client.load_table_from_json(
                batch,
                table_ref,
                job_config=job_config
            )
            job.result()  # 等待完成
```

### 5.2 方案二：Dataflow Pipeline 導入（中期）

#### 5.2.1 架構設計

```
┌─────────────────────────────────────────────────────────┐
│         RagicEDP ETL 架構（Dataflow 版）                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Cloud Scheduler                                        │
│      ↓                                                 │
│  Cloud Function (觸發器)                                 │
│      ↓                                                 │
│  Cloud Dataflow Pipeline                                │
│      ├── Read: BigQuery (raw_data)                     │
│      ├── Transform: 規則引擎 + 標準化                   │
│      ├── Enrich: 資料富集                              │
│      └── Write: BigQuery (dwh + star schema)           │
│      ↓                                                 │
│  BigQuery                                               │
│      ├── fact_orders (事實表)                          │
│      ├── dim_brands (維度表)                           │
│      ├── dim_customers (維度表)                        │
│      └── mv_* (物化視圖)                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 5.2.2 實施步驟

**步驟 1：建立 Dataflow Template（第 4 個月）**

```python
# dataflow/templates/ragic_etl_template.py
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions

def run_pipeline(argv=None):
    """Ragic ETL Pipeline"""
    
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--input_table',
        required=True,
        help='輸入表（BigQuery）'
    )
    parser.add_argument(
        '--output_table',
        required=True,
        help='輸出表（BigQuery）'
    )
    
    known_args, pipeline_args = parser.parse_known_args(argv)
    
    options = PipelineOptions(pipeline_args)
    
    with beam.Pipeline(options=options) as p:
        # Pipeline 邏輯
        (p
         | 'Read' >> beam.io.ReadFromBigQuery(table=known_args.input_table)
         | 'Transform' >> beam.ParDo(TransformFn())
         | 'Write' >> beam.io.WriteToBigQuery(table=known_args.output_table)
        )

if __name__ == '__main__':
    run_pipeline()
```

**步驟 2：部署 Template（第 4 個月）**

```bash
# 建立 Flex Template
gcloud dataflow flex-template build gs://ragic-templates/ragic-etl-template.json \
  --image gcr.io/b25h01-ragic/ragic-etl:latest \
  --sdk-language PYTHON \
  --metadata-file metadata.json
```

**步驟 3：整合到 Airflow（第 5 個月）**

```python
# dags/ragic_dataflow_dag.py
from airflow.providers.google.cloud.operators.dataflow import DataflowStartFlexTemplateOperator

transform_task = DataflowStartFlexTemplateOperator(
    task_id='transform_with_dataflow',
    template='gs://ragic-templates/ragic-etl-template.json',
    parameters={
        'input_table': 'erp_backup.raw_orders',
        'output_table': 'erp_backup.dwh_orders',
    },
    location='asia-east1',
    dag=dag,
)
```

### 5.3 方案三：串流處理架構（長期）

#### 5.3.1 架構設計

```
┌─────────────────────────────────────────────────────────┐
│        RagicEDP ETL 架構（串流處理版）                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Ragic API (Webhook)                                    │
│      ↓                                                 │
│  Cloud Function (Webhook Handler)                       │
│      ↓                                                 │
│  Pub/Sub Topic                                          │
│      ↓                                                 │
│  Cloud Dataflow (Streaming)                             │
│      ├── Parse: JSON 解析                              │
│      ├── Transform: 即時清洗和轉換                      │
│      └── Write: BigQuery Streaming Insert              │
│      ↓                                                 │
│  BigQuery (即時資料)                                    │
│      ↓                                                 │
│  Cloud Monitoring (即時告警)                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 5.3.2 實施考量

**適用場景**：
- 即時資料處理需求
- 事件驅動架構
- 即時分析和告警

**成本考量**：
- Pub/Sub：$40/百萬訊息
- Dataflow Streaming：$0.01/GB 處理
- 預估月成本：$100-200（視訊息量而定）

**建議**：
- 🟡 目前階段不建議導入
- 🟡 未來如有即時處理需求再考慮
- ✅ 優先完成批次處理優化

---

## 6. 實施路線圖

### 6.1 整體時程

```
月份    1    2    3    4    5    6    7    8
階段一  ████ (規則引擎、標準化函數庫)
階段二        ████████ (映射配置、富集規則)
階段三              ████████ (星狀模型、聚合計算)
階段四                    ████████ (Airflow、dbt)
Dataflow                          ████ (Dataflow Pipeline)
串流評估                                    ████ (Pub/Sub + Dataflow)
```

### 6.2 詳細實施計劃

#### 階段一：基礎建設（第 1-2 個月）

**目標**：建立規則引擎和標準化函數庫

| 任務 | GCP 技術 | 說明 | 優先級 |
|------|---------|------|--------|
| 規則引擎實作 | Cloud Function | 建立規則配置系統 | P0 |
| 標準化函數庫 | Cloud Function | 統一標準化邏輯 | P0 |
| 驗證追蹤系統 | BigQuery | 建立驗證結果表 | P1 |
| 日誌記錄系統 | Cloud Logging | 整合結構化日誌 | P1 |

#### 階段二：功能擴展（第 2-3 個月）

**目標**：建立映射配置和富集規則庫

| 任務 | GCP 技術 | 說明 | 優先級 |
|------|---------|------|--------|
| 映射配置系統 | Cloud Function | 統一欄位映射 | P1 |
| 富集規則庫 | Cloud Function | 統一富集邏輯 | P1 |
| 增量處理優化 | Cloud Function | 只處理新增/變更 | P2 |
| 自動修補機制 | Cloud Function | 自動修補問題 | P2 |

#### 階段三：進階功能（第 3-4 個月）

**目標**：建立星狀模型和聚合計算

| 任務 | GCP 技術 | 說明 | 優先級 |
|------|---------|------|--------|
| 星狀模型建立 | BigQuery | 事實表和維度表 | P1 |
| 聚合計算實作 | BigQuery | 統計匯總和衍生指標 | P1 |
| 物化視圖優化 | BigQuery | 提升查詢效能 | P2 |
| 外部資料整合 | Cloud Function | 整合外部 API | P3 |

#### 階段四：工具整合（第 4-6 個月）

**目標**：導入專業 ETL 工具

| 任務 | GCP 技術 | 說明 | 優先級 |
|------|---------|------|--------|
| Airflow 導入 | Cloud Composer | 工作流管理 | P2 |
| dbt 導入 | BigQuery | SQL 轉換 | P2 |
| Dataflow 評估 | Dataflow | 大規模處理評估 | P3 |

#### 階段五：Dataflow 深化（第 6-7 個月）

**目標**：深化 Dataflow 技術應用

| 任務 | GCP 技術 | 說明 | 優先級 |
|------|---------|------|--------|
| Dataflow Pipeline | Dataflow | 大規模處理 Pipeline | P2 |
| BigQuery Transfer | Data Transfer Service | 自動化資料移轉 | P2 |
| 效能優化 | Dataflow | 成本優化，效能調校 | P2 |

#### 階段六：串流處理評估（第 7-8 個月）

**目標**：評估串流處理需求

| 任務 | GCP 技術 | 說明 | 優先級 |
|------|---------|------|--------|
| Pub/Sub 評估 | Pub/Sub | 即時訊息傳遞評估 | P3 |
| 串流 Pipeline | Dataflow Streaming | 串流處理評估 | P3 |
| 即時分析 | BigQuery Streaming | 即時分析需求評估 | P3 |

---

## 7. 成本效益分析

### 7.1 GCP 服務成本估算

根據 [Google Cloud 定價](https://cloud.google.com/pricing)，估算如下：

#### 7.1.1 當前架構成本

| 服務 | 使用量 | 月成本 | 年成本 |
|------|--------|--------|--------|
| **Cloud Function** | 週執行 1 次，每次 5 分鐘，256MB | $1-5 | $12-60 |
| **BigQuery** | 461K 筆查詢，50GB 儲存 | $10-20 | $120-240 |
| **Cloud Storage** | 1GB 儲存 | $0.02 | $0.24 |
| **Cloud Logging** | 10GB 日誌 | $0.50 | $6 |
| **Cloud Scheduler** | 30 次/月 | $0.10 | $1.20 |
| **總計** | - | **$11.62-25.62** | **$139.44-307.44** |

#### 7.1.2 優化後架構成本

| 服務 | 使用量 | 月成本 | 年成本 |
|------|--------|--------|--------|
| **Cloud Function (Gen 2)** | 週執行 1 次，每次 3 分鐘，512MB | $2-8 | $24-96 |
| **BigQuery** | 461K 筆查詢，50GB 儲存，分割區表 | $10-20 | $120-240 |
| **Cloud Storage** | 1GB 儲存 | $0.02 | $0.24 |
| **Cloud Logging** | 10GB 日誌 | $0.50 | $6 |
| **Cloud Scheduler** | 30 次/月 | $0.10 | $1.20 |
| **總計** | - | **$12.62-28.62** | **$151.44-343.44** |

#### 7.1.3 Dataflow 導入後成本

| 服務 | 使用量 | 月成本 | 年成本 |
|------|--------|--------|--------|
| **Cloud Function** | 週執行 1 次，觸發 Dataflow | $1-3 | $12-36 |
| **Cloud Dataflow** | 週執行 1 次，50 萬筆，FlexRS | $10-30 | $120-360 |
| **BigQuery** | 461K 筆查詢，50GB 儲存 | $10-20 | $120-240 |
| **Cloud Storage** | 1GB 儲存 | $0.02 | $0.24 |
| **Cloud Composer** | Airflow，3-node cluster | $50-100 | $600-1200 |
| **總計** | - | **$71-153** | **$852-1836** |

#### 7.1.4 串流處理成本（如導入）

| 服務 | 使用量 | 月成本 | 年成本 |
|------|--------|--------|--------|
| **Pub/Sub** | 100 萬訊息/月 | $40 | $480 |
| **Dataflow Streaming** | 24/7 運行，10GB/小時 | $70-150 | $840-1800 |
| **BigQuery Streaming** | 100 萬筆插入/月 | $5 | $60 |
| **總計** | - | **$115-195** | **$1380-2340** |

### 7.2 成本效益比較

| 方案 | 月成本 | 年成本 | 處理能力 | 建議 |
|------|--------|--------|---------|------|
| **當前架構** | $11.62-25.62 | $139.44-307.44 | 週增量 9,500 筆 | ✅ 維持 |
| **優化後架構** | $12.62-28.62 | $151.44-343.44 | 週增量 9,500 筆 | ✅ 推薦 |
| **Dataflow 導入** | $71-153 | $852-1836 | 50 萬筆全量 | 🟡 中期考慮 |
| **串流處理** | $115-195 | $1380-2340 | 即時處理 | 🟡 長期考慮 |

**結論**：
- ✅ **當前架構成本最低**，適合當前資料量
- ✅ **優化後架構**成本略增，但效能提升明顯
- 🟡 **Dataflow 導入**成本較高，適合大規模處理需求
- 🟡 **串流處理**成本最高，適合即時處理需求

### 7.3 成本優化建議

**1. BigQuery 成本優化**
```sql
-- 使用分割區過濾，減少掃描資料量
SELECT * 
FROM `erp_backup.raw_orders`
WHERE order_date >= '2025-01-01'  -- 分割區過濾
  AND order_date < '2025-02-01';

-- 使用叢集過濾，進一步減少掃描
SELECT * 
FROM `erp_backup.raw_orders`
WHERE order_date >= '2025-01-01'
  AND brand_id = 'GMK'  -- 叢集過濾
LIMIT 1000;
```

**2. Cloud Function 成本優化**
```python
# 使用適當的記憶體配置
# 256MB: $0.0000025/GB-秒
# 512MB: $0.000005/GB-秒
# 1GB: $0.00001/GB-秒

# 選擇最小但足夠的記憶體配置
```

**3. Dataflow 成本優化**
```python
# 使用 FlexRS（Flexible Resource Scheduling）
options = PipelineOptions(
    flexrs_goal=FlexRSGoal.COST_OPTIMIZED,  # 成本優化
    # 使用預先購買的容量，降低成本
)

# 限制 worker 數量
options = PipelineOptions(
    max_num_workers=10,  # 限制最大 worker 數
)
```

---

## 8. 最佳實踐與優化

### 8.1 Cloud Functions 最佳實踐

#### 8.1.1 效能優化

**1. 使用適當的記憶體配置**
```python
# 根據資料量選擇記憶體
# 小資料量（< 1MB）：256MB
# 中資料量（1-10MB）：512MB
# 大資料量（> 10MB）：1GB 或更高
```

**2. 並行處理**
```python
import concurrent.futures

def process_tables_parallel(tables):
    """並行處理多個表格"""
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(process_table, table): table 
            for table in tables
        }
        results = []
        for future in concurrent.futures.as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                logger.error(f"處理失敗: {e}")
        return results
```

**3. 批次處理**
```python
def upload_to_bigquery_batch(records, batch_size=10000):
    """批次上傳 BigQuery"""
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        job = client.load_table_from_json(
            batch,
            table_ref,
            job_config=job_config
        )
        job.result()  # 等待完成
```

#### 8.1.2 錯誤處理

**1. 重試機制**
```python
from google.api_core import retry
import time

@retry.Retry(
    predicate=retry.if_exception_type(Exception),
    initial=1.0,
    maximum=60.0,
    multiplier=2.0
)
def fetch_with_retry(url):
    """帶重試的 API 呼叫"""
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.json()
```

**2. 錯誤記錄**
```python
import logging
from google.cloud import logging as cloud_logging

client = cloud_logging.Client()
client.setup_logging()
logger = logging.getLogger(__name__)

def ragic_backup(request):
    try:
        # 備份邏輯
        logger.info(f"備份完成，記錄數: {len(records)}")
    except Exception as e:
        logger.error(f"備份失敗: {str(e)}", exc_info=True)
        # 發送告警
        send_alert(f"備份失敗: {str(e)}")
        raise
```

#### 8.1.3 安全性

**1. 使用 Secret Manager**
```python
from google.cloud import secret_manager

def get_secret(secret_id):
    """從 Secret Manager 取得機密資訊"""
    client = secret_manager.SecretManagerServiceClient()
    name = f"projects/{PROJECT_ID}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

# 使用
api_key = get_secret('ragic-api-key')
```

**2. IAM 權限最小化**
```yaml
# IAM 角色設定
roles:
  - roles/bigquery.dataEditor  # 只能編輯資料
  - roles/bigquery.jobUser     # 只能執行作業
  # 不給予 roles/bigquery.admin
```

### 8.2 Dataflow 最佳實踐

#### 8.2.1 Pipeline 設計

**1. 使用 ParDo 進行轉換**
```python
class CleanDataFn(beam.DoFn):
    """資料清洗函數"""
    def setup(self):
        """初始化（每個 worker 執行一次）"""
        self.rule_engine = RuleEngine()
    
    def process(self, element):
        """處理單筆記錄"""
        cleaned = self.rule_engine.clean(element)
        yield cleaned
    
    def teardown(self):
        """清理（每個 worker 執行一次）"""
        pass
```

**2. 使用 Combine 進行聚合**
```python
class SumAmounts(beam.CombineFn):
    """金額匯總"""
    def create_accumulator(self):
        return 0
    
    def add_input(self, accumulator, element):
        return accumulator + element.get('amount', 0)
    
    def merge_accumulators(self, accumulators):
        return sum(accumulators)
    
    def extract_output(self, accumulator):
        return accumulator

# 使用
total_amount = (
    records
    | 'Sum Amounts' >> beam.CombineGlobally(SumAmounts())
)
```

**3. 使用 GroupByKey 進行分組**
```python
# 按品牌分組
grouped = (
    records
    | 'Key by Brand' >> beam.Map(lambda r: (r['brand_id'], r))
    | 'Group by Brand' >> beam.GroupByKey()
    | 'Process Group' >> beam.ParDo(ProcessBrandGroupFn())
)
```

#### 8.2.2 效能優化

**1. 使用 Windowing**
```python
# 時間視窗處理
windowed = (
    records
    | 'Window' >> beam.WindowInto(
        beam.window.FixedWindows(60)  # 60 秒視窗
    )
    | 'Aggregate' >> beam.CombineGlobally(SumAmounts())
)
```

**2. 使用 Side Inputs**
```python
# 使用側輸入（參考資料）
brands = (
    p
    | 'Read Brands' >> beam.io.ReadFromBigQuery(...)
    | 'As Dict' >> beam.Map(lambda x: (x['brand_id'], x))
)

enriched = (
    records
    | 'Enrich with Brands' >> beam.ParDo(
        EnrichWithBrandsFn(),
        brands=beam.pvalue.AsDict(brands)
    )
)
```

**3. 使用 Fusion 優化**
```python
# 避免不必要的序列化/反序列化
options = PipelineOptions(
    # 啟用 Fusion 優化
    experiments=['beam_fn_api'],
)
```

### 8.3 BigQuery 最佳實踐

#### 8.3.1 表設計

**1. 分割區表**
```sql
-- 按日期分割
CREATE TABLE `erp_backup.raw_orders`
(
  order_id STRING,
  order_date DATE,
  -- 其他欄位
)
PARTITION BY order_date
CLUSTER BY brand_id, channel_id;
```

**2. 叢集表**
```sql
-- 按品牌和通路叢集
CREATE TABLE `erp_backup.fact_orders`
(
  order_id STRING,
  brand_id STRING,
  channel_id STRING,
  -- 其他欄位
)
CLUSTER BY brand_id, channel_id;
```

**3. 物化視圖**
```sql
-- 每日統計物化視圖
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

#### 8.3.2 查詢優化

**1. 使用分割區過濾**
```sql
-- ✅ 好的查詢（使用分割區過濾）
SELECT * 
FROM `erp_backup.raw_orders`
WHERE order_date >= '2025-01-01'  -- 分割區過濾
  AND order_date < '2025-02-01';

-- ❌ 不好的查詢（全表掃描）
SELECT * 
FROM `erp_backup.raw_orders`
WHERE order_id = 'ORD001';  -- 沒有分割區過濾
```

**2. 使用叢集過濾**
```sql
-- ✅ 好的查詢（使用叢集過濾）
SELECT * 
FROM `erp_backup.fact_orders`
WHERE order_date >= '2025-01-01'
  AND brand_id = 'GMK'  -- 叢集過濾
  AND channel_id = 'CH001';

-- ❌ 不好的查詢（沒有叢集過濾）
SELECT * 
FROM `erp_backup.fact_orders`
WHERE order_date >= '2025-01-01'
  AND customer_id = 'CUST001';  -- 沒有叢集欄位
```

**3. 使用 LIMIT**
```sql
-- ✅ 好的查詢（限制結果數量）
SELECT * 
FROM `erp_backup.raw_orders`
WHERE order_date >= '2025-01-01'
LIMIT 1000;

-- ❌ 不好的查詢（返回所有結果）
SELECT * 
FROM `erp_backup.raw_orders`
WHERE order_date >= '2025-01-01';
```

#### 8.3.3 載入優化

**1. 批次載入**
```python
# 使用批次載入，每批 10,000 筆
def load_table_batch(client, table_id, records, batch_size=10000):
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        job = client.load_table_from_json(batch, table_ref, job_config=job_config)
        job.result()
```

**2. 並行載入**
```python
# 並行載入多個表格
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    futures = {
        executor.submit(load_table, table_id, records): table_id
        for table_id, records in tables.items()
    }
    for future in concurrent.futures.as_completed(futures):
        future.result()
```

**3. 使用 Storage Write API**
```python
# 使用 Storage Write API（高效能）
from google.cloud import bigquery_storage_v1

write_client = bigquery_storage_v1.BigQueryWriteClient()
stream = write_client.create_write_stream(...)
write_client.append_rows(stream, rows)
```

### 8.4 Cloud Composer 最佳實踐

#### 8.4.1 DAG 設計

**1. 任務分組**
```python
from airflow.utils.task_group import TaskGroup

with TaskGroup("extract_group") as extract_group:
    backup_orders = PythonOperator(...)
    backup_customers = PythonOperator(...)
    backup_products = PythonOperator(...)

with TaskGroup("transform_group") as transform_group:
    clean_orders = PythonOperator(...)
    clean_customers = PythonOperator(...)
    clean_products = PythonOperator(...)

extract_group >> transform_group
```

**2. 錯誤處理**
```python
# 使用 on_failure_callback
def failure_callback(context):
    """失敗回調"""
    task_instance = context['task_instance']
    logger.error(f"任務失敗: {task_instance.task_id}")
    send_alert(f"任務失敗: {task_instance.task_id}")

task = PythonOperator(
    task_id='backup_task',
    python_callable=backup_function,
    on_failure_callback=failure_callback,
)
```

**3. 任務重試**
```python
# 指數退避重試
def retry_delay(context):
    """自訂重試延遲"""
    return timedelta(minutes=5 * context['task_instance'].try_number)

task = PythonOperator(
    task_id='backup_task',
    python_callable=backup_function,
    retries=3,
    retry_delay=timedelta(minutes=5),
    retry_exponential_backoff=True,
    max_retry_delay=timedelta(minutes=30),
)
```

#### 8.4.2 監控和告警

**1. 使用 Sensors**
```python
from airflow.sensors.bash import BashSensor

check_data_ready = BashSensor(
    task_id='check_data_ready',
    bash_command='bq query --use_legacy_sql=false "SELECT COUNT(*) FROM `erp_backup.raw_orders`"',
    poke_interval=60,
    timeout=600,
)
```

**2. 使用 Callbacks**
```python
def success_callback(context):
    """成功回調"""
    logger.info(f"任務成功: {context['task_instance'].task_id}")

def failure_callback(context):
    """失敗回調"""
    logger.error(f"任務失敗: {context['task_instance'].task_id}")
    send_alert(f"任務失敗: {context['task_instance'].task_id}")

task = PythonOperator(
    task_id='backup_task',
    python_callable=backup_function,
    on_success_callback=success_callback,
    on_failure_callback=failure_callback,
)
```

---

## 9. 風險與挑戰

### 9.1 技術風險

| 風險 | 影響 | 機率 | 緩解措施 |
|------|------|------|---------|
| **Dataflow 學習曲線** | 中 | 中 | 提供培訓，建立範例，漸進式導入 |
| **效能問題** | 中 | 低 | 效能測試，優化關鍵路徑，監控 |
| **成本超支** | 中 | 中 | 成本監控，設定預算告警，優化資源 |
| **相容性問題** | 中 | 低 | 向後相容設計，版本控制，充分測試 |

### 9.2 業務風險

| 風險 | 影響 | 機率 | 緩解措施 |
|------|------|------|---------|
| **資料品質下降** | 高 | 低 | 充分測試，驗證機制，人工審核 |
| **服務中斷** | 高 | 低 | 漸進式部署，回滾機制，監控告警 |
| **處理延遲** | 中 | 低 | 效能測試，優化關鍵路徑，監控 |

### 9.3 組織風險

| 風險 | 影響 | 機率 | 緩解措施 |
|------|------|------|---------|
| **技能不足** | 中 | 中 | 培訓計劃，外部支援，文件完善 |
| **資源不足** | 中 | 低 | 資源規劃，優先級管理，彈性時程 |
| **變更阻力** | 低 | 中 | 溝通計劃，漸進式改進，展示效益 |

---

## 10. 結論與建議

### 10.1 核心結論

1. **GCP 深度整合是首選**：專案已使用 GCP，深化整合成本最低、效益最高
2. **階段性實施策略**：先建立基礎架構，再導入進階工具
3. **當前架構已足夠**：Cloud Function + BigQuery 適合當前資料量

### 10.2 具體建議

#### 短期建議（1-3 個月）

1. **優化 Cloud Functions**
   - ✅ 升級至 Gen 2（支援更長執行時間）
   - ✅ 實作並行處理（多表格同時處理）
   - ✅ 優化批次載入（減少 API 呼叫次數）

2. **建立規則引擎和標準化函數庫**
   - ✅ 將 87 條規則遷移至 YAML 配置
   - ✅ 建立規則執行引擎
   - ✅ 建立標準化函數庫

3. **優化 BigQuery**
   - ✅ 建立分割區表（按日期分割）
   - ✅ 建立叢集表（按品牌、通路叢集）
   - ✅ 優化載入策略（批次大小、並行載入）

#### 中期建議（3-6 個月）

1. **導入 Cloud Composer (Airflow)**
   - ✅ 管理工作流和排程
   - ✅ 任務依賴管理
   - ✅ 錯誤重試和告警

2. **建立星狀模型**
   - ✅ 建立事實表和維度表
   - ✅ 優化查詢效能
   - ✅ 支援複雜分析

3. **評估 Dataflow**
   - 🟡 評估大規模全量分析需求
   - 🟡 實作 Dataflow Pipeline 原型
   - 🟡 成本效益分析

#### 長期建議（6 個月以上）

1. **導入 Dataflow**
   - 🟡 建立完整的 Dataflow Pipeline
   - 🟡 整合規則引擎和標準化函數庫
   - 🟡 設定監控和告警

2. **評估串流處理**
   - 🟡 評估即時處理需求
   - 🟡 設計 Pub/Sub + Dataflow 架構
   - 🟡 成本效益分析

3. **持續優化**
   - ✅ 監控系統效能
   - ✅ 優化成本結構
   - ✅ 持續改進流程

### 10.3 技術選型建議

| 需求 | 推薦方案 | 理由 |
|------|---------|------|
| **輕量級 ETL** | Cloud Function (Gen 2) | ✅ 當前使用，成本低，效能好 |
| **大規模處理** | Cloud Dataflow | ✅ GCP 原生，效能好，自動擴展 |
| **工作流管理** | Cloud Composer (Airflow) | ✅ GCP 原生，整合好，功能完整 |
| **SQL 轉換** | dbt + BigQuery | ✅ 開源工具，生態好，版本控制 |
| **即時處理** | Pub/Sub + Dataflow Streaming | 🟡 未來需求，成本較高 |
| **視覺化 ETL** | Cloud Data Fusion | 🟡 可選方案，成本較高 |

### 10.4 下一步行動

1. **立即行動**（第 1 個月）
   - 升級 Cloud Function 至 Gen 2
   - 開始規則引擎實作
   - 建立標準化函數庫
   - 優化 BigQuery 表設計（分割區、叢集）

2. **短期行動**（第 2-3 個月）
   - 完成基礎建設階段
   - 開始功能擴展階段
   - 評估 Cloud Composer 適用性

3. **中期行動**（第 4-6 個月）
   - 導入 Cloud Composer (Airflow)
   - 導入 dbt 進行 SQL 轉換
   - 建立星狀模型
   - 評估 Dataflow 適用性

4. **長期行動**（第 6 個月以上）
   - 導入 Dataflow Pipeline
   - 評估串流處理需求
   - 持續優化和改進

---

## 11. 附錄

### 11.1 參考資料

- [Google Cloud ETL 文件](https://cloud.google.com/learn/what-is-etl?hl=zh-TW)
- [Cloud Functions 文件](https://cloud.google.com/functions/docs)
- [Cloud Dataflow 文件](https://cloud.google.com/dataflow/docs)
- [BigQuery 文件](https://cloud.google.com/bigquery/docs)
- [Cloud Composer 文件](https://cloud.google.com/composer/docs)
- [ETL_轉換改進計劃.md](./ETL_轉換改進計劃.md)
- [ETL_轉換深度研究報告.md](./ETL_轉換深度研究報告.md)

### 11.2 GCP ETL 服務對照表

| 功能 | GCP 服務 | 說明 |
|------|---------|------|
| **無伺服器計算** | Cloud Functions | 事件驅動，輕量級 ETL |
| **容器化服務** | Cloud Run | 長時間執行，複雜邏輯 |
| **批次處理** | Cloud Dataflow | Apache Beam，大規模處理 |
| **串流處理** | Cloud Dataflow (Streaming) | 即時資料處理 |
| **資料倉儲** | BigQuery | 無伺服器資料倉儲 |
| **工作流管理** | Cloud Composer | 託管 Airflow |
| **排程服務** | Cloud Scheduler | 簡單排程 |
| **訊息傳遞** | Pub/Sub | 即時訊息傳遞 |
| **視覺化 ETL** | Cloud Data Fusion | 拖放式 ETL 設計 |
| **資料準備** | Cloud Dataprep | 互動式資料準備 |
| **資料移轉** | BigQuery Data Transfer Service | 自動化資料移轉 |

### 11.3 成本對照表

| 服務類型 | GCP 服務 | 定價 | 說明 |
|---------|---------|------|------|
| **無伺服器計算** | Cloud Functions | $0.40/百萬次 | 免費額度 200 萬次/月 |
| **批次處理** | Cloud Dataflow | $0.01/GB | FlexRS 可降低成本 |
| **資料倉儲** | BigQuery | $5/TB/月 | 儲存費用，查詢按量計費 |
| **工作流管理** | Cloud Composer | $50-100/月 | 基礎費用 + 使用費 |
| **訊息傳遞** | Pub/Sub | $40/百萬訊息 | 免費額度 10GB/月 |
| **儲存** | Cloud Storage | $0.020/GB | 標準儲存 |

### 11.4 實作範例

#### 11.4.1 Cloud Function 範例

```python
# main.py
import functions_framework
from google.cloud import bigquery, logging
import json

@functions_framework.cloud_event
def ragic_backup(cloud_event):
    """Ragic 備份 Cloud Function (Gen 2)"""
    client = bigquery.Client()
    logger = logging.Client().logger('ragic-backup')
    
    try:
        # 備份邏輯
        logger.info("開始備份")
        # ...
        logger.info("備份完成")
        return {'status': 'success'}
    except Exception as e:
        logger.error(f"備份失敗: {str(e)}", exc_info=True)
        raise
```

#### 11.4.2 Dataflow Pipeline 範例

```python
# dataflow/pipelines/ragic_etl_pipeline.py
import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions

def run_pipeline():
    options = PipelineOptions()
    
    with beam.Pipeline(options=options) as p:
        (p
         | 'Read' >> beam.io.ReadFromBigQuery(...)
         | 'Transform' >> beam.ParDo(TransformFn())
         | 'Write' >> beam.io.WriteToBigQuery(...)
        )
```

#### 11.4.3 Airflow DAG 範例

```python
# dags/ragic_etl_dag.py
from airflow import DAG
from airflow.operators.python import PythonOperator

dag = DAG('ragic_etl_pipeline', ...)

backup_task = PythonOperator(
    task_id='backup_from_ragic',
    python_callable=backup_from_ragic,
    dag=dag,
)
```

---

**文件結束**

*建立時間: 2025-12-30*  
*版本: v1.0*  
*狀態: 完成*

