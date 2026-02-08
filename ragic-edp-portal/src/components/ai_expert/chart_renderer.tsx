"use client";

import { useEffect, useState } from "react";
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
  "bar", "stacked_bar", "horizontal_bar", "line", "pie", "donut",
  "area", "composed", "radar", "treemap", "scatter",
] as const;

const CHART_TYPE_LABELS: Record<(typeof CHART_TYPES)[number], string> = {
  bar: "長條圖",
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

type ChartRendererProps = {
  chart: AiChartDataV1;
  onTypeChange?: (chartId: string, newType: AiChartDataV1["chartType"]) => void;
  onPin?: (chart: AiChartDataV1) => void;
};

export function ChartRenderer({ chart, onTypeChange, onPin }: ChartRendererProps) {
  const [activeType, setActiveType] = useState(chart.chartType);
  const [mounted, setMounted] = useState(false);

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
  const formatTooltip = (value: any) => typeof value === "number" ? value.toLocaleString("zh-TW") : String(value ?? "");

  // Rotate X-axis labels when there are many categories
  const needsRotation = rawData.length > 8;
  const xAxisProps = needsRotation
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
    const commonProps = { data, margin: { top: 5, right: 30, bottom: needsRotation ? 60 : 5, left: 10 } };

    switch (activeType) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        );

      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
            ))}
          </LineChart>
        );

      case "pie":
      case "donut":
        return (
          <PieChart>
            <Tooltip formatter={formatTooltip} />
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
            <Tooltip formatter={formatTooltip} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} stroke={COLORS[i % COLORS.length]} />
            ))}
          </AreaChart>
        );

      case "stacked_bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="stack" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        );

      case "horizontal_bar":
        return (
          <BarChart {...commonProps} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" className="text-xs" tickFormatter={formatNum} />
            <YAxis dataKey={chart.xKey} type="category" className="text-xs" width={100} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        );

      case "composed":
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} {...xAxisProps} />
            <YAxis className="text-xs" tickFormatter={formatNum} />
            <Tooltip formatter={formatTooltip} />
            <Legend />
            {chart.yKeys.map((key, i) =>
              i === 0 ? (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
              ) : (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
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
            <Tooltip formatter={formatTooltip} />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Radar key={key} dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} />
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
            <Tooltip formatter={formatTooltip} />
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
          <DataDownloadButtons chart={chart} />
          {onPin && (
            <button
              type="button"
              onClick={() => onPin(chart)}
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted/50"
            >
              釘選
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

      <div className="w-full overflow-x-auto">
        {mounted && (
          <div style={{ width: "100%", minWidth: 400, height: 300 }}>
            <ResponsiveContainer>
              {renderChart()!}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
