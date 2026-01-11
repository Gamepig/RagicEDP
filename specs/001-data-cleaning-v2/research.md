# Research: 資料清洗系統 v2

**Date**: 2026-01-11
**Feature**: 001-data-cleaning-v2

## Research Topics

### 1. OpenRouter API Integration

**Decision**: 使用 OpenRouter 作為 AI Provider，主模型 Claude 3.5 Sonnet，備援模型 Gemini Pro

**Rationale**:
- OpenRouter 提供統一 API 存取多個 LLM 模型
- 支援自動 fallback 機制
- 成本透明，按 token 計費
- 無需維護多個 API key

**Alternatives Considered**:
- 直接使用 Anthropic API：較高成本，無 fallback
- Vertex AI (Gemini)：需額外 GCP 權限配置
- Azure OpenAI：企業級，但設定複雜

**Implementation Notes**:
```python
# OpenRouter API 端點
API_BASE = "https://openrouter.ai/api/v1"
PRIMARY_MODEL = "anthropic/claude-3.5-sonnet"
FALLBACK_MODEL = "google/gemini-pro"
```

---

### 2. YAML 規則配置格式

**Decision**: 採用統一 YAML schema 定義所有清洗規則

**Rationale**:
- YAML 人類可讀性高，易於維護
- 支援複雜嵌套結構（觸發條件、修正邏輯）
- 可透過 JSON Schema 驗證配置正確性
- 版本控制友好

**Schema Structure**:
```yaml
metadata:
  version: "1.0"
  category: format  # format|fk|numeric|required|unique|temporal|association|fill

rules:
  - id: FMT-001
    name: 電話格式驗證
    type: validation
    tables: [50, 60]  # 適用表格代碼
    field: 行動電話
    pattern: "^09\\d{8}$"
    auto_fixable: true
    fix_logic:
      type: regex_replace
      pattern: "[^0-9]"
      replacement: ""
    severity: medium
    priority: P1
```

**Alternatives Considered**:
- JSON 配置：較冗長，註解支援差
- TOML：嵌套結構支援不如 YAML
- Python DSL：需要執行環境，安全性考量

---

### 3. BigQuery 清洗狀態管理

**Decision**: 在原始表格新增清洗相關欄位，另建獨立表格記錄違規和歷史

**Rationale**:
- 原始表格新增 `_cleaning_status`, `_cleaning_updated_at` 欄位
- 獨立 `cleaning_violations` 表記錄違規詳情
- 獨立 `cleaning_history` 表記錄修改歷史
- 符合「原始保留」原則

**Schema Design**:
```sql
-- 原始表格新增欄位
ALTER TABLE sheet_*
ADD COLUMN _cleaning_status STRING,      -- pending|completed|auto_fixed|ai_fixed|manual|failed
ADD COLUMN _cleaning_updated_at TIMESTAMP;

-- 違規記錄表
CREATE TABLE cleaning_violations (
  id STRING,
  table_code STRING,
  record_id STRING,
  rule_id STRING,
  field_name STRING,
  before_value STRING,
  after_value STRING,
  severity STRING,
  status STRING,
  detected_at TIMESTAMP
);

-- 修改歷史表
CREATE TABLE cleaning_history (
  id STRING,
  table_code STRING,
  record_id STRING,
  action STRING,  -- auto_fix|ai_fix|manual_fix
  before_values JSON,
  after_values JSON,
  modified_by STRING,
  modified_at TIMESTAMP
);
```

**Alternatives Considered**:
- 完全獨立的清洗表：增加複雜度，查詢需 JOIN
- 僅記錄異常：無法追溯正常處理

---

### 4. Cloud Run + Google OAuth 認證

**Decision**: 使用 Cloud Run IAP (Identity-Aware Proxy) 整合 Google OAuth

**Rationale**:
- Cloud Run 原生支援 IAP
- 無需自行實作 OAuth 流程
- 可限制到特定 Google 帳號/群組
- 後端直接取得使用者身份

