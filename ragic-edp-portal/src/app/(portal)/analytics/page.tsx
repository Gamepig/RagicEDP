import { getRepositories } from "@/lib/data/provider";
import { defaultFiltersV0 } from "@/lib/state/filters";
import { AnalyticsOverview } from "@/components/analytics/analytics_overview";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const filters = defaultFiltersV0();
  const repos = getRepositories();

  const [stats, chart, pinned] = await Promise.all([
    repos.analytics.getDashboardStats({ dateRange: filters.dateRange }),
    repos.analytics.getChartData({ chartId: "01", filters }),
    repos.analytics.listPinnedWidgets({ userId: "demo" }),
  ]);

  return <AnalyticsOverview initialFilters={filters} initialStats={stats} initialChart={chart} initialPinned={pinned} />;
}
