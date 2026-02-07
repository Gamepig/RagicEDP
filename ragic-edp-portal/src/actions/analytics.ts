"use server";

import { auth } from "../lib/auth/auth";
import { assertAuthorized } from "../lib/auth/authorize";
import { getRepositories } from "../lib/data/provider";
import type { ChartFiltersV0 } from "@/lib/data/types";

async function requireAuthorizedSession() {
  const session = await auth();
  assertAuthorized(session);
}

export async function getDashboardStats(input: { dateRange: { from: string; to: string } }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.analytics.getDashboardStats(input);
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

export async function pinWidget(input: { userId: string; chartId: string }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.analytics.pinWidget(input);
}

export async function unpinWidget(input: { userId: string; chartId: string }) {
  await requireAuthorizedSession();
  const repos = getRepositories();
  return repos.analytics.unpinWidget(input);
}
