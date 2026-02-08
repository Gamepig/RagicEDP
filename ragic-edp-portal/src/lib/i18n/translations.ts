export type PortalLangV0 = "zh-Hant" | "en";

export type TranslationKeyV0 =
  | "theme.toggle"
  | "theme.light"
  | "theme.dark"
  | "nav.analytics"
  | "nav.correction"
  | "nav.ai"
  | "nav.dbops"
  | "header.portal"
  | "header.mockFirst"
  | "home.title"
  | "home.subtitle"
  | "home.goAnalytics"
  | "analytics.title"
  | "analytics.subtitle"
  | "analytics.pinned"
  | "analytics.widgets"
  | "analytics.category.executive"
  | "analytics.category.product"
  | "analytics.category.brand"
  | "analytics.category.channel"
  | "analytics.category.customer"
  | "analytics.category.operations"
  | "correction.title"
  | "correction.subtitle"
  | "ai.title"
  | "ai.subtitle"
  | "ai.model"
  | "ai.prompt"
  | "ai.promptPlaceholder"
  | "ai.send"
  | "ai.streaming"
  | "ai.chat"
  | "ai.chatEmpty"
  | "ai.result"
  | "ai.resultEmpty"
  | "ai.insights"
  | "ai.charts"
  | "ai.pin"
  | "ai.traces"
  | "common.comingSoon"
  | "common.goAnalyticsHint"
  | "common.goAnalytics"
  | "common.loading"
  | "common.error"
  | "common.close"
  | "common.placeholderFields"
  | "common.retry"
  | "correction.pending"
  | "correction.table"
  | "correction.recordId"
  | "correction.actions"
  | "correction.open"
  | "correction.detail"
  | "correction.fields"
  | "correction.ignore"
  | "correction.submit"
  | "filters.from"
  | "filters.to"
  | "filters.channel"
  | "filters.channelAll"
  | "filters.channelOnline"
  | "filters.channelOffline"
  | "kpi.revenue"
  | "kpi.orders"
  | "kpi.unavailable"
  | "kpi.noData"
  | "kpi.tryNarrow"
  | "chart.chartId"
  | "chart.title.01"
  | "chart.title.02"
  | "chart.title.03"
  | "chart.title.04"
  | "chart.title.05"
  | "chart.title.06"
  | "chart.title.11"
  | "chart.title.13"
  | "chart.title.14"
  | "chart.title.19"
  | "chart.title.21"
  | "chart.title.22"
  | "chart.title.23"
  | "chart.title.24"
  | "chart.title.25"
  | "chart.title.26"
  | "chart.title.28"
  | "chart.title.30"
  | "chart.title.37"
  | "chart.title.38"
  | "chart.title.39"
  | "chart.title.42"
  | "chart.title.44"
  | "chart.title.45"
  | "chart.title.48"
  | "chart.title.52"
  | "chart.title.55"
  | "chart.title.56"
  | "chart.title.59"
  | "chart.title.60"
  | "chart.title.NEW-01"
  | "chart.title.NEW-02"
  | "chart.title.NEW-03"
  | "chart.title.NEW-04"
  | "chart.title.NEW-05"
  | "chart.title.NEW-06"
  | "chart.title.NEW-07"
  | "chart.title.NEW-08"
  | "chart.title.NEW-09"
  | "chart.title.NEW-10"
  | "chart.title.NEW-11"
  | "chart.title.NEW-12"
  | "chart.title.NEW-13"
  | "chart.title.NEW-14"
  | "chart.title.NEW-15"
  | "chart.title.NEW-16"
  | "chart.title.NEW-17"
  | "chart.title.NEW-18"
  | "chart.title.NEW-19"
  | "chart.title.NEW-20"
  | "chart.title.NEW-21"
  | "chart.title.NEW-22"
  | "chart.title.NEW-23"
  | "chart.title.NEW-24"
  | "chart.title.NEW-25"
  | "chart.pin"
  | "chart.unpin"
  | "chart.export"
  | "chart.noData"
  | "chart.error"
  | "chart.needsNewView"
  | "dbops.schema"
  | "dbops.title"
  | "dbops.subtitle"
  | "dbops.table"
  | "dbops.fields"
  | "dbops.search"
  | "dbops.preview"
  | "dbops.nl"
  | "dbops.promptPlaceholder"
  | "dbops.execute"
  | "dbops.sqlConfirm"
  | "dbops.run"
  | "dbops.cancel"
  | "dbops.joinHealth"
  | "dbops.matchRate"
  | "dbops.reasons";

