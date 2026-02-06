import json
import yaml
from pathlib import Path
import subprocess


def load_specs():
    text = Path("docs/handoff/looker_studio_chart_specs.md").read_text(encoding="utf-8")
    import re

    match = re.search(r"```yaml\n(.*?)\n```", text, re.S)
    if not match:
        return []
    data = yaml.safe_load(match.group(1)) or {}
    return data.get("charts", [])


def main():
    specs = load_specs()
    # Filter valid datasource
    valid_specs = [
        s for s in specs if not s.get("datasource", "").startswith("SKIP_") and s.get("datasource")
    ]

    # Take first 4 for test
    batch = valid_specs[:4]

    # Map to ds0..ds3
    datasources = {}
    for i, spec in enumerate(batch):
        datasources[f"ds{i}"] = spec["datasource"]

    answers = {
        "project_id": "b25h01-ragic",
        "dashboard_id": "9f9356d9-4b4c-41ff-a849-26ecf649176a",
        "dashboard_name": "RagicEDP | Batch 01 | Charts 01-04",
        "dashboard_dataset": "erp_backup",
        "dashboard_datasources": datasources,
    }

    out_file = "docs/handoff/lsd_batch_01.json"
    Path(out_file).write_text(json.dumps(answers, indent=2))

    print(f"Generated answers for batch 1: {len(batch)} charts")
    print(json.dumps(datasources, indent=2))

    subprocess.run(["lsd-cloner", f"--answers={out_file}", f"--save={out_file}"])


if __name__ == "__main__":
    main()
