"use client";

import { AlertTriangle, ChevronDown, ChevronUp, Download, HelpCircle, Maximize2, Pin, PinOff, X } from "lucide-react";
import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { createPortal } from "react-dom";

const ChartHeightCtx = createContext(260);
import {
  CartesianGrid,
  ComposedChart,
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
  ReferenceLine,
  ReferenceArea,
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
import { getChartUnit, getChartDescription } from "@/lib/analytics/chart_registry";

type Point = { x: string; y: number };
type BubblePoint = { x: number; y: number; z: number; name?: string };

function sanitizeFilename(name: string): string {
  return (name || "chart")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeRows(raw: unknown[]): Record<string, unknown>[] {
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v == null) out[k] = "";
        else if (typeof v === "object") out[k] = JSON.stringify(v);
        else out[k] = v;
      }
      return out;
    });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escapeCsv = (value: unknown) => {
    const s = String(value ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, "\"\"")}"`;
    return s;
  };
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(",")),
  ];
  return "\uFEFF" + lines.join("\n");
}

async function exportRowsToExcel(rows: Record<string, unknown>[], filename: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}

function inlineComputedStyles(source: HTMLElement, target: HTMLElement) {
  const sourceElements = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const targetElements = [target, ...Array.from(target.querySelectorAll<HTMLElement>("*"))];
  sourceElements.forEach((srcEl, idx) => {
    const tgtEl = targetElements[idx];
    if (!tgtEl) return;
    const style = window.getComputedStyle(srcEl);
    let cssText = "";
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      cssText += `${prop}:${style.getPropertyValue(prop)};`;
    }
    tgtEl.setAttribute("style", cssText);
  });
}

async function exportChartToPng(target: HTMLElement, filename: string) {
  const width = Math.max(1, Math.round(target.clientWidth));
  const height = Math.max(1, Math.round(target.clientHeight));
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const renderFromDataUrl = async (dataUrl: string) => {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        resolve();
      };
      img.onerror = () => reject(new Error("image_load_failed"));
      img.src = dataUrl;
    });
  };

  const svg = target.querySelector("svg");
  if (svg) {
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", `${width}`);
    clone.setAttribute("height", `${height}`);
    const svgData = new XMLSerializer().serializeToString(clone);
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
    await renderFromDataUrl(svgUrl);
  } else {
    const clonedNode = target.cloneNode(true) as HTMLElement;
    inlineComputedStyles(target, clonedNode);
    const wrappedSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject x="0" y="0" width="100%" height="100%">
          ${new XMLSerializer().serializeToString(clonedNode)}
        </foreignObject>
      </svg>
    `;
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wrappedSvg)}`;
    await renderFromDataUrl(dataUrl);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  downloadBlob(blob, filename);
}

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

/** Format tooltip values with thousands separator */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtTooltip: any = (value: unknown) => {
  if (typeof value === "number") {
    return new Intl.NumberFormat("zh-TW").format(Math.round(value));
  }
  return value ?? "";
};

function formatImportantValue(value: unknown): string {
  if (typeof value === "number") {
    return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value);
  }
  if (value == null) return "-";
  return String(value);
}

function formatMetricValue(value: number, unit?: string): string {
  const base = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value);
  if (!unit || unit.trim() === "") return base;
  const normalized = unit.trim();
  if (normalized === "%" || normalized === "％") return `${base}%`;
  return `${base} ${normalized}`;
}

function buildChartSpecificInsights(chartId: string, rowsWithXY: Array<{ x: string; y: number }>, unit?: string): string[] {
  if (rowsWithXY.length === 0) return [];
  if (chartId === "NEW-01") {
    const sorted = [...rowsWithXY].sort((a, b) => b.y - a.y);
    const total = sorted.reduce((sum, row) => sum + row.y, 0);
    if (total <= 0) return [];
    let cumulative = 0;
    let count = 0;
    for (const row of sorted) {
      cumulative += row.y;
      count += 1;
      if (cumulative / total >= 0.8) break;
    }
    const ratio = (count / sorted.length) * 100;
    return [`Pareto 80/20 觀察：前 ${count} 項（${ratio.toFixed(1)}%）累積貢獻 80%。`];
  }
  if (chartId === "GA4-07" || chartId === "GA4-11") {
    const first = rowsWithXY[0];
    const last = rowsWithXY[rowsWithXY.length - 1];
    if (!first || !last || first.y === 0) return [];
    const dropRate = ((first.y - last.y) / first.y) * 100;
    return [`漏斗落差：首末階段差距 ${dropRate.toFixed(1)}%（${first.x} → ${last.x}）。`];
  }
  if (chartId === "GA4-22" || chartId === "GA4-23" || chartId === "GA4-24") {
    const avg = rowsWithXY.reduce((sum, row) => sum + row.y, 0) / rowsWithXY.length;
    return [`ROI 平均：${formatMetricValue(avg, unit)}，建議對低於平均區段優先調整預算。`];
  }
  return [];
}

