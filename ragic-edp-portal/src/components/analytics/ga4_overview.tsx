"use client";

import { useMemo, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pinWidget, unpinWidget, getMultipleChartData } from "@/actions/analytics";
import type { ChartDataV0 } from "@/lib/data/analytics.repo";
import type { ChartFiltersV0, PinnedWidgetV0, ResultV0 } from "@/lib/data/types";
import type { ChartSpecV0, ChartCategory, DashboardId } from "@/lib/analytics/chart_registry";
import { chartSupportsDateFilter, chartSupportsBrandFilter } from "@/lib/analytics/chart_registry";

import { useI18n } from "@/lib/i18n/i18n";

import { ChartGrid } from "./chart_grid";

function DateRangePicker({
  from,
  to,
  loading,
  onApply,
}: {
  from: string;
  to: string;
  loading: boolean;
  onApply: (from: string, to: string) => void;
}) {
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const changed = localFrom !== from || localTo !== to;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">日期範圍：</span>
      <input
        type="date"
        value={localFrom}
        disabled={loading}
        onChange={(e) => setLocalFrom(e.target.value)}
        className="rounded-md border px-2 py-1 text-sm disabled:opacity-50"
      />
      <span className="text-muted-foreground">~</span>
      <input
        type="date"
        value={localTo}
        disabled={loading}
        onChange={(e) => setLocalTo(e.target.value)}
        className="rounded-md border px-2 py-1 text-sm disabled:opacity-50"
      />
      <button
        type="button"
        disabled={!changed || loading}
        onClick={() => onApply(localFrom, localTo)}
        className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
          changed && !loading
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            載入中…
          </span>
        ) : (
          "套用"
        )}
      </button>
    </div>
  );
}

/** GA4 category labels */
const GA4_CATEGORY_LABELS: Record<string, string> = {
  ga4_traffic: "流量獲取",
  ga4_engagement: "互動轉換",
  ga4_conversion: "行為洞察",
  ga4_cross_trend: "趨勢異常（交叉）",
  ga4_cross_roi: "通路 ROI（交叉）",
  ga4_cross_campaign: "活動動能（交叉）",
};

/** Cross-analysis categories (GA4 × ERP) */
const CROSS_CATEGORIES = new Set<ChartCategory>([
  "ga4_cross_trend",
  "ga4_cross_roi",
  "ga4_cross_campaign",
]);

/** Dashboard mode */
type DashboardMode = "brand" | "all";

