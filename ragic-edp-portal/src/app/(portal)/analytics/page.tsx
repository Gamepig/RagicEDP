import { AnalyticsOverview } from "@/components/analytics/analytics_overview";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { getGA4AllCategories, listCharts, type ChartCategory } from "@/lib/analytics/chart_registry";
import { getRepositories } from "@/lib/data/provider";
import { filtersFromSearchParams } from "@/lib/state/filters";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = requireAuthorized(await auth(), "/analytics");
  const userId = session.user?.email ?? "dev@local";

  const params = await searchParams;
  const filters = filtersFromSearchParams(params);
  const repos = getRepositories();

  const allCharts = listCharts();
  const ga4Categories = getGA4AllCategories().map((c) => c.id);
  const baseCategories: ChartCategory[] = ["executive", "product", "channel", "customer", "operations", "cross_brand"];
  const categories = [...baseCategories, ...ga4Categories].map((id) => ({ id, name: id }));
  const defaultCategory = categories[0]?.id || "executive";

  const defaultCategoryChartIds = allCharts
    .filter((c) => c.category === defaultCategory)
    .map((c) => c.chart_id);

  const [stats, brands, pinned, ...chartResults] = await Promise.all([
    repos.analytics.getDashboardStats({ dateRange: filters.dateRange, revenueField: filters.revenueField, brand: filters.brand }),
    repos.analytics.getBrandList(),
    repos.analytics.listPinnedWidgets({ userId }),
    ...defaultCategoryChartIds.map((chartId) =>
      repos.analytics.getChartData({ chartId, filters }),
    ),
  ]);

  const charts = Object.fromEntries(
    defaultCategoryChartIds.map((id, index) => [id, chartResults[index]]),
  );

  return (
    <AnalyticsOverview
      key={`${filters.dateRange.from}_${filters.dateRange.to}_${filters.revenueField ?? "with_shipping"}_${filters.brand ?? "all"}`}
      initialFilters={filters}
      initialStats={stats}
      initialCharts={charts}
      availableCharts={allCharts}
      categories={categories}
      brands={brands.ok ? brands.data : []}
      initialPinned={pinned}
    />
  );
}
