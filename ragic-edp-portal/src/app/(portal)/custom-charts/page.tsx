import { CustomChartsOverview } from "@/components/analytics/custom_charts_overview";
import { auth } from "@/lib/auth/auth";
import { requireAuthorized } from "@/lib/auth/authorize";
import { listReadyCharts } from "@/lib/analytics/chart_registry";
import { getRepositories } from "@/lib/data/provider";
import { filtersFromSearchParams } from "@/lib/state/filters";

export const dynamic = "force-dynamic";

export default async function CustomChartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = requireAuthorized(await auth(), "/custom-charts");
  const userId = session.user?.email ?? "dev@local";
  const params = await searchParams;
  const filters = filtersFromSearchParams(params);
  const repos = getRepositories();

  const availableCharts = listReadyCharts();
  const [pinned, brands] = await Promise.all([
    repos.analytics.listPinnedWidgets({ userId }),
    repos.analytics.getBrandList(),
  ]);
  const pinnedCatalogChartIds =
    pinned.ok
      ? pinned.data
          .map((w) => (w.ref.kind === "catalog" ? w.ref.chartId : undefined))
          .filter((v): v is string => Boolean(v))
      : [];

  const chartResults = await Promise.all(
    pinnedCatalogChartIds.map((chartId) =>
      repos.analytics.getChartData({ chartId, filters })
    )
  );
  const charts = Object.fromEntries(
    pinnedCatalogChartIds.map((id, index) => [id, chartResults[index]])
  );

  return (
    <CustomChartsOverview
      key={`${filters.dateRange.from}_${filters.dateRange.to}_${filters.revenueField ?? "with_shipping"}_${filters.brand ?? "all"}`}
      initialFilters={filters}
      initialPinned={pinned}
      initialCharts={charts}
      availableCharts={availableCharts}
      brands={brands.ok ? brands.data : []}
    />
  );
}
