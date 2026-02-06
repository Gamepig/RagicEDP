#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import sync_playwright


@dataclass
class ChartSpec:
    id: str
    name: str
    datasource: str
    chart_type: str  # scorecard, bar, area, gauge, column
    metrics: list[str]
    dimension: str | None = None
    breakdown_dimension: str | None = None


def js_click(locator):
    try:
        locator.first.evaluate("el => el.click()")
        return True
    except:
        return False


def _safe_click(locator, timeout_ms: int = 15000) -> None:
    locator.first.wait_for(state="visible", timeout=timeout_ms)
    locator.first.click(timeout=timeout_ms)


def _select_from_overlay(page, text: str, timeout_ms: int = 15000) -> bool:
    # Overlay is used for choosing dimensions/metrics/datasource.
    overlay = page.locator(".cdk-overlay-pane").last
    try:
        overlay.wait_for(state="visible", timeout=timeout_ms)
    except Exception:
        return False

    # Optional search
    try:
        search = overlay.locator(
            'input[placeholder*="Search" i], input[placeholder*="搜尋" i]'
        ).first
        if search.count() > 0 and search.is_visible():
            search.click(timeout=timeout_ms)
            search.fill(text)
            page.wait_for_timeout(800)
    except Exception:
        pass

    # Prefer exact match, then loose.
    try:
        exact = overlay.get_by_text(text, exact=True).first
        if exact.count() > 0:
            exact.click(timeout=timeout_ms)
            return True
    except Exception:
        pass

    try:
        loose = overlay.get_by_text(re.compile(re.escape(text), re.I), exact=False).first
        if loose.count() > 0:
            loose.click(timeout=timeout_ms)
            return True
    except Exception:
        pass

    return False


def _open_setup_tab(page) -> None:
    # Ensure "設定/Setup" tab is active.
    try:
        js_click(page.get_by_text(re.compile(r"^設定$|^Setup$", re.I)))
    except Exception:
        pass


def _configure_chart_fields(
    page, *, dimension: str | None, metric: str | None, breakdown: str | None
) -> None:
    if not metric and not dimension and not breakdown:
        return

    _open_setup_tab(page)

    side_panel = page.locator("ng2-legacy-side-panel").first
    panel_mode = "legacy"
    if side_panel.count() == 0:
        panel_mode = "modern"
        # Modern properties panel title often like "「長條圖」資源" or similar.
        title = page.get_by_text(re.compile(r"資源", re.I)).first
        title.wait_for(state="visible", timeout=5000)
        side_panel = title.locator("..")
        for _ in range(6):
            if side_panel.get_by_text(re.compile(r"^設定$|^Setup$", re.I)).count() > 0:
                break
            side_panel = side_panel.locator("..")

    # Metric: replace/remove Record Count, then add desired metric.
    if metric:
        replaced = False
        try:
            if panel_mode == "legacy":
                rc_chip = (
                    side_panel.locator(".cdk-drag.chip")
                    .filter(has_text=re.compile(r"Record Count", re.I))
                    .first
                )
                if rc_chip.count() > 0 and rc_chip.is_visible():
                    rc_chip.click(timeout=15000)
                    page.wait_for_timeout(500)
                    replaced = _select_from_overlay(page, metric)
                    page.wait_for_timeout(800)
            else:
                rc_field = side_panel.get_by_text(re.compile(r"^\s*Record Count\s*$", re.I)).first
                if rc_field.count() > 0 and rc_field.is_visible():
                    _safe_click(rc_field)
                    page.wait_for_timeout(500)
                    replaced = _select_from_overlay(page, metric)
                    page.wait_for_timeout(800)
        except Exception:
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass

        if not replaced:
            # Remove Record Count if possible
            try:
                if panel_mode == "legacy":
                    rc_x = (
                        side_panel.locator(".chip")
                        .filter(has_text=re.compile(r"Record Count", re.I))
                        .locator("mat-icon")
                        .first
                    )
                    if rc_x.count() > 0 and rc_x.is_visible():
                        rc_x.click(force=True)
                        page.wait_for_timeout(500)
            except Exception:
                pass

            # Add metric
            add_metric = page.get_by_text(re.compile(r"新增指標|Add metric", re.I)).first
            if add_metric.count() > 0:
                add_metric.click(timeout=15000)
                page.wait_for_timeout(500)
                _select_from_overlay(page, metric)
                page.wait_for_timeout(800)

    # Dimension
    if dimension:
        dim_ok = False
        try:
            if panel_mode == "legacy":
                dim_ok = (
                    side_panel.locator(".cdk-drag.chip")
                    .filter(has_text=re.compile(rf"\b{re.escape(dimension)}\b", re.I))
                    .count()
                    > 0
                )
            else:
                dim_ok = (
                    side_panel.get_by_text(re.compile(rf"\b{re.escape(dimension)}\b", re.I)).count()
                    > 0
                )
        except Exception:
            dim_ok = False

        if not dim_ok:
            add_dim = page.get_by_text(re.compile(r"新增維度|Add dimension", re.I)).first
            if add_dim.count() > 0:
                add_dim.click(timeout=15000)
                page.wait_for_timeout(500)
                _select_from_overlay(page, dimension)
                page.wait_for_timeout(800)

    # Breakdown (optional)
    if breakdown:
        add_breakdown = page.get_by_text(re.compile(r"細分維度|Breakdown dimension", re.I)).first
        if add_breakdown.count() > 0:
            add_breakdown.click(timeout=15000)
            page.wait_for_timeout(500)
            _select_from_overlay(page, breakdown)
            page.wait_for_timeout(800)


