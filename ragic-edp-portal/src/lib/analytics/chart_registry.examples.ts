import {
  getChartSpec,
  getChartStats,
  hasChart,
  listReadyCharts,
  listPendingCharts,
  validateRequiredFields,
} from "./chart_registry";

export function exampleUsage() {
  const stats = getChartStats();
  console.log(`Total charts: ${stats.total} (${stats.ready} ready, ${stats.needsNewView} pending)`);

  const chart = getChartSpec("01");
  if (chart) {
    console.log(`Chart: ${chart.name}`);
    console.log(`Status: ${chart.status}`);
    console.log(`Required fields: ${chart.required_fields.join(", ")}`);
  }

  const availableFields = ["order_date", "revenue", "customer_code"];
  const validation = validateRequiredFields("01", availableFields);
  if (!validation.valid) {
    console.warn(`Missing fields: ${validation.missingFields.join(", ")}`);
  }

  const readyCharts = listReadyCharts();
  console.log(`Ready charts: ${readyCharts.map((c) => c.chart_id).join(", ")}`);

  const pendingCharts = listPendingCharts();
  console.log(`Pending charts (needs view): ${pendingCharts.map((c) => c.chart_id).join(", ")}`);

  if (hasChart("NEW-01")) {
    console.log("Chart NEW-01 exists in registry");
  }
}

export function getDashboardChartIds(): string[] {
  const readyCharts = listReadyCharts();
  return readyCharts.slice(0, 6).map((c) => c.chart_id);
}

export function getChartMetadata(chartId: string):
  | {
      id: string;
      name: string;
      status: "ready" | "needs_new_view";
      canRender: boolean;
    }
  | undefined {
  const spec = getChartSpec(chartId);
  if (!spec) return undefined;

  return {
    id: spec.chart_id,
    name: spec.name,
    status: spec.status,
    canRender: spec.status === "ready",
  };
}
