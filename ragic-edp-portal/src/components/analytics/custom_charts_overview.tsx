"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { ChartSpecV0 } from "@/lib/analytics/chart_registry";
import type { ChartDataV0 } from "@/lib/data/analytics.repo";
import type { ChartFiltersV0, PinnedWidgetV0, ResultV0 } from "@/lib/data/types";
import { ChartRenderer } from "@/components/ai_expert/chart_renderer";
import {
  createCustomChart,
  deleteCustomChart,
  getMultipleChartData,
  reorderPinnedWidgets,
  updateCustomChart,
} from "@/actions/analytics";

import { chartSupportsDateFilter, chartSupportsBrandFilter } from "@/lib/analytics/chart_registry";
import { ChartGrid } from "./chart_grid";

function SortableCard(props: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-80" : ""} {...attributes} {...listeners}>
      {props.children}
    </div>
  );
}

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

export function CustomChartsOverview(props: {
  initialFilters: ChartFiltersV0;
  initialPinned: ResultV0<PinnedWidgetV0[]>;
  initialCharts: Record<string, ResultV0<ChartDataV0>>;
  availableCharts: ChartSpecV0[];
  brands: { brand_code: string; brand_name: string }[];
}) {
  const router = useRouter();
  const [charts, setCharts] = useState(props.initialCharts);
  const [pinned, setPinned] = useState(props.initialPinned);
  const [isPending, startTransition] = useTransition();
  const [isFilterPending, startFilterTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedChartId, setSelectedChartId] = useState("");
  const [titleOverride, setTitleOverride] = useState("");
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const dateRange = props.initialFilters.dateRange;
  const revenueField = props.initialFilters.revenueField ?? "with_shipping";
  const activeBrand = props.initialFilters.brand;

  const pinnedData = pinned.ok ? pinned.data : [];
  const pinnedCatalogIds = useMemo(
    () =>
      new Set(
        pinnedData
          .map((w) => (w.ref.kind === "catalog" ? w.ref.chartId : undefined))
          .filter((v): v is string => Boolean(v))
      ),
    [pinnedData]
  );

  const selectableCharts = useMemo(
    () => props.availableCharts.filter((c) => !pinnedCatalogIds.has(c.chart_id)),
    [props.availableCharts, pinnedCatalogIds]
  );

  const specById = useMemo(
    () => new Map(props.availableCharts.map((c) => [c.chart_id, c] as const)),
    [props.availableCharts]
  );

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

  const handleDateApply = useCallback((from: string, to: string) => {
    startFilterTransition(() => {
      router.push(`/custom-charts?${buildParams({ from, to }).toString()}`);
    });
  }, [router, buildParams]);

  const handleRevenueToggle = useCallback((field: "net" | "with_shipping") => {
    startFilterTransition(() => {
      router.push(`/custom-charts?${buildParams({ revenue: field }).toString()}`);
    });
  }, [router, buildParams]);

  const handleBrandChange = useCallback((brand: string | undefined) => {
    startFilterTransition(() => {
      router.push(`/custom-charts?${buildParams({ brand: brand ?? null }).toString()}`);
    });
  }, [router, buildParams]);

  const onCreate = useCallback(() => {
    if (!selectedChartId) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await createCustomChart({
        chartId: selectedChartId,
        titleOverride: titleOverride.trim() || undefined,
      });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setPinned((prev) => {
        if (!prev.ok) return { ok: true as const, data: [result.data] };
        const exists = prev.data.some((w) => w.widgetId === result.data.widgetId);
        return exists ? prev : { ok: true as const, data: prev.data.concat(result.data) };
      });

      if (!charts[selectedChartId]) {
        const loaded = await getMultipleChartData({ chartIds: [selectedChartId], filters: props.initialFilters });
        setCharts((prev) => ({ ...prev, ...loaded }));
      }
      setSelectedChartId("");
      setTitleOverride("");
      setShowCreate(false);
    });
  }, [selectedChartId, titleOverride, charts, props.initialFilters]);

  const onDelete = useCallback((widgetId: string) => {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await deleteCustomChart({ widgetId });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }
      setPinned((prev) => {
        if (!prev.ok) return prev;
        return { ok: true, data: prev.data.filter((w) => w.widgetId !== widgetId) };
      });
    });
  }, []);

  const onStartEdit = useCallback((widget: PinnedWidgetV0) => {
    setEditingWidgetId(widget.widgetId);
    setEditingTitle(widget.titleOverride ?? "");
  }, []);

  const onSaveEdit = useCallback(() => {
    if (!editingWidgetId) return;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await updateCustomChart({
        widgetId: editingWidgetId,
        titleOverride: editingTitle.trim() || undefined,
      });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }
      setPinned((prev) => {
        if (!prev.ok) return prev;
        return {
          ok: true,
          data: prev.data.map((w) =>
            w.widgetId === editingWidgetId
              ? { ...w, titleOverride: editingTitle.trim() || undefined }
              : w
          ),
        };
      });
      setEditingWidgetId(null);
      setEditingTitle("");
    });
  }, [editingWidgetId, editingTitle]);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      if (!pinned.ok) return;
      const oldIndex = pinned.data.findIndex((w) => w.widgetId === String(active.id));
      const newIndex = pinned.data.findIndex((w) => w.widgetId === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      const moved = arrayMove(pinned.data, oldIndex, newIndex).map((w, idx) => ({ ...w, order: idx }));
      setPinned({ ok: true, data: moved });
      startTransition(async () => {
        const result = await reorderPinnedWidgets({ widgetIdsInOrder: moved.map((w) => w.widgetId) });
        if (!result.ok) {
          setErrorMessage(result.error.message);
        }
      });
    },
    [pinned]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">自訂圖表</h1>
        <div className="flex items-center gap-4">
          {props.brands.length > 0 && (
            <select
              value={activeBrand ?? ""}
              disabled={isFilterPending}
              onChange={(e) => handleBrandChange(e.target.value || undefined)}
              className="rounded-md border px-2 py-1.5 text-sm bg-background disabled:opacity-50 dark:border-neutral-500"
            >
              <option value="">全品牌</option>
              {props.brands.map((b) => (
                <option key={b.brand_code} value={b.brand_code}>{b.brand_name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1 rounded-lg border p-0.5 text-sm dark:border-neutral-500">
            <button
              type="button"
              onClick={() => handleRevenueToggle("with_shipping")}
              disabled={isFilterPending}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                revenueField === "with_shipping" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              含運實收
            </button>
            <button
              type="button"
              onClick={() => handleRevenueToggle("net")}
              disabled={isFilterPending}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                revenueField === "net" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              訂單實收
            </button>
          </div>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            loading={isFilterPending}
            onApply={handleDateApply}
          />
        </div>
      </div>

      {isFilterPending && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          圖表計算中，請稍候…
        </div>
      )}

      <section className="rounded-xl border bg-muted/20 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">可新增、命名、拖曳排序、刪除。共 {pinnedData.length} 張。</div>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            新增圖表
          </button>
        </div>

        {showCreate && (
          <div className="mt-3 grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[1fr_1fr_auto]">
            <select
              value={selectedChartId}
              onChange={(e) => setSelectedChartId(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm"
            >
              <option value="">選擇圖表</option>
              {selectableCharts.map((c) => (
                <option key={c.chart_id} value={c.chart_id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              value={titleOverride}
              onChange={(e) => setTitleOverride(e.target.value)}
              placeholder="自訂名稱（可留空）"
              className="h-9 rounded-md border px-3 text-sm"
            />
            <button
              type="button"
              onClick={onCreate}
              disabled={!selectedChartId || isPending}
              className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm disabled:opacity-50"
            >
              建立
            </button>
          </div>
        )}
      </section>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {pinnedData.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-10 text-sm text-muted-foreground">
          尚無自訂圖表，請先新增至少一張圖表。
        </div>
      ) : (
        <div className="relative">
          {isFilterPending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                計算中…
              </div>
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={pinnedData.map((w) => w.widgetId)} strategy={rectSortingStrategy}>
              <div className="grid gap-6 lg:grid-cols-2">
                {pinnedData.map((w) => {
                const chartId = w.ref.kind === "catalog" ? w.ref.chartId : undefined;
                if (!chartId || !specById.has(chartId)) {
                  return (
                    <SortableCard key={w.widgetId} id={w.widgetId}>
                      <div className="rounded-xl border bg-background p-4">
                        <div className="mb-2 text-sm font-semibold">AI 圖表</div>
                        {w.aiChartData ? (
                          <ChartRenderer chart={w.aiChartData} onUnpin={() => onDelete(w.widgetId)} />
                        ) : (
                          <div className="text-sm text-muted-foreground">此圖表格式暫不支援於自訂圖表頁編輯。</div>
                        )}
                      </div>
                    </SortableCard>
                  );
                }
                const spec = specById.get(chartId)!;
                return (
                  <SortableCard key={w.widgetId} id={w.widgetId}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-end gap-2">
                        {editingWidgetId === w.widgetId ? (
                          <>
                            <input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className="h-8 rounded-md border px-2 text-sm"
                              placeholder="圖表名稱"
                            />
                            <button type="button" onClick={onSaveEdit} className="h-8 rounded-md border px-3 text-xs">
                              儲存
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWidgetId(null);
                                setEditingTitle("");
                              }}
                              className="h-8 rounded-md border px-3 text-xs"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => onStartEdit(w)} className="h-8 rounded-md border px-3 text-xs">
                              編輯名稱
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(w.widgetId)}
                              className="h-8 rounded-md border border-red-200 px-3 text-xs text-red-600"
                            >
                              刪除
                            </button>
                          </>
                        )}
                      </div>
                      <ChartGrid
                        title={w.titleOverride || spec.name}
                        chartId={chartId}
                        chartType={spec.chart_type}
                        result={charts[chartId]}
                        pinned={true}
                        onTogglePin={() => onDelete(w.widgetId)}
                        status={spec.status}
                        dateRange={chartSupportsDateFilter(chartId) ? dateRange : undefined}
                        supportsDateFilter={chartSupportsDateFilter(chartId)}
                        supportsBrandFilter={chartSupportsBrandFilter(chartId)}
                      />
                    </div>
                  </SortableCard>
                );
              })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
