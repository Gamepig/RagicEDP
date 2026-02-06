"use client";

import type { ChartDataV0 } from "@/lib/data/analytics.repo";
import type { ResultV0 } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/i18n";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

type Point = { x: string; y: number };

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

export function ChartGrid(props: {
  title: string;
  chartId: string;
  result: ResultV0<ChartDataV0>;
  loading?: boolean;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { t } = useI18n();
  const points = props.result.ok ? toPoints(props.result.data.data) : [];

  const gridStroke = "hsl(var(--border))";
  const axisTick = "hsl(var(--muted-foreground))";
  const lineStroke = "hsl(var(--foreground))";
  const tooltipBg = "hsl(var(--foreground))";
  const tooltipFg = "hsl(var(--background))";

  return (
    <section className="rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{props.title}</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("chart.chartId")}: {props.chartId}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onTogglePin}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
          >
            {props.pinned ? t("chart.unpin") : t("chart.pin")}
          </button>
          <button type="button" className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50">
            {t("chart.export")}
          </button>
        </div>
      </div>

      <div className="mt-4">
        {props.loading ? (
          <div className="h-full rounded-lg border bg-muted/30" />
        ) : !props.result.ok ? (
          <div className="flex h-full items-center justify-center rounded-lg border">
            <div className="text-sm text-muted-foreground">{props.result.error.message || t("chart.error")}</div>
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border">
            <div className="text-sm text-muted-foreground">{t("chart.noData")}</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: axisTick }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: axisTick }} width={48} />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${gridStroke}`,
                  borderRadius: 10,
                  color: tooltipFg,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="y" stroke={lineStroke} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
