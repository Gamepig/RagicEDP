#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import dataclass
from pathlib import Path

import yaml
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


@dataclass(frozen=True)
class ChartPlan:
    chart_id: str
    name: str
    view_table: str
    template_type: str
    chart_type: str
    dimension: str | None
    metric: str | None
    x_offset: int
    y_offset: int


@dataclass(frozen=True)
class ChartSpec:
    chart_id: str
    name: str
    template_type: str
    chart_type: str
    datasource: str
    key_fields: list[str]
    dimension: str | None = None
    metric: str | None = None


def _now_tag() -> str:
    return time.strftime("%Y%m%d-%H%M%S")


def _safe_filename(s: str) -> str:
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s.strip())
    return s[:120] or "x"


def _extract_yaml_block(text: str) -> str:
    match = re.search(r"```yaml\n(.*?)\n```", text, re.S)
    if not match:
        raise ValueError("No YAML block found in chart specs markdown")
    return match.group(1)


def _load_chart_specs(spec_md_path: Path) -> list[ChartSpec]:
    text = spec_md_path.read_text(encoding="utf-8")
    yaml_text = _extract_yaml_block(text)
    data = yaml.safe_load(yaml_text) or {}
    charts = data.get("charts") or []
    specs: list[ChartSpec] = []
    for item in charts:
        specs.append(
            ChartSpec(
                chart_id=str(item.get("id", "")).strip(),
                name=str(item.get("name", "")).strip(),
                template_type=str(item.get("template_type", "")).strip(),
                chart_type=str(item.get("chart_type", "")).strip(),
                datasource=str(item.get("datasource", "")).strip(),
                key_fields=list(item.get("key_fields") or []),
                dimension=item.get("dimension"),
                metric=item.get("metric"),
            )
        )
    return specs


def _resolve_dimension_metric(spec: ChartSpec) -> tuple[str | None, str | None]:
    dimension = spec.dimension
    metric = spec.metric
    if not dimension and not metric and spec.key_fields:
        if len(spec.key_fields) == 1:
            metric = spec.key_fields[0]
        else:
            dimension = spec.key_fields[0]
            metric = spec.key_fields[1]
    return dimension, metric


def _compute_position(
    index: int, columns: int, x_start: int, y_start: int, x_gap: int, y_gap: int
) -> tuple[int, int]:
    col = index % columns
    row = index // columns
    return x_start + col * x_gap, y_start + row * y_gap


def _chart_picker_regex(template_type: str, chart_type: str) -> str:
    ttype = template_type.strip().upper()
    ctype = chart_type.strip().lower()

    if "pie" in ctype or "donut" in ctype:
        return r"圓餅|Pie|Donut"
    if "time" in ctype or "line" in ctype or "area" in ctype:
        return r"時間序列|Time series|折線|Line|區域|Area"
    if "bar" in ctype or "column" in ctype or "stacked" in ctype or ttype == "BAR":
        return r"長條|Bar|Column"
    if "table" in ctype or "matrix" in ctype or ttype == "TBL":
        return r"表格|Table|透視表|Pivot|矩陣"
    if "gauge" in ctype:
        return r"Gauge|儀表"
    if "heatmap" in ctype:
        return r"熱圖|Heatmap"
    if "scatter" in ctype:
        return r"散佈|Scatter"
    if "treemap" in ctype:
        return r"Treemap|矩形樹"
    if "map" in ctype:
        return r"地圖|Map"
    if "funnel" in ctype:
        return r"漏斗|Funnel"
    if "chord" in ctype:
        return r"Chord"
    if ttype == "KPI":
        return r"計分卡|Scorecard|Single value|KPI"
    return r"時間序列|Time series|長條|Bar|表格|Table"


