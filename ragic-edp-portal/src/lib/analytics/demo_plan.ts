import type { ChartSpecV0 } from "@/lib/analytics/chart_registry";

export const DEMO_TASK_PACK = [
  "T1 欄位來源",
  "T2 型別驗證",
  "T3 缺漏檢查",
  "T4 圖形適配",
  "T5 分類判斷",
  "T6 看板歸位",
  "T7 行銷意義",
  "T8 SQL 對帳",
] as const;

export type DemoTaskName = (typeof DEMO_TASK_PACK)[number];

export type DemoPlanDetail = {
  itemId: string;
  phase: "Phase 1" | "Phase 2" | "Phase 3";
  typeChoice: string;
  fieldChoice: string;
  displayMode: string;
  tests: string;
  semanticCheck: string;
};

export type DemoGateState = {
  done: number;
  total: number;
  gateG1: boolean;
  gateG2: boolean;
  gateG3: boolean;
  gateG4: boolean;
  gateG5: boolean;
};

type PlanSummary = Omit<DemoPlanDetail, "itemId" | "phase">;

const GA4_PLAN_SUMMARY: Record<string, PlanSummary> = {
  "GA4-01": { typeChoice: "donut", fieldChoice: "medium, sessions", displayMode: "來源佔比 + 百分比標籤", tests: "U/I/E2E（篩選後重算）", semanticCheck: "來源結構占比，donut 合理" },
  "GA4-02": { typeChoice: "stacked_area", fieldChoice: "date, new_users, returning_users", displayMode: "新/回訪堆疊趨勢", tests: "U/I/E2E（日期篩選）", semanticCheck: "趨勢+組成同時呈現" },
  "GA4-03": { typeChoice: "time_series_line", fieldChoice: "date, sessions", displayMode: "單軸趨勢", tests: "U/I/E2E（縮放閱讀）", semanticCheck: "流量趨勢，line 最佳" },
  "GA4-04": { typeChoice: "bar_topn", fieldChoice: "page, pageviews", displayMode: "Top20 排序條圖", tests: "U/I/E2E（切圖與匯出）", semanticCheck: "排名問題，bar 最佳" },
  "GA4-05": { typeChoice: "donut", fieldChoice: "device, users", displayMode: "裝置占比圓環", tests: "U/I/E2E（tooltip）", semanticCheck: "組成占比，donut 合理" },
  "GA4-06": { typeChoice: "table", fieldChoice: "landing_page, sessions, bounce_rate, avg_engagement", displayMode: "表格可排序", tests: "U/I/E2E（手機可讀）", semanticCheck: "多指標比較，table 合理" },
  "GA4-07": { typeChoice: "funnel", fieldChoice: "view/add/checkout/purchase", displayMode: "漏斗各段轉換率", tests: "U/I/E2E（漏斗渲染）", semanticCheck: "轉換流程，funnel 必須" },
  "GA4-08": { typeChoice: "time_series_line", fieldChoice: "date, cart_abandon_rate", displayMode: "趨勢線 + 警示門檻", tests: "U/I/E2E（註解顯示）", semanticCheck: "放棄率趨勢" },
  "GA4-09": { typeChoice: "time_series_line", fieldChoice: "date, cvr", displayMode: "趨勢線 + 單位%", tests: "U/I/E2E（跨區間對比）", semanticCheck: "CVR 時間變化" },
  "GA4-10": { typeChoice: "bar_topn", fieldChoice: "item_name, revenue(,qty)", displayMode: "TopN 商品排行", tests: "U/I/E2E（匯出）", semanticCheck: "商品貢獻排行" },
  "GA4-11": { typeChoice: "funnel/bar", fieldChoice: "form_start, form_submit", displayMode: "漏斗+段落轉換", tests: "U/I/E2E（切換圖型）", semanticCheck: "表單流程，funnel 優先" },
  "GA4-12": { typeChoice: "bar", fieldChoice: "source, sessions, cvr", displayMode: "Google/Facebook 對照", tests: "U/I/E2E（圖例切換）", semanticCheck: "類別比較，bar 合理" },
  "GA4-13": { typeChoice: "donut", fieldChoice: "customer_type, revenue_share", displayMode: "新客/回購營收占比", tests: "U/I/E2E（百分比顯示）", semanticCheck: "組成分析，donut 合理" },
  "GA4-14": { typeChoice: "dual_axis_line", fieldChoice: "date, sessions, revenue", displayMode: "雙軸同步趨勢", tests: "U/I/E2E（雙軸 tooltip）", semanticCheck: "同步性分析，雙軸合理" },
  "GA4-15": { typeChoice: "scatter_alert", fieldChoice: "session_delta, revenue_delta", displayMode: "四象限 + 告警點", tests: "U/I/E2E（告警標記）", semanticCheck: "偏離診斷，scatter 合理" },
  "GA4-16": { typeChoice: "heatmap", fieldChoice: "dow, hour, traffic_or_orders", displayMode: "時段熱力矩陣", tests: "U/I/E2E（手機可讀）", semanticCheck: "時段效率分析" },
  "GA4-17": { typeChoice: "stacked_bar", fieldChoice: "weekend_flag, sessions, revenue, cvr", displayMode: "週末/平日分組", tests: "U/I/E2E（切圖）", semanticCheck: "二群比較，stacked bar 合理" },
  "GA4-18": { typeChoice: "dual_axis_line", fieldChoice: "date, add_to_cart, orders", displayMode: "意圖 vs 成交落差", tests: "U/I/E2E（註解）", semanticCheck: "落差趨勢分析" },
  "GA4-19": { typeChoice: "time_series_line", fieldChoice: "date, quality_score", displayMode: "品質分數趨勢 + 0-100", tests: "U/I/E2E（tooltip）", semanticCheck: "品質監控" },
  "GA4-20": { typeChoice: "dual_axis_line", fieldChoice: "date, first_visit, new_customers", displayMode: "新客流量 vs 新客訂單", tests: "U/I/E2E（篩選）", semanticCheck: "雙序列對照" },
  "GA4-21": { typeChoice: "table", fieldChoice: "source, sessions, cvr, revenue, aov", displayMode: "通路綜合評分表", tests: "U/I/E2E（排序）", semanticCheck: "多指標決策，table 最佳" },
  "GA4-22": { typeChoice: "stacked_bar", fieldChoice: "month, paid_share, organic_share", displayMode: "付費/自然占比+趨勢", tests: "U/I/E2E（圖例）", semanticCheck: "結構變化，stacked 合理" },
  "GA4-23": { typeChoice: "dual_axis_line", fieldChoice: "date, google_cpc_sessions, revenue", displayMode: "Google 流量轉營收", tests: "U/I/E2E", semanticCheck: "效率趨勢" },
  "GA4-24": { typeChoice: "dual_axis_line", fieldChoice: "date, facebook_paid_sessions, revenue", displayMode: "Facebook 流量轉營收", tests: "U/I/E2E", semanticCheck: "效率趨勢" },
  "GA4-25": { typeChoice: "line_annotation", fieldChoice: "date, omnichat_sessions, revenue", displayMode: "高峰註記 + 前後比較", tests: "U/I/E2E", semanticCheck: "活動影響判讀" },
  "GA4-26": { typeChoice: "table", fieldChoice: "source, engaged_rate, cvr, revenue_per_session", displayMode: "通路品質排行", tests: "U/I/E2E", semanticCheck: "品質比較" },
  "GA4-27": { typeChoice: "bar", fieldChoice: "source, first_visit_rate, new_customers", displayMode: "新客效率比較", tests: "U/I/E2E", semanticCheck: "類別比較" },
  "GA4-28": { typeChoice: "table/bar", fieldChoice: "referral_source, sessions, cvr, revenue_impact", displayMode: "Referral 商業價值", tests: "U/I/E2E", semanticCheck: "來源價值評估" },
  "GA4-29": { typeChoice: "line_annotation", fieldChoice: "date, campaign_sessions, revenue_lift", displayMode: "活動區間標註", tests: "U/I/E2E", semanticCheck: "活動拉動分析" },
  "GA4-30": { typeChoice: "stacked_bar", fieldChoice: "campaign, new_vs_repeat", displayMode: "新客/回購分布", tests: "U/I/E2E", semanticCheck: "活動客群結構" },
  "GA4-31": { typeChoice: "scatter", fieldChoice: "item_views, sales_qty", displayMode: "商品關注-銷量散點", tests: "U/I/E2E", semanticCheck: "關注與成交關係" },
  "GA4-32": { typeChoice: "line_alert", fieldChoice: "date, campaign_cvr", displayMode: "連續衰退告警", tests: "U/I/E2E", semanticCheck: "素材疲乏偵測" },
  "GA4-33": { typeChoice: "heatmap", fieldChoice: "source, campaign, performance", displayMode: "平台×活動矩陣", tests: "U/I/E2E", semanticCheck: "交叉成效分析" },
  "GA4-34": { typeChoice: "table", fieldChoice: "landing_page, campaign, sessions, cvr, rps", displayMode: "活動頁效率排行", tests: "U/I/E2E", semanticCheck: "多指標頁面效率" },
  "GA4-35": { typeChoice: "kpi_tiles_sparkline", fieldChoice: "monthly KPI set", displayMode: "KPI 磚 + sparkline", tests: "U/I/E2E（響應式）", semanticCheck: "管理總覽儀表板" },
};