export const translationsV0: Record<PortalLangV0, Record<TranslationKeyV0, string>> = {
  "zh-Hant": {
    "theme.toggle": "主題",
    "theme.light": "淺色",
    "theme.dark": "深色",

    "nav.analytics": "分析報表",
    "nav.correction": "資料修正",
    "nav.ai": "AI 專家",
    "nav.dbops": "BigQuery 查詢",

    "header.portal": "門戶",
    "header.mockFirst": "模擬",

    "home.title": "RagicEDP Portal V2",
    "home.subtitle": "Mock-first demo。從 Analytics 開始。",
    "home.goAnalytics": "前往 Analytics",

    "analytics.title": "分析報表",
    "analytics.subtitle": "總覽（mock-first）",
    "analytics.pinned": "釘選",
    "analytics.widgets": "個",
    "analytics.category.executive": "經營決策",
    "analytics.category.product": "商品動能",
    "analytics.category.brand": "品牌",
    "analytics.category.channel": "通路營運",
    "analytics.category.customer": "客戶價值",
    "analytics.category.operations": "物流營運",

    "correction.title": "資料修正",
    "correction.subtitle": "（即將推出 / mock-first）",

    "ai.title": "AI 行銷分析專家",
    "ai.subtitle": "對話式智慧分析 — Gemini 3 Pro 驅動",

    "ai.model": "模型",
    "ai.prompt": "提問",
    "ai.promptPlaceholder": "例如：上月各通路營收比較",
    "ai.send": "送出",
    "ai.streaming": "回覆生成中...",
    "ai.chat": "對話",
    "ai.chatEmpty": "輸入行銷分析問題，AI 專家將即時回覆。",
    "ai.result": "結果",
    "ai.resultEmpty": "尚無結果。",
    "ai.insights": "洞察",
    "ai.charts": "圖表",
    "ai.pin": "釘選到儀表板",
    "ai.traces": "Trace",

    "dbops.title": "BigQuery 查詢",
    "dbops.subtitle": "Schema 瀏覽與自然語言 SQL 查詢",

    "common.comingSoon": "即將推出",
    "common.goAnalyticsHint": "先完成 Analytics 的互動與視覺審核，再逐步擴到其他模組。",
    "common.goAnalytics": "回到分析報表",
    "common.loading": "載入中...",
    "common.error": "發生錯誤",
    "common.close": "關閉",
    "common.placeholderFields": "（mock）這裡會顯示欄位與違規資訊。",
    "common.retry": "重試",

    "correction.pending": "待處理",
    "correction.table": "資料表",
    "correction.recordId": "記錄 ID",
    "correction.actions": "操作",
    "correction.open": "開啟",
    "correction.detail": "修正明細",
    "correction.fields": "欄位",
    "correction.ignore": "忽略",
    "correction.submit": "提交",

    "filters.from": "開始",
    "filters.to": "結束",
    "filters.channel": "通路",
    "filters.channelAll": "全部",
    "filters.channelOnline": "線上",
    "filters.channelOffline": "線下",

    "kpi.revenue": "營收",
    "kpi.orders": "訂單",
    "kpi.unavailable": "KPI 暫時不可用",
    "kpi.noData": "無資料",
    "kpi.tryNarrow": "試著縮小日期範圍。",

    "chart.chartId": "圖表 ID",
    "chart.title.01": "本月每日銷售趨勢",
    "chart.title.02": "昨日銷售 Top 10 品牌",
    "chart.title.03": "月度營收累積曲線",
    "chart.title.04": "今日營收達成率",
    "chart.title.05": "通路貢獻度趨勢",
    "chart.title.06": "訂單平均單價 (AOV)",
    "chart.title.11": "通路活動號碼成效排行",
    "chart.title.13": "每日商品銷量趨勢",
    "chart.title.14": "熱銷商品 Top 20 排行",
    "chart.title.19": "RFM 客戶分群分布",
    "chart.title.21": "客戶獲取月份同期群",
    "chart.title.22": "沉睡客戶預警 (120d+)",
    "chart.title.23": "客戶地理銷售熱力圖",
    "chart.title.24": "平均回購週期分布",
    "chart.title.25": "支付方式佔比",
    "chart.title.26": "訂單取消損失額度",
    "chart.title.28": "每筆訂單平均物流成本",
    "chart.title.30": "營運異常警示",
    "chart.title.37": "品牌營收貢獻佔比",
    "chart.title.38": "各品牌平均單價波動",
    "chart.title.39": "品類銷售高峰熱圖",
    "chart.title.42": "產品類別成長趨勢矩陣",
    "chart.title.44": "商品折扣與銷量相關性",
    "chart.title.45": "產品合購關聯分析",
    "chart.title.48": "首購品牌分佈矩陣",
    "chart.title.52": "客戶生日月份銷售貢獻",
    "chart.title.55": "數據清洗規則觸發統計",
    "chart.title.56": "資料備份同步健康度",
    "chart.title.59": "資料清洗後欄位填充率",
    "chart.title.60": "跨通路購買轉移分析",
    "chart.title.NEW-01": "80/20 Pareto 分析",
    "chart.title.NEW-02": "Basket size 分布",
    "chart.title.NEW-03": "回購率趨勢",
    "chart.title.NEW-04": "通路 x 品牌 交叉矩陣",
    "chart.title.NEW-05": "訂單狀態分佈",
    "chart.title.NEW-06": "每日客戶數 vs 訂單數散點",
    "chart.title.NEW-07": "訂單金額分布",
    "chart.title.NEW-08": "每日活躍客戶數",
    "chart.title.NEW-09": "每日新客數",
    "chart.title.NEW-10": "新客 vs 回購客營收佔比",
    "chart.title.NEW-11": "客戶購買頻次分布",
    "chart.title.NEW-12": "多品牌客比例",
    "chart.title.NEW-13": "客戶購買品牌數分布",
    "chart.title.NEW-14": "品牌交叉購買矩陣",
    "chart.title.NEW-15": "發票開立率",
    "chart.title.NEW-16": "平台單佔比",
    "chart.title.NEW-17": "Top 城市營收排行",
    "chart.title.NEW-18": "城市營收月趨勢",
    "chart.title.NEW-19": "週末 vs 平日營收/銷量對比",
    "chart.title.NEW-20": "月度客戶營收分布",
    "chart.title.NEW-21": "物流方式佔比",
    "chart.title.NEW-22": "運費收入趨勢",
    "chart.title.NEW-23": "含運實收 vs 訂單實收差額分布",
    "chart.title.NEW-24": "COD 佔比",
    "chart.title.NEW-25": "希望配達時段分布",
    "chart.pin": "釘選",
    "chart.unpin": "取消釘選",
    "chart.export": "匯出",
    "chart.noData": "此範圍無資料",
    "chart.error": "圖表載入失敗",
    "chart.needsNewView": "資料準備中",

    "dbops.schema": "Schema",
    "dbops.table": "資料表",
    "dbops.fields": "欄位",
    "dbops.search": "搜尋資料表...",
    "dbops.preview": "資料預覽",
    "dbops.nl": "自然語言轉 SQL",
    "dbops.promptPlaceholder": "例如：列出最近 10 筆訂單",
    "dbops.execute": "執行",
    "dbops.sqlConfirm": "確認 SQL",
    "dbops.run": "執行查詢",
    "dbops.cancel": "取消",
    "dbops.joinHealth": "Join Health",
    "dbops.matchRate": "匹配率",
    "dbops.reasons": "未匹配原因",
  },
  en: {
    "theme.toggle": "Theme",
    "theme.light": "Light",
    "theme.dark": "Dark",

    "nav.analytics": "Analytics",
    "nav.correction": "Correction",
    "nav.ai": "AI Expert",
    "nav.dbops": "DB Ops",

    "header.portal": "Portal",
    "header.mockFirst": "Mock-first",

    "home.title": "RagicEDP Portal V2",
    "home.subtitle": "Mock-first demo. Start with Analytics.",
    "home.goAnalytics": "Go to Analytics",

    "analytics.title": "Analytics",
    "analytics.subtitle": "Overview (mock-first)",
    "analytics.pinned": "Pinned",
    "analytics.widgets": "widgets",
    "analytics.category.executive": "Executive",
    "analytics.category.product": "Product",
    "analytics.category.brand": "Brand",
    "analytics.category.channel": "Channel",
    "analytics.category.customer": "Customer",
    "analytics.category.operations": "Logistics & Operations",

    "correction.title": "Correction",
    "correction.subtitle": "(Coming soon / mock-first)",

    "ai.title": "AI Marketing Expert",
    "ai.subtitle": "Conversational analytics — Powered by Gemini 3 Pro",

    "ai.model": "Model",
    "ai.prompt": "Prompt",
    "ai.promptPlaceholder": "e.g. Compare channel revenue last month",
    "ai.send": "Send",
    "ai.streaming": "Generating...",
    "ai.chat": "Chat",
    "ai.chatEmpty": "Ask a marketing analysis question and the AI expert will respond in real-time.",
    "ai.result": "Result",
    "ai.resultEmpty": "No result yet.",
    "ai.insights": "Insights",
    "ai.charts": "Charts",
    "ai.pin": "Pin to dashboard",
    "ai.traces": "Traces",

    "dbops.title": "BigQuery Query",
    "dbops.subtitle": "Schema browser & natural language SQL",

    "common.comingSoon": "Coming soon",
    "common.goAnalyticsHint": "Finish Analytics interactions and style sign-off first, then expand to other modules.",
    "common.goAnalytics": "Back to Analytics",
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.close": "Close",
    "common.placeholderFields": "(mock) Fields and violations will appear here.",
    "common.retry": "Retry",

    "correction.pending": "Pending",
    "correction.table": "Table",
    "correction.recordId": "Record ID",
    "correction.actions": "Actions",
    "correction.open": "Open",
    "correction.detail": "Correction Detail",
    "correction.fields": "Fields",
    "correction.ignore": "Ignore",
    "correction.submit": "Submit",

    "filters.from": "FROM",
    "filters.to": "TO",
    "filters.channel": "CHANNEL",
    "filters.channelAll": "All",
    "filters.channelOnline": "Online",
    "filters.channelOffline": "Offline",

    "kpi.revenue": "Revenue",
    "kpi.orders": "Orders",
    "kpi.unavailable": "KPI unavailable",
    "kpi.noData": "No data",
    "kpi.tryNarrow": "Try narrowing the date range.",

    "chart.chartId": "Chart ID",
    "chart.title.01": "Daily Sales Trend (This Month)",
    "chart.title.02": "Top 10 Brands (Yesterday)",
    "chart.title.03": "Monthly Cumulative Revenue",
    "chart.title.04": "Today's Revenue Achievement",
    "chart.title.05": "Channel Contribution Trend",
    "chart.title.06": "Average Order Value (AOV)",
    "chart.title.11": "Channel Campaign Performance",
    "chart.title.13": "Daily Product Sales Trend",
    "chart.title.14": "Top 20 Products",
    "chart.title.19": "RFM Customer Segmentation",
    "chart.title.21": "Customer Acquisition Cohort",
    "chart.title.22": "Churn Alert (120d+)",
    "chart.title.23": "Customer Sales Heatmap",
    "chart.title.24": "Repurchase Cycle Distribution",
    "chart.title.25": "Payment Method Share",
    "chart.title.26": "Order Cancellation Loss",
    "chart.title.28": "Average Shipping Cost per Order",
    "chart.title.30": "Operational Alerts",
    "chart.title.37": "Brand Revenue Share",
    "chart.title.38": "Brand ASP Fluctuations",
    "chart.title.39": "Category Sales Heatmap",
    "chart.title.42": "Category Growth Matrix",
    "chart.title.44": "Discount vs Sales Correlation",
    "chart.title.45": "Product Association Analysis",
    "chart.title.48": "First-Purchase Brand Matrix",
    "chart.title.52": "Birthday Month Sales Contribution",
    "chart.title.55": "Data Cleaning Rule Violations",
    "chart.title.56": "Backup Health Status",
    "chart.title.59": "Field Fill Rate After Cleaning",
    "chart.title.60": "Cross-Channel Migration Analysis",
    "chart.title.NEW-01": "80/20 Pareto Analysis",
    "chart.title.NEW-02": "Basket Size Distribution",
    "chart.title.NEW-03": "Repurchase Rate Trend (30/60/90d)",
    "chart.title.NEW-04": "Channel x Brand Matrix",
    "chart.title.NEW-05": "Order Status Distribution",
    "chart.title.NEW-06": "Daily Customers vs Orders",
    "chart.title.NEW-07": "Order Value Distribution",
    "chart.title.NEW-08": "Daily Active Customers",
    "chart.title.NEW-09": "Daily New Customers",
    "chart.title.NEW-10": "New vs Returning Revenue Share",
    "chart.title.NEW-11": "Purchase Frequency Distribution",
    "chart.title.NEW-12": "Multi-Brand Customer Ratio",
    "chart.title.NEW-13": "Brands per Customer Distribution",
    "chart.title.NEW-14": "Brand Cross-Purchase Matrix",
    "chart.title.NEW-15": "Invoice Issuance Rate",
    "chart.title.NEW-16": "Platform Order Share",
    "chart.title.NEW-17": "Top Cities by Revenue",
    "chart.title.NEW-18": "Monthly City Revenue Trend",
    "chart.title.NEW-19": "Weekend vs Weekday Sales",
    "chart.title.NEW-20": "Monthly Customer Revenue Distribution",
    "chart.title.NEW-21": "Logistics Method Share",
    "chart.title.NEW-22": "Shipping Revenue Trend",
    "chart.title.NEW-23": "Shipping Cost Variance",
    "chart.title.NEW-24": "Cash on Delivery (COD) Share",
    "chart.title.NEW-25": "Preferred Delivery Time Distribution",
    "chart.pin": "Pin",
    "chart.unpin": "Unpin",
    "chart.export": "Export",
    "chart.noData": "No data for this range",
    "chart.error": "Chart unavailable",
    "chart.needsNewView": "Data not ready",

    "dbops.schema": "Schema",
    "dbops.table": "Table",
    "dbops.fields": "Fields",
    "dbops.search": "Search tables...",
    "dbops.preview": "Data Preview",
    "dbops.nl": "NL to SQL",
    "dbops.promptPlaceholder": "e.g. Show recent 10 orders",
    "dbops.execute": "Execute",
    "dbops.sqlConfirm": "Confirm SQL",
    "dbops.run": "Run Query",
    "dbops.cancel": "Cancel",
    "dbops.joinHealth": "Join Health",
    "dbops.matchRate": "Match Rate",
    "dbops.reasons": "Unmatched Reasons",
  },
};
