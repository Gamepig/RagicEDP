#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import dataclass
from pathlib import Path

import yaml
from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as ec
from selenium.webdriver.support.ui import WebDriverWait


@dataclass(frozen=True)
class ChartSpec:
    chart_id: str
    name: str
    template_type: str
    chart_type: str
    datasource: str
    dimension: str | None
    metric: str | None


def _extract_yaml_block(text: str) -> str:
    match = re.search(r"```yaml\n(.*?)\n```", text, re.S)
    if not match:
        raise ValueError("No YAML block found in chart specs markdown")
    return match.group(1)


def _load_specs(spec_md: Path) -> list[ChartSpec]:
    text = spec_md.read_text(encoding="utf-8")
    data = yaml.safe_load(_extract_yaml_block(text)) or {}
    specs: list[ChartSpec] = []
    for item in data.get("charts", []):
        datasource = str(item.get("datasource", "")).strip()
        if datasource.upper().startswith("SKIP_"):
            continue
        specs.append(
            ChartSpec(
                chart_id=str(item.get("id", "")).strip(),
                name=str(item.get("name", "")).strip(),
                template_type=str(item.get("template_type", "")).strip(),
                chart_type=str(item.get("chart_type", "")).strip(),
                datasource=datasource,
                dimension=item.get("dimension"),
                metric=item.get("metric"),
            )
        )
    return specs


def _stamp() -> str:
    return time.strftime("%Y%m%d-%H%M%S")


def _chart_menu_label(spec: ChartSpec) -> list[str]:
    ctype = spec.chart_type.lower()
    if "line" in ctype or "time" in ctype or "area" in ctype:
        return ["時間序列", "折線圖", "Time series", "Line"]
    if "bar" in ctype or "column" in ctype:
        return ["長條圖", "Bar", "Column"]
    if "pie" in ctype or "donut" in ctype:
        return ["圓餅圖", "Pie", "Donut"]
    if "table" in ctype or "matrix" in ctype or spec.template_type.upper() == "TBL":
        return ["表格", "Table", "Pivot"]
    if "heatmap" in ctype:
        return ["熱圖", "Heatmap"]
    if "scatter" in ctype:
        return ["散佈", "Scatter"]
    if "treemap" in ctype:
        return ["Treemap", "矩形樹"]
    if "map" in ctype:
        return ["地圖", "Map"]
    if "funnel" in ctype:
        return ["漏斗", "Funnel"]
    if "gauge" in ctype:
        return ["計分卡", "單一值", "Scorecard", "Single value"]
    return ["時間序列", "Time series"]


def _wait_visible(wait: WebDriverWait, by: str, value: str):
    return wait.until(ec.visibility_of_element_located((by, value)))


def _click_first_text(driver: webdriver.Chrome, labels: list[str], timeout: int = 20) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        for text in labels:
            # aria-label match
            aria_elems = driver.find_elements(
                By.XPATH, f"//*[@aria-label and contains(@aria-label, '{text}')]"
            )
            if aria_elems:
                try:
                    aria_elems[0].click()
                    return True
                except Exception:
                    pass
            elems = driver.find_elements(By.XPATH, f"//*[contains(text(), '{text}')]")
            if elems:
                try:
                    elems[0].click()
                    return True
                except Exception:
                    continue
        time.sleep(0.3)
    return False


def _align_chart_top_left(driver: webdriver.Chrome) -> None:
    Path("_local/looker_studio").mkdir(parents=True, exist_ok=True)
    # Open Arrange menu
    if _click_first_text(driver, ["排列", "Arrange"], timeout=5):
        time.sleep(0.5)
        _click_first_text(driver, ["對齊左側", "Align left"], timeout=3)
        time.sleep(0.3)
        _click_first_text(driver, ["對齊上方", "Align top"], timeout=3)
        time.sleep(0.3)
        driver.save_screenshot("_local/looker_studio/selenium_aligned.png")