export const REPLAN_PHASE3_ITEMS: DemoPlanDetail[] = [
  { itemId: "RP-A01", phase: "Phase 3", typeChoice: "funnel", fieldChoice: "status/event_step, users/orders", displayMode: "分段漏斗 + 轉換率", tests: "U/I/E2E", semanticCheck: "流程流失分析" },
  { itemId: "RP-A02", phase: "Phase 3", typeChoice: "line + UCL/LCL", fieldChoice: "date, metric, ucl, lcl", displayMode: "中線 + 管制上/下限", tests: "U/I/E2E", semanticCheck: "穩定性監測" },
  { itemId: "RP-A03", phase: "Phase 3", typeChoice: "slope", fieldChoice: "periodA, periodB, value", displayMode: "兩期變化斜率", tests: "U/I/E2E", semanticCheck: "前後期比較" },
  { itemId: "RP-A04", phase: "Phase 3", typeChoice: "box_plot", fieldChoice: "metric distribution", displayMode: "中位/四分位/離群", tests: "U/I/E2E", semanticCheck: "分布差異" },
  { itemId: "RP-A05", phase: "Phase 3", typeChoice: "calendar_heatmap", fieldChoice: "date, metric", displayMode: "月曆格點 + 色階", tests: "U/I/E2E", semanticCheck: "季節性/日效應" },
  { itemId: "RP-A06", phase: "Phase 3", typeChoice: "scatter_matrix", fieldChoice: "multi metrics", displayMode: "多指標 pair matrix", tests: "U/I/E2E", semanticCheck: "關聯探索" },
  { itemId: "RP-A07", phase: "Phase 3", typeChoice: "sankey-lite/path", fieldChoice: "source_node,target_node,value", displayMode: "流程路徑圖", tests: "U/I/E2E", semanticCheck: "行為路徑分析" },
  { itemId: "RP-A08", phase: "Phase 3", typeChoice: "reverse_path", fieldChoice: "conversion_prev_steps", displayMode: "轉換前路徑回溯", tests: "U/I/E2E", semanticCheck: "轉換前觸點" },
  { itemId: "RP-B01", phase: "Phase 3", typeChoice: "sankey", fieldChoice: "source,target,flow", displayMode: "多節點流向", tests: "U/I/E2E", semanticCheck: "流向分析" },
  { itemId: "RP-B02", phase: "Phase 3", typeChoice: "chord", fieldChoice: "entity_a,entity_b,value", displayMode: "關聯強度弦圖", tests: "U/I/E2E", semanticCheck: "共現關係" },
  { itemId: "RP-B03", phase: "Phase 3", typeChoice: "quadrant/scatter", fieldChoice: "x_metric,y_metric,segment", displayMode: "四象限 + 門檻線", tests: "U/I/E2E", semanticCheck: "策略分區" },
  { itemId: "RP-B04", phase: "Phase 3", typeChoice: "marimekko", fieldChoice: "dim1,dim2,share", displayMode: "面積=占比", tests: "U/I/E2E", semanticCheck: "結構比較" },
  { itemId: "RP-B05", phase: "Phase 3", typeChoice: "cohort_matrix", fieldChoice: "cohort_month,period,retention", displayMode: "cohort 留存矩陣", tests: "U/I/E2E", semanticCheck: "留存分析" },
  { itemId: "RP-B06", phase: "Phase 3", typeChoice: "venn/upset", fieldChoice: "segment flags,user_id", displayMode: "2~3 區交集", tests: "U/I/E2E", semanticCheck: "受眾重疊" },
  { itemId: "RP-B07", phase: "Phase 3", typeChoice: "choropleth", fieldChoice: "region_code,metric", displayMode: "地圖色階 + 排名", tests: "U/I/E2E", semanticCheck: "地理分布" },
  { itemId: "RP-B08", phase: "Phase 3", typeChoice: "gantt", fieldChoice: "task,start,end,status", displayMode: "活動時間軸", tests: "U/I/E2E", semanticCheck: "活動節奏管理" },
];