function buildImportantSummary(chartId: string, chartType: string, rawData: unknown[], unit?: string): string[] {
  const normalizedType = chartType.toLowerCase();
  const rows = rawData.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
  if (rows.length === 0) return [];

  const rowsWithXY = rows.filter((row) => typeof row.x === "string" && typeof row.y === "number") as Array<{ x: string; y: number; series?: unknown }>;
  if (rowsWithXY.length > 0) {
    const values = rowsWithXY.map((row) => row.y);
    const total = values.reduce((sum, v) => sum + v, 0);
    const maxRow = rowsWithXY.reduce((acc, cur) => (cur.y > acc.y ? cur : acc), rowsWithXY[0]);
    const minRow = rowsWithXY.reduce((acc, cur) => (cur.y < acc.y ? cur : acc), rowsWithXY[0]);

    if (normalizedType.includes("pareto")) {
      const top3 = [...rowsWithXY].sort((a, b) => b.y - a.y).slice(0, 3);
      const top3Sum = top3.reduce((sum, row) => sum + row.y, 0);
      const top3Ratio = total > 0 ? (top3Sum / total) * 100 : 0;
      return [...buildChartSpecificInsights(chartId, rowsWithXY, unit),
        `Top 1：${formatImportantValue(top3[0]?.x)}（${formatMetricValue(top3[0]?.y ?? 0, unit)}）`,
        `Top 3 累積占比：${top3Ratio.toFixed(1)}%`,
        `總量：${formatMetricValue(total, unit)}`,
      ];
    }

    if (normalizedType.includes("line") || normalizedType.includes("time_series") || normalizedType.includes("area")) {
      return [...buildChartSpecificInsights(chartId, rowsWithXY, unit),
        `最新值：${formatMetricValue(rowsWithXY[rowsWithXY.length - 1]?.y ?? 0, unit)}（${formatImportantValue(rowsWithXY[rowsWithXY.length - 1]?.x)}）`,
        `最高點：${formatImportantValue(maxRow.x)}（${formatMetricValue(maxRow.y, unit)}）`,
        `最低點：${formatImportantValue(minRow.x)}（${formatMetricValue(minRow.y, unit)}）`,
      ];
    }

    if (normalizedType.includes("bar") || normalizedType.includes("histogram") || normalizedType.includes("scatter") || normalizedType.includes("bubble")) {
      return [...buildChartSpecificInsights(chartId, rowsWithXY, unit),
        `最大值：${formatImportantValue(maxRow.x)}（${formatMetricValue(maxRow.y, unit)}）`,
        `最小值：${formatImportantValue(minRow.x)}（${formatMetricValue(minRow.y, unit)}）`,
        `合計：${formatMetricValue(total, unit)}`,
      ];
    }
  }

  if (normalizedType.includes("table") || normalizedType.includes("alert")) {
    return [`資料筆數：${formatImportantValue(rows.length)}`, "此圖表以明細資料為主，請展開下方列表檢視關鍵欄位。"];
  }

  return [`資料筆數：${formatImportantValue(rows.length)}`];
}

