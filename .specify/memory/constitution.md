<!--
Sync Impact Report
==================
Version change: 0.0.0 → 1.0.0 (MAJOR - initial constitution)
Modified principles: N/A (initial creation)
Added sections:
  - Core Principles (7 principles)
  - Technology Constraints
  - Development Workflow
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated (Constitution Check table added)
  - .specify/templates/spec-template.md ✅ compatible (no changes needed)
  - .specify/templates/tasks-template.md ✅ compatible (no changes needed)
Follow-up TODOs: None
-->

# RagicEDP Constitution

## Core Principles

### I. Data Integrity First

所有資料操作必須遵循「原始保留」原則：
- 原始值 MUST 保留於獨立欄位，清洗結果存於衍生欄位
- 所有修改 MUST 記錄完整歷史，包含修改前值、修改後值、修改者、時間戳
- 破壞性操作（刪除、覆寫）MUST 經過明確確認流程

**Rationale**: ERP 資料為企業營運核心，資料遺失或無法追溯的修改將造成不可逆損失。

### II. Symbol Verification Mandatory

使用任何系統名稱前，MUST 查閱符號索引表 `.claude/symbols/index.yaml`：
- GCP Secrets: 小寫+連字號 (e.g., `ragic-api-key`)
- 環境變數: 大寫+底線 (e.g., `RAGIC_API_KEY`)
- Cloud Functions: 小寫+連字號 (e.g., `backup-erp-incremental`)
- Python 函數: 小寫+底線 (e.g., `backup_erp_data`)
- BigQuery 表格: `sheet_{code}_{name}` (e.g., `sheet_60_customer`)

**Rationale**: 名稱不一致是部署失敗和系統錯誤的主要原因，符號索引表是單一真相來源。

### III. Incremental Processing

資料處理 MUST 採用增量模式：
- 備份系統：僅處理自上次備份後的新增/修改資料
- 清洗系統：僅處理當日新增資料，不重複清洗已處理資料
- 禁止在生產環境執行全量重建，除非經過明確審批

**Rationale**: 減少 API 配額消耗、降低處理時間、避免對 BigQuery 造成不必要負載。

### IV. Layered Data Processing

資料處理 MUST 遵循分層架構：
1. **SQL 規則層**: 可程式化的格式驗證、外鍵檢查、數值範圍驗證
2. **自動補足層**: 從關聯表計算缺失欄位
3. **AI 判斷層**: 語義分析無法自動修正的問題
4. **人工處理層**: AI 信心度不足時的最終兜底

每層 MUST 有明確的輸入/輸出契約和錯誤處理。

**Rationale**: 分層處理確保問題在最適當的層級解決，降低 AI 成本並提高可追溯性。

### V. Configuration-Driven Rules

清洗規則 MUST 使用 YAML 配置，而非硬編碼：
- 規則配置存放於 `rules/` 目錄
- 每條規則 MUST 有唯一 ID、類型、適用表格、觸發條件
- 規則變更 MUST 透過版本控制追蹤
- 新增規則 MUST 更新規則手冊文件

**Rationale**: 配置驅動的規則便於維護、審查和回滾，減少程式碼修改風險。

### VI. Fail-Safe Notification

系統異常 MUST 主動通知：
- 備份失敗 MUST 發送 Email 通知
- 清洗發現需人工處理的資料 MUST 發送通知
- 通知內容 MUST 包含問題摘要、影響範圍、處理建議
- 連續失敗 MUST 升級通知層級

**Rationale**: 資料處理系統為無人值守運行，異常需主動推送而非被動發現。

### VII. Documentation Synchronization

文件與程式碼 MUST 保持同步：
- 新功能 MUST 同步更新相關文件
- API 變更 MUST 更新符號索引表
- 規則變更 MUST 更新規則手冊
- 部署配置變更 MUST 更新部署文件

**Rationale**: 過時的文件比沒有文件更危險，會導致錯誤的假設和決策。

## Technology Constraints

### 技術棧限制

| 層級 | 選擇 | 理由 |
|------|------|------|
| 語言 | Python 3.11+ | GCP Cloud Functions 原生支援 |
| 套件管理 | UV | 快速、可靠的依賴解析 |
| 資料倉庫 | BigQuery | 已有基礎設施，asia-east1 區域 |
| 無伺服器 | Cloud Functions Gen2 | 成本效益、自動擴展 |
| 容器 | Cloud Run | 需要長時間運行或 WebSocket |
| AI Provider | OpenRouter | 多模型切換、成本控制 |
| 排程 | Cloud Scheduler | GCP 原生整合 |

### 效能標準

- 單日備份處理時間 SHOULD < 10 分鐘
- 單日清洗處理時間 SHOULD < 15 分鐘
- AI 單次呼叫 SHOULD < 5 秒
- 資料修正介面響應 SHOULD < 2 秒

### 安全要求

- API Keys MUST 存放於 GCP Secret Manager
- 不得在程式碼或日誌中記錄敏感資訊
- Cloud Functions MUST 使用最小權限服務帳戶
- BigQuery 存取 MUST 限制於必要的資料集

## Development Workflow

### 開發流程

1. **規劃階段**: 建立/更新 Speckit 文件 (spec.md, plan.md)
2. **任務拆分**: 使用 /speckit.tasks 產生 tasks.md
3. **符號驗證**: 任何名稱引用前查閱 `.claude/symbols/index.yaml`
4. **實作**: 依 tasks.md 順序執行，完成一項勾選一項
5. **驗證**: 執行 `scripts/deploy/validate.py` 驗證符號和規則
6. **部署**: 使用標準化部署腳本

### 程式碼品質

- 每個模組 MUST 有明確的單一職責
- 公開 API MUST 有型別提示
- 錯誤處理 MUST 使用明確的錯誤類型
- 日誌 MUST 使用結構化格式

### 版本控制

- Commit 訊息格式: `type: description` (feat/fix/docs/refactor/test)
- 破壞性變更 MUST 在 commit 訊息中標註
- 規則檔案變更 MUST 獨立 commit

## Governance

### 修訂流程

1. 提出修訂需求，說明理由
2. 評估影響範圍（哪些模板/文件需要同步更新）
3. 執行修訂並同步更新相關文件
4. 更新版本號：
   - MAJOR: 原則移除或根本性重定義
   - MINOR: 新增原則或顯著擴展
   - PATCH: 措辭修正、澄清、錯字修復

### 合規審查

- 每次 PR/Review MUST 驗證是否符合 Constitution
- 違反 Constitution 的變更 MUST 提供正當理由並記錄
- 複雜度超出必要範圍 MUST 說明為何簡單方案不足

### 參考文件

開發時應參考以下文件：
- 專案配置: `CLAUDE.md`
- 符號索引: `.claude/symbols/index.yaml`
- 開發準則: `_docs/official/核心規劃/開發準則_v1.md`
- 規則手冊: `_docs/planning/資料清洗/自動化清洗規則完整手冊_v2.md`

**Version**: 1.0.0 | **Ratified**: 2026-01-11 | **Last Amended**: 2026-01-11