def _create_new_page(driver: webdriver.Chrome, fallback_page_label: str | None = None) -> None:
    Path("_local/looker_studio").mkdir(parents=True, exist_ok=True)
    try_js = driver.execute_script(
        """
const target = ['新增頁面','Add page'];
const els = Array.from(document.querySelectorAll('button,[role="button"]'));
for (const el of els) {
  const t = (el.innerText || '').trim();
  if (!t) continue;
  if (target.some(x => t.includes(x))) { el.click(); return true; }
}
return false;
"""
    )
    if not try_js and not _click_first_text(driver, ["新增頁面", "Add page"], timeout=10):
        if fallback_page_label:
            picked = driver.execute_script(
                """
const label = arguments[0];
const els = Array.from(document.querySelectorAll('div,button,span'))
  .filter(el => (el.innerText || '').trim() === label);
for (const el of els) {
  const r = el.getBoundingClientRect();
  if (r.left < 200 && r.width < 120) { el.click(); return true; }
}
return false;
""",
                fallback_page_label,
            )
            if picked:
                driver.save_screenshot("_local/looker_studio/selenium_selected_page.png")
                return
        driver.save_screenshot("_local/looker_studio/selenium_add_page_not_found.png")
        raise RuntimeError("Add page button not found")
    time.sleep(1.5)
    driver.save_screenshot("_local/looker_studio/selenium_after_add_page.png")


def _dispatch_canvas_click(driver: webdriver.Chrome, dx: int = 80, dy: int = 120) -> bool:
    script = """
const dx = arguments[0];
const dy = arguments[1];
const candidates = [];
const selectors = [
  'canvas-layout',
  '.canvas-layout',
  '.report-canvas',
  '.canvas-container',
  '.report-page',
  '.main-content'
];
for (const sel of selectors) {
  document.querySelectorAll(sel).forEach(el => candidates.push(el));
}
// Fallback: consider any large element in viewport
document.querySelectorAll('div,section').forEach(el => {
  const r = el.getBoundingClientRect();
  if (r.width > 600 && r.height > 400) candidates.push(el);
});
let best = null;
let bestArea = 0;
for (const el of candidates) {
  const r = el.getBoundingClientRect();
  const area = r.width * r.height;
  if (r.width < 200 || r.height < 200) continue;
  if (area > bestArea) { best = el; bestArea = area; }
}
if (!best) return false;
const r = best.getBoundingClientRect();
const x = r.left + dx;
const y = r.top + dy;
best.dispatchEvent(new MouseEvent('mousedown', {clientX:x, clientY:y, bubbles:true}));
best.dispatchEvent(new MouseEvent('mouseup', {clientX:x, clientY:y, bubbles:true}));
best.dispatchEvent(new MouseEvent('click', {clientX:x, clientY:y, bubbles:true}));
return true;
"""
    return bool(driver.execute_script(script, dx, dy))


def _find_canvas_element(driver: webdriver.Chrome):
    selectors = [
        "canvas-layout",
        ".canvas-layout",
        ".report-canvas",
        ".canvas-container",
        ".report-page",
        ".main-content",
    ]
    candidates = []
    for sel in selectors:
        candidates.extend(driver.find_elements(By.CSS_SELECTOR, sel))
    if not candidates:
        candidates = driver.find_elements(By.CSS_SELECTOR, "div,section")

    best = None
    best_area = 0
    for el in candidates:
        try:
            rect = el.rect
            area = rect.get("width", 0) * rect.get("height", 0)
            if rect.get("width", 0) < 200 or rect.get("height", 0) < 200:
                continue
            if area > best_area:
                best = el
                best_area = area
        except Exception:
            continue
    return best


def _click_canvas(driver: webdriver.Chrome, dx: int = 80, dy: int = 120) -> None:
    if not _dispatch_canvas_click(driver, dx=dx, dy=dy):
        width = driver.execute_script("return window.innerWidth")
        x = max(80, min(width - 400, 120))
        y = 200
        driver.execute_script("document.elementFromPoint(arguments[0], arguments[1]).click()", x, y)


