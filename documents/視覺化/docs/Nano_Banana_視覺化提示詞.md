# RagicEDP 視覺化提示詞 - Nano Banana

**用途**: 為客戶快速了解 RagicEDP 專案規劃而生成的視覺化圖片提示詞

---

## 圖片 1: 系統總覽圖

**標題**: RagicEDP 三大核心模組總覽

**Prompt**:
```
Create a modern, professional infographic showing three interconnected modules in a horizontal layout. 

Left module (藍色系): "資料備份模組" with icon of cloud backup/upload arrow, showing "Ragic API → BigQuery" data flow with incremental backup symbol (clock icon).

Center module (綠色系): "資料清理模組" with AI brain icon and magnifying glass, showing "SQL + AI 雙層過濾" with quality check symbols.

Right module (紫色系): "視覺化模組" with chart/graph icon, showing "動態星狀模型圖" with network diagram symbol.

All three modules connected by flowing arrows showing data pipeline. Background: clean white with subtle tech grid pattern. Style: modern flat design, corporate blue-green-purple color scheme, professional typography in Traditional Chinese.
```

**說明**: 展示三大核心模組及其關係，讓客戶快速理解系統架構

---

## 圖片 2: 資料備份流程圖

**標題**: 每日增量備份與週報告流程

**Prompt**:
```
Create a vertical flowchart diagram showing daily backup process and weekly report cycle.

Top section: "每日備份流程" 
- Ragic API box (left) with cloud icon
- Arrow labeled "增量抓取" pointing right
- Data transformation box (center) with gear icon
- Arrow pointing right to BigQuery box (right) with database icon
- Below: Cloud Scheduler clock icon triggering daily schedule
- Below that: "啟動資料清理" arrow pointing down

Bottom section: "週報告流程（每週日 00:00）"
- BigQuery box (left)
- Arrow labeled "統計分析" pointing right
- Report generation box (center) with document icon
- Arrow pointing right to Email box (right) with mail icon

Style: clean flowchart with rounded boxes, blue and green color scheme, arrows with labels, professional infographic style, Traditional Chinese labels.
```

**說明**: 清楚展示每日備份與週報告的時序流程

---

## 圖片 3: 資料清理四層檢測架構

**標題**: 四層資料異常檢測系統

**Prompt**:
```
Create a layered pyramid diagram showing four detection layers stacked vertically.

Layer 4 (top, smallest, red): "外鍵完整性檢測" - Reference integrity icon, showing "參照不存在（孤立記錄）"

Layer 3 (orange): "時序異常檢測" - Clock/time series icon, showing "趨勢突變" and "週期異常"

Layer 2 (yellow): "關聯規則學習（多欄位）" - Network/connection icon, showing "歷史關聯挖掘" and "異常組合標記"

Layer 1 (bottom, largest, green): "統計異常檢測（單欄位）" - Chart/statistics icon, showing "Z-Score / IQR 離群值檢測", "分布異常", "空值/格式異常"

Each layer should have distinct color and icon. Data flows upward through layers. Background: gradient from light to dark. Style: modern 3D pyramid effect, professional color coding, Traditional Chinese labels.
```

**說明**: 視覺化四層檢測架構的層次關係與檢測重點

---

## 圖片 4: 資料清理處理流程

**標題**: SQL → AI → 人工審核 → 回饋學習完整流程

**Prompt**:
```
Create a horizontal process flow diagram with four connected steps:

Step 1 (left, blue): "SQL 快速過濾" box with database icon, showing "BigQuery 側" with checkmarks for "外鍵完整性檢查", "數值範圍檢查", "關聯矩陣比對". Output: "候選異常 100-500 筆/週"

Step 2 (orange): "AI 深度分析" box with AI brain icon, showing "語義分析", "上下文判斷", "修正建議", "信心度評分"

Step 3 (yellow): "人工審核" box with human icon, showing three paths: "高信心度→自動修正", "中信心度→提供選項", "低信心度→標記待查"

Step 4 (right, green): "回饋學習" box with circular arrow icon, showing "更新學習模型" and "規則庫更新"

Arrows flow left to right, with feedback loop from Step 4 back to Step 2. Style: modern flowchart, color-coded steps, icons for each stage, Traditional Chinese labels, professional infographic design.
```

