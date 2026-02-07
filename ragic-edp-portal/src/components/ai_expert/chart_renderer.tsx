"use client";

import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { AiChartDataV1 } from "@/lib/data/types";

const CHART_TYPES = ["bar", "line", "pie", "area", "scatter", "donut"] as const;

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
  const data = chart.data;

  function handleTypeChange(type: AiChartDataV1["chartType"]) {
    setActiveType(type);
    onTypeChange?.(chart.chartId, type);
  }

  function renderChart() {
    const commonProps = { data, margin: { top: 5, right: 20, bottom: 5, left: 0 } };

    switch (activeType) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
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
            <XAxis dataKey={chart.xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
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
            <Tooltip />
            <Legend />
            <Pie
              data={data}
              dataKey={chart.yKeys[0]}
              nameKey={chart.xKey}
              innerRadius={activeType === "donut" ? "40%" : 0}
              outerRadius="80%"
              label
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
            <XAxis dataKey={chart.xKey} className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip />
            <Legend />
            {chart.yKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} fill={COLORS[i % COLORS.length]} fillOpacity={0.3} stroke={COLORS[i % COLORS.length]} />
            ))}
          </AreaChart>
        );

      case "scatter":
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey={chart.xKey} className="text-xs" />
            <YAxis dataKey={chart.yKeys[0]} className="text-xs" />
            <Tooltip />
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
            {type}
          </button>
        ))}
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()!}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
