import re
import unittest
from typing import List
from .spec_models import ChartSpec, VizConfig, VisType, DataSourceSpec, DataSourceType


class StudioSpecConverter:
    @staticmethod
    def parse_markdown(md_content: str) -> List[ChartSpec]:
        specs = []
        lines = md_content.split("\n")
        current_section = ""

        for line in lines:
            line = line.strip()
            if line.startswith("## "):
                current_section = line.replace("## ", "").strip()
                continue

            if not line.startswith("|") or "---" in line or "ID" in line:
                continue

            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 8:
                continue

            # | | ID | Name | Source | Dim | Metric | Strategy | Note | |
            # 0 1    2      3        4     5        6          7      8

            chart_id = parts[1]
            title = parts[2]
            source_raw = parts[3]
            dim_raw = parts[4]
            metric_raw = parts[5]
            strategy_raw = parts[6]

            # Determine VisType based on Strategy column
            # Mapping based on Official Looker Studio UI names
            vis_type = VisType.TABLE  # Default
            if "KPI" in strategy_raw or "Scorecard" in strategy_raw or "評量表" in strategy_raw:
                vis_type = VisType.SCORECARD
            elif "Column" in strategy_raw or "柱狀圖" in strategy_raw:
                vis_type = VisType.COLUMN
            elif "Bar" in strategy_raw or "長條圖" in strategy_raw:
                vis_type = (
                    VisType.COLUMN
                )  # Studio API often treats Bar/Column similarly or requires template
            elif "Time Series" in strategy_raw or "時間序列" in strategy_raw:
                vis_type = (
                    VisType.LINE
                )  # Closest mapping if specific TIME_SERIES type missing in enum
            elif "Line" in strategy_raw or "折線圖" in strategy_raw:
                vis_type = VisType.LINE
            elif "Area" in strategy_raw or "面積圖" in strategy_raw:
                vis_type = VisType.AREA
            elif "Donut" in strategy_raw or "Pie" in strategy_raw or "圓餅圖" in strategy_raw:
                vis_type = VisType.PIE
            elif "Single Value" in strategy_raw:
                vis_type = VisType.SINGLE_VALUE

            # Parse Datasource
            table_name = source_raw.replace("`", "")
            if "+" in table_name:  # Handle joins/blends loosely for now
                table_name = table_name.split("+")[0]

            ds_spec = DataSourceSpec(
                project_id="b25h01-ragic",
                dataset_id="erp_backup",
                table_id=table_name,
                alias=f"ds{chart_id}",
            )

            viz_config = VizConfig(type=vis_type)

            dims = [d.strip() for d in dim_raw.split(",")] if dim_raw != "-" else []
            metrics = [m.strip() for m in metric_raw.split(",")]

            spec = ChartSpec(
                functional_id=chart_id,
                title=title,
                description=current_section,
                explore=table_name,
                dimensions=dims,
                measures=metrics,
                viz_config=viz_config,
                datasource=ds_spec,
            )

            # Validation against Knowledge Base limits
            StudioSpecConverter.validate_spec(spec)

            specs.append(spec)

        return specs

    @staticmethod
    def validate_spec(spec: ChartSpec):
        # Ref: _docs/knowledge_base/looker/studio/visualization/chart_config_and_limits.md
        if spec.viz_config.type == VisType.SCORECARD:
            if len(spec.measures) != 1:
                raise ValueError(
                    f"Scorecard (KPI) must have exactly 1 metric. Got {len(spec.measures)} for chart {spec.functional_id}"
                )
            if len(spec.dimensions) > 0:
                raise ValueError(
                    f"Scorecard (KPI) cannot have dimensions. Got {len(spec.dimensions)} for chart {spec.functional_id}"
                )


class TestStudioSpecConverter(unittest.TestCase):
    def test_parse_simple_kpi(self):
        md = "| 01 | Revenue | `fact_orders` | - | revenue | `sdk` + KPI Tile | |"
        specs = StudioSpecConverter.parse_markdown(md)
        self.assertEqual(len(specs), 1)
        self.assertEqual(specs[0].functional_id, "01")
        self.assertEqual(specs[0].viz_config.type, VisType.SCORECARD)
        self.assertEqual(specs[0].datasource.table_id, "fact_orders")

    def test_parse_bar_chart(self):
        md = "| 02 | Top Brands | `fact` | brand | rev | `sdk` + Bar Chart | |"
        specs = StudioSpecConverter.parse_markdown(md)
        self.assertEqual(specs[0].viz_config.type, VisType.COLUMN)
        self.assertEqual(specs[0].dimensions, ["brand"])


if __name__ == "__main__":
    unittest.main()
