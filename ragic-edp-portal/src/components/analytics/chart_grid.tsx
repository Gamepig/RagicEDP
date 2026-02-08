"use client";

import { AlertTriangle, Download, Pin, PinOff } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  Treemap,
  Scatter,
  ScatterChart,
  ZAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useI18n } from "@/lib/i18n/i18n";
import type { TranslationKeyV0 } from "@/lib/i18n/translations";
import { EmptyState, ErrorState, LoadingState } from "@/components/states/common_states";
import type { ChartDataV0 } from "@/lib/data/analytics.repo";
import type { ResultV0 } from "@/lib/data/types";
import { getChartUnit } from "@/lib/analytics/chart_registry";

type Point = { x: string; y: number };
type BubblePoint = { x: number; y: number; z: number; name?: string };

function toBubblePoints(data: unknown[]): BubblePoint[] {
  return data
    .map((v) => {
      if (!v || typeof v !== "object") return undefined;
      const r = v as { x?: unknown; y?: unknown; z?: unknown; name?: unknown };
      if (typeof r.x !== "number") return undefined;
      if (typeof r.y !== "number") return undefined;
      if (typeof r.z !== "number") return undefined;
      return {
        x: r.x,
        y: r.y,
        z: r.z,
        ...(typeof r.name === "string" ? { name: r.name } : {}),
      };
    })
    .filter((v): v is BubblePoint => Boolean(v));
}

function toPoints(data: unknown[]): Point[] {
  return data
    .map((v) => {
      if (!v || typeof v !== "object") return undefined;
      const r = v as { x?: unknown; y?: unknown };
      if (typeof r.x !== "string") return undefined;
      if (typeof r.y !== "number") return undefined;
      return { x: r.x, y: r.y };
    })
    .filter((v): v is Point => Boolean(v));
}

const CHART_PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#f43f5e",
  "#a855f7",
  "#3b82f6",
  "#22c55e",
];

