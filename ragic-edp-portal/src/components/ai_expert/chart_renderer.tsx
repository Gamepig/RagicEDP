"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, PinOff, X } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { AiChartDataV1 } from "@/lib/data/types";
import { DataDownloadButtons } from "./data_download_buttons";

const CHART_TYPES = [
  "bar", "grouped_bar", "stacked_bar", "horizontal_bar", "line", "pie", "donut",
  "area", "composed", "radar", "treemap", "scatter",
] as const;

const CHART_TYPE_LABELS: Record<(typeof CHART_TYPES)[number], string> = {
  bar: "長條圖",
  grouped_bar: "分組長條",
  stacked_bar: "堆疊長條",
  horizontal_bar: "橫向長條",
  line: "折線圖",
  pie: "圓餅圖",
  donut: "環圈圖",
  area: "面積圖",
  composed: "組合圖",
  radar: "雷達圖",
  treemap: "矩形樹圖",
  scatter: "散佈圖",
};

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

/** Map common SQL column names to friendly Chinese labels for chart legends. */
const FRIENDLY_LABELS: Record<string, string> = {
  // 營收相關
  revenue: "營收",
  total_revenue: "總營收",
  total_amount: "總金額",
  order_amount: "訂單金額",
  monetary: "消費金額",
  aov: "平均客單價",
  avg_order_value: "平均客單價",
  brand_revenue_per_session: "品牌營收/流量",
  // 訂單相關
  order_count: "訂單數",
  orders: "訂單數",
  orders_this_year: "今年訂單",
  orders_last_year: "去年訂單",
  total_orders: "總訂單數",
  // 客戶相關
  customer_count: "客戶數",
  customers: "客戶數",
  unique_customers: "不重複客戶",
  total_spent: "消費金額",
  total_customers: "總客戶數",
  frequency: "購買次數",
  recency: "最近購買(天)",
  purchase_count: "購買次數",
  // 商品/銷售
  units_sold: "銷售數量",
  quantity: "數量",
  total_quantity: "總數量",
  // 維度
  month: "月份",
  year: "年份",
  date: "日期",
  day: "日",
  week: "週",
  quarter: "季度",
  period: "期間",
  brand_name: "品牌",
  channel_name: "通路",
  channel: "通路",
  customer_name: "客戶",
  product_name: "商品",
  product_series: "產品系列",
  city: "縣市",
  district: "區域",
  // GA4 相關
  sessions: "流量",
  total_sessions: "總流量",
  site_sessions: "網站流量",
  purchasers: "購買人數",
  total_purchasers: "總購買人數",
  site_purchasers: "網站購買人數",
  pageviews: "瀏覽量",
  bounce_rate: "跳出率",
  conversion_rate: "轉換率",
  source: "流量來源",
  medium: "媒介",
  campaign: "活動",
  // 成長/比較
  growth_rate: "成長率",
  mom_growth: "月增長率",
  yoy_growth: "年增長率",
  pct_change: "變化率",
  share: "佔比",
  ratio: "比率",
  revenue_share_pct: "營收佔比%",
  order_share_pct: "訂單佔比%",
  // 排名/比較
  rank: "排名",
  category: "分類",
  segment: "族群",
  rfm_segment: "RFM族群",
  last_order_date: "最後購買日",
  first_order_date: "首次購買日",
  // 額外維度
  brand_code: "品牌代碼",
  channel_code: "通路代碼",
  product_code: "商品代碼",
  customer_code: "客戶代碼",
  order_code: "訂單編號",
  order_date: "訂單日期",
  // 複合欄位
  avg_revenue: "平均營收",
  avg_orders: "平均訂單",
  avg_spent: "平均消費",
  site_revenue_per_session: "網站營收/流量",
  avg_session_duration: "平均瀏覽時間",
  new_users: "新使用者",
  active_users: "活躍使用者",
  returning_users: "回訪使用者",
  event_count: "事件數",
  // 其他常見
  pct: "百分比",
  percent: "百分比",
  diff: "差異",
  change: "變化",
  previous: "前期",
  current_period: "本期",
  prior_period: "前期",
};

