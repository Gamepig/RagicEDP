# Data Quality Checklist: 資料清洗系統 v2

**Purpose**: 驗證資料清洗規則、驗證邏輯、資料完整性需求的品質與完整性
**Created**: 2026-01-11
**Feature**: [spec.md](../spec.md)
**Timing**: Pre-Implementation (開發前驗證規格是否足夠清晰)
**Depth**: Standard

---

## Requirement Completeness (需求完整性)

- [x] CHK001 - 是否定義了所有資料表的清洗規則覆蓋範圍？[Completeness, Spec §FR-002] ✅ research.md §6 定義 10 張表處理順序
- [x] CHK002 - 格式驗證規則 (電話、Email、日期) 是否涵蓋所有相關欄位？[Coverage, Spec §FR-006] ✅ spec.md 新增 Validation Rules Definition
- [x] CHK003 - 外鍵參照規則是否涵蓋所有跨表關聯欄位 (品牌、通路、客戶編號)？[Coverage, Spec §FR-007] ✅ spec §FR-007 已定義
- [x] CHK004 - 數值範圍規則是否定義了所有數值欄位的合理範圍？[Gap, Spec §FR-008] ✅ spec.md 新增數值範圍規則表
- [ ] CHK005 - 是否列出所有必填欄位清單及其適用表格？[Completeness, Spec §FR-010] ⚠️ 延後到 YAML 規則配置
- [x] CHK006 - 自動補足規則是否涵蓋所有衍生欄位計算邏輯？[Coverage, Spec §FR-011-013] ✅ spec.md 新增 Derived Fields Calculation
- [x] CHK007 - 是否定義了清洗執行的表格處理順序 (維度表 → 事實表)？[Gap] ✅ research.md §6 已定義

## Requirement Clarity (需求清晰度)

- [x] CHK008 - 電話格式的「標準格式」是否明確定義 (09XX-XXX-XXX vs 09XXXXXXXX)？[Clarity, Spec §FR-006] ✅ spec.md 定義 `^09\d{8}$`
- [x] CHK009 - Email 格式驗證是否定義了具體的正則表達式或驗證規則？[Clarity, Spec §FR-006] ✅ spec.md 定義正則表達式
- [x] CHK010 - 日期格式是否明確定義接受的格式 (YYYY-MM-DD vs 其他)？[Clarity, Spec §FR-006] ✅ spec.md 定義 ISO 8601 格式
- [x] CHK011 - 「數值異常」的判斷標準是否量化 (例如金額 < 0, 數量 > 10000)？[Clarity, Spec §FR-008] ✅ spec.md 數值範圍規則表
- [x] CHK012 - AI 信心度閾值 90% 的選擇依據是否有說明？[Clarity, Spec §FR-016] ✅ 業界標準閾值，可接受
- [x] CHK013 - RFM 分數計算的五分位數分組邏輯是否明確定義？[Clarity, Spec §FR-012] ✅ spec.md 新增 RFM 分數計算
- [x] CHK014 - 「累積消費金額」的計算範圍是否明確 (含退貨？含運費？)？[Ambiguity, Spec §FR-012] ✅ spec.md 新增計算規則 (排除退貨、贈品、運費)

## Requirement Consistency (需求一致性)

- [x] CHK015 - 清洗狀態的 enum 值在 data-model.md 和 spec.md 之間是否一致？[Consistency] ✅ data-model.md 定義 7 種狀態，與 spec 一致
- [x] CHK016 - 違規嚴重程度 (critical/high/medium/low) 的分類標準是否統一？[Consistency, Spec §Key Entities] ✅ spec.md 新增嚴重程度分類標準
- [x] CHK017 - 規則優先級 (P1/P2/P3) 與執行順序的關係是否一致？[Consistency] ✅ P1/P2/P3 對應 User Story 優先級
- [x] CHK018 - API contract 中的 schema 定義是否與 data-model.md 一致？[Consistency] ✅ api.yaml schema 與 data-model.md 一致

## Acceptance Criteria Quality (驗收標準品質)

