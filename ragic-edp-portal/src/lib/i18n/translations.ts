export type PortalLangV0 = "zh-Hant" | "en";

export type TranslationKeyV0 =
  | "theme.toggle"
  | "theme.light"
  | "theme.dark"
  | "nav.analytics"
  | "nav.customCharts"
  | "nav.ga4"
  | "nav.ga4Cross"
  | "nav.ga4Ops"
  | "nav.correction"
  | "nav.ai"
  | "nav.dbops"
  | "nav.userMgmt"
  | "header.portal"
  | "header.mockFirst"
  | "header.signOut"
  | "header.userFallback"
  | "home.title"
  | "home.subtitle"
  | "home.goAnalytics"
  | "analytics.title"
  | "analytics.subtitle"
  | "analytics.pinned"
  | "analytics.widgets"
  | "customCharts.title"
  | "customCharts.subtitle"
  | "analytics.category.executive"
  | "analytics.category.product"
  | "analytics.category.channel"
  | "analytics.category.customer"
  | "analytics.category.operations"
  | "analytics.category.ga4_traffic"
  | "analytics.category.ga4_engagement"
  | "analytics.category.ga4_conversion"
  | "analytics.category.ga4_cross_trend"
  | "analytics.category.ga4_cross_roi"
  | "analytics.category.cross_brand"
  | "analytics.category.ga4_cross_campaign"
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
  | "chart.title.NEW-27"
  | "chart.title.NEW-28"
  | "chart.title.NEW-31"
  | "chart.title.GA4-01"
  | "chart.title.GA4-02"
  | "chart.title.GA4-03"
  | "chart.title.GA4-04"
  | "chart.title.GA4-05"
  | "chart.title.GA4-06"
  | "chart.title.GA4-07"
  | "chart.title.GA4-08"
  | "chart.title.GA4-09"
  | "chart.title.GA4-10"
  | "chart.title.GA4-11"
  | "chart.title.GA4-12"
  | "chart.title.GA4-13"
  | "chart.title.GA4-14"
  | "chart.title.GA4-15"
  | "chart.title.GA4-16"
  | "chart.title.GA4-17"
  | "chart.title.GA4-18"
  | "chart.title.GA4-19"
  | "chart.title.GA4-20"
  | "chart.title.GA4-21"
  | "chart.title.GA4-22"
  | "chart.title.GA4-23"
  | "chart.title.GA4-24"
  | "chart.title.GA4-25"
  | "chart.title.GA4-26"
  | "chart.title.GA4-27"
  | "chart.title.GA4-28"
  | "chart.title.GA4-29"
  | "chart.title.GA4-30"
  | "chart.title.GA4-31"
  | "chart.title.GA4-32"
  | "chart.title.GA4-33"
  | "chart.title.GA4-34"
  | "chart.title.GA4-35"
  | "chart.pin"
  | "chart.unpin"
  | "chart.export"
  | "chart.exportPng"
  | "chart.exportCsv"
  | "chart.exportExcel"
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
  | "dbops.reasons"
  | "ga4ops.title"
  | "ga4ops.subtitle"
  | "analytics.group.erp"
  | "analytics.group.erp_cross"
  | "analytics.group.ga4"
  | "analytics.group.ga4_erp"
  | "analytics.allBrands"
  | "analytics.brandFilter"
  | "nav.correctionDemo"
  | "nav.correction.dashboard"
  | "nav.correction.pending"
  | "nav.correction.history"
  | "nav.correction.schema"
  | "nav.correction.backupLogs"
  | "correctionDemo.title"
  | "correctionDemo.subtitle"
  | "correctionDemo.tab.dashboard"
  | "correctionDemo.tab.pending"
  | "correctionDemo.tab.history"
  | "correctionDemo.tab.starSchema"
  | "correctionDemo.tab.backupLog"
  | "correction.stats.pending"
  | "correction.stats.manual"
  | "correction.stats.completed"
  | "correction.stats.autoFixed"
  | "correction.stats.aiFixed"
  | "correction.stats.completionRate"
  | "correction.stats.sourceDistribution"
  | "correction.violationCount"
  | "correction.confidence"
  | "correction.detectedAt"
  | "correction.currentValue"
  | "correction.suggestedValue"
  | "correction.violationInfo"
  | "correction.fieldCorrection"
  | "correction.confirmCorrection"
  | "correction.corrector"
  | "correction.correctedAt"
  | "correction.action.corrected"
  | "correction.action.ignored"
  | "correction.dateFrom"
  | "correction.dateTo"
  | "correction.schema.title"
  | "correction.schema.subtitle"
  | "correction.schema.overview"
  | "correction.schema.detailed"
  | "correction.schema.refresh"
  | "correction.schema.totalTables"
  | "correction.schema.totalRecords"
  | "correction.schema.factTables"
  | "correction.schema.dimTables"
  | "correction.schema.lastUpdated"
  | "correction.backup.title"
  | "correction.backup.subtitle"
  | "correction.backup.date"
  | "correction.backup.totalFetched"
  | "correction.backup.autoFixed"
  | "correction.backup.manualRequired"
  | "correction.backup.status"
  | "correction.backup.success"
  | "correction.backup.failed"
  | "correction.backup.details"
  | "correction.backup.sheetLogs"
  | "correction.backup.cleaningStats"
  | "correction.backup.fixedRecords"
  | "correction.backup.syncTime"
  | "correction.backup.backupSize"
  | "correction.backup.duration"
  | "correction.backup.errorMessage"
  | "correction.backup.backToList";