/** Common word-level translations for building friendly labels from snake_case */
const WORD_MAP: Record<string, string> = {
  revenue: "營收", order: "訂單", orders: "訂單", customer: "客戶", customers: "客戶",
  brand: "品牌", channel: "通路", product: "商品", total: "總", count: "數",
  amount: "金額", avg: "平均", name: "", monthly: "月", daily: "日",
  sales: "銷售", rate: "率", growth: "成長", trend: "趨勢", sum: "合計",
  share: "佔比", pct: "%", percent: "%", ratio: "比率", diff: "差異",
  unique: "不重複", new: "新", active: "活躍", returning: "回訪",
  session: "流量", sessions: "流量", pageview: "瀏覽", pageviews: "瀏覽",
  bounce: "跳出", conversion: "轉換", purchase: "購買", purchasers: "購買人",
  city: "縣市", district: "區域", date: "日期", month: "月份", year: "年份",
  week: "週", quarter: "季度", period: "期間", site: "網站",
  segment: "族群", category: "分類", rank: "排名", code: "代碼",
  first: "首次", last: "最後", per: "/", spent: "消費", value: "值",
  frequency: "頻率", recency: "距今", monetary: "金額",
  event: "事件", user: "使用者", users: "使用者",
};

function friendlyLabel(key: string): string {
  if (FRIENDLY_LABELS[key]) return FRIENDLY_LABELS[key];
  // Try word-by-word translation
  const words = key.split("_");
  const translated = words.map((w) => WORD_MAP[w] ?? w).filter(Boolean).join("");
  // If any word was translated (contains CJK), use it
  if (/[\u4e00-\u9fff]/.test(translated)) return translated;
  // Fallback: readable snake_case
  return key.replace(/_/g, " ");
}

/**
 * Pivot long-format multi-dimension data into wide-format for grouped/stacked bar charts.
 * Input:  [{ customer: "A", product: "P1", amount: 100 }, { customer: "A", product: "P2", amount: 50 }]
 * Output: [{ customer: "A", "P1": 100, "P2": 50 }]  + seriesNames: ["P1", "P2"]
 */
function pivotData(
  data: Record<string, unknown>[],
  xKey: string,
  seriesKey: string,
  valueKey: string,
): { pivoted: Record<string, unknown>[]; seriesNames: string[] } {
  const groupMap = new Map<string, Record<string, unknown>>();
  const seriesSet = new Set<string>();

  for (const row of data) {
    const gk = String(row[xKey] ?? "");
    const sk = String(row[seriesKey] ?? "");
    const val = Number(row[valueKey]) || 0;
    seriesSet.add(sk);

    if (!groupMap.has(gk)) {
      groupMap.set(gk, { [xKey]: gk });
    }
    groupMap.get(gk)![sk] = val;
  }

  return {
    pivoted: [...groupMap.values()],
    seriesNames: [...seriesSet],
  };
}