export function GA4Overview(props: {
  dashboardId: DashboardId;
  title: string;
  initialFilters: ChartFiltersV0;
  initialCharts: Record<string, ResultV0<ChartDataV0>>;
  initialPinned: ResultV0<PinnedWidgetV0[]>;
  availableCharts: ChartSpecV0[];
  categories: { id: ChartCategory; name: string }[];
  brands?: { brand_code: string; brand_name: string }[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [charts, setCharts] = useState(props.initialCharts);
  const [pinned, setPinned] = useState(props.initialPinned);
  const [isPending, startTransition] = useTransition();
  const [isDateLoading, setIsDateLoading] = useState(false);

  // Dashboard mode: "brand" = brand-filterable charts, "all" = non-filterable charts
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("brand");

  // Separate categories by mode
  const brandCategories = useMemo(
    () => props.categories.filter((c) => {
      // All categories have brand-filterable charts
      const chartsInCat = props.availableCharts.filter((ch) => ch.category === c.id);
      return chartsInCat.some((ch) => chartSupportsBrandFilter(ch.chart_id));
    }),
    [props.categories, props.availableCharts]
  );
  const allBrandCategories = useMemo(
    () => props.categories.filter((c) => {
      const chartsInCat = props.availableCharts.filter((ch) => ch.category === c.id);
      return chartsInCat.some((ch) => !chartSupportsBrandFilter(ch.chart_id));
    }),
    [props.categories, props.availableCharts]
  );

  const currentCategories = dashboardMode === "brand" ? brandCategories : allBrandCategories;

  const [activeCategory, setActiveCategory] = useState<ChartCategory>(
    brandCategories[0]?.id || "ga4_traffic"
  );
  const [loadedCategories, setLoadedCategories] = useState<Set<ChartCategory>>(
    () => new Set([brandCategories[0]?.id || "ga4_traffic"])
  );

  const dateRange = props.initialFilters.dateRange;
  const activeBrand = props.initialFilters.brand;

  const buildParams = useCallback((overrides: { from?: string; to?: string; brand?: string | null }) => {
    const params = new URLSearchParams();
    params.set("from", overrides.from ?? dateRange.from);
    params.set("to", overrides.to ?? dateRange.to);
    const br = overrides.brand === null ? undefined : (overrides.brand ?? activeBrand);
    if (br) params.set("brand", br);
    return params;
  }, [dateRange, activeBrand]);

  const handleDateApply = useCallback((from: string, to: string) => {
    setIsDateLoading(true);
    router.push(`/ga4?${buildParams({ from, to }).toString()}`);
  }, [router, buildParams]);

  const handleBrandChange = useCallback((brand: string | undefined) => {
    setIsDateLoading(true);
    router.push(`/ga4?${buildParams({ brand: brand ?? null }).toString()}`);
  }, [router, buildParams]);

  const pinnedChartIds = useMemo(() => {
    if (!pinned.ok) return new Set<string>();
    return new Set(
      pinned.data
        .map((w) => (w.ref.kind === "catalog" ? w.ref.chartId : undefined))
        .filter((v): v is string => typeof v === "string")
    );
  }, [pinned]);

  const filteredCharts = useMemo(() => {
    const catCharts = props.availableCharts.filter((c) => c.category === activeCategory);
    if (dashboardMode === "brand") {
      return catCharts.filter((c) => chartSupportsBrandFilter(c.chart_id));
    }
    return catCharts.filter((c) => !chartSupportsBrandFilter(c.chart_id));
  }, [props.availableCharts, activeCategory, dashboardMode]);

  async function onTogglePin(chartId: string) {
    if (pinnedChartIds.has(chartId)) {
      await unpinWidget({ chartId });
      setPinned((prev) => {
        if (!prev.ok) return prev;
        return { ok: true, data: prev.data.filter((w) => !(w.ref.kind === "catalog" && w.ref.chartId === chartId)) };
      });
      return;
    }
    await pinWidget({ chartId });
    const next: PinnedWidgetV0 = {
      widgetId: chartId,
      ref: { kind: "catalog", chartId },
      order: pinned.ok ? pinned.data.length : 0,
      pinnedAt: new Date().toISOString(),
    };
    setPinned((prev) => (prev.ok ? { ok: true, data: prev.data.concat(next) } : prev));
  }

  const handleModeChange = useCallback((mode: DashboardMode) => {
    setDashboardMode(mode);
    const cats = mode === "brand" ? brandCategories : allBrandCategories;
    const firstCat = cats[0];
    if (firstCat && !cats.some((c) => c.id === activeCategory)) {
      setActiveCategory(firstCat.id);
      // Load data for new category if not yet loaded
      if (!loadedCategories.has(firstCat.id)) {
        const chartIds = props.availableCharts
          .filter((c) => c.category === firstCat.id)
          .map((c) => c.chart_id);
        startTransition(async () => {
          const result = await getMultipleChartData({ chartIds, filters: props.initialFilters });
          setCharts((prev) => ({ ...prev, ...result }));
          setLoadedCategories((prev) => new Set(prev).add(firstCat.id));
        });
      }
    }
  }, [brandCategories, allBrandCategories, activeCategory, loadedCategories, props.availableCharts, props.initialFilters]);

  const handleCategoryChange = useCallback((catId: ChartCategory) => {
    setActiveCategory(catId);

    if (loadedCategories.has(catId)) return;

    const chartIds = props.availableCharts
      .filter((c) => c.category === catId)
      .map((c) => c.chart_id);

    startTransition(async () => {
      const result = await getMultipleChartData({
        chartIds,
        filters: props.initialFilters,
      });
      setCharts((prev) => ({ ...prev, ...result }));
      setLoadedCategories((prev) => new Set(prev).add(catId));
    });
  }, [loadedCategories, props.availableCharts, props.initialFilters]);

  /** Check if a chart is a cross-analysis chart (GA4 × ERP) */
  const isCrossAnalysis = (chartId: string): boolean => {
    const spec = props.availableCharts.find((c) => c.chart_id === chartId);
    return spec ? CROSS_CATEGORIES.has(spec.category as ChartCategory) : false;
  };

  return (
    <div className="space-y-6">
      {/* Header: title + brand selector + date picker */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{props.title}</h1>
        <div className="flex items-center gap-3">
          {dashboardMode === "brand" && props.brands && props.brands.length > 0 && (
            <select
              value={activeBrand ?? ""}
              disabled={isDateLoading}
              onChange={(e) => handleBrandChange(e.target.value || undefined)}
              className="rounded-md border px-2 py-1.5 text-sm bg-background disabled:opacity-50"
            >
              <option value="">{t("analytics.allBrands")}</option>
              {props.brands.map((b) => (
                <option key={b.brand_code} value={b.brand_code}>{b.brand_name}</option>
              ))}
            </select>
          )}
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            loading={isDateLoading}
            onApply={handleDateApply}
          />
        </div>
      </div>

      {/* Top-level dashboard mode tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange("brand")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            dashboardMode === "brand"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          品牌分析看板
          {activeBrand && dashboardMode === "brand" && (
            <span className="ml-1.5 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
              {props.brands?.find((b) => b.brand_code === activeBrand)?.brand_name ?? activeBrand}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            dashboardMode === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          全品牌總覽
        </button>
      </div>

      {/* Category tabs */}
      {currentCategories.length > 0 && (
        <div className="border-b">
          <div className="flex gap-1 overflow-x-auto">
            {currentCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {GA4_CATEGORY_LABELS[cat.id] ?? cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart grid */}
      {isPending || isDateLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">載入圖表中…</p>
          </div>
        </div>
      ) : filteredCharts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            {dashboardMode === "all"
              ? "此分類下無全品牌圖表"
              : "此分類下無可篩選品牌的圖表"}
          </p>
        </div>
      ) : (
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
              dateRange={chartSupportsDateFilter(spec.chart_id) ? dateRange : undefined}
              supportsDateFilter={chartSupportsDateFilter(spec.chart_id)}
              badges={[
                ...(isCrossAnalysis(spec.chart_id)
                  ? [{ label: "GA4×ERP 交叉分析", color: "purple" as const }]
                  : []),
                ...(dashboardMode === "all"
                  ? [{ label: "全品牌數據", color: "amber" as const }]
                  : []),
              ]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