def main() -> int:
    p = argparse.ArgumentParser(
        description="Create Looker Studio charts from BQ views (Batch Mode)"
    )
    p.add_argument(
        "--report-edit-url",
        required=True,
        help="Looker Studio report edit URL",
    )
    p.add_argument("--channel", default="chrome")
    p.add_argument("--user-data-dir", default="_local/looker_studio/chrome_profile")
    p.add_argument("--headless", action="store_true")
    p.add_argument("--timeout-ms", type=int, default=60000)
    p.add_argument("--out-dir", default="_local/looker_studio/build_debug")
    p.add_argument(
        "--spec-md",
        default="docs/handoff/looker_studio_chart_specs.md",
        help="Markdown file containing YAML chart specs",
    )
    p.add_argument("--max-charts", type=int, default=0)
    p.add_argument("--columns", type=int, default=2)
    p.add_argument("--x-start", type=int, default=80)
    p.add_argument("--y-start", type=int, default=140)
    p.add_argument("--x-gap", type=int, default=520)
    p.add_argument("--y-gap", type=int, default=360)
    args = p.parse_args()

    out_dir = Path(args.out_dir).expanduser().resolve() / _now_tag()
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / "run.log"

    def log(msg: str) -> None:
        print(msg)
        with log_path.open("a", encoding="utf-8") as f:
            f.write(msg + "\n")

    def snap(page, name: str) -> None:
        try:
            page.screenshot(path=str(out_dir / f"{_safe_filename(name)}.png"), full_page=True)
        except Exception:
            pass

    def fail(page, step: str, err: Exception) -> int:
        log(f"FAILED step={step}: {err}")
        snap(page, f"error_{step}")
        try:
            (out_dir / f"dom_fail_{_safe_filename(step)}.html").write_text(
                page.content(), encoding="utf-8"
            )
        except Exception:
            pass
        return 1

    spec_path = Path(args.spec_md).expanduser().resolve()
    specs = _load_chart_specs(spec_path)
    if args.max_charts > 0:
        specs = specs[: args.max_charts]

    batch_plans: list[ChartPlan] = []
    for idx, spec in enumerate(specs):
        if not spec.chart_id or not spec.name:
            continue
        if not spec.datasource:
            raise ValueError(f"Missing datasource for chart {spec.chart_id}")
        if spec.datasource.upper().startswith("SKIP_"):
            log(f"Skipping {spec.chart_id}: datasource={spec.datasource}")
            continue
        if "+" in spec.datasource:
            raise ValueError(
                f"Datasource for chart {spec.chart_id} must be a single view/table, got {spec.datasource}"
            )

        dimension, metric = _resolve_dimension_metric(spec)
        x_offset, y_offset = _compute_position(
            idx, args.columns, args.x_start, args.y_start, args.x_gap, args.y_gap
        )
        batch_plans.append(
            ChartPlan(
                chart_id=spec.chart_id,
                name=spec.name,
                view_table=spec.datasource,
                template_type=spec.template_type,
                chart_type=spec.chart_type,
                dimension=dimension,
                metric=metric,
                x_offset=x_offset,
                y_offset=y_offset,
            )
        )

    with sync_playwright() as pwp:
        context = pwp.chromium.launch_persistent_context(
            user_data_dir=str(Path(args.user_data_dir).expanduser().resolve()),
            channel=args.channel,
            headless=args.headless,
            accept_downloads=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.new_page()

        log(f"Open: {args.report_edit_url}")
        page.goto(args.report_edit_url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        page.wait_for_timeout(5000)
        snap(page, "opened")

        # Initial cleanup
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        except Exception:
            pass

        for plan in batch_plans:
            log(f"--- Building Chart {plan.chart_id}: {plan.name} ---")

            # Ensure we are on the report page (recover from Home)
            if "reporting" not in page.url:
                log("Detected drift away from report. Navigating back...")
                page.goto(
                    args.report_edit_url, wait_until="domcontentloaded", timeout=args.timeout_ms
                )
                page.wait_for_timeout(5000)

            try:
                ensure_datasource(page, plan.view_table, args.timeout_ms, snap)
            except Exception as e:
                log(f"Failed to ensure datasource for {plan.chart_id}: {e}")
                snap(page, f"fail_ds_{plan.chart_id}")
                # Strong recovery: reload page to clear overlays/modals
                log("Reloading page to recover from failure...")
                page.goto(
                    args.report_edit_url, wait_until="domcontentloaded", timeout=args.timeout_ms
                )
                page.wait_for_timeout(5000)
                continue

            try:
                build_chart(page, plan, args.timeout_ms, snap, out_dir)
            except Exception as e:
                fail(page, f"build_{plan.chart_id}", e)
                # Strong recovery: reload page
                log("Reloading page to recover from failure...")
                page.goto(
                    args.report_edit_url, wait_until="domcontentloaded", timeout=args.timeout_ms
                )
                page.wait_for_timeout(5000)

        # Zoom out to see full canvas
        try:
            page.evaluate("document.body.style.zoom = '0.5'")
        except:
            pass
        snap(page, "batch_complete")
        context.close()

    return 0


def ensure_datasource(page, view_table, timeout_ms, snap_func):
    # Check strict match first, then loose match (truncation)
    if page.get_by_text(view_table, exact=False).count() > 0:
        print(f"Datasource {view_table} present.")
        return

    # Try truncated match (first 15 chars)
    short_name = view_table[:15]
    if page.get_by_text(short_name, exact=False).count() > 0:
        print(f"Datasource {view_table} (partial match) present.")
        return

    print(f"Adding datasource: {view_table}")

    # Locate Add Data button
    # Prefer toolbar icon
    add_data = page.locator("report-editing-tools").get_by_role(
        "button", name=re.compile(r"新增資料|Add data", re.I)
    )
    if add_data.count() == 0:
        # Fallback to footer
        add_data = page.locator("footer").get_by_role(
            "button", name=re.compile(r"新增資料|Add data", re.I)
        )

    add_data.first.wait_for(state="visible", timeout=timeout_ms)
    add_data.first.click(timeout=timeout_ms)
    page.wait_for_timeout(2000)

    # Search BigQuery
    bq_tile = page.get_by_text(re.compile(r"^BigQuery$", re.I), exact=True)
    if bq_tile.count() == 0:
        search = page.locator('input[placeholder="搜尋"]').first
        if search.is_visible():
            search.fill("BigQuery")
            page.wait_for_timeout(800)
        bq_tile = page.get_by_text("BigQuery", exact=False)

    bq_tile.first.click(timeout=timeout_ms)
    page.wait_for_timeout(3000)

    # Project
    project_input = page.locator('input[placeholder="Search Projects"]').first
    if not project_input.is_visible():
        project_input = page.locator('input[placeholder*="專案" i]').first
    if not project_input.is_visible():
        project_input = page.locator('input[aria-label*="Project" i]').first
    if not project_input.is_visible():
        project_input = page.locator(".connector-step-container input[type='text']").first

    project_input.wait_for(state="visible", timeout=10000)
    project_input.click()
    project_input.fill("b25h01-ragic")
    page.wait_for_timeout(500)
    project_input.press("Enter")
    page.wait_for_timeout(2000)

    # Try selecting the project text
    try:
        page.get_by_text("b25h01-ragic", exact=False).first.click(timeout=3000)
    except Exception:
        # Maybe "My Projects" needs expansion?
        # Or maybe hitting Enter already selected it?
        pass

    # Select Dataset (erp_backup)
    ds_item = page.get_by_text("erp_backup", exact=False).first
    ds_item.click(timeout=timeout_ms)

    # Wait for Table search to appear; retry dataset click if needed
    try:
        page.locator('input[placeholder="Search Tables"]').wait_for(state="visible", timeout=3000)
    except Exception:
        print("Table search not found, retrying dataset click...")
        ds_item.click()
        page.wait_for_timeout(1000)

    # Find table input (strictly the Table search box)
    try:
        table_input = page.locator('input[placeholder="Search Tables"]').first
        if not table_input.is_visible():
            # Try Chinese/Alternate placeholder
            table_input = page.locator(
                'input[placeholder*="表" i], input[placeholder*="Table" i]'
            ).first
    except:
        pass

    # Fallback to positional (3rd input)
    if not table_input.is_visible():
        table_input = page.locator("mat-form-field input").nth(2)
        table_input.wait_for(state="visible", timeout=3000)

    table_input.fill(view_table)
    page.wait_for_timeout(1500)

    # Select the table row
    page.get_by_text(view_table, exact=False).first.click(timeout=timeout_ms)

    # Add Button
    add_btn = page.locator('add-data-view footer button[aria-label="新增"]').first
    for _ in range(10):
        if add_btn.is_enabled():
            break
        page.wait_for_timeout(500)

    add_btn.click(timeout=timeout_ms)
    page.wait_for_timeout(4000)

    # Confirm Add to Report
    confirm = page.get_by_role("button", name=re.compile(r"新增至報表|ADD TO REPORT", re.I))
    if confirm.count() > 0:
        confirm.first.click()
        page.wait_for_timeout(4000)


def build_chart(page, plan, timeout_ms, snap_func, out_dir):
    try:
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    except Exception:
        pass

    # Click Add Chart
    add_chart = page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)).first
    add_chart.click(timeout=timeout_ms)
    page.wait_for_timeout(800)

    type_regex = _chart_picker_regex(plan.template_type, plan.chart_type)

    header = page.get_by_text(re.compile(type_regex, re.I)).first
    header.scroll_into_view_if_needed()
    box = header.bounding_box()
    if box:
        # Click slightly below header (icon area)
        page.mouse.click(box["x"] + 30, box["y"] + 60)
    else:
        # Fallback for 1.1 line if header fails
        if plan.chart_type == "line":
            page.mouse.click(520, 220)

    page.wait_for_timeout(800)

    # Dismiss overlay if open
    picker_probe = page.get_by_text(re.compile(r"^(表格|時間序列|Google 地圖)$", re.I)).first
    if picker_probe.is_visible():
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)

    # PLACE THE CHART on the canvas (grid placement, no cut/paste)
    print(f"Placing chart on canvas at ({plan.x_offset}, {plan.y_offset})")
    try:
        page.evaluate(f"window.scrollTo(0, {max(plan.y_offset - 120, 0)})")
        page.wait_for_timeout(400)
        page.mouse.click(plan.x_offset, plan.y_offset)
        page.wait_for_timeout(2000)  # Wait for creation
    except Exception as e:
        print(f"Error placing chart: {e}")

    # Properties Panel
    settings = page.get_by_text(re.compile(r"^設定$|^Setup$", re.I)).first
    if settings.count() > 0:
        try:
            settings.click(timeout=1000)
        except:
            pass

    # Scroll down properties
    panel_body = page.locator("ng2-legacy-side-panel .panel-body").first
    try:
        panel_body.evaluate("el => { el.scrollTop = 400 }")
    except:
        pass
    page.wait_for_timeout(500)

    side_panel = page.locator("ng2-legacy-side-panel").first

    # Replace Metric (Record Count)
    try:
        replaced = False
        rc_chip = (
            side_panel.locator(".cdk-drag.chip")
            .filter(has_text=re.compile(r"Record Count", re.I))
            .first
        )

        if rc_chip.count() > 0 and rc_chip.is_visible():
            if not plan.metric:
                print("No metric provided; skip metric replacement")
            else:
                print(f"Replacing Record Count with {plan.metric}")
            rc_chip.click()
            page.wait_for_timeout(500)
            # Select new metric from overlay
            overlay = page.locator(".cdk-overlay-pane").last
            if overlay.is_visible():
                # Search first
                search = overlay.locator(
                    'input[placeholder="Search"], input[placeholder="搜尋"]'
                ).first
                if search.is_visible() and plan.metric:
                    search.click(timeout=5000)
                    search.fill(plan.metric)
                    page.wait_for_timeout(2000)

                if plan.metric:
                    target = overlay.get_by_text(plan.metric, exact=True).first
                    if target.count() > 0:
                        target.click(timeout=5000)
                        replaced = True
                        page.wait_for_timeout(1000)
    except Exception as e:
        print(f"Warning: Failed to replace metric with {plan.metric}: {e}")
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        except:
            pass

    # If not replaced, add new metric
    if not replaced and plan.metric:
        try:
            print(f"Adding metric {plan.metric} manually")
            # Add Metric Button
            add_metric = page.get_by_text(re.compile(r"新增指標|Add metric", re.I)).first
            if add_metric.count() > 0:
                add_metric.click(timeout=5000)
                page.wait_for_timeout(500)
                overlay = page.locator(".cdk-overlay-pane").last

                # Search first
                search = overlay.locator(
                    'input[placeholder="Search"], input[placeholder="搜尋"]'
                ).first
                if search.is_visible() and plan.metric:
                    search.fill(plan.metric)
                    page.wait_for_timeout(1000)

                if plan.metric:
                    overlay.get_by_text(plan.metric, exact=True).first.click(timeout=5000)
                    page.wait_for_timeout(1000)
        except Exception as e:
            print(f"Warning: Failed to add metric {plan.metric} manually: {e}")
            try:
                page.keyboard.press("Escape")
                page.wait_for_timeout(500)
            except:
                pass

    # Dimension
    try:
        if plan.dimension:
            # Find current dimension chip (likely order_date)
            # Or "Add dimension"
            print(f"Setting dimension to {plan.dimension}")
            # Scroll up
            try:
                panel_body.evaluate("el => { el.scrollTop = 0 }")
            except:
                pass

            # Try replace 'order_date'
            date_chip = (
                side_panel.locator(".cdk-drag.chip")
                .filter(has_text=re.compile(r"order_date|Date|日期", re.I))
                .first
            )
            if date_chip.count() > 0:
                date_chip.click()
                page.wait_for_timeout(500)
                overlay = page.locator(".cdk-overlay-pane").last
                if plan.dimension:
                    overlay.get_by_text(plan.dimension, exact=True).first.click()
                    page.wait_for_timeout(1000)
    except Exception as e:
        print(f"Warning: Failed to set dimension {plan.dimension}: {e}")
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        except:
            pass

    # Insert chart title text (align with Looker naming)
    try:
        title_text = f"{plan.chart_id} | {plan.name}"
        title_btn = page.get_by_role("button", name=re.compile(r"文字|Text", re.I)).first
        if title_btn.count() > 0:
            title_btn.click(timeout=3000)
            page.mouse.click(plan.x_offset, max(plan.y_offset - 60, 80))
            page.keyboard.type(title_text)
            page.wait_for_timeout(300)
    except Exception:
        pass

    snap_func(page, f"chart_{plan.chart_id}_done")


if __name__ == "__main__":
    raise SystemExit(main())
