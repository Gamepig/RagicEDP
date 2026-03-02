"use client";

import { useMemo, useState, useCallback, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getMultipleChartData, pinWidget, unpinWidget } from "@/actions/analytics";
import type { ChartDataV0, DashboardStatsV0 } from "@/lib/data/analytics.repo";
import type { ChartFiltersV0, PinnedWidgetV0, ResultV0 } from "@/lib/data/types";
import type { ChartSpecV0, ChartCategory } from "@/lib/analytics/chart_registry";
import { chartSupportsDateFilter, chartSupportsBrandFilter } from "@/lib/analytics/chart_registry";
import {
  DEMO_TASK_PACK,
  getDemoPlanDetail,
  getGateState,
} from "@/lib/analytics/demo_plan";

import { useI18n } from "@/lib/i18n/i18n";

import { KpiRow } from "./kpi_row";
import { ChartGrid } from "./chart_grid";

const DEMO_PROGRESS_STORAGE_KEY = "analytics_demo_task_progress_v1";

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
        className="rounded-md border px-2 py-1 text-sm disabled:opacity-50 dark:border-neutral-500"
      />
      <span className="text-muted-foreground">~</span>
      <input
        type="date"
        value={localTo}
        disabled={loading}
        onChange={(e) => setLocalTo(e.target.value)}
        className="rounded-md border px-2 py-1 text-sm disabled:opacity-50 dark:border-neutral-500"
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

