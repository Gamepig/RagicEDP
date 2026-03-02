import { GA4Overview } from "@/components/analytics/ga4_overview";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";
import { filtersFromSearchParams } from "@/lib/state/filters";
import { listChartsByDashboard, getGA4AllCategories } from "@/lib/analytics/chart_registry";

export const dynamic = "force-dynamic";

export default async function GA4Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = requireAuthorized(await auth(), "/ga4");
  const userId = session.user?.email ?? "dev@local";
  const params = await searchParams;
  const filters = filtersFromSearchParams(params);
  const repos = getRepositories();

  const allCharts = listChartsByDashboard("ga4");
  const categories = getGA4AllCategories();
  const defaultCategory = categories[0]?.id || "ga4_traffic";

  const defaultCategoryChartIds = allCharts
    .filter((c) => c.category === defaultCategory)
    .map((c) => c.chart_id);

  const [pinned, brands, ...chartResults] = await Promise.all([
    repos.analytics.listPinnedWidgets({ userId }),
    repos.analytics.getBrandList(),
    ...defaultCategoryChartIds.map((chartId) =>
      repos.analytics.getChartData({ chartId, filters })
    ),
  ]);

  const charts = Object.fromEntries(
    defaultCategoryChartIds.map((id, index) => [id, chartResults[index]])
  );

  return (
    <GA4Overview
      key={`${filters.dateRange.from}_${filters.dateRange.to}_${filters.brand ?? "all"}`}
      dashboardId="ga4"
      title="GA4 網站分析"
      initialFilters={filters}
      initialCharts={charts}
      initialPinned={pinned}
      availableCharts={allCharts}
      categories={categories}
      brands={brands.ok ? brands.data : []}
    />
  );
}