def _try_rename_current_page(page, new_name: str) -> None:
    # Best-effort: open Manage pages and rename current/last page.
    try:
        js_click(page.get_by_role("button", name=re.compile(r"管理頁面|Manage pages", re.I)))
        page.wait_for_timeout(1200)

        items = page.locator("page-list-item")
        if items.count() > 0:
            # Prefer selected page, then fall back to last page.
            target = page.locator("page-list-item[aria-selected='true']").first
            if target.count() == 0:
                target = items.nth(items.count() - 1)
            menu_trigger = target.locator("button[aria-label*='更多']").first
            if menu_trigger.count() == 0:
                menu_trigger = (
                    target.locator("button").filter(has_text=re.compile(r"更多|More", re.I)).first
                )
            if menu_trigger.count() > 0:
                menu_trigger.click()
                page.wait_for_timeout(600)
                page.get_by_text(re.compile(r"重新命名|Rename", re.I)).first.click()
                page.wait_for_timeout(400)
                page.keyboard.insert_text(new_name)
                page.keyboard.press("Enter")
                page.wait_for_timeout(800)

        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
    except Exception:
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass


def _insert_page_title(page, title_text: str) -> None:
    try:
        _safe_click(page.get_by_role("button", name=re.compile(r"文字|Text", re.I)))
        page.wait_for_timeout(300)
        page.mouse.move(80, 190)
        page.mouse.down()
        page.mouse.move(760, 240)
        page.mouse.up()
        page.wait_for_timeout(200)
        page.keyboard.insert_text(title_text)
        page.wait_for_timeout(200)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
    except Exception:
        pass


def _copy_seed_chart(page, seed_edit_url: str) -> None:
    # Use an existing known-good chart (Chart01) as a seed.
    # This avoids flakiness in the "Add a chart" picker UI.
    page.goto(seed_edit_url, timeout=120000)
    page.wait_for_timeout(8000)
    _modal_sweep(page)
    _ensure_edit_mode(page)
    page.wait_for_timeout(800)

    # Try a few safe points to select the existing chart.
    for x, y in [(360, 420), (520, 520), (600, 520), (420, 360)]:
        try:
            page.mouse.click(x, y)
            page.wait_for_timeout(800)
            if _wait_chart_selected(page, timeout_ms=4000):
                page.keyboard.press("Control+c")
                page.wait_for_timeout(600)
                return
        except Exception:
            pass

    raise RuntimeError("Seed chart copy failed (could not select chart on seed page)")


def _build_linking_create_url(
    *,
    template_report_id: str,
    report_name: str,
    project_id: str,
    dataset_id: str,
    table_id: str,
) -> str:
    # Create a temporary report instance from a template report id, with ds0 bound to a BigQuery
    # TABLE (can be a view). This avoids the flaky BigQuery picker UI in the editor.
    # Note: This URL produces a /reporting/create?... link (not persistent). That's OK for
    # clipboard-only use. We do NOT click "Edit and share".
    return (
        # Use explicit auth user segment to avoid account mismatch redirects.
        "https://lookerstudio.google.com/u/0/reporting/create"
        f"?c.reportId={quote(template_report_id)}"
        "&c.mode=edit"
        "&c.explain=true"
        f"&r.reportName={quote(report_name)}"
        "&ds.ds0.connector=bigQuery"
        "&ds.ds0.type=TABLE"
        f"&ds.ds0.projectId={quote(project_id)}"
        f"&ds.ds0.datasetId={quote(dataset_id)}"
        f"&ds.ds0.tableId={quote(table_id)}"
        "&ds.ds0.refreshFields=true"
    )


def _copy_chart_from_linking_create_url(
    page,
    *,
    create_url: str,
    expect_table_id: str,
) -> None:
    # Open create URL and copy the single chart on the page.
    # The copied chart should carry its datasource into the target report on paste.
    page.goto(create_url, timeout=120000)
    page.wait_for_timeout(12000)

    def _handle_access_prompt() -> None:
        # Create URLs often show a credentials/access dialog with buttons like "確認".
        # We must accept it before the editor canvas loads.
        buttons = [
            re.compile(r"^確認$|^Confirm$", re.I),
            re.compile(r"^繼續$|^Continue$", re.I),
            re.compile(r"^同意$|^Agree$", re.I),
            re.compile(r"允許|Allow|授權|Authorize", re.I),
        ]
        for _ in range(5):
            clicked = False
            for rx in buttons:
                try:
                    b = page.get_by_role("button", name=rx).first
                    if b.count() > 0 and b.is_visible():
                        b.click(timeout=30000)
                        page.wait_for_timeout(3000)
                        clicked = True
                        break
                except Exception:
                    continue
            if not clicked:
                break

    _handle_access_prompt()
    _ensure_edit_mode(page)

    # If a prompt still exists, try again.
    _handle_access_prompt()

    # Wait for editor chrome to be present.
    try:
        page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)).first.wait_for(
            state="visible", timeout=30000
        )
    except Exception:
        pass

    # Debug: capture the create-url report state.
    try:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", expect_table_id)[:120]
        page.screenshot(path=f"_local/looker_studio/create_url_{safe}.png", full_page=True)
    except Exception:
        pass

    # Best-effort: if the page shows the BigQuery datasource name text, it's loaded.
    # Otherwise it may still be loading; wait a bit.
    try:
        if page.get_by_text(expect_table_id, exact=False).count() == 0:
            page.wait_for_timeout(5000)
    except Exception:
        pass

    # Select chart by clicking common canvas points, then copy.
    for x, y in [(360, 420), (520, 520), (600, 520), (420, 360), (680, 520)]:
        try:
            page.mouse.click(x, y)
            page.wait_for_timeout(900)
            if _wait_chart_selected(page, timeout_ms=5000):
                try:
                    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", expect_table_id)[:120]
                    page.screenshot(
                        path=f"_local/looker_studio/create_url_{safe}_chart_selected.png",
                        full_page=True,
                    )
                except Exception:
                    pass
                page.keyboard.press("Control+c")
                page.wait_for_timeout(800)
                return
        except Exception:
            pass

    raise RuntimeError("Failed to select/copy chart from create URL report")


