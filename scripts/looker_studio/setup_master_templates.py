#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import time
from pathlib import Path
from dataclasses import dataclass

from playwright.sync_api import sync_playwright


@dataclass
class MasterPagePlan:
    name: str
    datasource: str
    chart_type: str  # ts, bar, pie, kpi
    topic_field: str = "topic_name"


def _now_tag() -> str:
    return time.strftime("%Y%m%d-%H%M%S")


def _safe_filename(s: str) -> str:
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s.strip())
    return s[:120] or "x"


def force_click(page, locator_or_selector, timeout=10000):
    """Robust click using standard, force, then JS approach."""
    try:
        if isinstance(locator_or_selector, str):
            loc = page.locator(locator_or_selector).first
        else:
            loc = locator_or_selector

        # Try standard click first
        try:
            loc.click(timeout=timeout)
            return
        except:
            pass

        # Try force click (bypasses interceptors like backdrops)
        try:
            loc.click(force=True, timeout=timeout)
            return
        except:
            pass

        # JS click fallback (last resort)
        loc.evaluate("el => el.click()")
    except Exception as e:
        print(f"Force click failed: {e}")


def main() -> int:
    p = argparse.ArgumentParser(
        description="Setup 4 Master Pages for Looker Studio Hybrid Strategy"
    )
    p.add_argument(
        "--report-edit-url",
        required=True,
        help="Looker Studio report edit URL",
    )
    p.add_argument("--channel", default="chrome")
    p.add_argument("--user-data-dir", default="_local/looker_studio/chrome_profile")
    p.add_argument("--headless", action="store_true")
    p.add_argument("--timeout-ms", type=int, default=300000)
    p.add_argument("--out-dir", default="_local/looker_studio/master_setup_debug")
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

    plans = [
        # MasterPagePlan("趨勢分析模板(TS)", "ls_u_ts_poc", "ts"),
        # MasterPagePlan("排名分析模板(BAR)", "ls_u_bar_poc", "bar"),
        MasterPagePlan("佔比分析模板(PIE)", "ls_u_pie_poc", "pie"),
        MasterPagePlan("關鍵指標模板(KPI)", "ls_u_kpi_poc", "kpi"),
    ]

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
        page.wait_for_timeout(10000)
        snap(page, "opened")

        for i, plan in enumerate(plans):
            log(f"--- Setting up Page {i + 1}: {plan.name} ---")

            # Dismiss any open menus
            page.keyboard.press("Escape")
            page.wait_for_timeout(1000)

            # 1. Add Page
            log("Adding new page...")
            try:
                # Try Toolbar "Add Page" text/button first
                add_page_btn = page.get_by_text(re.compile(r"新增頁面|Add page", re.I)).first
                if add_page_btn.count() > 0:
                    force_click(page, add_page_btn)
                else:
                    # Try Page Menu
                    page_menu = page.get_by_role(
                        "button", name=re.compile(r"頁面|Page", re.I)
                    ).first
                    force_click(page, page_menu)
                    page.wait_for_timeout(1000)
                    new_p = page.get_by_text(re.compile(r"新增頁面|New page", re.I)).first
                    force_click(page, new_p)

                page.wait_for_timeout(5000)  # Wait for page load
            except Exception as e:
                log(f"Warning: Failed to add page: {e}")

            # 2. Add Data Source
            log(f"Ensuring datasource: {plan.datasource}")
            try:
                ensure_datasource(page, plan.datasource, args.timeout_ms, log)
            except Exception as e:
                log(f"Failed to ensure datasource {plan.datasource}: {e}")

            # 3. Add Filter Control
            log(f"Adding Filter Control for {plan.topic_field}...")
            try:
                page.keyboard.press("Escape")
                page.wait_for_timeout(1000)
                add_c = page.get_by_role(
                    "button", name=re.compile(r"新增控制項|Add a control", re.I)
                ).first
                force_click(page, add_c)
                page.wait_for_timeout(1000)
                dropdown = page.get_by_text(re.compile(r"下拉式選單|Drop-down list", re.I)).first
                force_click(page, dropdown)
                page.wait_for_timeout(1000)
                page.mouse.click(100, 100)  # Place at top left
                page.wait_for_timeout(3000)

                # Config field
                side_panel = page.locator("ng2-legacy-side-panel").first
                # Look for ANY chip that can be clicked to change field
                chip = side_panel.locator(".cdk-drag.chip").first
                if chip.count() > 0:
                    force_click(page, chip)
                    page.wait_for_timeout(1500)
                    overlay = page.locator(".cdk-overlay-pane").last
                    search = overlay.locator(
                        'input[placeholder*="Search" i], input[placeholder*="搜尋" i]'
                    ).first
                    if search.is_visible():
                        search.fill(plan.topic_field)
                        page.wait_for_timeout(1500)
                    target_field = overlay.get_by_text(plan.topic_field, exact=True).first
                    force_click(page, target_field)
                    log("Set filter field.")
            except Exception as e:
                log(f"Warning: Failed to setup filter control: {e}")

            # 4. Add Main Chart
            log(f"Adding Main Chart ({plan.chart_type})...")
            try:
                page.keyboard.press("Escape")
                page.wait_for_timeout(1000)
                add_ch = page.get_by_role(
                    "button", name=re.compile(r"新增圖表|Add a chart", re.I)
                ).first
                force_click(page, add_ch)
                page.wait_for_timeout(1500)

                type_map = {
                    "ts": r"時間序列|Time series",
                    "bar": r"長條|Bar",
                    "pie": r"圓餅|Pie",
                    "kpi": r"計分卡|Scorecard",
                }

                header = page.get_by_text(re.compile(type_map[plan.chart_type], re.I)).first
                box = header.bounding_box()
                if box:
                    page.mouse.click(box["x"] + 30, box["y"] + 60)
                else:
                    # Fallback click for TS icon area if header fails
                    page.mouse.click(500, 200)

                page.wait_for_timeout(1000)
                page.mouse.click(400, 400)  # Center
                page.wait_for_timeout(3000)
                log("Chart added.")
            except Exception as e:
                log(f"Warning: Failed to add chart: {e}")

            snap(page, f"page_{i + 1}_final")
            log(f"Completed Page {i + 1}")

        context.close()
    return 0