**Implementation Flow**:
1. 啟用 Cloud Run 的 IAP
2. 設定允許存取的 IAM 成員
3. 後端從 `X-Goog-Authenticated-User-Email` header 取得使用者
4. 前端無需處理登入，瀏覽器自動導向 Google 登入

**Alternatives Considered**:
- 自行實作 OAuth2：複雜度高，安全風險
- Firebase Auth：需額外服務，增加依賴
- 共用密碼：不安全，無法追溯操作者

---

### 5. RFM 分數計算邏輯

**Decision**: 採用五分位數 (Quintile) 分組，R/F/M 各 1-5 分

**Rationale**:
- 業界標準 RFM 模型
- 五分位數適合中等規模客戶群
- 總分 3-15 分，易於分群

**Calculation Logic**:
```sql
-- Recency: 最近購買距今天數 (越小越好)
R = NTILE(5) OVER (ORDER BY days_since_last_purchase ASC)

-- Frequency: 訂單次數 (越多越好)
F = NTILE(5) OVER (ORDER BY order_count DESC)

-- Monetary: 累積消費金額 (越多越好)
M = NTILE(5) OVER (ORDER BY total_amount DESC)

-- RFM Score: 3-15
RFM_Score = R + F + M
```

**Customer Segments**:
| 分數 | 分群 | 說明 |
|------|------|------|
| 13-15 | 最佳客戶 | 高頻高額近期購買 |
| 10-12 | 潛力客戶 | 中等表現 |
| 7-9 | 一般客戶 | 需關注 |
| 3-6 | 流失風險 | 需挽回 |

**Alternatives Considered**:
- 加權平均：主觀性高，難以標準化
- K-means 聚類：需要更多資料，運算複雜

---

### 6. 清洗引擎執行順序

**Decision**: 按表格依賴關係排序，維度表先於事實表

**Rationale**:
- 維度表 (品牌、通路、客戶) 需先清洗
- 事實表 (訂單、訂單明細) 的外鍵參照才有效
- 避免重複處理

**Processing Order**:
```
Phase 1: 基礎維度表 (parallel)
├── 10 品牌表
├── 30 金流表
├── 40 物流表
└── 41 郵遞區號表

Phase 2: 關聯維度表
├── 20 通路表 (depends: 品牌)
└── 70 商品表 (depends: 品牌)

Phase 3: 核心維度表
├── 80 活動管理表
└── 60 客戶表

Phase 4: 事實表
├── 50 訂單表 (depends: 客戶、通路、物流、金流)
└── 99 訂單明細表 (depends: 訂單、商品、品牌)
```

---

### 7. 前端技術選型

**Decision**: React 18 + Vite + Tailwind CSS

**Rationale**:
- React 生態成熟，元件豐富
- Vite 建置快速，開發體驗佳
- Tailwind 原子化 CSS，快速樣式開發
- 專案已有 React 經驗

**Key Libraries**:
- `@tanstack/react-query`: 資料狀態管理
- `@tanstack/react-table`: 表格元件
- `react-router-dom`: 路由
- `lucide-react`: 圖示

**Alternatives Considered**:
- Vue 3：學習曲線低，但團隊較熟悉 React
- Svelte：生態較小
- Next.js：SSR 不必要，增加複雜度

---

## Summary

| Topic | Decision | Impact |
|-------|----------|--------|
| AI Provider | OpenRouter (Claude + Gemini fallback) | 成本控制、可靠性 |
| 規則配置 | YAML with JSON Schema | 維護性、版本控制 |
| 狀態管理 | 原始表 + 獨立清洗表 | 資料完整性 |
| 認證 | Cloud Run IAP + Google OAuth | 安全性、簡化開發 |
| RFM | 五分位數、3-15 分 | 客戶分群標準化 |
| 執行順序 | 維度表 → 事實表 | 依賴關係正確 |
| 前端 | React 18 + Vite + Tailwind | 開發效率 |

**All NEEDS CLARIFICATION resolved**: ✅
