"use server";

import { auth } from "../lib/auth/auth";
import { assertAuthorized } from "../lib/auth/authorize";
import { getRepositories } from "../lib/data/provider";
import type { ChartFiltersV0 } from "@/lib/data/types";

async function requireAuthorizedSession() {
  const session = await auth();
  assertAuthorized(session);
}

export async function getDashboardStats(input: { dateRange: { from: string; to: string }; revenueField?: "net" | "with_shipping"; brand?: string }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.analytics.getDashboardStats(input);
}

export async function getBrandList() {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.analytics.getBrandList();
}

export async function getChartData(input: { chartId: string; filters: ChartFiltersV0 }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.analytics.getChartData(input);
}

/**
 * 批量取得多個圖表資料
 * Phase 2 優化：可改為 single BigQuery batch query 以減少 round trips
 */
export async function getMultipleChartData(input: {
  chartIds: string[];
  filters: ChartFiltersV0;
}) {
  await requireAuthorizedSession();
  const repos = getRepositories();

  // Phase 1: sequential queries (mock-first)
  // Phase 2: 可改為 Promise.all() 或 batch SQL
  const results = await Promise.all(
    input.chartIds.map(async (chartId) => {
      const result = await repos.analytics.getChartData({ chartId, filters: input.filters });
      return { chartId, result };
    })
  );

  return Object.fromEntries(results.map(({ chartId, result }) => [chartId, result]));
}

export async function pinWidget(input: { chartId: string }) {
  const session = await auth();
  assertAuthorized(session);
  const userId = session.user?.email ?? "dev@local";
  const repos = getRepositories();
  return repos.analytics.pinWidget({ userId, chartId: input.chartId });
}

export async function unpinWidget(input: { chartId: string }) {
  const session = await auth();
  assertAuthorized(session);
  const userId = session.user?.email ?? "dev@local";
  const repos = getRepositories();
  return repos.analytics.unpinWidget({ userId, chartId: input.chartId });
}

export async function unpinByWidgetId(input: { widgetId: string }) {
  const session = await auth();
  assertAuthorized(session);
  const userId = session.user?.email ?? "dev@local";
  const repos = getRepositories();
  return repos.analytics.unpinByWidgetId({ userId, widgetId: input.widgetId });
}

export async function reorderPinnedWidgets(input: { widgetIdsInOrder: string[] }) {
  const session = await auth();
  assertAuthorized(session);
  const userId = session.user?.email ?? "dev@local";
  const repos = getRepositories();
  return repos.analytics.reorderPinnedWidgets({ userId, widgetIdsInOrder: input.widgetIdsInOrder });
}

export async function updatePinnedWidget(input: { widgetId: string; titleOverride?: string }) {
  const session = await auth();
  assertAuthorized(session);
  const userId = session.user?.email ?? "dev@local";
  const repos = getRepositories();
  return repos.analytics.updatePinnedWidget({
    userId,
    widgetId: input.widgetId,
    titleOverride: input.titleOverride,
  });
}

export async function createCustomChart(input: { chartId: string; titleOverride?: string }) {
  const session = await auth();
  assertAuthorized(session);
  const userId = session.user?.email ?? "dev@local";
  const repos = getRepositories();

  const pinResult = await repos.analytics.pinWidget({ userId, chartId: input.chartId });
  if (!pinResult.ok) return pinResult;

  const listResult = await repos.analytics.listPinnedWidgets({ userId });
  if (!listResult.ok) return listResult;
  const widget = listResult.data.find((w) => w.ref.kind === "catalog" && w.ref.chartId === input.chartId);
  if (!widget) {
    return { ok: false as const, error: { code: "WIDGET_NOT_FOUND", message: "Widget was not created" } };
  }

  if (input.titleOverride?.trim()) {
    const updateResult = await repos.analytics.updatePinnedWidget({
      userId,
      widgetId: widget.widgetId,
      titleOverride: input.titleOverride,
    });
    if (!updateResult.ok) return updateResult;
    return { ok: true as const, data: { ...widget, titleOverride: input.titleOverride.trim() } };
  }

  return { ok: true as const, data: widget };
}

export async function updateCustomChart(input: { widgetId: string; titleOverride?: string }) {
  const session = await auth();
  assertAuthorized(session);
  const userId = session.user?.email ?? "dev@local";
  const repos = getRepositories();
  return repos.analytics.updatePinnedWidget({
    userId,
    widgetId: input.widgetId,
    titleOverride: input.titleOverride,
  });
}

export async function deleteCustomChart(input: { widgetId: string }) {
  const session = await auth();
  assertAuthorized(session);
  const userId = session.user?.email ?? "dev@local";
  const repos = getRepositories();
  return repos.analytics.unpinByWidgetId({ userId, widgetId: input.widgetId });
}