**說明**: 展示資料清理的完整處理流程與回饋機制

---

## 圖片 5: 星狀模型結構圖

**標題**: BigQuery 星狀模型資料表關聯

**Prompt**:
```
Create a star schema diagram showing one central fact table connected to multiple dimension tables.

Center (large, blue): "fact_order_details" fact table with star icon, showing key fields: order_id, brand_id, channel_id, customer_id, product_id, quantity, subtotal

Surrounding dimension tables (smaller, green) connected by lines:
- Top: "dim_brand" (brand_id, brand_name)
- Top-right: "dim_channel" (channel_id, channel_name)
- Right: "dim_payment" (payment_id, payment_name)
- Bottom-right: "dim_logistics" (logistics_id, logistics_name)
- Bottom: "dim_postal" (postal_code, city, district)
- Bottom-left: "dim_customer" (customer_id, customer_name, phone, email)
- Left: "dim_product" (product_id, product_name, brand_id)
- Top-left: "fact_orders" (order_id, order_date, order_total)

Style: classic star schema visualization, fact table emphasized, dimension tables in lighter color, connection lines labeled with foreign keys, clean database diagram style, Traditional Chinese labels.
```

**說明**: 清楚展示資料倉儲的星狀模型結構

---

## 圖片 6: 技術架構圖

**標題**: RagicEDP 完整技術架構

**Prompt**:
```
Create a comprehensive system architecture diagram showing all components and their connections.

Top row: "Ragic API" → "備份模組 (Cloud Run)" → "BigQuery"

Middle section: "清理模組 (Cloud Run)" with three sub-components:
- "SQL 檢測" (left, blue)
- "AI 分析" (center, orange) - showing "OpenRouter 主要 + OpenAI 備援"
- "規則引擎" (right, green)

Bottom section: "視覺化模組" with three outputs:
- "Mermaid 圖表" (left)
- "週報告生成" (center)
- "Email 通知" (right)

Additional elements:
- Cloud Scheduler icon triggering backup module
- LINE Notify icon for alerts
- Looker Studio icon for dashboards
- Google OAuth icon for authentication

Style: modern cloud architecture diagram, color-coded modules, icons for each service, connection lines showing data flow, professional tech diagram style, Traditional Chinese labels.
```

**說明**: 展示完整的技術堆疊與服務整合

---

## 圖片 7: 人工審核介面架構

**標題**: 審核介面雙層架構設計

**Prompt**:
```
Create a two-layer interface architecture diagram:

Top layer (larger, blue background): "Looker Studio（報表層）"
- Dashboard icon
- Three features: "異常統計儀表板", "趨勢分析圖表", "週報告自動生成"
- Visual elements: charts, graphs, statistics

Bottom layer (green background): "自建 SPA（審核操作層）"
- Web application icon
- Five features listed:
  1. "異常記錄列表" (list icon)
  2. "逐筆審核功能" (checkmark icon)
  3. "AI 建議預覽" (AI brain icon)
  4. "批次操作" (multiple items icon)
  5. "規則管理介面" (settings icon)

Both layers connected by bidirectional arrow showing data exchange. Technology stack shown below: "Vue 3 + Element Plus + FastAPI + Firebase Hosting". Style: modern UI mockup style, clean separation between layers, icons for each feature, professional dashboard design, Traditional Chinese labels.
```

**說明**: 展示審核介面的雙層設計與功能模組

---

## 圖片 8: 認證流程圖

**標題**: 雙重認證機制流程