/** Compact data table displayed below charts — shows category, values, and percentage */
function DataTable({
  data,
  xKey,
  yKeys,
  formatNum,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  formatNum: (v: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const primaryYKey = yKeys[0];
  const total = primaryYKey
    ? data.reduce((sum, row) => sum + (Number(row[primaryYKey]) || 0), 0)
    : 0;

  const displayData = expanded ? data : data.slice(0, 5);
  const hasMore = data.length > 5;

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="space-y-1.5">
        {displayData.map((row, i) => {
          const label = String(row[xKey] ?? "");
          const value = Number(row[primaryYKey] ?? 0);
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="truncate text-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 tabular-nums">
                <span className="font-medium text-foreground">{formatNum(value)}</span>
                {total > 0 && yKeys.length === 1 && (
                  <span className="text-muted-foreground w-12 text-right">{pct}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-[10px] text-primary hover:underline"
        >
          {expanded ? "收起" : `顯示全部 ${data.length} 筆`}
        </button>
      )}
      {total > 0 && yKeys.length === 1 && (
        <div className="mt-1.5 flex items-center justify-between border-t pt-1.5 text-xs font-medium">
          <span className="text-muted-foreground">合計</span>
          <span>{formatNum(total)}</span>
        </div>
      )}
    </div>
  );
}

/** Grouped data table for multi-dimension data (e.g. customer × product) */
function GroupedDataTable({
  data,
  xKey,
  seriesKey,
  yKey,
  formatNum,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  seriesKey: string;
  yKey: string;
  formatNum: (v: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Group rows by xKey
  const groups = new Map<string, { label: string; items: { series: string; value: number }[]; total: number }>();
  for (const row of data) {
    const gk = String(row[xKey] ?? "");
    const sk = String(row[seriesKey] ?? "");
    const val = Number(row[yKey]) || 0;
    if (!groups.has(gk)) groups.set(gk, { label: gk, items: [], total: 0 });
    const g = groups.get(gk)!;
    g.items.push({ series: sk, value: val });
    g.total += val;
  }
  const sortedGroups = [...groups.values()].sort((a, b) => b.total - a.total);
  const displayGroups = expanded ? sortedGroups : sortedGroups.slice(0, 5);

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="space-y-3">
        {displayGroups.map((group, gi) => (
          <div key={gi}>
            <div className="flex items-center justify-between text-xs font-medium">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[gi % COLORS.length] }}
                />
                <span className="text-foreground">{group.label}</span>
              </div>
              <span className="tabular-nums text-foreground">{formatNum(group.total)}</span>
            </div>
            <div className="ml-5 mt-1 space-y-0.5">
              {group.items.map((item, ii) => (
                <div key={ii} className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate">{item.series}</span>
                  <span className="tabular-nums">{formatNum(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {sortedGroups.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-[10px] text-primary hover:underline"
        >
          {expanded ? "收起" : `顯示全部 ${sortedGroups.length} 組`}
        </button>
      )}
    </div>
  );
}

type ChartRendererProps = {
  chart: AiChartDataV1;
  onTypeChange?: (chartId: string, newType: AiChartDataV1["chartType"]) => void;
  onPin?: (chart: AiChartDataV1) => void;
  onUnpin?: () => void;
  pinned?: boolean;
};

export function ChartRenderer({ chart, onTypeChange, onPin, onUnpin, pinned }: ChartRendererProps) {
  const [activeType, setActiveType] = useState(chart.chartType);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const chartBodyRef = useRef<HTMLDivElement>(null);

  const closeExpanded = useCallback(() => setExpanded(false), []);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeExpanded(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, closeExpanded]);

  // Delay rendering to ensure parent has layout dimensions
  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);
  const rawData = chart.data as Record<string, unknown>[];

  // For pie/donut with many categories, group small slices into "其他"
  const data = (() => {
    if ((activeType !== "pie" && activeType !== "donut") || rawData.length <= 8) return rawData;
    const yKey = chart.yKeys[0];
    const sorted = [...rawData].sort((a, b) => (Number(b[yKey]) || 0) - (Number(a[yKey]) || 0));
    const top7 = sorted.slice(0, 7);
    const rest = sorted.slice(7);
    if (rest.length === 0) return top7;
    const otherVal = rest.reduce((sum, r) => sum + (Number(r[yKey]) || 0), 0);
    return [...top7, { [chart.xKey]: "其他", [yKey]: otherVal }];
  })();

  function handleTypeChange(type: AiChartDataV1["chartType"]) {
    setActiveType(type);
    onTypeChange?.(chart.chartId, type);
  }

  function formatNum(value: number): string {
    if (value >= 1e8) return `${(value / 1e8).toFixed(1)}億`;
    if (value >= 1e4) return `${(value / 1e4).toFixed(0)}萬`;
    return value.toLocaleString("zh-TW");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatTooltip = (value: any, name: any) => [typeof value === "number" ? value.toLocaleString("zh-TW") : String(value ?? ""), friendlyLabel(String(name))];
  const formatTooltipLabel = (label: unknown) => friendlyLabel(String(chart.xKey)) + ": " + String(label ?? "");

  // Rotate X-axis labels when there are many categories
  const needsRotation = rawData.length > 8;
  const manyCategories = rawData.length > 15;
  const xAxisProps = manyCategories
    ? { angle: -90, textAnchor: "end" as const, height: 100, interval: 0, tick: { fontSize: 10, dx: -4, dy: -4 } }
    : needsRotation
      ? { angle: -45, textAnchor: "end" as const, height: 80, interval: 0, className: "text-[10px]" }
      : { className: "text-xs" };

  // Custom pie label with connector lines — positions text at end of label line to avoid overlap
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderPieLabel(props: any) {
    const { cx, cy, midAngle, outerRadius, name, value, percent } = props;
    if ((percent ?? 0) < 0.02) return null;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 20;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? "start" : "end";
    return (
      <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" className="text-xs fill-foreground">
        {name}: {formatNum(value)}
      </text>
    );
  }

  function renderChart() {
    const commonProps = { data, margin: { top: 5, right: 30, bottom: manyCategories ? 80 : needsRotation ? 60 : 5, left: 10 } };

    switch (activeType) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} name={friendlyLabel(key)} fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        );

      case "grouped_bar": {
        // Multi-dimension: pivot data so each series value becomes a separate Bar
        const sk = chart.seriesKey;
        if (sk && chart.yKeys[0]) {
          const { pivoted, seriesNames } = pivotData(data, chart.xKey, sk, chart.yKeys[0]);
          return (
            <BarChart data={pivoted} margin={commonProps.margin}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={chart.xKey} {...xAxisProps} />
              <YAxis className="text-xs" tickFormatter={formatNum} />
              <Tooltip formatter={formatTooltip} />
              <Legend />
              {seriesNames.map((name, i) => (
                <Bar key={name} dataKey={name} name={name} fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          );
        }
        // Fallback to regular bar if no seriesKey
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} name={friendlyLabel(key)} fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        );
      }

      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} name={friendlyLabel(key)} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
            ))}
          </LineChart>
        );

      case "pie":
      case "donut":
        return (
          <PieChart>
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Legend />
            <Pie
              data={data}
              dataKey={chart.yKeys[0]}
              nameKey={chart.xKey}
              innerRadius={activeType === "donut" ? "40%" : 0}
              outerRadius="70%"
              labelLine
              label={renderPieLabel}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} name={friendlyLabel(key)} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} stroke={COLORS[i % COLORS.length]} />
            ))}
          </AreaChart>
        );

      case "stacked_bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} name={friendlyLabel(key)} stackId="stack" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        );

      case "horizontal_bar":
        return (
          <BarChart {...commonProps} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" tickFormatter={formatNum} />
            <YAxis dataKey={chart.xKey} type="category" className="text-xs" width={100} />
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} name={friendlyLabel(key)} fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        );

      case "composed":
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Legend />
            {chart.yKeys.map((key, i) =>
              i === 0 ? (
                <Bar key={key} dataKey={key} name={friendlyLabel(key)} fill={COLORS[i % COLORS.length]} />
              ) : (
                <Line key={key} type="monotone" dataKey={key} name={friendlyLabel(key)} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
              )
            )}
          </ComposedChart>
        );

      case "radar":
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey={chart.xKey} className="text-xs" />
            <PolarRadiusAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Radar key={key} dataKey={key} name={friendlyLabel(key)} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} />
            ))}
          </RadarChart>
        );

      case "treemap":
        return (
          <Treemap
            data={data.map((d, i) => ({
              name: String(d[chart.xKey] ?? ""),
              size: Number(d[chart.yKeys[0]] ?? 0),
              fill: COLORS[i % COLORS.length],
            }))}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#fff"
            content={({ x, y, width, height, name, value }: // eslint-disable-next-line @typescript-eslint/no-explicit-any
              any) => (
              <g>
                <rect x={x} y={y} width={width} height={height} className="fill-primary/60 stroke-background" />
                {width > 50 && height > 30 && (
                  <>
                    <text x={x + 4} y={y + 16} className="text-[11px] fill-foreground font-medium">{name}</text>
                    <text x={x + 4} y={y + 30} className="text-[10px] fill-foreground/70">{formatNum(value)}</text>
                  </>
                )}
              </g>
            )}
          />
        );

      case "scatter":
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis dataKey={chart.yKeys[0]} className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} labelFormatter={formatTooltipLabel} />
            <Scatter data={data} fill={COLORS[0]} />
          </ScatterChart>
        );

      default:
        return null;
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{chart.title}</h3>
        <div className="flex items-center gap-1">
          <DataDownloadButtons chart={chart} chartRef={chartBodyRef} />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-md border p-1 text-muted-foreground hover:bg-muted/50"
            title="放大"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          {onUnpin && (
            <button
              type="button"
              onClick={onUnpin}
              className="rounded-md border p-1 text-red-500 hover:bg-red-50"
              title="取消釘選"
            >
              <PinOff className="h-3.5 w-3.5" />
            </button>
          )}
          {onPin && (
            <button
              type="button"
              onClick={() => onPin(chart)}
              disabled={pinned}
              className={`rounded-md border px-2 py-1 text-xs ${pinned ? "cursor-default border-green-300 bg-green-50 text-green-700" : "hover:bg-muted/50"}`}
            >
              {pinned ? "✓ 已釘選" : "釘選"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {CHART_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
              activeType === type
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-muted/50"
            }`}
          >
            {CHART_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="w-full overflow-x-auto" ref={chartBodyRef}>
        {mounted && (
          <div style={{ width: "100%", minWidth: 400, height: manyCategories ? 380 : 300 }}>
            <ResponsiveContainer>
              {renderChart()!}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Data table below chart — use grouped view for multi-dimension, flat view otherwise */}
      {data.length > 0 && !chart.seriesKey && (
        <DataTable data={data} xKey={chart.xKey} yKeys={chart.yKeys} formatNum={formatNum} />
      )}
      {data.length > 0 && chart.seriesKey && (
        <GroupedDataTable
          data={data}
          xKey={chart.xKey}
          seriesKey={chart.seriesKey}
          yKey={chart.yKeys[0]}
          formatNum={formatNum}
        />
      )}

      {expanded && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closeExpanded}>
          <div
            className="relative mx-4 flex w-full max-w-6xl flex-col rounded-2xl border bg-background p-8 shadow-2xl"
            style={{ height: "72vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{chart.title}</h3>
              <button type="button" onClick={closeExpanded} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {CHART_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                    activeType === type ? "bg-primary text-primary-foreground" : "border hover:bg-muted/50"
                  }`}
                >
                  {CHART_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
            <div className="mt-4 flex-1">
              <ResponsiveContainer>
                {renderChart()!}
              </ResponsiveContainer>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
