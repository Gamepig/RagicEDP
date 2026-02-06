import json
from .studio_converter import StudioSpecConverter
from .url_builder import LinkingUrlBuilder
from .renderer import StudioRenderer
from .spec_models import DashboardSpec


def deploy_studio_charts(markdown_path: str):
    # 1. Read Markdown Spec
    with open(markdown_path, "r") as f:
        md_content = f.read()

    converter = StudioSpecConverter()
    all_specs = converter.parse_markdown(md_content)

    # 2. Group specs by Functional Board (based on Description/Section)
    boards = {}
    for spec in all_specs:
        # Filter out GA charts and System Log charts (as requested)
        if "GA" in spec.datasource.table_id or "System Log" in spec.datasource.table_id:
            print(f"Skipping chart {spec.functional_id} ({spec.title}) - GA/System Log source")
            continue

        section = spec.description or "General"
        if section not in boards:
            boards[section] = []
        boards[section].append(spec)

    # 3. Generate Linking URLs
    builder = LinkingUrlBuilder(StudioRenderer())
    deployment_results = {}

    print(f"Deploying {len(all_specs)} charts across {len(boards)} functional boards...\n")

    for section_name, specs in boards.items():
        print(f"\n📂 Section: {section_name}")
        print("=" * 60)

        for chart in specs:
            # V3 Strategy: Generate per-chart URL using wildcard to avoid alias errors
            url = builder.build_chart_url(chart)

            print(f"   📊 Chart: {chart.title} (ID: {chart.functional_id})")
            print(f"   🔗 URL: {url}")
            print("-" * 30)

    return deployment_results


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m app.looker.deploy_studio <spec_markdown_path>")
        sys.exit(1)

    deploy_studio_charts(sys.argv[1])