**Prompt**:
```
Create a dual authentication flow diagram showing two parallel paths:

Left path (blue, Google colors): "方式一：Google OAuth 2.0（推薦）"
1. User clicks "使用 Google 登入" button
2. Google authentication page (Google logo)
3. Callback returns ID Token
4. Backend verifies token, checks email whitelist
5. Issues JWT Session Token
6. User logged in

Right path (green): "方式二：本地帳號密碼（備選）"
1. User enters username/password
2. Backend validates (bcrypt hash icon)
3. Issues JWT Session Token
4. User logged in

Both paths converge at "JWT Session Token" and then to "登入成功" with three role badges: "admin", "reviewer", "viewer".

Style: modern authentication flow diagram, clear step-by-step process, icons for each step, color-coded paths, professional security diagram style, Traditional Chinese labels.
```

**說明**: 清楚展示兩種認證方式的流程與角色權限

---

## 圖片 9: 衝突處理流程

**標題**: 多規則衝突處理策略

**Prompt**:
```
Create a vertical decision tree flowchart showing conflict resolution process:

Step 1 (top): "收集所有規則判定結果" - Multiple rule icons converging

Step 2: "檢查白名單" - Decision diamond: "白名單內?" → Yes: "標記為正常" (green checkmark), No: Continue

Step 3: "按記錄分組" - Grouping icon with multiple records

Step 4: "解決優先順序衝突" - Priority scale icon showing "高優先規則勝出"

Step 5: "合併重複標記" - Merge icon showing "合併為一條，列出所有觸發規則"

Step 6: "調整嚴重性" - Severity levels: Low → Medium → High → Critical, with "多規則觸發 → 提升" arrow

Step 7 (bottom): "輸出最終異常列表" - Final output box with checkmark

Side panel showing priority weights: "外鍵完整性 (100)", "統計異常 (80)", "關聯規則 (70)", "時序異常 (60)", "格式異常 (40)".

Style: modern flowchart with decision points, color-coded severity levels, priority weights displayed, professional process diagram, Traditional Chinese labels.
```

**說明**: 展示多規則衝突時的處理邏輯與優先順序

---

## 圖片 10: 實施階段規劃圖

**標題**: 四階段實施計劃時程

**Prompt**:
```
Create a horizontal timeline/Gantt chart showing four implementation phases:

Phase 1 (left, blue): "備份模組（基礎）"
- Timeline bar showing duration
- Four tasks listed: "重構 Ragic API", "BigQuery MERGE", "backup_metadata 表", "Cloud Scheduler"

Phase 2 (orange): "清理模組（核心）"
- Timeline bar (longest)
- Five tasks: "Layer 1-4 SQL 檢測", "整合 Claude API", "關聯規則學習", "自定義規則引擎", "人工反饋機制"

Phase 3 (green): "視覺化模組"
- Timeline bar
- Three tasks: "Schema 自動抓取", "Mermaid 生成器", "多層次視覺化"

Phase 4 (purple): "報告與通知"
- Timeline bar
- Three tasks: "週報告模板", "報告生成邏輯", "Email 通知"

Each phase connected by arrow showing sequence. Dependencies shown with dotted lines. Style: modern project timeline, color-coded phases, task checkboxes, professional project management diagram, Traditional Chinese labels.
```

**說明**: 展示專案實施的四個階段與任務清單

---

## 使用建議

1. **生成順序**: 建議按照 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 的順序生成，形成完整的視覺化故事線

2. **風格一致性**: 所有圖片應保持相同的設計風格（現代、專業、企業級）

3. **顏色規範**:
   - 備份模組：藍色系
   - 清理模組：綠色/橙色系
   - 視覺化模組：紫色系
   - 警告/異常：紅色/橙色
   - 成功/正常：綠色

4. **文字要求**: 所有標籤使用繁體中文，技術名詞可保留英文

5. **圖示使用**: 使用清晰的圖示系統，避免過於複雜的插圖

---

## 輸出格式建議

- **尺寸**: 建議使用 16:9 或 4:3 比例，適合簡報使用
- **解析度**: 至少 1920x1080，確保列印品質
- **格式**: PNG（透明背景）或 PDF（向量格式）

---

*提示詞版本: v1.0*
*建立日期: 2025-12-21*

