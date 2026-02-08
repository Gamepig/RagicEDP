import { AnalyticsOverview } from "@/components/analytics/analytics_overview";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getRepositories } from "@/lib/data/provider";
import { filtersFromSearchParams } from "@/lib/state/filters";
import { listCharts, getChartCategories } from "@/lib/analytics/chart_registry";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  requireAuthorized(session, "/analytics");

  const params = await searchParams;
  const filters = filtersFromSearchParams(params);
  const repos = getRepositories();

  const allCharts = listCharts();
  const chartIds = allCharts.map((c) => c.chart_id);
  const categories = getChartCategories();

  const [stats, pinned, ...chartResults] = await Promise.all([
    repos.analytics.getDashboardStats({ dateRange: filters.dateRange }),
    repos.analytics.listPinnedWidgets({ userId: "demo" }),
    ...chartIds.map((chartId) => repos.analytics.getChartData({ chartId, filters })),
  ]);

  const charts = Object.fromEntries(
    chartIds.map((id, index) => [id, chartResults[index]])
  );

  return (
    <AnalyticsOverview
      initialFilters={filters}
      initialStats={stats}
      initialCharts={charts}
      initialPinned={pinned}
      availableCharts={allCharts}
      categories={categories}
    />
  );
}