function buildImportantDataRows(chartType: string, rawData: unknown[], unit?: string): Array<{ label: string; value: string; meta?: string }> {
  const normalizedType = chartType.toLowerCase();
  const objectRows = rawData.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
  if (objectRows.length === 0) return [];

  const rowsWithXY = objectRows.filter((row) => "x" in row && "y" in row);
  if (rowsWithXY.length > 0) {
    const ordered = normalizedType.includes("pareto")
      ? [...rowsWithXY].sort((a, b) => Number(b.y) - Number(a.y))
      : rowsWithXY;
    return ordered.slice(0, 8).map((row) => ({
      label: formatImportantValue(row.x),
      value: typeof row.y === "number" ? formatMetricValue(row.y, unit) : formatImportantValue(row.y),
      meta: typeof row.series === "string" ? row.series : undefined,
    }));
  }

  const first = objectRows[0];
  const entries = Object.entries(first);
  const labelKey = entries.find(([, v]) => typeof v === "string")?.[0] ?? entries[0]?.[0];
  const valueKey = entries.find(([k, v]) => k !== labelKey && typeof v === "number")?.[0] ?? entries.find(([k]) => k !== labelKey)?.[0];

  if (!labelKey || !valueKey) return [];

  return objectRows.slice(0, 8).map((row) => ({
    label: formatImportantValue(row[labelKey]),
    value: typeof row[valueKey] === "number" ? formatMetricValue(Number(row[valueKey]), unit) : formatImportantValue(row[valueKey]),
  }));
}

/** Charts that need multi-series line rendering (rawData has a `series` column) */
const MULTI_SERIES_LINE_CHARTS = new Set(["NEW-10", "NEW-18", "NEW-32", "38"]);

