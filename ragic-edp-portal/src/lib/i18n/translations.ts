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
  | "correction.title"
  | "correction.subtitle"
  | "ai.title"
  | "ai.subtitle"
  | "dbops.title"
  | "dbops.subtitle"
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
  | "chart.title01"
  | "chart.pin"
  | "chart.unpin"
  | "chart.export"
  | "chart.noData"
  | "chart.error"
  | "dbops.schema"
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
    "nav.dbops": "DB 操作",

    "header.portal": "門戶",
    "header.mockFirst": "模擬",

    "home.title": "RagicEDP Portal V2",
    "home.subtitle": "Mock-first demo。從 Analytics 開始。",
    "home.goAnalytics": "前往 Analytics",

    "analytics.title": "分析報表",
    "analytics.subtitle": "總覽（mock-first）",
    "analytics.pinned": "釘選",
    "analytics.widgets": "個",

    "correction.title": "資料修正",
    "correction.subtitle": "（即將推出 / mock-first）",

    "ai.title": "AI 專家",
    "ai.subtitle": "對話式分析（mock-first）",

    "ai.model": "模型",
    "ai.prompt": "提問",
    "ai.promptPlaceholder": "例如：本月營收為什麼下降？",
    "ai.send": "送出",
    "ai.streaming": "回覆生成中...",
    "ai.chat": "對話",
    "ai.chatEmpty": "輸入問題後送出，會產生 mock 串流回覆與結果卡。",
    "ai.result": "結果",
    "ai.resultEmpty": "尚無結果。",
    "ai.insights": "洞察",
    "ai.charts": "圖表",
    "ai.pin": "釘選到儀表板",
    "ai.traces": "Trace",

    "dbops.title": "DB 操作",
    "dbops.subtitle": "Schema & SQL（mock-first）",

    "common.comingSoon": "即將推出",
    "common.goAnalyticsHint": "先完成 Analytics 的互動與視覺審核，再逐步擴到其他模組。",
    "common.goAnalytics": "回到分析報表",
    "common.loading": "載入中...",
    "common.error": "發生錯誤",
    "common.close": "關閉",
    "common.placeholderFields": "（mock）這裡會顯示欄位與違規資訊。",

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
    "chart.title01": "01 | 本月每日銷售趨勢",
    "chart.pin": "釘選",
    "chart.unpin": "取消釘選",
    "chart.export": "匯出",
    "chart.noData": "此範圍無資料",
    "chart.error": "圖表載入失敗",

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

    "correction.title": "Correction",
    "correction.subtitle": "(Coming soon / mock-first)",

    "ai.title": "AI Expert",
    "ai.subtitle": "Conversational analytics (mock-first)",

    "ai.model": "Model",
    "ai.prompt": "Prompt",
    "ai.promptPlaceholder": "e.g. Why did revenue drop this month?",
    "ai.send": "Send",
    "ai.streaming": "Generating...",
    "ai.chat": "Chat",
    "ai.chatEmpty": "Ask a question to see mock streaming and result cards.",
    "ai.result": "Result",
    "ai.resultEmpty": "No result yet.",
    "ai.insights": "Insights",
    "ai.charts": "Charts",
    "ai.pin": "Pin to dashboard",
    "ai.traces": "Traces",

    "dbops.title": "DB Ops",
    "dbops.subtitle": "(Coming soon / mock-first)",

    "common.comingSoon": "Coming soon",
    "common.goAnalyticsHint": "Finish Analytics interactions and style sign-off first, then expand to other modules.",
    "common.goAnalytics": "Back to Analytics",
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.close": "Close",
    "common.placeholderFields": "(mock) Fields and violations will appear here.",

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
    "chart.title01": "01 | Daily Sales Trend (This Month)",
    "chart.pin": "Pin",
    "chart.unpin": "Unpin",
    "chart.export": "Export",
    "chart.noData": "No data for this range",
    "chart.error": "Chart unavailable",

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