def _paste_seed_chart_on_canvas(page) -> None:
    # Paste at a safe canvas location and ensure the pasted chart becomes selected.
    placements = [(320, 320), (420, 360), (520, 420)]
    for x, y in placements:
        try:
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_timeout(300)
            page.mouse.click(x, y)
            page.wait_for_timeout(200)
            page.keyboard.press("Control+v")
            page.wait_for_timeout(2500)

            # Click again inside the pasted area to force selection.
            page.mouse.click(x + 10, y + 10)
            page.wait_for_timeout(800)

            if _wait_chart_selected(page, timeout_ms=12000):
                return

            try:
                page.screenshot(
                    path="_local/looker_studio/paste_debug_last.png",
                    full_page=True,
                )
            except Exception:
                pass
        except Exception:
            pass

    try:
        page.screenshot(path="_local/looker_studio/paste_failed.png", full_page=True)
    except Exception:
        pass
    raise RuntimeError("Seed chart paste failed (chart not selected / properties not visible)")


def _snap(page, path: str) -> None:
    try:
        page.screenshot(path=path, full_page=True)
    except Exception:
        pass


def _modal_sweep(page) -> None:
    for _ in range(3):
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
        except Exception:
            pass


def _ensure_edit_mode(page) -> None:
    # If we landed in view mode, click the "編輯" button.
    try:
        if page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)).count() > 0:
            return
    except Exception:
        pass

    try:
        edit_btn = page.get_by_role("button", name=re.compile(r"編輯|Edit", re.I)).first
        if edit_btn.count() > 0 and edit_btn.is_visible():
            edit_btn.click(timeout=15000)
            page.wait_for_timeout(2000)
    except Exception:
        pass


def _wait_chart_selected(page, timeout_ms: int = 15000) -> bool:
    # A chart must be *selected*; many UI signals (e.g. Setup tab) exist even with nothing
    # selected. We gate on chart-only properties like field chips / Add metric.
    deadline = time.time() + (timeout_ms / 1000.0)
    while time.time() < deadline:
        try:
            sp = page.locator("ng2-legacy-side-panel").first
            if sp.count() > 0 and sp.is_visible():
                if sp.locator(".cdk-drag.chip, .chip").count() > 0:
                    return True
                if sp.get_by_text(re.compile(r"新增指標|Add metric", re.I)).count() > 0:
                    return True
                if sp.get_by_text(re.compile(r"新增維度|Add dimension", re.I)).count() > 0:
                    return True
        except Exception:
            pass

        # Global fallback: if any field/datasource chip is visible anywhere, we treat it as selected.
        try:
            chips = page.locator(".cdk-drag.chip, .chip")
            if chips.count() > 0:
                try:
                    if chips.first.is_visible():
                        return True
                except Exception:
                    return True
        except Exception:
            pass

        try:
            if page.get_by_text(re.compile(r"資料來源|Data source", re.I)).count() > 0:
                return True
        except Exception:
            pass

        # Modern properties panel variants (best-effort)
        try:
            if page.get_by_text(re.compile(r"新增指標|Add metric", re.I)).count() > 0:
                return True
        except Exception:
            pass

        page.wait_for_timeout(300)

    return False


def _insert_chart_on_canvas(page, chart_type: str) -> None:
    # Click-through strategy derived from build_charts.py: click chart type thumbnail
    # then drop the chart on canvas via a safe click.
    type_regex = r"長條|Bar"
    if chart_type == "scorecard":
        type_regex = r"計分卡|Scorecard"
    elif chart_type == "area":
        type_regex = r"時間序列|Time series"
    elif chart_type == "gauge":
        type_regex = r"量錶|Gauge"
    elif chart_type == "column":
        type_regex = r"長條|Bar"

    # Open chart picker
    try:
        _safe_click(page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)))
    except Exception:
        js_click(page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)))
    page.wait_for_timeout(800)

    # Click the thumbnail/icon area for the desired chart type
    header = page.get_by_text(re.compile(type_regex, re.I)).first
    header.scroll_into_view_if_needed()
    box = None
    try:
        box = header.bounding_box()
    except Exception:
        box = None

    if box:
        page.mouse.click(box["x"] + 30, box["y"] + 60)
    else:
        # Fallback: click the text label itself
        try:
            _safe_click(header)
        except Exception:
            js_click(header)

    page.wait_for_timeout(800)

    # Place chart on canvas.
    # First try a click placement; then a drag placement as fallback.
    placements = [
        ("click", (300, 300, 0, 0)),
        ("click", (420, 360, 0, 0)),
        ("drag", (140, 240, 980, 780)),
    ]

    for kind, (x1, y1, x2, y2) in placements:
        try:
            if kind == "click":
                page.evaluate("window.scrollTo(0, 0)")
                page.wait_for_timeout(300)
                page.mouse.click(x1, y1)
            else:
                page.mouse.move(x1, y1)
                page.mouse.down()
                page.mouse.move(x2, y2)
                page.mouse.up()

            page.wait_for_timeout(2500)

            # Re-click inside the placed chart region to force selection.
            try:
                page.mouse.click(x1 + 10, y1 + 10)
                page.wait_for_timeout(800)
            except Exception:
                pass

            if _wait_chart_selected(page, timeout_ms=15000):
                return
        except Exception:
            pass

    raise RuntimeError("Chart placement failed (chart not selected / properties not visible)")