function MultiSeriesLineComponent({ rawData }: { rawData: unknown[] }) {
  const ch = useContext(ChartHeightCtx);
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";

  // Pivot rawData: [{x, series, y}] → [{x, seriesA: y, seriesB: y, ...}]
  const seriesSet = new Set<string>();
  const grouped = new Map<string, Record<string, number>>();
  for (const row of rawData) {
    const r = row as Record<string, unknown>;
    const x = String(r.x ?? "");
    const s = String(r.series ?? "");
    const y = Number(r.y) || 0;
    if (!x || !s) continue;
    seriesSet.add(s);
    if (!grouped.has(x)) grouped.set(x, {});
    grouped.get(x)![s] = y;
  }
  const seriesNames = Array.from(seriesSet);
  const pivoted = Array.from(grouped.entries()).map(([x, vals]) => ({ x, ...vals }));

  return (
    <ResponsiveContainer width="100%" height={ch}>
      <LineChart data={pivoted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisTick }} dy={10} interval="preserveStartEnd" angle={pivoted.length > 15 ? -30 : 0} textAnchor={pivoted.length > 15 ? "end" : "middle"} height={pivoted.length > 15 ? 50 : 30} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: axisTick }} width={55} tickFormatter={fmtY} />
        <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${gridStroke}`, borderRadius: "8px", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} formatter={fmtTooltip} />
        {seriesNames.map((name, i) => (
          <Line key={name} type="monotone" dataKey={name} stroke={CHART_PALETTE[i % CHART_PALETTE.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name={name} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function LineChartComponent({ data, color, variant = "default" }: { data: Point[]; color: string; variant?: "default" | "curved" | "step" | "dashed" }) {
  const ch = useContext(ChartHeightCtx);
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";
  const tooltipBg = "#ffffff";
  const tooltipFg = "#0f172a";

  const strokeDasharray = variant === "dashed" ? "5 5" : undefined;
  const strokeType = variant === "curved" ? "basis" : variant === "step" ? "step" : "monotone";

  return (
    <ResponsiveContainer width="100%" height={ch}>
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
          formatter={fmtTooltip}
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
  const ch = useContext(ChartHeightCtx);
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";
  const tooltipBg = "#ffffff";
  const tooltipFg = "#0f172a";
  const gradientId = `areaGradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <ResponsiveContainer width="100%" height={ch}>
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
          formatter={fmtTooltip}
        />
        <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BarChartComponent({ data, color, horizontal = false, variant = "default" }: { data: Point[]; color: string; horizontal?: boolean; variant?: "default" | "rounded" | "gradient" }) {
  const ch = useContext(ChartHeightCtx);
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
    <ResponsiveContainer width="100%" height={horizontal ? Math.max(ch, displayData.length * 28) : ch}>
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
          formatter={fmtTooltip}
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
  const ch = useContext(ChartHeightCtx);
  const tooltipBg = "#ffffff";
  const tooltipFg = "#0f172a";

  const displayData = data.slice(0, 8);
  const colors = generateComplementaryColors(color, displayData.length);

  return (
    <ResponsiveContainer width="100%" height={ch}>
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
          formatter={fmtTooltip}
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
  const ch = useContext(ChartHeightCtx);
  const value = data.length > 0 ? data[0].y : 0;
  const isPercent = chartType?.includes("gauge") || unit === "%" || unit === "％";
  const formatted = isPercent
    ? `${value.toFixed(1)}%`
    : value >= 10000
      ? `${(value / 10000).toFixed(1)} 萬`
      : Intl.NumberFormat().format(Math.round(value));

  return (
    <div className="flex items-center justify-center" style={{ height: ch }}>
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight" style={{ color }}>{formatted}</div>
        <div className="mt-2 text-sm text-muted-foreground">{unit || "目前數值"}</div>
      </div>
    </div>
  );
}

function TableComponent({ data }: { data: Point[] }) {
  const ch = useContext(ChartHeightCtx);
  return (
    <div className="overflow-auto" style={{ height: ch }}>
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
  const ch = useContext(ChartHeightCtx);
  const displayData = data.slice(0, 6);
  return (
    <ResponsiveContainer width="100%" height={ch}>
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
          formatter={fmtTooltip}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function RadialBarChartComponent({ data, color }: { data: Point[]; color: string }) {
  const ch = useContext(ChartHeightCtx);
  const value = data.length > 0 ? data[0].y : 0;
  const max = 100;
  const displayData = [{ name: "Value", value: Math.min(value, max), fill: color }];

  return (
    <ResponsiveContainer width="100%" height={ch}>
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
  const ch = useContext(ChartHeightCtx);
  const numData = data.map((d) => ({ x: Number(d.x) || 0, y: d.y }));
  return (
    <ResponsiveContainer width="100%" height={ch}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" dataKey="x" name="X" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <YAxis type="number" dataKey="y" name="Y" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={55} tickFormatter={fmtY} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ borderRadius: "8px", fontSize: 12 }} formatter={fmtTooltip} />
        <Scatter name="Values" data={numData} fill={color} fillOpacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function BubbleChartComponent({ data, color }: { data: BubblePoint[]; color: string }) {
  const ch = useContext(ChartHeightCtx);
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";
  const tooltipBg = "#ffffff";
  const tooltipFg = "#0f172a";

  return (
    <ResponsiveContainer width="100%" height={ch}>
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
  const ch = useContext(ChartHeightCtx);
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
    <div className="overflow-auto" style={{ height: ch }}>
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
  const ch = useContext(ChartHeightCtx);
  const treeData = data.slice(0, 10).map((d) => ({ name: d.x, size: d.y }));

  return (
    <ResponsiveContainer width="100%" height={ch}>
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

type DualAxisPoint = { x: string; y1: number; y2: number };

function toDualAxisPoints(data: unknown[]): DualAxisPoint[] {
  return data
    .map((v) => {
      if (!v || typeof v !== "object") return undefined;
      const r = v as Record<string, unknown>;
      const x = typeof r.x === "string" ? r.x : undefined;
      const y1 = typeof r.y1 === "number" ? r.y1 : typeof r.y === "number" ? r.y : undefined;
      const y2 = typeof r.y2 === "number" ? r.y2 : undefined;
      if (!x || y1 === undefined || y2 === undefined) return undefined;
      return { x, y1, y2 };
    })
    .filter((v): v is DualAxisPoint => Boolean(v));
}

function DualAxisLineComponent({ rawData }: { rawData: unknown[] }) {
  const ch = useContext(ChartHeightCtx);
  const data = toDualAxisPoints(rawData);
  if (data.length === 0) return <EmptyState />;
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";
  return (
    <ResponsiveContainer width="100%" height={ch}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisTick }} dy={10} interval="preserveStartEnd" angle={data.length > 15 ? -30 : 0} textAnchor={data.length > 15 ? "end" : "middle"} height={data.length > 15 ? 50 : 30} />
        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6366f1" }} width={55} tickFormatter={fmtY} />
        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#10b981" }} width={55} tickFormatter={fmtY} />
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} formatter={fmtTooltip} />
        <Line yAxisId="left" type="monotone" dataKey="y1" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Sessions" />
        <Line yAxisId="right" type="monotone" dataKey="y2" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Revenue" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function toAnnotationData(rawData: unknown[]): { points: Point[]; annotations: Array<{ start: string; end: string; label: string }> } {
  const points: Point[] = [];
  let annotations: Array<{ start: string; end: string; label: string }> = [];
  for (const v of rawData) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    if (typeof r.x === "string" && typeof r.y === "number") {
      points.push({ x: r.x, y: r.y });
    }
    if (Array.isArray(r.annotations)) {
      annotations = r.annotations as Array<{ start: string; end: string; label: string }>;
    }
  }
  return { points, annotations };
}

function LineAnnotationComponent({ rawData, color }: { rawData: unknown[]; color: string }) {
  const ch = useContext(ChartHeightCtx);
  const { points, annotations } = toAnnotationData(rawData);
  if (points.length === 0) return <EmptyState />;
  const gridStroke = "#e2e8f0";
  const axisTick = "#64748b";
  return (
    <ResponsiveContainer width="100%" height={ch}>
      <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisTick }} dy={10} interval="preserveStartEnd" />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: axisTick }} width={55} tickFormatter={fmtY} />
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} formatter={fmtTooltip} />
        {annotations.map((a, i) => (
          <ReferenceArea key={i} x1={a.start} x2={a.end} fill="#f59e0b" fillOpacity={0.08} label={{ value: a.label, position: "insideTop", fill: "#f59e0b", fontSize: 10 }} />
        ))}
        {annotations.map((a, i) => (
          <ReferenceLine key={`s-${i}`} x={a.start} stroke="#f59e0b" strokeDasharray="5 5" />
        ))}
        <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

type KpiTile = { label: string; value: number; deltaPct?: number; sparkline?: number[] };

function KpiTilesSparklineComponent({ rawData }: { rawData: unknown[] }) {
  const tiles: KpiTile[] = rawData
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((r) => ({
      label: String(r.label ?? r.x ?? ""),
      value: typeof r.value === "number" ? r.value : typeof r.y === "number" ? r.y : 0,
      deltaPct: typeof r.deltaPct === "number" ? r.deltaPct : undefined,
      sparkline: Array.isArray(r.sparkline) ? (r.sparkline as number[]) : undefined,
    }));

  if (tiles.length === 0) return <EmptyState />;

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile, i) => {
        const delta = tile.deltaPct;
        const tone = delta == null ? "" : delta >= 0 ? "text-emerald-600" : "text-red-500";
        const sign = delta == null ? "" : delta >= 0 ? "↑" : "↓";
        const sparkData = tile.sparkline?.map((v, j) => ({ x: j, y: v })) ?? [];
        return (
          <div key={i} className="rounded-lg border bg-background p-3">
            <div className="text-[13px] text-muted-foreground">{tile.label}</div>
            <div className="mt-1 text-[28px] font-bold leading-tight">{tile.value >= 10000 ? `${(tile.value / 10000).toFixed(1)}萬` : tile.value.toLocaleString()}</div>
            {delta != null && (
              <div className={`mt-0.5 text-xs font-medium ${tone}`}>
                {sign}{Math.abs(Math.round(delta * 100))}% MoM
              </div>
            )}
            {sparkData.length > 1 && (
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={sparkData}>
                  <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScatterAlertComponent({ rawData, color }: { rawData: unknown[]; color: string }) {
  const ch = useContext(ChartHeightCtx);
  type AlertPoint = { x: number; y: number; alert?: boolean; label?: string };
  const points: AlertPoint[] = rawData
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((r) => ({
      x: typeof r.x === "number" ? r.x : Number(r.x) || 0,
      y: typeof r.y === "number" ? r.y : 0,
      alert: r.alert === true,
      label: typeof r.label === "string" ? r.label : undefined,
    }));

  if (points.length === 0) return <EmptyState />;

  const normal = points.filter((p) => !p.alert);
  const alerts = points.filter((p) => p.alert);

  return (
    <ResponsiveContainer width="100%" height={ch}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" dataKey="x" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
        <YAxis type="number" dataKey="y" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} width={55} tickFormatter={fmtY} />
        <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="3 3" />
        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
        <Tooltip contentStyle={{ borderRadius: "8px", fontSize: 12 }} formatter={fmtTooltip} />
        <Scatter name="Normal" data={normal} fill={color} fillOpacity={0.7} />
        {alerts.length > 0 && (
          <Scatter name="Alert" data={alerts} fill="#ef4444" fillOpacity={0.9}>
            {alerts.map((_, i) => (
              <Cell key={i} fill="#ef4444" />
            ))}
          </Scatter>
        )}
      </ScatterChart>
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

  if (MULTI_SERIES_LINE_CHARTS.has(chartId)) {
    chart = <MultiSeriesLineComponent rawData={rawData} />;
  } else if (normalizedType === "dual_axis_line") {
    chart = <DualAxisLineComponent rawData={rawData} />;
  } else if (normalizedType === "line_annotation") {
    chart = <LineAnnotationComponent rawData={rawData} color={color} />;
  } else if (normalizedType === "kpi_tiles_sparkline") {
    chart = <KpiTilesSparklineComponent rawData={rawData} />;
  } else if (normalizedType === "scatter_alert") {
    chart = <ScatterAlertComponent rawData={rawData} color={color} />;
  } else if (normalizedType.includes("area") || normalizedType.includes("stream")) {
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

/** Chart IDs that aggregate by month — will show only 1 data point when the
 *  selected date range falls within a single calendar month. */
const MONTHLY_AGG_CHARTS = new Set([
  "38", "21", "NEW-03", "NEW-10", "NEW-18", "NEW-20", "52", "28", "NEW-22", "NEW-32",
]);

export function ChartGrid(props: {
  title: string;
  chartId: string;
  chartType: string;
  result: ResultV0<ChartDataV0>;
  loading?: boolean;
  pinned?: boolean;
  onTogglePin?: () => void;
  status?: "ready" | "needs_new_view";
  dateRange?: { from: string; to: string };
  supportsDateFilter?: boolean;
  supportsBrandFilter?: boolean;
  badges?: { label: string; color: "purple" | "amber" | "blue" | "green" }[];
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [showImportantData, setShowImportantData] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const chartBodyRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const points = props.result?.ok ? toPoints(props.result.data.data) : [];
  const needsNewView = false;

  const closeExpanded = useCallback(() => setExpanded(false), []);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeExpanded(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, closeExpanded]);

  useEffect(() => {
    if (!exportOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportOpen(false);
    };
    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onEsc);
    };
  }, [exportOpen]);

  const titleKey = `chart.title.${props.chartId}` as TranslationKeyV0;
  const displayTitle = t(titleKey).startsWith("chart.title.") ? props.title : t(titleKey);
  const chartUnit = getChartUnit(props.chartId);
  const rawRows = props.result?.ok ? normalizeRows(props.result.data.data) : [];
  const importantDataRows = props.result?.ok ? buildImportantDataRows(props.chartType, props.result.data.data, chartUnit) : [];
  const importantSummary = props.result?.ok ? buildImportantSummary(props.chartId, props.chartType, props.result.data.data, chartUnit) : [];
  const baseFilename = sanitizeFilename(`${props.chartId}_${displayTitle}`);

  const handleExportCsv = useCallback(() => {
    const csv = toCsv(rawRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `${baseFilename}.csv`);
    setExportOpen(false);
  }, [rawRows, baseFilename]);

  const handleExportExcel = useCallback(async () => {
    setExporting(true);
    try {
      await exportRowsToExcel(rawRows, `${baseFilename}.xlsx`);
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  }, [rawRows, baseFilename]);

  const handleExportPng = useCallback(async () => {
    if (!chartBodyRef.current) return;
    setExporting(true);
    try {
      await exportChartToPng(chartBodyRef.current, `${baseFilename}.png`);
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  }, [baseFilename]);

  const rawLen = props.result?.ok ? props.result.data.data.length : 0;
  const isSingleMonth = MONTHLY_AGG_CHARTS.has(props.chartId) && rawLen <= 1 && rawLen > 0;

  return (
    <section
      className="relative flex flex-col rounded-xl border bg-background p-4 shadow-sm transition-all hover:shadow-md"
      data-testid={`chart-card-${props.chartId}`}
      data-chart-id={props.chartId}
      data-chart-type={props.chartType}
    >
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
            {props.supportsDateFilter === false ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                全時段快照
              </span>
            ) : props.dateRange ? (
              <span className="rounded bg-muted px-1.5 py-0.5">
                {props.dateRange.from} ~ {props.dateRange.to}
              </span>
            ) : null}
            {props.supportsBrandFilter === false && (
              <span className="rounded bg-purple-100 px-1.5 py-0.5 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                不適用品牌篩選
              </span>
            )}
            {isSingleMonth && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                僅單月數據
              </span>
            )}
            {props.badges?.map((badge) => {
              const colorMap = {
                purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              };
              return (
                <span key={badge.label} className={`rounded px-1.5 py-0.5 ${colorMap[badge.color]}`}>
                  {badge.label}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="group relative">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label="圖表說明"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            {getChartDescription(props.chartId) && (
              <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden w-72 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md group-hover:block">
                {getChartDescription(props.chartId)!.split("\n").map((line, i) => (
                  <p key={i} className={i > 0 ? "mt-1.5" : ""}>{line}</p>
                ))}
              </div>
            )}
          </div>
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
            onClick={() => setExpanded(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
            aria-label="放大圖表"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              disabled={needsNewView || exporting || !props.result?.ok}
              onClick={() => setExportOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
              aria-label={t("chart.export")}
              data-testid={`chart-export-trigger-${props.chartId}`}
            >
              <Download className="h-4 w-4" />
            </button>
            {exportOpen && (
              <div
                className="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-md border bg-popover p-1 shadow-md"
                data-testid={`chart-export-menu-${props.chartId}`}
              >
                <button
                  type="button"
                  onClick={handleExportPng}
                  disabled={exporting}
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50"
                  data-testid={`chart-export-png-${props.chartId}`}
                >
                  {t("chart.exportPng")}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exporting}
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50"
                  data-testid={`chart-export-csv-${props.chartId}`}
                >
                  {t("chart.exportCsv")}
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50"
                  data-testid={`chart-export-excel-${props.chartId}`}
                >
                  {t("chart.exportExcel")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-[260px] flex-1" ref={chartBodyRef}>
        {props.loading || !props.result ? (
          <LoadingState />
        ) : !props.result.ok ? (
          <ErrorState message={props.result.error.message} traceId={props.result.error.code} />
        ) : points.length === 0 && props.result.data.data.length === 0 ? (
          <EmptyState />
        ) : (
          <ChartRenderer chartType={props.chartType} data={points} rawData={props.result.ok ? props.result.data.data : []} chartId={props.chartId} unit={chartUnit} />
        )}
      </div>

      {props.result?.ok ? (
        <div className="mt-3 border-t pt-3">
          <button
            type="button"
            onClick={() => setShowImportantData((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              showImportantData
                ? "bg-primary/10 text-primary"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-expanded={showImportantData}
            data-testid={`chart-important-toggle-${props.chartId}`}
          >
            {showImportantData ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            圖表重要數據
          </button>

          {showImportantData ? (
            importantDataRows.length > 0 || importantSummary.length > 0 ? (
              <div className="mt-2 space-y-2" data-testid={`chart-important-panel-${props.chartId}`}>
                {importantSummary.length > 0 ? (
                  <ul className="grid gap-1 text-xs text-muted-foreground">
                    {importantSummary.map((item, index) => (
                      <li key={`${props.chartId}-summary-${index}`} className="rounded-md border bg-muted/20 px-2.5 py-1.5">{item}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="overflow-x-auto rounded-md border bg-muted/20">
                  <table className="w-full min-w-[420px] border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">項目</th>
                        <th className="px-3 py-2 font-medium">數值</th>
                        <th className="px-3 py-2 font-medium">備註</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importantDataRows.map((row, index) => (
                        <tr key={`${props.chartId}-important-${index}`} className="border-b last:border-0">
                          <td className="px-3 py-2">{row.label}</td>
                          <td className="px-3 py-2 font-medium">{row.value}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.meta ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">目前資料型態無可摘要的重要數據列。</p>
            )
          ) : null}
        </div>
      ) : null}

      {expanded && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeExpanded}
          data-testid={`chart-modal-${props.chartId}`}
        >
          <div className="relative mx-4 flex w-full max-w-6xl flex-col rounded-2xl border bg-background p-8 shadow-2xl" style={{ height: "72vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{displayTitle}</h2>
                {getChartDescription(props.chartId) && (
                  <p className="mt-1 text-sm text-muted-foreground">{getChartDescription(props.chartId)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={closeExpanded}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                data-testid={`chart-modal-close-${props.chartId}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex-1">
              <ChartHeightCtx.Provider value={Math.round(window.innerHeight * 0.72 - 160)}>
                {props.result?.ok && (
                  <ChartRenderer chartType={props.chartType} data={points} rawData={props.result.data.data} chartId={props.chartId} unit={chartUnit} />
                )}
              </ChartHeightCtx.Provider>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