def _move_chart_with_keyboard(driver: webdriver.Chrome, target_x: int, target_y: int) -> None:
    # 1. Force move to top-left (Reset)
    # Assuming canvas is roughly 1200x900, 50 large steps (shift+arrow) covers ~500px
    # We do 100 steps to be safe.
    actions = ActionChains(driver)

    # Reset X (Left)
    for _ in range(5):
        actions.key_down(Keys.SHIFT).send_keys(Keys.ARROW_LEFT * 10).key_up(Keys.SHIFT)

    # Reset Y (Top)
    for _ in range(5):
        actions.key_down(Keys.SHIFT).send_keys(Keys.ARROW_UP * 10).key_up(Keys.SHIFT)

    actions.perform()
    time.sleep(0.5)

    # 2. Move to target position
    # Shift+Arrow = 10px (approx)
    # Arrow = 1px (approx)

    steps_x_large = target_x // 10
    steps_x_small = target_x % 10
    steps_y_large = target_y // 10
    steps_y_small = target_y % 10

    actions = ActionChains(driver)

    # Move X
    if steps_x_large > 0:
        for _ in range(steps_x_large):
            actions.key_down(Keys.SHIFT).send_keys(Keys.ARROW_RIGHT).key_up(Keys.SHIFT)
    if steps_x_small > 0:
        actions.send_keys(Keys.ARROW_RIGHT * steps_x_small)

    # Move Y
    if steps_y_large > 0:
        for _ in range(steps_y_large):
            actions.key_down(Keys.SHIFT).send_keys(Keys.ARROW_DOWN).key_up(Keys.SHIFT)
    if steps_y_small > 0:
        actions.send_keys(Keys.ARROW_DOWN * steps_y_small)

    actions.perform()


def main() -> int:
    p = argparse.ArgumentParser(description="Selenium chart builder (Loooker Studio)")
    p.add_argument("--report-edit-url", required=True)
    p.add_argument("--spec-md", default="docs/handoff/looker_studio_chart_specs.md")
    p.add_argument("--max-charts", type=int, default=0)
    p.add_argument("--user-data-dir", default="_local/looker_studio/chrome_profile")
    p.add_argument("--profile-directory", default=None)
    p.add_argument("--page-label", default="2")
    args = p.parse_args()

    specs = _load_specs(Path(args.spec_md))
    if args.max_charts > 0:
        specs = specs[: args.max_charts]

    options = Options()
    options.add_argument(f"--user-data-dir={Path(args.user_data_dir).resolve()}")
    if args.profile_directory:
        options.add_argument(f"--profile-directory={args.profile_directory}")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 30)

    driver.get(args.report_edit_url)
    time.sleep(6)

    _create_new_page(driver, fallback_page_label=args.page_label)
    _click_canvas(driver, dx=80, dy=120)

    for spec in specs:
        add_chart = _click_first_text(
            driver, ["新增圖表", "Add a chart", "新增圖表\u3000"], timeout=15
        )
        if not add_chart:
            Path("_local/looker_studio").mkdir(parents=True, exist_ok=True)
            driver.save_screenshot("_local/looker_studio/selenium_add_chart_not_found.png")
            print(f"[warn] add chart button not found for {spec.chart_id}")
            continue
        Path("_local/looker_studio").mkdir(parents=True, exist_ok=True)
        driver.save_screenshot(
            f"_local/looker_studio/selenium_after_add_chart_{spec.chart_id}_{_stamp()}.png"
        )

        if not _click_first_text(driver, _chart_menu_label(spec), timeout=20):
            print(f"[warn] chart menu item not found for {spec.chart_id}")
            continue
        driver.save_screenshot(
            f"_local/looker_studio/selenium_after_pick_chart_{spec.chart_id}_{_stamp()}.png"
        )

        # Place chart on canvas
        _click_canvas(driver, dx=80, dy=180)
        time.sleep(2)

        _move_chart_with_keyboard(driver, target_x=80, target_y=120)
        time.sleep(1)

        # Insert title as text box
        if _click_first_text(driver, ["文字", "Text"], timeout=10):
            _click_canvas(driver, dx=80, dy=80)
            time.sleep(0.3)
            driver.switch_to.active_element.send_keys(f"{spec.chart_id} | {spec.name}")
            time.sleep(0.3)

        # NOTE: Field binding (dimension/metric) requires stable selectors; handled in Playwright.
        # Selenium version is intentionally minimal for stability.

    time.sleep(2)
    driver.quit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