def _add_bq_datasource_if_missing(page, view_table: str) -> None:
    # NOTE: Avoid using a global "page has text" heuristic here.
    # The BigQuery picker itself contains the view_table string, which can create false positives.

    add_data = page.locator("report-editing-tools").get_by_role(
        "button", name=re.compile(r"新增資料|Add data", re.I)
    )
    if add_data.count() == 0:
        add_data = page.locator("footer").get_by_role(
            "button", name=re.compile(r"新增資料|Add data", re.I)
        )

    add_data.first.wait_for(state="visible", timeout=30000)
    add_data.first.click(timeout=30000)
    page.wait_for_timeout(2000)

    bq_tile = page.get_by_text(re.compile(r"^BigQuery$", re.I), exact=True)
    if bq_tile.count() == 0:
        search = page.locator('input[placeholder*="搜尋" i], input[placeholder*="Search" i]').first
        if search.count() > 0 and search.is_visible():
            search.fill("BigQuery")
            page.wait_for_timeout(600)
        bq_tile = page.get_by_text("BigQuery", exact=False)

    bq_tile.first.click(timeout=30000)
    page.wait_for_timeout(2500)

    cfg = page.locator("ng2-bigquery-config").first
    cfg.wait_for(state="visible", timeout=30000)

    def _click_views_tab_best_effort() -> None:
        # Some variants expose tables/views toggles; ignore if absent.
        candidates = [re.compile(r"^Views$|^VIEWS$|檢視表|視圖", re.I)]
        for rx in candidates:
            try:
                btn = cfg.get_by_role("tab", name=rx).first
                if btn.count() == 0:
                    btn = cfg.get_by_role("button", name=rx).first
                if btn.count() == 0:
                    btn = cfg.get_by_text(rx).first
                if btn.count() > 0 and btn.is_visible():
                    btn.click(timeout=3000)
                    page.wait_for_timeout(600)
                    return
            except Exception:
                continue

    # Project selection.
    proj_col = cfg.locator("ng2-config-column").first
    # Some environments show a manual Project ID input; fill it but still click the list row.
    try:
        manual_project = cfg.locator(
            'input[placeholder="Enter Project Id manually"], input[aria-label="Enter Project Id manually"]'
        ).first
        if manual_project.count() > 0 and manual_project.is_visible():
            manual_project.click(timeout=5000)
            manual_project.fill("b25h01-ragic")
            page.wait_for_timeout(300)
            try:
                manual_project.press("Enter")
            except Exception:
                page.keyboard.press("Enter")
            page.wait_for_timeout(1200)
    except Exception:
        pass

    picked_project = False
    for _ in range(2):
        try:
            item = proj_col.locator("ng2-config-column-item a[href*='project=b25h01-ragic']").first
            if item.count() > 0:
                row = item.locator("xpath=ancestor::ng2-config-column-item").first
                row.locator(".list-option").first.click(timeout=30000)
                page.wait_for_timeout(1200)
                picked_project = True
                break
        except Exception:
            pass

        # Fallback: click by display name shown in this account.
        try:
            proj_col.get_by_text(re.compile(r"^Ragic-SSOT-HA70$", re.I)).first.click(timeout=30000)
            page.wait_for_timeout(1200)
            picked_project = True
            break
        except Exception:
            pass

    # Dataset selection.
    ds_col = cfg.locator("ng2-config-column").nth(1)
    ds_search = ds_col.locator(
        'input[placeholder="Search Datasets"], input[placeholder*="Datasets" i]'
    ).first
    try:
        if ds_search.count() > 0 and ds_search.is_visible():
            ds_search.click(timeout=5000)
            ds_search.fill("erp_backup")
            page.wait_for_timeout(800)
    except Exception:
        pass

    ds_row = (
        ds_col.locator("ng2-config-column-item")
        .filter(has_text=re.compile(r"\berp_backup\b", re.I))
        .first
    )
    if ds_row.count() == 0:
        # Fail early with a useful artifact: dataset list didn't populate.
        try:
            page.screenshot(path="_local/looker_studio/add_data_no_dataset.png", full_page=True)
        except Exception:
            pass
        raise RuntimeError("Dataset erp_backup not found in BigQuery connector")

    # Dataset click is flaky; try a couple strategies to make it stick.
    clicked = False
    for _ in range(3):
        try:
            opt = ds_row.locator(".list-option").first
            if opt.count() > 0:
                opt.click(timeout=30000)
            else:
                ds_row.click(timeout=30000)
            page.wait_for_timeout(600)
            try:
                ds_row.dblclick(timeout=3000)
            except Exception:
                pass
            page.wait_for_timeout(600)
            clicked = True
            break
        except Exception:
            page.wait_for_timeout(400)

    if not clicked:
        raise RuntimeError("Failed to click dataset erp_backup")

    # Wait for the 3rd column (tables) to appear after selecting dataset.
    deadline = time.time() + 20
    while time.time() < deadline:
        if cfg.locator("ng2-config-column").count() >= 3:
            break
        page.wait_for_timeout(300)

    # Table/View selection column.
    table_col = cfg.locator("ng2-config-column").nth(2)
    _click_views_tab_best_effort()

    table_input = table_col.locator(
        'input[placeholder="Search Tables"], input[placeholder="搜尋"], input[placeholder*="Search" i], '
        'input[placeholder*="Tables" i], input[placeholder*="表" i]'
    ).first
    if table_input.count() > 0 and table_input.is_visible():
        table_input.click(timeout=5000)
        table_input.fill(view_table)
        try:
            table_input.press("Enter")
        except Exception:
            pass
        page.wait_for_timeout(1500)
    else:
        # Some UIs show the table list without a search box.
        page.wait_for_timeout(800)

    # After filtering, require the target view/table to appear in the table column.
    table_item = (
        table_col.locator("ng2-config-column-item")
        .filter(has_text=re.compile(re.escape(view_table), re.I))
        .first
    )
    if table_item.count() == 0:
        try:
            safe = re.sub(r"[^A-Za-z0-9._-]+", "_", view_table)[:120]
            page.screenshot(
                path=f"_local/looker_studio/add_data_{safe}_no_table_match.png",
                full_page=True,
            )
        except Exception:
            pass
        raise RuntimeError(f"Table/view {view_table} not found in BigQuery table list")

    try:
        table_item.locator(".list-option").first.click(timeout=30000)
    except Exception:
        table_item.click(timeout=30000)
    page.wait_for_timeout(800)

    # Some variants require keyboard selection from the (filtered) list.
    try:
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(200)
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(200)
        page.keyboard.press("Enter")
        page.wait_for_timeout(600)
    except Exception:
        pass

    # Select the table/view row.
    # In many UI variants, clicking the text is not enough; you need to click the row/checkbox.
    row = (
        page.locator(
            "add-data-view mat-row, add-data-view .mat-row, add-data-view .mat-mdc-row, "
            "add-data-view [role='option'], mat-row, .mat-row, .mat-mdc-row, [role='option']"
        )
        .filter(has_text=re.compile(re.escape(view_table), re.I))
        .first
    )
    try:
        if row.count() > 0:
            row.scroll_into_view_if_needed()
            row.click(timeout=30000)
            page.wait_for_timeout(400)
            cb = row.locator("mat-checkbox, [role='checkbox']").first
            if cb.count() > 0:
                cb.click(force=True)
                page.wait_for_timeout(400)
        else:
            # Fallback: click by text, then try clicking ancestors to toggle selection.
            text_el = page.get_by_text(view_table, exact=False).first
            if text_el.count() > 0:
                text_el.scroll_into_view_if_needed()
                try:
                    text_el.click(timeout=30000)
                except Exception:
                    js_click(text_el)
                page.wait_for_timeout(500)

                parent = text_el
                for _ in range(5):
                    try:
                        parent = parent.locator("..")
                        if parent.count() == 0:
                            break
                        parent.click(timeout=2000)
                        page.wait_for_timeout(300)
                    except Exception:
                        break
    except Exception:
        pass

    # Add Button (scope to add-data-view footer first)
    add_btn = (
        page.locator("add-data-view footer")
        .get_by_role("button", name=re.compile(r"新增|Add", re.I))
        .first
    )
    if add_btn.count() == 0:
        add_btn = page.get_by_role("button", name=re.compile(r"新增|Add", re.I)).first

    # If the footer role/name lookup is flaky, fall back to footer buttons by text.
    if add_btn.count() == 0:
        add_btn = (
            page.locator("add-data-view footer button")
            .filter(has_text=re.compile(r"新增|Add", re.I))
            .first
        )

    for _ in range(20):
        try:
            if add_btn.is_enabled():
                break
        except Exception:
            break
        page.wait_for_timeout(500)

    # If still disabled, try re-selecting the table row once.
    try:
        if not add_btn.is_enabled():
            if row.count() > 0:
                row.click(timeout=3000)
                try:
                    row.dblclick(timeout=3000)
                except Exception:
                    pass
            else:
                try:
                    page.get_by_text(view_table, exact=True).first.click(timeout=3000)
                except Exception:
                    page.get_by_text(view_table, exact=False).first.click(timeout=3000)
            page.wait_for_timeout(800)
    except Exception:
        pass

    # If still disabled, try keyboard selection patterns.
    try:
        if not add_btn.is_enabled():
            try:
                page.keyboard.press("Enter")
            except Exception:
                pass
            try:
                page.keyboard.press("Space")
            except Exception:
                pass
            page.wait_for_timeout(800)
    except Exception:
        pass

    for _ in range(10):
        try:
            if add_btn.is_enabled():
                break
        except Exception:
            break
        page.wait_for_timeout(500)

    try:
        if not add_btn.is_enabled():
            # Provide minimal state for debugging.
            try:
                try:
                    page.screenshot(
                        path=f"_local/looker_studio/add_data_{view_table}_disabled.png",
                        full_page=True,
                    )
                except Exception:
                    pass

                try:
                    from pathlib import Path

                    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", view_table)[:120]
                    Path(f"_local/looker_studio/add_data_{safe}_disabled.html").write_text(
                        page.content(), encoding="utf-8"
                    )
                except Exception:
                    pass

                selected = page.locator(
                    "add-data-view [aria-selected='true'], add-data-view .selected, "
                    "add-data-view .mdc-list-item--selected"
                )
                text_matches = 0
                try:
                    text_matches = page.get_by_text(view_table, exact=False).count()
                except Exception:
                    text_matches = 0
                print(
                    "[debug] BigQuery add disabled",
                    {
                        "view_table": view_table,
                        "row_matches": row.count() if row else 0,
                        "selected_matches": selected.count(),
                        "text_matches": text_matches,
                    },
                )
            except Exception:
                pass
            raise RuntimeError("BigQuery add button stayed disabled after selecting table")
    except Exception:
        raise
    add_btn.click(timeout=30000)
    page.wait_for_timeout(2000)

    try:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", view_table)[:120]
        page.screenshot(
            path=f"_local/looker_studio/add_data_{safe}_after_add_click.png",
            full_page=True,
        )
    except Exception:
        pass

    # Confirm Add to Report (some flows have a second step, some close immediately)
    for _ in range(6):
        try:
            confirm = page.get_by_role(
                "button", name=re.compile(r"新增.*報表|ADD TO REPORT|Add to report", re.I)
            ).first
            if confirm.count() > 0 and confirm.is_visible():
                confirm.click(timeout=30000)
                page.wait_for_timeout(2000)
                break
        except Exception:
            pass

        # If dialog closed, we're done.
        try:
            if page.locator("add-data-view").count() == 0:
                break
        except Exception:
            pass

        # Some UIs require clicking Add twice.
        try:
            if add_btn.is_visible() and add_btn.is_enabled():
                add_btn.click(timeout=3000)
        except Exception:
            pass
        page.wait_for_timeout(1500)

    # Wait for dialog to close (best-effort)
    for _ in range(6):
        try:
            adv = page.locator("add-data-view").first
            if adv.count() == 0:
                return
            if not adv.is_visible():
                return
        except Exception:
            pass

        # Try close via Escape or Cancel
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
        try:
            cancel = page.get_by_role(
                "button", name=re.compile(r"取消|Cancel|關閉|Close", re.I)
            ).first
            if cancel.count() > 0 and cancel.is_visible():
                cancel.click(timeout=3000)
        except Exception:
            pass
        page.wait_for_timeout(1200)

    # Still open; capture and fail so we don't paste under a modal.
    try:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "_", view_table)[:120]
        page.screenshot(
            path=f"_local/looker_studio/add_data_{safe}_did_not_close.png",
            full_page=True,
        )
    except Exception:
        pass
    raise RuntimeError("Add data dialog did not close")


