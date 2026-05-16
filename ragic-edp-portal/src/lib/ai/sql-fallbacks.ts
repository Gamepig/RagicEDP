import { GA4_MAT_FQ_DATASET } from "@/lib/config/bigquery-datasets";

export function shouldUseBrandShareFallback(prompt: string): boolean {
  const q = prompt.toLowerCase();
  return (q.includes("品牌") || q.includes("brand")) && (q.includes("佔比") || q.includes("占比") || q.includes("share"));
}

function extractMonthStart(naturalLanguage: string): string | null {
  const monthMatch = naturalLanguage.match(/(20\d{2})年\s*(\d{1,2})月/);
  if (!monthMatch) return null;
  const year = monthMatch[1];
  const month = monthMatch[2].padStart(2, "0");
  return `${year}-${month}-01`;
}

const BRAND_NAME_TO_CODE: Record<string, string> = {
  "菜市仔嬤": "GMK",
  "HOYA": "HYA",
  "hoya": "HYA",
  "寶島鮮": "BDF",
  "有樹食": "YAS",
  "HH-Life": "HHH",
  "hh-life": "HHH",
};

function extractBrandCode(naturalLanguage: string): string | null {
  for (const [name, code] of Object.entries(BRAND_NAME_TO_CODE)) {
    if (naturalLanguage.includes(name)) return code;
  }
  return null;
}

function buildBrandFilter(brandCode: string | null, alias?: string): string {
  if (!brandCode) return "";
  return `AND ${alias ? `${alias}.` : ""}brand_code = '${brandCode}'`;
}

export function buildDeterministicGa4SourceSql(naturalLanguage: string): string | null {
  const text = naturalLanguage.toLowerCase();
  const asksSource = /ga4|流量|traffic|來源|source|媒介|medium/.test(text)
    && /來源|source|媒介|medium/.test(text);
  const from = extractMonthStart(naturalLanguage);
  const brandCode = extractBrandCode(naturalLanguage);

  if (!asksSource || !from) {
    return null;
  }

  return `
SELECT
  source,
  medium,
  SUM(sessions) AS sessions,
  SUM(users) AS users,
  SUM(first_visit_count) AS first_visit_count,
  SUM(purchasers) AS purchasers,
  SAFE_DIVIDE(SUM(purchasers), NULLIF(SUM(sessions), 0)) AS cvr
FROM \`${GA4_MAT_FQ_DATASET}.mat_ga4_source_daily\`
WHERE event_date >= DATE('${from}')
  AND event_date < DATE_ADD(DATE('${from}'), INTERVAL 1 MONTH)
  ${brandCode ? `AND brand_code = '${brandCode}'` : ""}
GROUP BY source, medium
ORDER BY sessions DESC
LIMIT 50`.replace(/\n\s*\n/g, "\n").trim();
}

export function buildDeterministicWeekendWeekdayAovSql(naturalLanguage: string): string | null {
  const text = naturalLanguage.toLowerCase();
  const asksWeekendWeekday = /週末|周末|平日|假日|休日|weekend|weekday/.test(text);
  const asksAov = /平均客單|客單|平均單價|aov|average\s*order/i.test(naturalLanguage);
  const from = extractMonthStart(naturalLanguage);
  const brandCode = extractBrandCode(naturalLanguage);

  if (!asksWeekendWeekday || !asksAov || !from) {
    return null;
  }

  return `
SELECT
  day_type,
  ROUND(SAFE_DIVIDE(SUM(revenue_net_sum), NULLIF(SUM(order_count), 0)), 2) AS avg_order_value,
  SUM(order_count) AS orders,
  ROUND(SUM(revenue_net_sum), 0) AS revenue
FROM \`b25h01-ragic.erp_backup.ls_p1_10_weekend_weekday_qty\`
WHERE order_date >= DATE('${from}')
  AND order_date < DATE_ADD(DATE('${from}'), INTERVAL 1 MONTH)
  ${buildBrandFilter(brandCode)}
GROUP BY day_type
ORDER BY day_type
LIMIT 50`.replace(/\n\s*\n/g, "\n").trim();
}

export function buildDeterministicGa4RagicDailyDiffSql(naturalLanguage: string): string | null {
  const text = naturalLanguage.toLowerCase();
  const asksCompare = /比對|比較|對照|落差|差異|vs|比校/i.test(naturalLanguage);
  const asksGa4 = /ga4/.test(text) && /購買人數|purchasers|purchase/i.test(naturalLanguage);
  const asksRagicOrders = /ragic|訂單|orders?|order_count/i.test(text);
  const asksDaily = /按日|每日|每天|日別|daily/i.test(naturalLanguage);
  const from = extractMonthStart(naturalLanguage);
  const brandCode = extractBrandCode(naturalLanguage);

  if (!asksCompare || !asksGa4 || !asksRagicOrders || !asksDaily || !from) {
    return null;
  }

  return `
WITH ga4 AS (
  SELECT
    date,
    SUM(purchasers) AS ga4_purchasers
  FROM \`${GA4_MAT_FQ_DATASET}.mat_ga4_daily_traffic\`
  WHERE date >= DATE('${from}')
    AND date < DATE_ADD(DATE('${from}'), INTERVAL 1 MONTH)
    ${buildBrandFilter(brandCode)}
  GROUP BY date
),
erp AS (
  SELECT
    order_date AS date,
    COUNT(DISTINCT order_code) AS ragic_orders
  FROM \`b25h01-ragic.erp_backup.view_order_customer\`
  WHERE order_date >= DATE('${from}')
    AND order_date < DATE_ADD(DATE('${from}'), INTERVAL 1 MONTH)
    AND LOWER(status) = 'toggle-on'
    ${buildBrandFilter(brandCode)}
  GROUP BY order_date
)
SELECT
  COALESCE(ga4.date, erp.date) AS date,
  COALESCE(ga4.ga4_purchasers, 0) AS ga4_purchasers,
  COALESCE(erp.ragic_orders, 0) AS ragic_orders,
  COALESCE(ga4.ga4_purchasers, 0) - COALESCE(erp.ragic_orders, 0) AS diff
FROM ga4
FULL OUTER JOIN erp USING (date)
ORDER BY date
LIMIT 50`.replace(/\n\s*\n/g, "\n").trim();
}

export function getBrandShareFallbackSql(): string {
  return `
WITH order_brand AS (
  SELECT
    order_code,
    ANY_VALUE(brand_name) AS brand_name
  FROM \`b25h01-ragic.erp_backup.ls_v_order_lines_ext\`
  WHERE order_date >= DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 30 DAY)
    AND brand_name IS NOT NULL
    AND LOWER(status) = 'toggle-on'
  GROUP BY order_code
),
order_revenue AS (
  SELECT
    o.order_code,
    ob.brand_name,
    o.order_amount_with_shipping AS revenue
  FROM \`b25h01-ragic.erp_backup.view_order_customer\` o
  JOIN order_brand ob USING (order_code)
  WHERE o.order_date >= DATE_SUB(CURRENT_DATE('Asia/Taipei'), INTERVAL 30 DAY)
    AND LOWER(o.status) = 'toggle-on'
)
SELECT
  brand_name,
  SUM(revenue) AS revenue,
  ROUND(
    SAFE_DIVIDE(
      SUM(revenue),
      SUM(SUM(revenue)) OVER()
    ) * 100,
    2
  ) AS revenue_share_pct
FROM order_revenue
GROUP BY brand_name
ORDER BY revenue DESC
LIMIT 10`.trim();
}
