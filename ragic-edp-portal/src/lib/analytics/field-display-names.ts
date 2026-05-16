export const OFFICIAL_FIELD_DISPLAY_NAMES: Record<string, string> = {
  // GA4 dimensions
  source: "流量來源",
  medium: "流量媒介",
  source_medium: "流量來源 / 流量媒介",
  campaign: "廣告活動",
  campaign_name: "廣告活動",
  event_date: "日期",
  date: "日期",
  month: "月份",
  day_type: "平假日別",

  // GA4 metrics
  sessions: "造訪次數",
  total_sessions: "總造訪次數",
  site_sessions: "網站造訪次數",
  campaign_sessions: "活動造訪次數",
  google_cpc_sessions: "Google Ads 造訪次數",
  fb_paid_sessions: "Facebook Ads 造訪次數",
  line_sessions: "LINE 導購造訪次數",
  omnichat_sessions: "LINE 導購造訪次數",
  paidmedia_sessions: "paidmedia 造訪次數",
  paid_sessions: "付費造訪次數",
  organic_sessions: "自然搜尋造訪次數",
  users: "使用者",
  new_users: "新使用者",
  new_visitors: "新使用者",
  first_visit_count: "首次造訪",
  returning_users: "回訪者",
  returning_visitors: "回訪者",
  engaged_sessions: "參與工作階段",
  engaged_rate: "互動率",
  engagement_rate: "互動率",
  avg_engagement_sec: "平均互動時間（秒）",
  purchasers: "購買者",
  total_purchasers: "總購買者",
  site_purchasers: "網站購買者",
  ga4_purchasers: "GA4 購買者",
  cvr: "購買轉換率（CVR）",
  conversion_rate: "轉換率",
  bounce_rate: "跳出率",
  pageviews: "瀏覽量",
  event_count: "事件數",
  add_to_cart_count: "加入購物車",
  begin_checkout_count: "結帳",
  item_name: "商品名稱",
  view_count: "項目瀏覽事件數",

  // ERP and cross-platform metrics
  revenue: "營收",
  revenue_sum: "營收",
  revenue_net_sum: "實收營收",
  orders: "訂單數（ERP）",
  order_count: "訂單數（ERP）",
  ragic_orders: "ERP 訂單數",
  avg_order_value: "平均客單價",
  aov: "平均訂單金額（AOV，ERP）",
  revenue_per_session: "每次造訪營收",
  quantity_sum: "商品件數",
  sold_quantity: "商品件數",
  diff: "差異",
};

export function displayNameWithField(field: string, displayName: string): string {
  const normalizedField = field.trim();
  const normalizedDisplayName = displayName.trim();
  if (!normalizedField) return normalizedDisplayName;
  if (!normalizedDisplayName || normalizedDisplayName === normalizedField) return normalizedField;
  if (normalizedDisplayName.includes(`（${normalizedField}）`)) return normalizedDisplayName;
  return `${normalizedDisplayName}（${normalizedField}）`;
}

export function officialFieldDisplayName(field: string | undefined, includeField = true): string | undefined {
  if (!field) return undefined;
  const displayName = OFFICIAL_FIELD_DISPLAY_NAMES[field];
  if (!displayName) return undefined;
  return includeField ? displayNameWithField(field, displayName) : displayName;
}

export function buildFieldDisplayNameMap(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const label = officialFieldDisplayName(field);
    if (label) out[field] = label;
  }
  return out;
}
