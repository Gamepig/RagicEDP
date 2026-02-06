"use client";

import { AlertTriangle, Download, Pin, PinOff } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useI18n } from "@/lib/i18n/i18n";
import { EmptyState, ErrorState, LoadingState } from "@/components/states/common_states";

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
  status?: "active" | "needs_new_view";
}) {
  const { t } = useI18n();
  const points = props.result.ok ? toPoints(props.result.data.data) : [];
  const needsNewView = props.status === "needs_new_view";

  const gridStroke = "hsl(var(--border))";
  const axisTick = "hsl(var(--muted-foreground))";
  const lineStroke = "hsl(var(--foreground))";
  const tooltipBg = "hsl(var(--popover))";
  const tooltipFg = "hsl(var(--popover-foreground))";

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
          <h2 className="text-sm font-semibold tracking-tight">{props.title}</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("chart.chartId")}: {props.chartId}
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
        ) : points.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="x"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: axisTick }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: axisTick }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${gridStroke}`,
                  borderRadius: "var(--radius)",
                  color: tooltipFg,
                  fontSize: 12,
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                cursor={{ stroke: axisTick, strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="y"
                stroke={lineStroke}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