def _select_chart_datasource(page, view_table: str) -> None:
    # Prefer clicking the explicit datasource value next to "資料來源" to open the datasource picker.
    try:
        label = page.get_by_text(re.compile(r"資料來源|Data source", re.I)).first
        if label.count() > 0 and label.is_visible():
            candidate = label.locator(
                "xpath=following::*[contains(normalize-space(.), 'ls_v_')][1]"
            ).first
            if candidate.count() > 0 and candidate.is_visible():
                candidate.click(timeout=15000)
                page.wait_for_timeout(800)
                if _select_from_overlay(page, view_table, timeout_ms=15000):
                    page.wait_for_timeout(1200)
                    return
                try:
                    page.keyboard.press("Escape")
                except Exception:
                    pass
    except Exception:
        pass

    # Fallback: click a "chip" element (varies across legacy/modern UI).
    side_panel = page.locator("ng2-legacy-side-panel").first
    root = side_panel if side_panel.count() > 0 else page

    chips = root.locator(".cdk-drag.chip, .chip, mat-chip, mat-chip-row, .mat-mdc-chip, .mat-chip")
    if chips.count() == 0 and root is not page:
        root = page
        chips = root.locator(
            ".cdk-drag.chip, .chip, mat-chip, mat-chip-row, .mat-mdc-chip, .mat-chip"
        )
    if chips.count() == 0:
        raise RuntimeError("No datasource control found")

    # If the current datasource chip already contains the target view_table, no-op.
    try:
        for i in range(min(10, chips.count())):
            txt = chips.nth(i).inner_text(timeout=1000)
            if txt and re.search(re.escape(view_table), txt, re.I):
                return
    except Exception:
        pass

    max_try = min(10, chips.count())
    for i in range(max_try):
        try:
            chips.nth(i).click(timeout=15000)
            page.wait_for_timeout(600)

            overlay = page.locator(".cdk-overlay-pane").last
            if overlay.count() == 0:
                continue

            # Debug artifact: capture overlay state.
            try:
                safe = re.sub(r"[^A-Za-z0-9._-]+", "_", view_table)[:120]
                page.screenshot(
                    path=f"_local/looker_studio/ds_overlay_{safe}_try{i + 1}.png",
                    full_page=True,
                )
            except Exception:
                pass

            # If this overlay is clearly a field picker (e.g. "維度 - X 軸"), skip.
            try:
                if (
                    overlay.get_by_text(
                        re.compile(r"維度\s*-\s*X\s*軸|Dimension\s*-\s*X", re.I)
                    ).count()
                    > 0
                ):
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(300)
                    continue
            except Exception:
                pass

            if _select_from_overlay(page, view_table, timeout_ms=15000):
                page.wait_for_timeout(1200)
                return

            # Not the datasource picker, or datasource not present.
            try:
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            except Exception:
                pass
        except Exception:
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
            continue

    raise RuntimeError(f"Could not select datasource {view_table} from overlay")