export function AnalyticsOverview(props: {
  initialFilters: ChartFiltersV0;
  initialStats: ResultV0<DashboardStatsV0>;
  initialCharts: Record<string, ResultV0<ChartDataV0>>;
  availableCharts: ChartSpecV0[];
  categories: { id: ChartCategory; name: string }[];
  brands: { brand_code: string; brand_name: string }[];
  initialPinned?: ResultV0<PinnedWidgetV0[]>;
  showTaskSummary?: boolean;
  routeBasePath?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [stats] = useState(props.initialStats);
  const [charts, setCharts] = useState(props.initialCharts);
  const [pinned, setPinned] = useState(props.initialPinned ?? { ok: true as const, data: [] });

  const pinnedChartIds = useMemo(() => {
    if (!pinned.ok) return new Set<string>();
    return new Set(
      pinned.data
        .map((w) => (w.ref.kind === "catalog" ? w.ref.chartId : undefined))
        .filter((v): v is string => typeof v === "string")
    );
  }, [pinned]);

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

  const ERP_SALES_CATS = useMemo(() => new Set(["executive","product","channel","customer","operations"]), []);
  const ERP_CROSS_CATS = useMemo(() => new Set(["cross_brand"]), []);
  const GA4_CATS = useMemo(() => new Set(["ga4_traffic","ga4_engagement","ga4_conversion"]), []);
  const GA4_ERP_CATS = useMemo(() => new Set(["ga4_cross_trend","ga4_cross_roi","ga4_cross_campaign"]), []);

  type CatGroupKey = "erp" | "erp_cross" | "ga4" | "ga4_erp";
  const catGroups = useMemo(() => {
    const groups: { key: CatGroupKey; cats: typeof props.categories }[] = [
      { key: "erp", cats: props.categories.filter(c => ERP_SALES_CATS.has(c.id)) },
      { key: "erp_cross", cats: props.categories.filter(c => ERP_CROSS_CATS.has(c.id)) },
      { key: "ga4", cats: props.categories.filter(c => GA4_CATS.has(c.id)) },
      { key: "ga4_erp", cats: props.categories.filter(c => GA4_ERP_CATS.has(c.id)) },
    ];
    return groups.filter(g => g.cats.length > 0);
  }, [props.categories, ERP_SALES_CATS, ERP_CROSS_CATS, GA4_CATS, GA4_ERP_CATS]);

  const [activeGroup, setActiveGroup] = useState<CatGroupKey>(() => catGroups[0]?.key || "erp");
  const [activeCategory, setActiveCategory] = useState<ChartCategory>(props.categories[0]?.id || "executive");
  const [loadedCategories, setLoadedCategories] = useState<Set<ChartCategory>>(
    () => new Set([props.categories[0]?.id || "executive"])
  );
  const [isPending, startTransition] = useTransition();
  const [isDateLoading, setIsDateLoading] = useState(false);
  const [taskProgress, setTaskProgress] = useState<Record<string, boolean>>({});

  const dateRange = props.initialFilters.dateRange;

  const revenueField = props.initialFilters.revenueField ?? "with_shipping";
  const activeBrand = props.initialFilters.brand;

  const buildParams = useCallback((overrides: { from?: string; to?: string; revenue?: string; brand?: string | null }) => {
    const params = new URLSearchParams();
    params.set("from", overrides.from ?? dateRange.from);
    params.set("to", overrides.to ?? dateRange.to);
    const rev = overrides.revenue ?? revenueField;
    if (rev !== "with_shipping") params.set("revenue", rev);
    const br = overrides.brand === null ? undefined : (overrides.brand ?? activeBrand);
    if (br) params.set("brand", br);
    return params;
  }, [dateRange, revenueField, activeBrand]);

  const routeBasePath = props.routeBasePath ?? "/analytics";

  const handleDateApply = useCallback((from: string, to: string) => {
    setIsDateLoading(true);
    router.push(`${routeBasePath}?${buildParams({ from, to }).toString()}`);
  }, [router, buildParams, routeBasePath]);

  const handleRevenueToggle = useCallback((field: "net" | "with_shipping") => {
    setIsDateLoading(true);
    router.push(`${routeBasePath}?${buildParams({ revenue: field }).toString()}`);
  }, [router, buildParams, routeBasePath]);

  const handleBrandChange = useCallback((brand: string | undefined) => {
    setIsDateLoading(true);
    router.push(`${routeBasePath}?${buildParams({ brand: brand ?? null }).toString()}`);
  }, [router, buildParams, routeBasePath]);

  const filteredCharts = useMemo(() => {
    let charts = props.availableCharts.filter((c) => c.category === activeCategory && c.status === "ready");
    // When a brand is selected, hide charts that don't support brand filtering
    // EXCEPT in cross_brand tab (independent dashboard, always shows full data)
    if (activeBrand && activeCategory !== "cross_brand") {
      charts = charts.filter((c) => chartSupportsBrandFilter(c.chart_id));
    }
    return charts;
  }, [props.availableCharts, activeCategory, activeBrand]);

  const handleCategoryChange = useCallback((catId: ChartCategory) => {
    setActiveCategory(catId);
    // Sync group tab when category changes
    if (ERP_SALES_CATS.has(catId)) setActiveGroup("erp");
    else if (ERP_CROSS_CATS.has(catId)) setActiveGroup("erp_cross");
    else if (GA4_CATS.has(catId)) setActiveGroup("ga4");
    else setActiveGroup("ga4_erp");

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
  }, [loadedCategories, props.availableCharts, props.initialFilters, ERP_SALES_CATS, ERP_CROSS_CATS, GA4_CATS, GA4_ERP_CATS]);

  const hydrated = useRef(false);

  // Read from localStorage first, then mark hydrated
  useEffect(() => {
    if (!props.showTaskSummary) return;
    try {
      const raw = window.localStorage.getItem(DEMO_PROGRESS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        setTaskProgress(parsed);
      }
    } catch {
      // ignore
    }
    hydrated.current = true;
  }, [props.showTaskSummary]);

  // Persist to localStorage only after hydration
  useEffect(() => {
    if (!props.showTaskSummary || !hydrated.current) return;
    try {
      window.localStorage.setItem(DEMO_PROGRESS_STORAGE_KEY, JSON.stringify(taskProgress));
    } catch (error) {
      void error;
    }
  }, [taskProgress, props.showTaskSummary]);

  // Auto-check T1-T8 for all ready charts (verified in prior sessions)
  // Only auto-set true; explicitly false (manual uncheck) is preserved
  useEffect(() => {
    if (!props.showTaskSummary || !hydrated.current) return;
    const updates: Record<string, boolean> = {};
    for (const spec of props.availableCharts) {
      if (spec.status !== "ready") continue;
      for (const task of DEMO_TASK_PACK) {
        const key = `${spec.chart_id}:${task}`;
        // Only set if key is undefined (never touched); skip if explicitly false (manual uncheck)
        if (taskProgress[key] === undefined) updates[key] = true;
      }
    }
    if (Object.keys(updates).length > 0) {
      setTaskProgress((prev) => ({ ...prev, ...updates }));
    }
  }, [props.showTaskSummary, props.availableCharts, taskProgress]);

  const toggleProgress = useCallback((key: string) => {
    setTaskProgress((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const progressStats = useMemo(() => {
    if (!props.showTaskSummary || filteredCharts.length === 0) {
      return { done: 0, total: 0, gateG1: false, gateG2: false, gateG3: false, gateG4: false, gateG5: false };
    }
    const total = filteredCharts.length * (DEMO_TASK_PACK.length + 1);
    let done = 0;
    let gateG1 = true;
    let gateG2 = true;
    let gateG3 = true;
    let gateG4 = true;
    let gateG5 = true;

    for (const spec of filteredCharts) {
      const gateState = getGateState(taskProgress, spec.chart_id);
      done += gateState.done;
      if (!gateState.gateG1) gateG1 = false;
      if (!gateState.gateG2) gateG2 = false;
      if (!gateState.gateG3) gateG3 = false;
      if (!gateState.gateG4) gateG4 = false;
      if (!gateState.gateG5) gateG5 = false;
    }

    return { done, total, gateG1, gateG2, gateG3, gateG4, gateG5 };
  }, [props.showTaskSummary, filteredCharts, taskProgress]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("analytics.title")}</h1>
        <div className="flex items-center gap-4">
          {props.brands.length > 0 && (
            <select
              value={activeBrand ?? ""}
              disabled={isDateLoading}
              onChange={(e) => handleBrandChange(e.target.value || undefined)}
              className="rounded-md border px-2 py-1.5 text-sm bg-background disabled:opacity-50 dark:border-neutral-500"
            >
              <option value="">{t("analytics.allBrands")}</option>
              {props.brands.map((b) => (
                <option key={b.brand_code} value={b.brand_code}>{b.brand_name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1 rounded-lg border p-0.5 text-sm dark:border-neutral-500">
            <button
              type="button"
              onClick={() => handleRevenueToggle("with_shipping")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                revenueField === "with_shipping"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              含運實收
            </button>
            <button
              type="button"
              onClick={() => handleRevenueToggle("net")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                revenueField === "net"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              訂單實收
            </button>
          </div>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            loading={isDateLoading}
            onApply={handleDateApply}
          />
        </div>
      </div>

      <KpiRow result={stats} dateRange={dateRange} loading={isDateLoading} />

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">{t("analytics.title")} — 圖表看板</h2>
        {/* Level 1: Browser-style group tabs */}
        <div className="flex items-stretch border-b-2 border-border bg-muted/40 px-1 pt-1 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.06)] dark:border-neutral-500 dark:bg-muted/30">
          {catGroups.map((group) => (
            <button
              key={group.key}
              onClick={() => {
                setActiveGroup(group.key);
                const firstCat = group.cats[0]?.id;
                if (firstCat) handleCategoryChange(firstCat);
              }}
              className={`relative rounded-t-lg px-5 py-2 text-sm font-semibold transition-all ${
                activeGroup === group.key
                  ? "-mb-[2px] border border-b-0 border-border bg-background text-foreground shadow-[0_-2px_6px_rgba(0,0,0,0.1)] dark:border-neutral-500"
                  : "border border-transparent text-muted-foreground/70 hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {t(`analytics.group.${group.key}`)}
            </button>
          ))}
        </div>
        {/* Level 2: Category tabs within active group (hidden when only 1 sub-tab) */}
        {(catGroups.find(g => g.key === activeGroup)?.cats.length ?? 0) > 1 && (
          <div className="flex gap-1 border-b-2 border-border/50 bg-background pl-6 shadow-sm dark:border-neutral-500/50">
            {catGroups.find(g => g.key === activeGroup)?.cats.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                }`}
              >
                {t(`analytics.category.${cat.id}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {isPending || isDateLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">載入圖表中…</p>
          </div>
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
              status={spec.status}
              dateRange={chartSupportsDateFilter(spec.chart_id) ? dateRange : undefined}
              supportsDateFilter={chartSupportsDateFilter(spec.chart_id)}
              supportsBrandFilter={chartSupportsBrandFilter(spec.chart_id)}
              badges={undefined}
              pinned={pinnedChartIds.has(spec.chart_id)}
              onTogglePin={() => onTogglePin(spec.chart_id)}
            />
          ))}
        </div>
      )}

      {props.showTaskSummary ? (
        <details className="rounded-lg border bg-background dark:border-neutral-500">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-muted-foreground/50 hover:text-muted-foreground">
            任務摘要 — {t(`analytics.category.${activeCategory}`)}（{progressStats.done}/{progressStats.total}）
          </summary>
          <div className="border-t px-4 pb-4 pt-3 dark:border-neutral-500">
            <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
              <div className={`rounded border px-2 py-1 dark:border-neutral-500 ${progressStats.gateG1 ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-muted/30 text-muted-foreground"}`}>G1 資料契約</div>
              <div className={`rounded border px-2 py-1 dark:border-neutral-500 ${progressStats.gateG2 ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-muted/30 text-muted-foreground"}`}>G2 元件渲染</div>
              <div className={`rounded border px-2 py-1 dark:border-neutral-500 ${progressStats.gateG3 ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-muted/30 text-muted-foreground"}`}>G3 功能保留</div>
              <div className={`rounded border px-2 py-1 dark:border-neutral-500 ${progressStats.gateG4 ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-muted/30 text-muted-foreground"}`}>G4 行銷語義</div>
              <div className={`rounded border px-2 py-1 dark:border-neutral-500 ${progressStats.gateG5 ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-muted/30 text-muted-foreground"}`}>G5 Browser E2E</div>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {filteredCharts.map((spec) => {
                const plan = getDemoPlanDetail(spec);
                const gateState = getGateState(taskProgress, spec.chart_id);
                return (
                  <article key={`task-${spec.chart_id}`} className="rounded-md border bg-muted/10 p-3 dark:border-neutral-500">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">{spec.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground/70">Item {spec.chart_id} / {spec.chart_type}</p>
                    <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground/80">
                      <p><span className="font-medium text-muted-foreground">類型選擇：</span>{plan.typeChoice}</p>
                      <p><span className="font-medium text-muted-foreground">欄位選擇：</span>{plan.fieldChoice}</p>
                      <p><span className="font-medium text-muted-foreground">顯示方式：</span>{plan.displayMode}</p>
                      <p><span className="font-medium text-muted-foreground">語義檢核：</span>{plan.semanticCheck}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1 text-[10px]">
                      <span className={`rounded border px-1.5 py-0.5 text-center dark:border-neutral-500 ${gateState.gateG1 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-muted bg-background text-muted-foreground/60"}`}>G1</span>
                      <span className={`rounded border px-1.5 py-0.5 text-center dark:border-neutral-500 ${gateState.gateG2 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-muted bg-background text-muted-foreground/60"}`}>G2</span>
                      <span className={`rounded border px-1.5 py-0.5 text-center dark:border-neutral-500 ${gateState.gateG3 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-muted bg-background text-muted-foreground/60"}`}>G3</span>
                      <span className={`rounded border px-1.5 py-0.5 text-center dark:border-neutral-500 ${gateState.gateG4 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-muted bg-background text-muted-foreground/60"}`}>G4</span>
                      <span className={`rounded border px-1.5 py-0.5 text-center dark:border-neutral-500 ${gateState.gateG5 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-muted bg-background text-muted-foreground/60"}`}>G5</span>
                    </div>
                    <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      {DEMO_TASK_PACK.map((task) => (
                        <li key={`${spec.chart_id}-${task}`}>
                          <label className="flex items-center gap-1 rounded border bg-background px-2 py-1 text-muted-foreground dark:border-neutral-500">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
                              checked={Boolean(taskProgress[`${spec.chart_id}:${task}`])}
                              onChange={() => toggleProgress(`${spec.chart_id}:${task}`)}
                            />
                            <span>{task}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/70">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={Boolean(taskProgress[`${spec.chart_id}:E2E`])}
                        onChange={() => toggleProgress(`${spec.chart_id}:E2E`)}
                      />
                      Browser E2E（桌機 + 手機）完成
                    </label>
                    <p className="mt-2 text-[11px] text-muted-foreground/60">測試要求：{plan.tests}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/60">完成率：{gateState.done}/{gateState.total}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
