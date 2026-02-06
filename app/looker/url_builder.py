from typing import List, Dict
from .spec_models import DashboardSpec, ChartSpec
from .renderer import StudioRenderer


class LinkingUrlBuilder:
    def __init__(self, renderer: StudioRenderer):
        self.renderer = renderer

    def build_chart_url(self, chart: ChartSpec) -> str:
        # Fallback Strategy: Generate a single URL for a single chart
        # using wildcard 'ds.*' to avoid alias issues (ds01 not found in empty report)

        params = {}

        # 1. Report Params
        params["r.reportName"] = chart.title
        params["c.mode"] = "view"

        # 2. Data Source Params (Use Wildcard ONLY)
        params["ds.*.connector"] = "bigQuery"
        params["ds.*.projectId"] = chart.datasource.project_id
        params["ds.*.datasetId"] = chart.datasource.dataset_id
        params["ds.*.refreshFields"] = str(chart.datasource.refresh_fields).lower()

        if chart.datasource.table_id:
            params["ds.*.tableId"] = chart.datasource.table_id
            params["ds.*.type"] = "TABLE"
        elif chart.datasource.sql:
            params["ds.*.sql"] = chart.datasource.sql
            params["ds.*.type"] = "CUSTOM_QUERY"

        return self.renderer.build_url(params)

    def build_dashboard_url(self, dashboard: DashboardSpec, template_id: str = None) -> str:
        all_params = {}

        # 1. Report Level Params (Required by KB)
        all_params["r.reportName"] = dashboard.title
        all_params["c.mode"] = "view"  # Default to view mode for safety
        if template_id:
            all_params["c.reportId"] = template_id

        # 2. Add Charts (Data Sources)
        project_ids = set()
        dataset_ids = set()

        for chart in dashboard.charts:
            chart_params = self.renderer.render_linking_params(chart)
            all_params.update(chart_params)

            # Collect IDs for wildcard check
            project_ids.add(chart.datasource.project_id)
            dataset_ids.add(chart.datasource.dataset_id)

        # 3. Global Wildcard Optimization (Only if consistent)
        if len(project_ids) == 1:
            common_project = project_ids.pop()
            all_params["ds.*.projectId"] = common_project
            # Remove individual keys
            keys_to_remove = [
                k for k in all_params if k.endswith(".projectId") and k != "ds.*.projectId"
            ]
            for k in keys_to_remove:
                del all_params[k]

        if len(dataset_ids) == 1:
            common_dataset = dataset_ids.pop()
            all_params["ds.*.datasetId"] = common_dataset
            keys_to_remove = [
                k for k in all_params if k.endswith(".datasetId") and k != "ds.*.datasetId"
            ]
            for k in keys_to_remove:
                del all_params[k]

        return self.renderer.build_url(all_params)


import unittest
from .spec_models import VizConfig, VisType, DataSourceSpec


class TestLinkingUrlBuilder(unittest.TestCase):
    def test_build_multi_chart_url(self):
        renderer = StudioRenderer()
        builder = LinkingUrlBuilder(renderer)

        c1 = ChartSpec(
            functional_id="01",
            title="C1",
            explore="t1",
            dimensions=[],
            measures=[],
            viz_config=VizConfig(type=VisType.SCORECARD),
            datasource=DataSourceSpec(project_id="p", dataset_id="d", table_id="t1", alias="ds1"),
        )
        c2 = ChartSpec(
            functional_id="02",
            title="C2",
            explore="t2",
            dimensions=[],
            measures=[],
            viz_config=VizConfig(type=VisType.COLUMN),
            datasource=DataSourceSpec(project_id="p", dataset_id="d", table_id="t2", alias="ds2"),
        )

        dash = DashboardSpec(dashboard_id="d1", title="MyDash", charts=[c1, c2])
        url = builder.build_dashboard_url(dash)

        # NOTE: '*' is encoded as '%2A' in the URL query string
        self.assertIn("ds.%2A.projectId=b25h01-ragic", url)
        self.assertIn("ds.ds1.tableId=t1", url)
        self.assertIn("ds.ds2.tableId=t2", url)
        self.assertIn("r.reportName=MyDash", url)


if __name__ == "__main__":
    unittest.main()