function getChartColor(chartId: string): string {
  let hash = 0;
  for (let i = 0; i < chartId.length; i++) {
    hash = chartId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CHART_PALETTE.length;
  return CHART_PALETTE[index];
}

/** Format Y-axis values */
function fmtY(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}萬`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

function LineChartComponent({ data, color, variant = "default" }: { data: Point[]; color: string; variant?: "default" | "curved" | "step" | "dashed" }) {
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";
  const tooltipBg = "#ffffff";
  const tooltipFg = "#0f172a";

  const strokeDasharray = variant === "dashed" ? "5 5" : undefined;
  const strokeType = variant === "curved" ? "basis" : variant === "step" ? "step" : "monotone";

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisTick }} dy={10} interval="preserveStartEnd" angle={data.length > 15 ? -30 : 0} textAnchor={data.length > 15 ? "end" : "middle"} height={data.length > 15 ? 50 : 30} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: axisTick }} width={55} tickFormatter={fmtY} />
        <Tooltip
          contentStyle={{
            background: tooltipBg,
            border: `1px solid ${gridStroke}`,
            borderRadius: "8px",
            color: tooltipFg,
            fontSize: 12,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          cursor={{ stroke: axisTick, strokeWidth: 1 }}
        />
        <Line
          type={strokeType}
          dataKey="y"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={strokeDasharray}
          dot={variant === "dashed" ? { r: 3, fill: color } : false}
          activeDot={{ r: 4, strokeWidth: 0, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaChartComponent({ data, color, variant = "gradient" }: { data: Point[]; color: string; variant?: "gradient" | "solid" }) {
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";
  const tooltipBg = "#ffffff";
  const tooltipFg = "#0f172a";
  const gradientId = `areaGradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={variant === "gradient" ? 0.4 : 0.8} />
            <stop offset="95%" stopColor={color} stopOpacity={variant === "gradient" ? 0.05 : 0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisTick }} dy={10} interval="preserveStartEnd" angle={data.length > 15 ? -30 : 0} textAnchor={data.length > 15 ? "end" : "middle"} height={data.length > 15 ? 50 : 30} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: axisTick }} width={55} tickFormatter={fmtY} />
        <Tooltip
          contentStyle={{
            background: tooltipBg,
            border: `1px solid ${gridStroke}`,
            borderRadius: "8px",
            color: tooltipFg,
            fontSize: 12,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          cursor={{ stroke: axisTick, strokeWidth: 1 }}
        />
        <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BarChartComponent({ data, color, horizontal = false, variant = "default" }: { data: Point[]; color: string; horizontal?: boolean; variant?: "default" | "rounded" | "gradient" }) {
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";
  const tooltipBg = "#ffffff";
  const tooltipFg = "#0f172a";
  const gradientId = `barGradient-${Math.random().toString(36).substr(2, 9)}`;

  const displayData = horizontal ? data.slice(0, 15) : data.slice(0, 20);

  // Calculate left margin for horizontal bars based on longest label
  const maxLabelLen = horizontal ? Math.max(...displayData.map(d => d.x.length), 4) : 0;
  const leftWidth = horizontal ? Math.min(Math.max(maxLabelLen * 8, 80), 150) : 40;

  return (
    <ResponsiveContainer width="100%" height={horizontal ? Math.max(260, displayData.length * 28) : 260}>
      <BarChart
        data={displayData}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        layout={horizontal ? "vertical" : "horizontal"}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2={horizontal ? "1" : "0"} y2={horizontal ? "0" : "1"}>
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={!horizontal} vertical={horizontal} />
        <XAxis
          type={horizontal ? "number" : "category"}
          dataKey={horizontal ? undefined : "x"}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: axisTick }}
          dy={horizontal ? 0 : 10}
          {...(horizontal ? { tickFormatter: fmtY } : {})}
          {...(!horizontal && displayData.length > 10 ? { angle: -30, textAnchor: "end", height: 50 } : {})}
        />
        <YAxis
          type={horizontal ? "category" : "number"}
          dataKey={horizontal ? "x" : undefined}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: axisTick }}
          width={leftWidth}
          {...(!horizontal ? { tickFormatter: fmtY } : {})}
        />
        <Tooltip
          contentStyle={{
            background: tooltipBg,
            border: `1px solid ${gridStroke}`,
            borderRadius: "8px",
            color: tooltipFg,
            fontSize: 12,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          cursor={{ fill: "#94a3b8", opacity: 0.3 }}
        />
        <Bar
          dataKey="y"
          fill={variant === "gradient" ? `url(#${gradientId})` : color}
          radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function generateComplementaryColors(baseColor: string, count: number): string[] {
  // Convert hex to HSL
  const hex = baseColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // Generate variations
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hueOffset = (i * (360 / count)) / 360;
    const newH = (h + hueOffset) % 1;
    const newL = Math.max(0.3, Math.min(0.8, l + (i % 2 === 0 ? 0.1 : -0.1)));
    const newS = Math.max(0.4, s);

    // HSL to RGB
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
    const p = 2 * newL - q;
    const newR = Math.round(hue2rgb(p, q, newH + 1/3) * 255);
    const newG = Math.round(hue2rgb(p, q, newH) * 255);
    const newB = Math.round(hue2rgb(p, q, newH - 1/3) * 255);

    colors.push(`#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`);
  }

  return colors;
}

function PieChartComponent({ data, color, variant = "default" }: { data: Point[]; color: string; variant?: "default" | "donut" }) {
  const tooltipBg = "#ffffff";
  const tooltipFg = "#0f172a";

  const displayData = data.slice(0, 8);
  const colors = generateComplementaryColors(color, displayData.length);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Tooltip
          contentStyle={{
            background: tooltipBg,
            border: `1px solid #e2e8f0`,
            borderRadius: "8px",
            color: tooltipFg,
            fontSize: 12,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
        />
        <Pie
          data={displayData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ payload, percent }) => `${payload?.x ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          innerRadius={variant === "donut" ? 50 : 0}
          fill={color}
          dataKey="y"
        >
          {displayData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function ScorecardComponent({ data, chartType, color, unit }: { data: Point[]; chartType?: string; color: string; unit?: string }) {
  const value = data.length > 0 ? data[0].y : 0;
  const isPercent = chartType?.includes("gauge") || unit === "%" || unit === "％";
  const formatted = isPercent
    ? `${value.toFixed(1)}%`
    : value >= 10000
      ? `${(value / 10000).toFixed(1)} 萬`
      : Intl.NumberFormat().format(Math.round(value));

  return (
    <div className="flex h-[260px] items-center justify-center">
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight" style={{ color }}>{formatted}</div>
        <div className="mt-2 text-sm text-muted-foreground">{unit || "目前數值"}</div>
      </div>
    </div>
  );
}

function TableComponent({ data }: { data: Point[] }) {
  return (
    <div className="h-[260px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase">項目</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase">數值</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 20).map((row, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2">{row.x}</td>
              <td className="px-3 py-2 text-right font-mono">{row.y.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RadarChartComponent({ data, color }: { data: Point[]; color: string }) {
  const displayData = data.slice(0, 6);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={displayData}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="x" tick={{ fontSize: 12, fill: "#64748b" }} />
        <PolarRadiusAxis angle={30} domain={[0, "auto"]} tick={false} axisLine={false} />
        <Radar name="Value" dataKey="y" stroke={color} fill={color} fillOpacity={0.5} />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            fontSize: 12,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function RadialBarChartComponent({ data, color }: { data: Point[]; color: string }) {
  const value = data.length > 0 ? data[0].y : 0;
  const max = 100;
  const displayData = [{ name: "Value", value: Math.min(value, max), fill: color }];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={10} data={displayData} startAngle={180} endAngle={0}>
        <RadialBar background={{ fill: "#e2e8f0" }} dataKey="value" cornerRadius={10} />
        <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold" fill={color}>
          {value.toFixed(1)}%
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="text-xs" fill="#64748b">
          達成率
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

function ScatterChartComponent({ data, color }: { data: Point[]; color: string }) {
  const numData = data.map((d) => ({ x: Number(d.x) || 0, y: d.y }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" dataKey="x" name="X" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <YAxis type="number" dataKey="y" name="Y" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={55} tickFormatter={fmtY} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ borderRadius: "8px", fontSize: 12 }} />
        <Scatter name="Values" data={numData} fill={color} fillOpacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function BubbleChartComponent({ data, color }: { data: BubblePoint[]; color: string }) {
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";
  const tooltipBg = "#ffffff";
  const tooltipFg = "#0f172a";

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis
          type="number"
          dataKey="x"
          name="Recency"
          tick={{ fontSize: 12, fill: axisTick }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Frequency"
          tick={{ fontSize: 12, fill: axisTick }}
          tickLine={false}
          axisLine={false}
          width={55} tickFormatter={fmtY}
        />
        <ZAxis type="number" dataKey="z" range={[100, 1000]} name="Monetary" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{
            background: tooltipBg,
            border: `1px solid ${gridStroke}`,
            borderRadius: "8px",
            color: tooltipFg,
            fontSize: 12,
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
          formatter={(value: number | undefined, name: string | undefined) => {
            const labels: Record<string, string> = {
              Recency: "Recency (天)",
              Frequency: "Frequency (次)",
              Monetary: "Monetary (元)",
            };
            const displayName = name ?? "";
            return [(value ?? 0).toLocaleString(), labels[displayName] ?? displayName];
          }}
          labelFormatter={(_label, payload) => {
            const item = payload?.[0]?.payload as BubblePoint | undefined;
            return item?.name ? `客戶: ${item.name}` : "";
          }}
        />
        <Scatter name="RFM" data={data} fill={color} fillOpacity={0.7} stroke={color} strokeWidth={1} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function HeatmapComponent({ rawData, color }: { rawData: unknown[]; color: string }) {
  type HeatCell = { x: string; y: string; z: number };
  const cells = rawData.filter((v): v is HeatCell => {
    if (!v || typeof v !== "object") return false;
    const r = v as Record<string, unknown>;
    return typeof r.x === "string" && typeof r.y === "string" && typeof r.z === "number";
  });

  if (cells.length === 0) return <EmptyState />;

  const xLabels = [...new Set(cells.map(c => c.x))];
  const yLabels = [...new Set(cells.map(c => c.y))];
  const maxZ = Math.max(...cells.map(c => c.z));
  const minZ = Math.min(...cells.map(c => c.z));

  const getOpacity = (z: number) => {
    if (maxZ === minZ) return 0.5;
    return 0.15 + 0.85 * ((z - minZ) / (maxZ - minZ));
  };

  const cellMap = new Map(cells.map(c => [`${c.x}-${c.y}`, c.z]));

  return (
    <div className="h-[260px] overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-medium text-muted-foreground sticky left-0 bg-background" />
            {xLabels.map(x => (
              <th key={x} className="px-2 py-1 text-center font-medium text-muted-foreground">{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {yLabels.map(y => (
            <tr key={y}>
              <td className="px-2 py-1 font-medium text-muted-foreground whitespace-nowrap sticky left-0 bg-background">{y}</td>
              {xLabels.map(x => {
                const val = cellMap.get(`${x}-${y}`) ?? 0;
                return (
                  <td key={`${x}-${y}`} className="px-2 py-1 text-center" title={`${y} / ${x}: ${val}`}>
                    <div
                      className="mx-auto flex h-8 w-full items-center justify-center rounded text-[10px] font-medium text-white"
                      style={{ backgroundColor: color, opacity: getOpacity(val) }}
                    >
                      {val}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TreemapComponent({ data, color }: { data: Point[]; color: string }) {
  const treeData = data.slice(0, 10).map((d) => ({ name: d.x, size: d.y }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <Treemap
        data={treeData}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="#fff"
        fill={color}
        content={(props: any) => {
            const { depth, x, y, width, height, index, name } = props;
            return (
              <g>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  style={{
                    fill: index % 2 === 0 ? color : generateComplementaryColors(color, 2)[1],
                    stroke: "#fff",
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 1 / (depth + 1e-10),
                    opacity: 0.8,
                  }}
                />
                {width > 50 && height > 30 && (
                  <text x={x + width / 2} y={y + height / 2 + 7} textAnchor="middle" fill="#fff" fontSize={12}>
                    {name}
                  </text>
                )}
              </g>
            );
          }}
      />
    </ResponsiveContainer>
  );
}

function ChartRenderer({ chartType, data, rawData, chartId, unit }: { chartType: string; data: Point[]; rawData: unknown[]; chartId: string; unit: string }) {
  const normalizedType = chartType.toLowerCase();
  const color = getChartColor(chartId);

  // Derive variant from chartId hash
  let hash = 0;
  for (let i = 0; i < chartId.length; i++) {
    hash = chartId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const variantIndex = Math.abs(hash) % 3;

  let chart: React.ReactNode;

  if (normalizedType.includes("area") || normalizedType.includes("stream")) {
    const variant = variantIndex === 0 ? "gradient" : "solid";
    chart = <AreaChartComponent data={data} color={color} variant={variant} />;
  } else if (normalizedType.includes("line") || normalizedType.includes("time_series")) {
    const variant = variantIndex === 0 ? "curved" : variantIndex === 1 ? "step" : "default";
    chart = <LineChartComponent data={data} color={color} variant={variant} />;
  } else if (normalizedType.includes("stacked_bar")) {
    chart = <BarChartComponent data={data} color={color} horizontal={false} variant="default" />;
  } else if (normalizedType.includes("bar") || normalizedType.includes("column") || normalizedType.includes("pareto") || normalizedType.includes("histogram")) {
    const isHorizontal = normalizedType.includes("horizontal") || normalizedType.includes("topn");
    const variant = variantIndex === 0 ? "gradient" : variantIndex === 1 ? "rounded" : "default";
    chart = <BarChartComponent data={data} color={color} horizontal={isHorizontal} variant={variant} />;
  } else if (normalizedType.includes("pie") || normalizedType.includes("donut") || normalizedType.includes("doughnut")) {
    const variant = normalizedType.includes("donut") || variantIndex === 0 ? "donut" : "default";
    chart = <PieChartComponent data={data} color={color} variant={variant} />;
  } else if (normalizedType.includes("scorecard") || normalizedType.includes("kpi") || normalizedType.includes("gauge")) {
    if (normalizedType.includes("gauge")) {
      chart = <RadialBarChartComponent data={data} color={color} />;
    } else {
      chart = <ScorecardComponent data={data} chartType={chartType} color={color} unit={unit} />;
    }
  } else if (normalizedType.includes("radar")) {
    chart = <RadarChartComponent data={data} color={color} />;
  } else if (normalizedType.includes("scatter")) {
    chart = <ScatterChartComponent data={data} color={color} />;
  } else if (normalizedType.includes("bubble")) {
    const bubblePoints = toBubblePoints(rawData);
    chart = <BubbleChartComponent data={bubblePoints} color={color} />;
  } else if (normalizedType.includes("cohort") || normalizedType.includes("matrix")) {
    // Cohort and matrix types → heatmap
    chart = <HeatmapComponent rawData={rawData} color={color} />;
  } else if (normalizedType.includes("heatmap")) {
    chart = <HeatmapComponent rawData={rawData} color={color} />;
  } else if (normalizedType.includes("treemap")) {
    chart = <TreemapComponent data={data} color={color} />;
  } else if (normalizedType.includes("table") || normalizedType.includes("alert")) {
    chart = <TableComponent data={data} />;
  } else {
    chart = <LineChartComponent data={data} color={color} variant="default" />;
  }

  return (
    <div className="relative">
      {unit && (
        <span className="absolute -top-1 right-0 text-[10px] text-muted-foreground">
          單位：{unit}
        </span>
      )}
      {chart}
    </div>
  );
}

export function ChartGrid(props: {
  title: string;
  chartId: string;
  chartType: string;
  result: ResultV0<ChartDataV0>;
  loading?: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  status?: "ready" | "needs_new_view";
  dateRange?: { from: string; to: string };
}) {
  const { t } = useI18n();
  const points = props.result.ok ? toPoints(props.result.data.data) : [];
  const needsNewView = false;

  const titleKey = `chart.title.${props.chartId}` as TranslationKeyV0;
  const displayTitle = t(titleKey).startsWith("chart.title.") ? props.title : t(titleKey);

  return (
    <section className="relative flex flex-col rounded-xl border bg-background p-4 shadow-sm transition-all hover:shadow-md">
      {needsNewView && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-background/80 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-background p-4 shadow-sm">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <span className="text-sm font-medium text-muted-foreground">{t("chart.needsNewView")}</span>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{displayTitle}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t("chart.chartId")}: {props.chartId}</span>
            {props.dateRange && (
              <span className="rounded bg-muted px-1.5 py-0.5">
                {props.dateRange.from} ~ {props.dateRange.to}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onTogglePin}
            disabled={needsNewView}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
            aria-label={props.pinned ? t("chart.unpin") : t("chart.pin")}
          >
            {props.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
          <button
            type="button"
            disabled={needsNewView}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
            aria-label={t("chart.export")}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 min-h-[260px] flex-1">
        {props.loading ? (
          <LoadingState />
        ) : !props.result.ok ? (
          <ErrorState message={props.result.error.message} traceId={props.result.error.code} />
        ) : points.length === 0 && (!props.result.ok || props.result.data.data.length === 0) ? (
          <EmptyState />
        ) : (
          <ChartRenderer chartType={props.chartType} data={points} rawData={props.result.ok ? props.result.data.data : []} chartId={props.chartId} unit={getChartUnit(props.chartId)} />
        )}
      </div>
    </section>
  );
}