export const translationsV0: Record<PortalLangV0, Record<TranslationKeyV0, string>> = {
  "zh-Hant": {
    "theme.toggle": "主題",
    "theme.light": "淺色",
    "theme.dark": "深色",

    "nav.analytics": "分析報表",
    "nav.customCharts": "自訂圖表",
    "nav.ga4": "GA4 網站分析",
    "nav.ga4Cross": "GA4 交叉分析",
    "nav.ga4Ops": "GA4數據查詢",
    "nav.correction": "資料修正",
    "nav.ai": "AI 專家",
    "nav.dbops": "BigQuery 查詢",
    "nav.userMgmt": "使用者管理",
    "nav.correctionDemo": "修正 DEMO",
    "nav.correction.dashboard": "修正總覽",
    "nav.correction.pending": "待處理清單",
    "nav.correction.history": "修正歷史",
    "nav.correction.schema": "星狀模型",
    "nav.correction.backupLogs": "備份記錄",
    "correctionDemo.title": "資料修正系統",
    "correctionDemo.subtitle": "DEMO 版面預覽",
    "correctionDemo.tab.dashboard": "總覽",
    "correctionDemo.tab.pending": "待處理",
    "correctionDemo.tab.history": "歷史紀錄",
    "correctionDemo.tab.starSchema": "星型架構",
    "correctionDemo.tab.backupLog": "備份日誌",
    "correction.stats.pending": "待處理",
    "correction.stats.manual": "人工待處理",
    "correction.stats.completed": "已完成",
    "correction.stats.autoFixed": "自動修正",
    "correction.stats.aiFixed": "AI 修正",
    "correction.stats.completionRate": "完成進度",
    "correction.stats.sourceDistribution": "修正來源分佈",
    "correction.violationCount": "違規數",
    "correction.confidence": "AI 信心度",
    "correction.detectedAt": "清洗時間",
    "correction.currentValue": "目前值",
    "correction.suggestedValue": "建議值",
    "correction.violationInfo": "違規資訊",
    "correction.fieldCorrection": "欄位修正",
    "correction.confirmCorrection": "確認修正",
    "correction.corrector": "修正者",
    "correction.correctedAt": "修正時間",
    "correction.action.corrected": "已修正",
    "correction.action.ignored": "已忽略",
    "correction.dateFrom": "開始日期",
    "correction.dateTo": "結束日期",
    "correction.schema.title": "星狀模型",
    "correction.schema.subtitle": "BigQuery 星型架構視覺化",
    "correction.schema.overview": "總覽",
    "correction.schema.detailed": "詳細",
    "correction.schema.refresh": "重新整理",
    "correction.schema.totalTables": "總表格數",
    "correction.schema.totalRecords": "總資料筆數",
    "correction.schema.factTables": "事實表",
    "correction.schema.dimTables": "維度表",
    "correction.schema.lastUpdated": "最後更新",
    "correction.backup.title": "備份記錄",
    "correction.backup.subtitle": "每日 ETL 備份日誌",
    "correction.backup.date": "備份日期",
    "correction.backup.totalFetched": "總擷取筆數",
    "correction.backup.autoFixed": "自動修正",
    "correction.backup.manualRequired": "人工待處理",
    "correction.backup.status": "狀態",
    "correction.backup.success": "成功",
    "correction.backup.failed": "失敗",
    "correction.backup.details": "詳情",
    "correction.backup.sheetLogs": "表格備份記錄",
    "correction.backup.cleaningStats": "清洗統計",
    "correction.backup.fixedRecords": "修正記錄",
    "correction.backup.syncTime": "同步時間",
    "correction.backup.backupSize": "備份大小",
    "correction.backup.duration": "執行時間",
    "correction.backup.errorMessage": "錯誤訊息",
    "correction.backup.backToList": "返回列表",

    "header.portal": "門戶",
    "header.mockFirst": "",
    "header.signOut": "登出",
    "header.userFallback": "使用者",

    "home.title": "RagicEDP Portal V2",
    "home.subtitle": "從 Analytics 開始。",
    "home.goAnalytics": "前往 Analytics",

    "analytics.title": "分析報表",
    "analytics.subtitle": "總覽",
    "analytics.pinned": "自訂圖表",
    "analytics.widgets": "個",
    "customCharts.title": "自訂圖表",
    "customCharts.subtitle": "個人化圖表看板（MVP）",
    "analytics.category.executive": "經營決策",
    "analytics.category.product": "商品動能",
    "analytics.category.channel": "通路營運",
    "analytics.category.customer": "客戶價值",
    "analytics.category.operations": "物流營運",
    "analytics.category.ga4_traffic": "流量獲取",
    "analytics.category.ga4_engagement": "互動轉換",
    "analytics.category.ga4_conversion": "行為洞察",
    "analytics.category.ga4_cross_trend": "趨勢異常",
    "analytics.category.ga4_cross_roi": "通路 ROI",
    "analytics.category.cross_brand": "跨品牌分析",
    "analytics.category.ga4_cross_campaign": "活動動能",
    "analytics.group.erp": "ERP 銷售",
    "analytics.group.erp_cross": "ERP 跨品牌",
    "analytics.group.ga4": "GA4 網站",
    "analytics.group.ga4_erp": "GA4 × ERP",
    "analytics.allBrands": "全部品牌",
    "analytics.brandFilter": "品牌",

    "correction.title": "資料修正",
    "correction.subtitle": "（即將推出 / mock-first）",

    "ai.title": "AI 行銷分析專家",
  "ai.subtitle": "對話式智慧分析 — Gemini 3.1 Pro 驅動",

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
    "ga4ops.title": "GA4 數據查詢",
    "ga4ops.subtitle": "GA4 與交叉分析資料的 SQL 查詢與預覽",

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

    "kpi.revenue": "本月營收",
    "kpi.orders": "本月訂單數",
    "kpi.unavailable": "KPI 暫時不可用",
    "kpi.noData": "無資料",
    "kpi.tryNarrow": "試著縮小日期範圍。",

    "chart.chartId": "圖表 ID",
    "chart.title.01": "本月每日銷售趨勢",
    "chart.title.02": "昨日銷售 Top 10 品牌",
    "chart.title.03": "月度營收累積曲線",
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
    "chart.title.NEW-27": "通路訂單數趨勢",
    "chart.title.NEW-28": "通路客單價比較",
    "chart.title.NEW-31": "通路新客佔比",
    "chart.title.GA4-01": "流量來源分布",
    "chart.title.GA4-02": "每日用戶數趨勢（新客 vs 回訪）",
    "chart.title.GA4-03": "每日 Session 數趨勢",
    "chart.title.GA4-04": "熱門頁面 Top 20",
    "chart.title.GA4-05": "裝置類型分布",
    "chart.title.GA4-06": "Landing Page 成效排行",
    "chart.title.GA4-07": "電商轉換漏斗",
    "chart.title.GA4-08": "購物車放棄率趨勢",
    "chart.title.GA4-09": "轉換率日趨勢",
    "chart.title.GA4-10": "商品銷售排行（GA4 側）",
    "chart.title.GA4-11": "表單轉換漏斗",
    "chart.title.GA4-12": "Google vs Facebook 流量對比",
    "chart.title.GA4-13": "新客 vs 回購客營收佔比",
    "chart.title.GA4-14": "流量-營收同步性趨勢",
    "chart.title.GA4-15": "流量營收偏離警報",
    "chart.title.GA4-16": "時段投放效率熱力圖",
    "chart.title.GA4-17": "週末平日轉換效率",
    "chart.title.GA4-18": "購物意圖 vs 成交落差",
    "chart.title.GA4-19": "每日流量品質評分",
    "chart.title.GA4-20": "新客流量 vs 新客訂單趨勢",
    "chart.title.GA4-21": "廣告通路成效總覽表",
    "chart.title.GA4-22": "付費 vs 自然流量 ROI",
    "chart.title.GA4-23": "Google Ads 流量轉營收效率",
    "chart.title.GA4-24": "Facebook 廣告流量轉營收效率",
    "chart.title.GA4-25": "LINE (Omnichat) 導購成效",
    "chart.title.GA4-26": "通路流量品質排行",
    "chart.title.GA4-27": "通路新客獲取效率",
    "chart.title.GA4-28": "Referral 流量商業價值",
    "chart.title.GA4-29": "活動營收拉動力分析",
    "chart.title.GA4-30": "活動新客 vs 老客回購",
    "chart.title.GA4-31": "活動商品關注 vs 銷量",
    "chart.title.GA4-32": "素材疲乏偵測",
    "chart.title.GA4-33": "跨平台活動成效矩陣",
    "chart.title.GA4-34": "活動 Landing Page 效率",
    "chart.title.GA4-35": "月度行銷效率儀表板",
    "chart.pin": "釘選",
    "chart.unpin": "取消釘選",
    "chart.export": "匯出",
    "chart.exportPng": "下載圖表 PNG",
    "chart.exportCsv": "下載數據 CSV",
    "chart.exportExcel": "下載數據 Excel",
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
    "nav.customCharts": "Custom Charts",
    "nav.ga4": "GA4 Web Analytics",
    "nav.ga4Cross": "GA4 Cross-Analysis",
    "nav.ga4Ops": "GA4 Query",
    "nav.correction": "Correction",
    "nav.ai": "AI Expert",
    "nav.dbops": "DB Ops",
    "nav.userMgmt": "User Management",
    "nav.correctionDemo": "Correction Demo",
    "nav.correction.dashboard": "Dashboard",
    "nav.correction.pending": "Pending Records",
    "nav.correction.history": "History",
    "nav.correction.schema": "Star Schema",
    "nav.correction.backupLogs": "Backup Logs",
    "correctionDemo.title": "Data Correction System",
    "correctionDemo.subtitle": "Demo Layout Preview",
    "correctionDemo.tab.dashboard": "Overview",
    "correctionDemo.tab.pending": "Pending",
    "correctionDemo.tab.history": "History",
    "correctionDemo.tab.starSchema": "Star Schema",
    "correctionDemo.tab.backupLog": "Backup Log",
    "correction.stats.pending": "Pending",
    "correction.stats.manual": "Manual Pending",
    "correction.stats.completed": "Completed",
    "correction.stats.autoFixed": "Auto Fixed",
    "correction.stats.aiFixed": "AI Fixed",
    "correction.stats.completionRate": "Completion Rate",
    "correction.stats.sourceDistribution": "Fix Source Distribution",
    "correction.violationCount": "Violations",
    "correction.confidence": "AI Confidence",
    "correction.detectedAt": "Cleaned At",
    "correction.currentValue": "Current Value",
    "correction.suggestedValue": "Suggested Value",
    "correction.violationInfo": "Violation Info",
    "correction.fieldCorrection": "Field Correction",
    "correction.confirmCorrection": "Confirm Correction",
    "correction.corrector": "Corrector",
    "correction.correctedAt": "Corrected At",
    "correction.action.corrected": "Corrected",
    "correction.action.ignored": "Ignored",
    "correction.dateFrom": "From",
    "correction.dateTo": "To",
    "correction.schema.title": "Star Schema",
    "correction.schema.subtitle": "BigQuery Star Schema Visualization",
    "correction.schema.overview": "Overview",
    "correction.schema.detailed": "Detailed",
    "correction.schema.refresh": "Refresh",
    "correction.schema.totalTables": "Total Tables",
    "correction.schema.totalRecords": "Total Records",
    "correction.schema.factTables": "Fact Tables",
    "correction.schema.dimTables": "Dimension Tables",
    "correction.schema.lastUpdated": "Last Updated",
    "correction.backup.title": "Backup Logs",
    "correction.backup.subtitle": "Daily ETL Backup Logs",
    "correction.backup.date": "Backup Date",
    "correction.backup.totalFetched": "Total Fetched",
    "correction.backup.autoFixed": "Auto Fixed",
    "correction.backup.manualRequired": "Manual Required",
    "correction.backup.status": "Status",
    "correction.backup.success": "Success",
    "correction.backup.failed": "Failed",
    "correction.backup.details": "Details",
    "correction.backup.sheetLogs": "Sheet Backup Logs",
    "correction.backup.cleaningStats": "Cleaning Statistics",
    "correction.backup.fixedRecords": "Fixed Records",
    "correction.backup.syncTime": "Sync Time",
    "correction.backup.backupSize": "Backup Size",
    "correction.backup.duration": "Duration",
    "correction.backup.errorMessage": "Error Message",
    "correction.backup.backToList": "Back to List",

    "header.portal": "Portal",
    "header.mockFirst": "",
    "header.signOut": "Sign out",
    "header.userFallback": "User",

    "home.title": "RagicEDP Portal V2",
    "home.subtitle": "Start with Analytics.",
    "home.goAnalytics": "Go to Analytics",

    "analytics.title": "Analytics",
    "analytics.subtitle": "Overview",
    "analytics.pinned": "Custom Charts",
    "analytics.widgets": "widgets",
    "customCharts.title": "Custom Charts",
    "customCharts.subtitle": "Personalized chart dashboard (MVP)",
    "analytics.category.executive": "Executive",
    "analytics.category.product": "Product",
    "analytics.category.channel": "Channel",
    "analytics.category.customer": "Customer",
    "analytics.category.operations": "Logistics & Operations",
    "analytics.category.ga4_traffic": "Traffic Acquisition",
    "analytics.category.ga4_engagement": "Engagement & Conversion",
    "analytics.category.ga4_conversion": "Behavioral Insights",
    "analytics.category.ga4_cross_trend": "Trends & Anomalies",
    "analytics.category.ga4_cross_roi": "Channel ROI",
    "analytics.category.cross_brand": "Cross-Brand Analysis",
    "analytics.category.ga4_cross_campaign": "Campaign Performance",
    "analytics.group.erp": "ERP Sales",
    "analytics.group.erp_cross": "ERP Cross-Brand",
    "analytics.group.ga4": "GA4 Web",
    "analytics.group.ga4_erp": "GA4 × ERP",
    "analytics.allBrands": "All Brands",
    "analytics.brandFilter": "Brand",

    "correction.title": "Correction",
    "correction.subtitle": "(Coming soon / mock-first)",

    "ai.title": "AI Marketing Expert",
  "ai.subtitle": "Conversational analytics — Powered by Gemini 3.1 Pro",

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
    "ga4ops.title": "GA4 Data Query",
    "ga4ops.subtitle": "SQL query and preview for GA4 and cross-analysis datasets",

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

    "kpi.revenue": "Monthly Revenue",
    "kpi.orders": "Monthly Orders",
    "kpi.unavailable": "KPI unavailable",
    "kpi.noData": "No data",
    "kpi.tryNarrow": "Try narrowing the date range.",

    "chart.chartId": "Chart ID",
    "chart.title.01": "Daily Sales Trend (This Month)",
    "chart.title.02": "Top 10 Brands (Yesterday)",
    "chart.title.03": "Monthly Cumulative Revenue",
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
    "chart.title.NEW-27": "Channel Order Count Trend",
    "chart.title.NEW-28": "Channel AOV Comparison",
    "chart.title.NEW-31": "Channel New Customer Share",
    "chart.title.GA4-01": "Traffic Source Distribution",
    "chart.title.GA4-02": "Daily Users (New vs Returning)",
    "chart.title.GA4-03": "Daily Sessions Trend",
    "chart.title.GA4-04": "Top 20 Pages",
    "chart.title.GA4-05": "Device Type Distribution",
    "chart.title.GA4-06": "Landing Page Performance",
    "chart.title.GA4-07": "E-Commerce Conversion Funnel",
    "chart.title.GA4-08": "Cart Abandonment Rate Trend",
    "chart.title.GA4-09": "Daily Conversion Rate Trend",
    "chart.title.GA4-10": "Product Sales Ranking (GA4)",
    "chart.title.GA4-11": "Form Conversion Funnel",
    "chart.title.GA4-12": "Google vs Facebook Traffic",
    "chart.title.GA4-13": "New vs Returning Revenue Share",
    "chart.title.GA4-14": "Traffic-Revenue Sync Trend",
    "chart.title.GA4-15": "Traffic-Revenue Deviation Alert",
    "chart.title.GA4-16": "Time Slot Efficiency Heatmap",
    "chart.title.GA4-17": "Weekend vs Weekday Conversion",
    "chart.title.GA4-18": "Purchase Intent vs Actual Orders",
    "chart.title.GA4-19": "Daily Traffic Quality Score",
    "chart.title.GA4-20": "New Visitors vs New Customers",
    "chart.title.GA4-21": "Ad Channel Performance Overview",
    "chart.title.GA4-22": "Paid vs Organic Traffic ROI",
    "chart.title.GA4-23": "Google Ads Revenue Efficiency",
    "chart.title.GA4-24": "Facebook Ads Revenue Efficiency",
    "chart.title.GA4-25": "LINE (Omnichat) Sales Impact",
    "chart.title.GA4-26": "Channel Traffic Quality Ranking",
    "chart.title.GA4-27": "Channel New Customer Efficiency",
    "chart.title.GA4-28": "Referral Traffic Business Value",
    "chart.title.GA4-29": "Campaign Revenue Lift Analysis",
    "chart.title.GA4-30": "Campaign New vs Repeat Customers",
    "chart.title.GA4-31": "Product Views vs Sales",
    "chart.title.GA4-32": "Creative Fatigue Detection",
    "chart.title.GA4-33": "Cross-Platform Campaign Matrix",
    "chart.title.GA4-34": "Campaign Landing Page Efficiency",
    "chart.title.GA4-35": "Monthly Marketing Dashboard",
    "chart.pin": "Pin",
    "chart.unpin": "Unpin",
    "chart.export": "Export",
    "chart.exportPng": "Download Chart PNG",
    "chart.exportCsv": "Download Data CSV",
    "chart.exportExcel": "Download Data Excel",
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
