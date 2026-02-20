"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DemoChartType = "line" | "bar" | "area" | "donut";

type DemoRow = {
  month: string;
  revenue: number;
  orders: number;
  aov: number;
  conversionRate: number;
};

const DEMO_DATA: DemoRow[] = [
  { month: "Jan", revenue: 1280000, orders: 1100, aov: 1164, conversionRate: 2.8 },
  { month: "Feb", revenue: 1325000, orders: 1180, aov: 1123, conversionRate: 3.0 },
  { month: "Mar", revenue: 1410000, orders: 1260, aov: 1119, conversionRate: 3.1 },
  { month: "Apr", revenue: 1380000, orders: 1215, aov: 1136, conversionRate: 2.9 },
  { month: "May", revenue: 1515000, orders: 1342, aov: 1129, conversionRate: 3.3 },
  { month: "Jun", revenue: 1592000, orders: 1418, aov: 1122, conversionRate: 3.4 },
  { month: "Jul", revenue: 1660000, orders: 1495, aov: 1110, conversionRate: 3.5 },
  { month: "Aug", revenue: 1718000, orders: 1530, aov: 1123, conversionRate: 3.6 },
];

const PIE_COLORS = ["#0f766e", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#64748b"];

const CHART_TYPE_OPTIONS: Array<{ id: DemoChartType; label: string }> = [
  { id: "line", label: "折線" },
  { id: "bar", label: "長條" },
  { id: "area", label: "面積" },
  { id: "donut", label: "甜甜圈" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("zh-TW", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function ChartUiDemoPage() {
  const [chartType, setChartType] = useState<DemoChartType>("line");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totals = useMemo(() => {
    const totalRevenue = DEMO_DATA.reduce((sum, row) => sum + row.revenue, 0);
    const totalOrders = DEMO_DATA.reduce((sum, row) => sum + row.orders, 0);
    const avgAov = Math.round(totalRevenue / totalOrders);
    const avgCv = DEMO_DATA.reduce((sum, row) => sum + row.conversionRate, 0) / DEMO_DATA.length;
    return { totalRevenue, totalOrders, avgAov, avgCv };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter: any = (value: number, key: string) => {
    if (key === "revenue") return [formatCurrency(value), "營收"];
    if (key === "orders") return [value.toLocaleString("zh-TW"), "訂單數"];
    if (key === "aov") return [formatCurrency(value), "客單價"];
    if (key === "conversionRate") return [formatPercent(value), "轉換率"];
    return [value, key];
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commonProps: { data: typeof DEMO_DATA; onMouseMove: (state: any) => void; onMouseLeave: () => void; children?: React.ReactNode } = {
    data: DEMO_DATA,
    onMouseMove: (state) => {
      if (typeof state.activeTooltipIndex === "number") setActiveIndex(state.activeTooltipIndex);
    },
    onMouseLeave: () => setActiveIndex(null),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Chart UI Pro Demo</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Portal 圖表新樣式示範</h1>
            <p className="mt-1 text-sm text-slate-600">示範重點：高質感卡片樣式、圖型切換、圖下欄位值面板（Field Value Panel）。</p>
          </div>
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/85 p-1 shadow-sm backdrop-blur">
            {CHART_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setChartType(opt.id)}
                className={
                  chartType === opt.id
                    ? "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="總營收" value={formatCompact(totals.totalRevenue)} helper={formatCurrency(totals.totalRevenue)} />
        <StatCard label="總訂單" value={totals.totalOrders.toLocaleString("zh-TW")} helper="近 8 個月" />
        <StatCard label="平均客單價" value={formatCurrency(totals.avgAov)} helper="AOV" />
        <StatCard label="平均轉換率" value={formatPercent(totals.avgCv)} helper="CVR" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">營收與訂單趨勢</h2>
            <p className="text-xs text-slate-500">可切換圖型；滑過圖表會同步高亮下方欄位值。</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">Demo ID: UI-CHART-01</span>
        </div>

        <div className="h-[360px] w-full rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/50 p-3">
          <ResponsiveContainer>
            {chartType === "line" ? (
              <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#475569" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#475569" }} tickFormatter={formatCompact} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#475569" }} />
                <Tooltip formatter={tooltipFormatter} />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            ) : chartType === "bar" ? (
              <BarChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 12, fill: "#475569" }} tickFormatter={formatCompact} />
                <Tooltip formatter={tooltipFormatter} />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]} fill="#0f766e" />
              </BarChart>
            ) : chartType === "area" ? (
              <AreaChart {...commonProps}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0891b2" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#0891b2" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#475569" }} />
                <YAxis tick={{ fontSize: 12, fill: "#475569" }} tickFormatter={formatCompact} />
                <Tooltip formatter={tooltipFormatter} />
                <Area type="monotone" dataKey="revenue" stroke="#0891b2" strokeWidth={2.5} fill="url(#revFill)" />
              </AreaChart>
            ) : (
              <PieChart>
                <Tooltip formatter={tooltipFormatter} />
                <Pie
                  data={DEMO_DATA}
                  dataKey="revenue"
                  nameKey="month"
                  innerRadius={78}
                  outerRadius={124}
                  paddingAngle={2}
                  onMouseMove={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {DEMO_DATA.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>

        <FieldValuePanel rows={DEMO_DATA} activeIndex={activeIndex} />
      </section>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </article>
  );
}

function FieldValuePanel({ rows, activeIndex }: { rows: DemoRow[]; activeIndex: number | null }) {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/65 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-700">Field Value Panel</span>
        <Badge label="維度: month" />
        <Badge label="指標: revenue / orders / aov / conversionRate" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="border-b border-slate-200 px-3 py-2 font-medium">月份</th>
              <th className="border-b border-slate-200 px-3 py-2 font-medium">營收</th>
              <th className="border-b border-slate-200 px-3 py-2 font-medium">訂單</th>
              <th className="border-b border-slate-200 px-3 py-2 font-medium">客單價</th>
              <th className="border-b border-slate-200 px-3 py-2 font-medium">轉換率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isActive = activeIndex === index;
              return (
                <tr key={row.month} className={isActive ? "bg-cyan-50" : "hover:bg-slate-100/70"}>
                  <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-700">{row.month}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{formatCurrency(row.revenue)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{row.orders.toLocaleString("zh-TW")}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{formatCurrency(row.aov)}</td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{formatPercent(row.conversionRate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">{label}</span>;
}