export const PHASE3_FIX_ITEMS: DemoPlanDetail[] = [
  { itemId: "GA4-22", phase: "Phase 3", typeChoice: "先隱藏/修正", fieldChoice: "required_fields 與 SQL 輸出不一致", displayMode: "先隱藏，補契約再開", tests: "U/I/E2E 回歸", semanticCheck: "避免誤判 ROI" },
  { itemId: "GA4-28", phase: "Phase 3", typeChoice: "先隱藏/修正", fieldChoice: "revenue_impact 未穩定輸出", displayMode: "補公式或改欄位定義", tests: "U/I/E2E", semanticCheck: "避免虛假商業價值" },
  { itemId: "GA4-30", phase: "Phase 3", typeChoice: "先隱藏/修正", fieldChoice: "新客/回購定義與欄位衝突", displayMode: "統一定義後重開", tests: "U/I/E2E", semanticCheck: "避免客群誤讀" },
  { itemId: "GA4-34", phase: "Phase 3", typeChoice: "先隱藏/修正", fieldChoice: "revenue_per_session 契約漂移", displayMode: "先修 SQL 或契約", tests: "U/I/E2E", semanticCheck: "避免效率失真" },
  { itemId: "Chart-04", phase: "Phase 3", typeChoice: "保留+修正", fieldChoice: "目標值固定常數", displayMode: "目標配置化", tests: "U/I/E2E", semanticCheck: "避免達成率失真" },
  { itemId: "Chart-44", phase: "Phase 3", typeChoice: "保留+改名", fieldChoice: "名稱與指標語義偏差", displayMode: "改名或補折扣欄位", tests: "U/I/E2E", semanticCheck: "降低語義誤導" },
  { itemId: "Chart-52", phase: "Phase 3", typeChoice: "保留+改名", fieldChoice: "生日月實為首購月 proxy", displayMode: "明確標註 proxy", tests: "U/I/E2E", semanticCheck: "降低決策誤解" },
];