def ensure_datasource(page, view_table, timeout_ms, log_func):
    # Quick check if already present in field list
    if page.get_by_text(view_table, exact=False).count() > 0:
        log_func(f"Datasource {view_table} already present.")
        return

    log_func(f"Connecting new datasource: {view_table}")
    add_data = page.get_by_role("button", name=re.compile(r"新增資料|Add data", re.I)).first
    force_click(page, add_data)
    page.wait_for_timeout(3000)

    # BigQuery
    bq = page.get_by_text(re.compile(r"^BigQuery$", re.I), exact=True).first
    force_click(page, bq)
    page.wait_for_timeout(5000)

    # Project search
    project_input = page.locator(
        'input[placeholder*="Project" i], input[placeholder*="專案" i]'
    ).first
    project_input.fill("b25h01-ragic")
    page.wait_for_timeout(1000)
    project_input.press("Enter")
    page.wait_for_timeout(3000)

    # Dataset
    ds = page.get_by_text("erp_backup", exact=False).first
    force_click(page, ds)
    page.wait_for_timeout(2000)

    # Table search
    table_input = page.locator('input[placeholder*="Table" i], input[placeholder*="表" i]').first
    table_input.fill(view_table)
    page.wait_for_timeout(2000)
    target_table = page.get_by_text(view_table, exact=False).first
    force_click(page, target_table)
    page.wait_for_timeout(2000)

    # Add Button
    add_btn = page.locator(
        'add-data-view footer button[aria-label*="新增" i], add-data-view footer button[aria-label*="Add" i]'
    ).first
    force_click(page, add_btn)
    page.wait_for_timeout(5000)

    # Confirm
    confirm = page.get_by_role("button", name=re.compile(r"新增至報表|ADD TO REPORT", re.I))
    if confirm.count() > 0:
        force_click(page, confirm.first)
        page.wait_for_timeout(5000)


if __name__ == "__main__":
    raise SystemExit(main())
