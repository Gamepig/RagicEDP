#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


def _now_tag() -> str:
    return time.strftime("%Y%m%d-%H%M%S")


def _safe_filename(s: str) -> str:
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s.strip())
    return s[:120] or "x"


def main() -> int:
    p = argparse.ArgumentParser(description="Add a Filter Control to Looker Studio Report")
    p.add_argument(
        "--report-edit-url",
        required=True,
        help="Looker Studio report edit URL",
    )
    p.add_argument("--channel", default="chrome")
    p.add_argument("--user-data-dir", default="_local/looker_studio/chrome_profile")
    p.add_argument("--headless", action="store_true")
    p.add_argument("--timeout-ms", type=int, default=60000)
    p.add_argument("--out-dir", default="_local/looker_studio/control_debug")
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

        # Initial cleanup (close any overlays)
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        except Exception:
            pass

        # 1. Add Control
        log("Adding Filter Control (Drop-down list)...")
        try:
            # Click "Add a control"
            add_control = page.get_by_role(
                "button", name=re.compile(r"新增控制項|Add a control", re.I)
            ).first
            add_control.click(timeout=5000)
            page.wait_for_timeout(1000)

            # Select "Drop-down list"
            dropdown = page.get_by_text(re.compile(r"下拉式選單|Drop-down list", re.I)).first
            dropdown.click(timeout=5000)
            page.wait_for_timeout(1000)

            # Place it on canvas (Top Left)
            page.mouse.click(100, 50)
            page.wait_for_timeout(2000)
            snap(page, "control_placed")

        except Exception as e:
            log(f"Failed to add control: {e}")
            snap(page, "fail_add_control")
            return 1

        # 2. Configure Control Field to "brand_name"
        log("Configuring Control Field to 'brand_name'...")
        try:
            # Check Property Panel
            settings = page.get_by_text(re.compile(r"^設定$|^Setup$", re.I)).first
            if settings.count() > 0:
                try:
                    settings.click(timeout=1000)
                except:
                    pass

            side_panel = page.locator("ng2-legacy-side-panel").first

            # The control field chip usually defaults to something (e.g. order_date)
            # We need to find the "Control field" or "Dimension" chip area.
            # In controls, it's often called "Control field".

            # Try to click the first chip in the Setup panel
            first_chip = side_panel.locator(".cdk-drag.chip").first
            if first_chip.count() > 0:
                first_chip.click(timeout=3000)
                page.wait_for_timeout(1000)

                # Search overlay
                overlay = page.locator(".cdk-overlay-pane").last
                search = overlay.locator(
                    'input[placeholder="Search"], input[placeholder="搜尋"]'
                ).first
                if search.is_visible():
                    search.fill("brand_name")
                    page.wait_for_timeout(1000)

                # Click 'brand_name'
                target = overlay.get_by_text("brand_name", exact=True).first
                if target.count() > 0:
                    target.click(timeout=3000)
                    log("Set control field to brand_name")
                else:
                    log("Warning: 'brand_name' not found in picker")
                    snap(page, "brand_name_not_found")

        except Exception as e:
            log(f"Failed to configure control: {e}")
            snap(page, "fail_config_control")

        page.wait_for_timeout(2000)
        snap(page, "final_state")
        context.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