export function getExecutionLane(supportsDateFilter: boolean, supportsBrandFilter: boolean): "Interactive" | "Snapshot" {
  return supportsDateFilter && supportsBrandFilter ? "Interactive" : "Snapshot";
}

export function getDemoPlanDetail(spec: ChartSpecV0): DemoPlanDetail {
  const ga4 = GA4_PLAN_SUMMARY[spec.chart_id];
  if (ga4) {
    return {
      itemId: spec.chart_id,
      phase: "Phase 2",
      ...ga4,
    };
  }

  return {
    itemId: spec.chart_id,
    phase: "Phase 1",
    typeChoice: spec.chart_type,
    fieldChoice: spec.required_fields.join(", "),
    displayMode: "legend/tooltip/unit 對齊 registry 與實際資料",
    tests: "U/I/E2E（至少驗證資料契約與匯出能力）",
    semanticCheck: "依 chart_type 與分析問題對齊（問題-圖型/維度-指標）",
  };
}

export function getGateState(taskProgress: Record<string, boolean>, itemId: string): DemoGateState {
  const taskDone = (task: DemoTaskName) => Boolean(taskProgress[`${itemId}:${task}`]);
  const e2eDone = Boolean(taskProgress[`${itemId}:E2E`]);

  let done = 0;
  DEMO_TASK_PACK.forEach((task) => {
    if (taskDone(task)) done += 1;
  });
  if (e2eDone) done += 1;

  return {
    done,
    total: DEMO_TASK_PACK.length + 1,
    gateG1: taskDone("T1 欄位來源") && taskDone("T2 型別驗證") && taskDone("T3 缺漏檢查"),
    gateG2: taskDone("T4 圖形適配"),
    gateG3: taskDone("T6 看板歸位") && taskDone("T8 SQL 對帳"),
    gateG4: taskDone("T7 行銷意義"),
    gateG5: e2eDone,
  };
}