- [x] CHK019 - SC-002 「15 分鐘內處理 10,000 筆」是否有分階段驗證標準？[Measurability, Spec §SC-002] ✅ spec.md 新增 Measurement Methods
- [x] CHK020 - SC-003 「SQL 規則覆蓋率達 80%」如何測量和驗證？[Measurability, Spec §SC-003] ✅ spec.md 定義計算公式
- [x] CHK021 - SC-004 「AI 自動修正率達 70%」的計算基準是否明確？[Measurability, Spec §SC-004] ✅ spec.md 定義計算公式
- [x] CHK022 - SC-008 「自動補足覆蓋率達 95%」是否定義了測量方法？[Measurability, Spec §SC-008] ✅ spec.md 定義計算公式

## Scenario Coverage (情境覆蓋)

- [x] CHK023 - 是否定義了單筆記錄有多個違規時的處理順序？[Coverage, Spec §Edge Cases] ✅ spec Edge Cases: 依優先順序處理
- [ ] CHK024 - 是否定義了同一欄位被多條規則命中時的優先順序？[Gap] ⚠️ MEDIUM - 實作時依嚴重程度排序
- [ ] CHK025 - 是否定義了清洗執行中途失敗的回復機制？[Gap, Recovery Flow] ⚠️ MEDIUM - 延後到實作
- [x] CHK026 - 是否定義了 AI 服務不可用時的降級處理？[Coverage, Spec §Edge Cases] ✅ spec Edge Cases 已定義
- [ ] CHK027 - 是否定義了批次處理超時時的分批續傳邏輯？[Gap, Spec §Edge Cases] ⚠️ MEDIUM - 延後到實作

## Edge Case Coverage (邊界案例覆蓋)

- [ ] CHK028 - 欄位值為 NULL vs 空字串 vs 空白字元的處理是否區分？[Edge Case, Gap] ⚠️ MEDIUM - 延後到 YAML 規則
- [x] CHK029 - 數值欄位的邊界值 (0, 負數, 極大值) 處理是否定義？[Edge Case, Spec §FR-008] ✅ spec.md 數值範圍規則表
- [ ] CHK030 - 日期欄位的未來日期、過去極端日期處理是否定義？[Edge Case, Spec §FR-006] ⚠️ LOW - 延後到 YAML 規則
- [ ] CHK031 - 外鍵欄位指向已刪除記錄時的處理是否定義？[Edge Case, Spec §FR-007] ⚠️ LOW - 延後到 YAML 規則
- [ ] CHK032 - 同一客戶在同一秒內有多筆訂單時，「首購」判斷是否定義？[Edge Case, Spec §FR-012] ⚠️ LOW - 使用最小 record_id

## Non-Functional Requirements (非功能性需求)

- [ ] CHK033 - 清洗引擎的記憶體使用上限是否定義？[NFR, Gap] ⚠️ LOW - Cloud Functions 預設 256MB
- [ ] CHK034 - OpenRouter API 呼叫的 Rate Limit 和重試策略是否定義？[NFR, Gap] ⚠️ LOW - 實作時配置
- [ ] CHK035 - 清洗歷史記錄的保留期限是否定義？[NFR, Gap] ⚠️ LOW - 預設 90 天
- [ ] CHK036 - 違規記錄的儲存容量估算和清理策略是否定義？[NFR, Gap] ⚠️ LOW - BigQuery 自動分區

## Dependencies & Assumptions (依賴與假設)

- [ ] CHK037 - 假設「增量備份每日 00:00 完成」是否有延遲容錯機制？[Assumption, Spec §Assumptions] ⚠️ LOW - 觸發時檢查備份狀態
- [ ] CHK038 - OpenRouter API 配額和成本預算是否有明確限制？[Dependency, Gap] ⚠️ LOW - 實作時監控
- [x] CHK039 - BigQuery 寫入權限和配額是否確認？[Dependency, Spec §Assumptions] ✅ constitution 已確認 asia-east1
- [x] CHK040 - Email 發送服務的配額和失敗處理是否定義？[Dependency, Spec §FR-018] ✅ spec Edge Cases: 重試 3 次

---

## Notes

- Check items off as completed: `[x]`
- Add comments or findings inline
- 標記說明：
  - `[Completeness]` - 需求是否完整
  - `[Clarity]` - 需求是否清晰
  - `[Consistency]` - 需求是否一致
  - `[Measurability]` - 需求是否可量化驗證
  - `[Coverage]` - 情境是否涵蓋
  - `[Gap]` - 需求缺失
  - `[Ambiguity]` - 需求模糊
  - `[NFR]` - 非功能性需求
  - `[Spec §X]` - 參照 spec.md 章節
