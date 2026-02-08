"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { pinWidget, unpinWidget } from "@/actions/analytics";
import type { ChartDataV0, DashboardStatsV0 } from "@/lib/data/analytics.repo";
import type { ChartFiltersV0, PinnedWidgetV0, ResultV0 } from "@/lib/data/types";
import type { ChartSpecV0, ChartCategory } from "@/lib/analytics/chart_registry";

import { useI18n } from "@/lib/i18n/i18n";

import { KpiRow } from "./kpi_row";
import { ChartGrid } from "./chart_grid";

function DateRangePicker({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">日期範圍：</span>
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="rounded-md border px-2 py-1 text-sm"
      />
      <span className="text-muted-foreground">~</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="rounded-md border px-2 py-1 text-sm"
      />
    </div>
  );
}

export function AnalyticsOverview(props: {
  initialFilters: ChartFiltersV0;
  initialStats: ResultV0<DashboardStatsV0>;
  initialCharts: Record<string, ResultV0<ChartDataV0>>;
  initialPinned: ResultV0<PinnedWidgetV0[]>;
  availableCharts: ChartSpecV0[];
  categories: { id: ChartCategory; name: string }[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [stats] = useState(props.initialStats);
  const [charts] = useState(props.initialCharts);
  const [pinned, setPinned] = useState(props.initialPinned);
  const [activeCategory, setActiveCategory] = useState<ChartCategory>(props.categories[0]?.id || "executive");

  const dateRange = props.initialFilters.dateRange;

  const handleDateChange = useCallback((from: string, to: string) => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    router.push(`/analytics?${params.toString()}`);
  }, [router]);

  const pinnedChartIds = useMemo(() => {
    if (!pinned.ok) return new Set<string>();
    const ids = pinned.data
      .map((w) => (w.ref.kind === "catalog" ? w.ref.chartId : undefined))
      .filter((v): v is string => typeof v === "string");
    return new Set(ids);
  }, [pinned]);

  const filteredCharts = useMemo(() => {
    return props.availableCharts.filter((c) => c.category === activeCategory);
  }, [props.availableCharts, activeCategory]);

  async function onTogglePin(chartId: string) {
    const userId = "demo";
    if (pinnedChartIds.has(chartId)) {
      await unpinWidget({ userId, chartId });
      setPinned((prev) => {
        if (!prev.ok) return prev;
        return { ok: true, data: prev.data.filter((w) => !(w.ref.kind === "catalog" && w.ref.chartId === chartId)) };
      });
      return;
    }

    await pinWidget({ userId, chartId });
    const next: PinnedWidgetV0 = {
      widgetId: chartId,
      ref: { kind: "catalog", chartId },
      order: pinned.ok ? pinned.data.length : 0,
      pinnedAt: new Date().toISOString(),
    };
    setPinned((prev) => (prev.ok ? { ok: true, data: prev.data.concat(next) } : prev));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("analytics.title")}</h1>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={handleDateChange}
        />
      </div>

      {pinned.ok && pinned.data.length > 0 ? (
        <section className="rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">{t("analytics.pinned")}</h2>
            <span className="text-xs text-muted-foreground">
              {pinned.data.length} {t("analytics.widgets")}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pinned.data.map((w) => (
              <span
                key={w.widgetId}
                className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground"
              >
                {w.ref.kind === "catalog" ? w.ref.chartId : w.widgetId}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <KpiRow result={stats} />

      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {props.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`analytics.category.${cat.id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {filteredCharts.map((spec) => (
          <ChartGrid
            key={spec.chart_id}
            title={spec.name}
            chartId={spec.chart_id}
            chartType={spec.chart_type}
            result={charts[spec.chart_id]}
            pinned={pinnedChartIds.has(spec.chart_id)}
            onTogglePin={() => onTogglePin(spec.chart_id)}
            status={spec.status}
            dateRange={dateRange}
          />
        ))}
      </div>
    </div>
  );
}