def main() -> int:
    p = argparse.ArgumentParser(description="Build Aesthetic Standalone Charts")
    p.add_argument("--report-edit-url", required=True)
    p.add_argument("--channel", default="chrome")
    p.add_argument("--user-data-dir", default="_local/looker_studio/chrome_profile")
    p.add_argument("--headless", action="store_true")
    p.add_argument(
        "--only-chart-id",
        default=None,
        help="Only build a single chart id (e.g. 02) for debugging",
    )
    p.add_argument(
        "--add-missing-datasources",
        action="store_true",
        help=(
            "Try to add BigQuery datasources via UI when missing. "
            "Default is to assume datasources are already present in the report "
            "(recommended; the BigQuery picker UI is flaky)."
        ),
    )
    p.add_argument(
        "--datasource-add-mode",
        default="ui",
        choices=["ui", "create"],
        help=(
            "How to add missing datasources: 'ui' uses Add data -> BigQuery picker; "
            "'create' uses Linking API create URLs (does not import datasource via copy/paste reliably)."
        ),
    )
    p.add_argument(
        "--template-report-id",
        default=None,
        help=(
            "Template reportId used to generate Linking API create URLs. "
            "If omitted, we derive it from --report-edit-url (recommended, since it is accessible)."
        ),
    )
    p.add_argument(
        "--linking-project-id",
        default="b25h01-ragic",
        help="BigQuery projectId for ds0 in create URL",
    )
    p.add_argument(
        "--linking-dataset-id",
        default="erp_backup",
        help="BigQuery datasetId for ds0 in create URL",
    )
    p.add_argument(
        "--urls-path",
        default="_local/looker_studio/official_pages_urls.txt",
        help="Append created page URLs here (tab-separated)",
    )
    args = p.parse_args()

    template_report_id = args.template_report_id
    if not template_report_id:
        m = re.search(r"/reporting/([a-f0-9-]{20,})/", args.report_edit_url, re.I)
        if not m:
            raise SystemExit("Could not derive template reportId from --report-edit-url")
        template_report_id = m.group(1)

    # Build pages into an existing report.
    # Keep this list small and validated; expand after each gate passes.
    specs = [
        ChartSpec(
            id="02",
            name="昨日銷售 Top 10 品牌",
            datasource="ls_v_02_top_10_brands_yesterday",
            chart_type="bar",
            dimension="brand_name",
            metrics=["revenue"],
        ),
        ChartSpec(
            id="03",
            name="月度營收累積曲線",
            datasource="ls_v_03_monthly_revenue_accumulation",
            chart_type="area",
            dimension="order_date",
            metrics=["cumulative_revenue"],
        ),
        ChartSpec(
            id="04",
            name="全通路 ROAS 總覽",
            datasource="ls_v_04_omnichannel_roas_overview",
            chart_type="gauge",
            dimension=None,
            metrics=["roas"],
        ),
        ChartSpec(
            id="05",
            name="通路貢獻度趨勢",
            datasource="ls_v_05_channel_contribution_trend",
            chart_type="column",
            dimension="order_date",
            breakdown_dimension=None,
            metrics=["order_count"],
        ),
    ]

    with sync_playwright() as pwp:
        context = pwp.chromium.launch_persistent_context(
            user_data_dir=args.user_data_dir,
            channel=args.channel,
            headless=args.headless,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        page.goto(args.report_edit_url, timeout=120000)
        page.wait_for_timeout(10000)

        # Prepare clipboard with an existing known-good chart from the seed page.
        # If later steps fail due to clipboard loss, we can re-copy.
        _copy_seed_chart(page, args.report_edit_url)

        out_dir = Path("_local/looker_studio")
        out_dir.mkdir(parents=True, exist_ok=True)
        urls_path = Path(args.urls_path)
        urls_path.parent.mkdir(parents=True, exist_ok=True)

        existing_ids: set[str] = set()
        url_map: dict[str, str] = {}
        try:
            if urls_path.exists():
                for line in urls_path.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    parts = line.split("\t")
                    chart_id = parts[0].strip()
                    existing_ids.add(chart_id)
                    if len(parts) >= 3:
                        url_map[chart_id] = parts[-1].strip()
        except Exception:
            existing_ids = set()
            url_map = {}

        for spec in specs:
            if args.only_chart_id and spec.id != args.only_chart_id:
                continue
            if spec.id in existing_ids:
                print(f"Skipping {spec.id}: already in {urls_path}")
                # Still allow rerun if the page exists but chart insertion previously failed.
                # We'll operate on the known pageId URL (if present).
                pass

            print(f"--- Building {spec.id}: {spec.name} ---")
            page.keyboard.press("Escape")

            try:
                target_url = url_map.get(spec.id)
                if target_url:
                    print(f"Opening existing page URL: {target_url}")
                    page.goto(target_url, timeout=120000)
                    page.wait_for_timeout(8000)
                    _modal_sweep(page)
                    _ensure_edit_mode(page)
                    page.wait_for_timeout(800)

                    page_title = f"{spec.id} | {spec.name}"
                    _try_rename_current_page(page, page_title)
                    _insert_page_title(page, page_title)

                    print(f"Adding chart on existing page {spec.id}...")
                    if args.add_missing_datasources:
                        if args.datasource_add_mode == "ui":
                            _add_bq_datasource_if_missing(page, spec.datasource)
                            # Now place a chart instance to bind.
                            try:
                                _paste_seed_chart_on_canvas(page)
                            except Exception:
                                # Clipboard can be lost after modal flows; re-copy seed and retry.
                                _copy_seed_chart(page, args.report_edit_url)
                                page.goto(target_url, timeout=120000)
                                page.wait_for_timeout(8000)
                                _modal_sweep(page)
                                _ensure_edit_mode(page)
                                _paste_seed_chart_on_canvas(page)
                        else:
                            create_url = _build_linking_create_url(
                                template_report_id=template_report_id,
                                report_name=f"TMP | {spec.id} | {spec.name}",
                                project_id=args.linking_project_id,
                                dataset_id=args.linking_dataset_id,
                                table_id=spec.datasource,
                            )
                            _copy_chart_from_linking_create_url(
                                page,
                                create_url=create_url,
                                expect_table_id=spec.datasource,
                            )
                            page.goto(target_url, timeout=120000)
                            page.wait_for_timeout(8000)
                            _modal_sweep(page)
                            _ensure_edit_mode(page)
                            _paste_seed_chart_on_canvas(page)
                    else:
                        # Fallback: paste seed chart (requires datasource already present).
                        try:
                            _paste_seed_chart_on_canvas(page)
                        except Exception:
                            _copy_seed_chart(page, args.report_edit_url)
                            page.goto(target_url, timeout=120000)
                            page.wait_for_timeout(8000)
                            _modal_sweep(page)
                            _ensure_edit_mode(page)
                            _paste_seed_chart_on_canvas(page)

                    _snap(page, f"_local/looker_studio/chart_{spec.id}_after_paste.png")

                    print(f"Ensuring report has datasource {spec.datasource}...")
                    if args.add_missing_datasources:
                        print(f"Datasource ensured via mode={args.datasource_add_mode}")
                    else:
                        print("Skipping datasource creation; expecting datasource already present")

                    # Sanity check: datasource should now be visible somewhere.
                    try:
                        if page.get_by_text(spec.datasource, exact=False).count() == 0:
                            page.screenshot(
                                path=f"_local/looker_studio/datasource_{spec.id}_not_visible.png",
                                full_page=True,
                            )
                    except Exception:
                        pass

                    print(f"Linking chart datasource to {spec.datasource}...")
                    _select_chart_datasource(page, spec.datasource)

                    # Configure fields (also forces a stronger "chart is selected" signal).
                    metric = spec.metrics[0] if spec.metrics else None
                    _configure_chart_fields(
                        page,
                        dimension=spec.dimension,
                        metric=metric,
                        breakdown=spec.breakdown_dimension,
                    )

                else:
                    print("Adding page...")
                    try:
                        page.keyboard.press("Control+m")
                    except Exception:
                        pass
                    page.wait_for_timeout(1200)

                    if not js_click(page.get_by_text(re.compile(r"新增頁面|Add page", re.I))):
                        js_click(page.locator('button[aria-label="管理頁面"]'))
                        page.wait_for_timeout(1000)
                        js_click(page.get_by_text("新增頁面"))

                    page.wait_for_timeout(5000)
                    _modal_sweep(page)
                    _ensure_edit_mode(page)

                    page_title = f"{spec.id} | {spec.name}"
                    _try_rename_current_page(page, page_title)
                    _insert_page_title(page, page_title)

                    print(f"Adding chart on new page {spec.id}...")
                    if args.add_missing_datasources:
                        if args.datasource_add_mode == "ui":
                            _add_bq_datasource_if_missing(page, spec.datasource)
                            try:
                                _paste_seed_chart_on_canvas(page)
                            except Exception:
                                _copy_seed_chart(page, args.report_edit_url)
                                _paste_seed_chart_on_canvas(page)
                        else:
                            create_url = _build_linking_create_url(
                                template_report_id=template_report_id,
                                report_name=f"TMP | {spec.id} | {spec.name}",
                                project_id=args.linking_project_id,
                                dataset_id=args.linking_dataset_id,
                                table_id=spec.datasource,
                            )
                            _copy_chart_from_linking_create_url(
                                page,
                                create_url=create_url,
                                expect_table_id=spec.datasource,
                            )
                            page.keyboard.press("Escape")
                            page.wait_for_timeout(600)
                            _paste_seed_chart_on_canvas(page)
                    else:
                        try:
                            _paste_seed_chart_on_canvas(page)
                        except Exception:
                            _copy_seed_chart(page, args.report_edit_url)
                            _paste_seed_chart_on_canvas(page)

                    _snap(page, f"_local/looker_studio/chart_{spec.id}_after_paste.png")

                    print(f"Ensuring report has datasource {spec.datasource}...")
                    if args.add_missing_datasources:
                        print(f"Datasource ensured via mode={args.datasource_add_mode}")
                    else:
                        print("Skipping datasource creation; expecting datasource already present")

                    try:
                        if page.get_by_text(spec.datasource, exact=False).count() == 0:
                            page.screenshot(
                                path=f"_local/looker_studio/datasource_{spec.id}_not_visible.png",
                                full_page=True,
                            )
                    except Exception:
                        pass

                    print(f"Linking chart datasource to {spec.datasource}...")
                    _select_chart_datasource(page, spec.datasource)

                    metric = spec.metrics[0] if spec.metrics else None
                    _configure_chart_fields(
                        page,
                        dimension=spec.dimension,
                        metric=metric,
                        breakdown=spec.breakdown_dimension,
                    )

                    try:
                        with urls_path.open("a", encoding="utf-8") as f:
                            f.write(f"{spec.id}\t{spec.name}\t{page.url}\n")
                    except Exception:
                        pass
            except Exception as e:
                print(f"[error] Failed pre-config for {spec.id}: {e}")
                try:
                    page.screenshot(
                        path=f"_local/looker_studio/chart_{spec.id}_error.png", full_page=True
                    )
                except Exception:
                    pass
                continue

        context.close()
    return 0


if __name__ == "__main__":
    main()
