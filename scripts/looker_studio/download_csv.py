#!/usr/bin/env python3

from __future__ import annotations

import argparse
import traceback
from pathlib import Path

import yaml
from playwright.sync_api import sync_playwright


def _load_yaml(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def main() -> int:
    p = argparse.ArgumentParser(description="Download chart data CSVs from Looker Studio")
    p.add_argument("--spec", required=True, help="Path to report_spec.yaml")
    p.add_argument(
        "--channel",
        default="chrome",
        help="Browser channel to use (recommended: chrome).",
    )
    p.add_argument(
        "--user-data-dir",
        default="_local/looker_studio/chrome_profile",
        help="Persistent profile directory (gitignored).",
    )
    p.add_argument(
        "--state",
        default="_local/looker_studio/storage_state.json",
        help="storage_state.json captured by auth_capture.py",
    )
    p.add_argument(
        "--headless",
        action="store_true",
        help="Run browser in headless mode (may not work for all Google flows)",
    )
    p.add_argument(
        "--timeout-ms",
        type=int,
        default=20000,
        help="Timeout for waiting on selectors/page load",
    )
    p.add_argument(
        "--debug-dir",
        default="_local/looker_studio/debug",
        help="Directory to write screenshots/traces/logs (gitignored)",
    )
    args = p.parse_args()

    spec_path = Path(args.spec).resolve()
    state_path = Path(args.state).expanduser().resolve()
    user_data_dir = Path(args.user_data_dir).expanduser().resolve()

    if not state_path.exists() and not user_data_dir.exists():
        raise SystemExit(
            f"Missing storage state: {state_path} and missing profile dir: {user_data_dir}. "
            "Run scripts/looker_studio/auth_capture.py first."
        )

    spec = _load_yaml(spec_path)
    report_url = (spec.get("report") or {}).get("url")
    if not report_url:
        raise SystemExit("spec.report.url is required")

    downloads = spec.get("downloads") or []
    if not isinstance(downloads, list) or not downloads:
        raise SystemExit("spec.downloads must be a non-empty list")

    debug_dir = Path(args.debug_dir).expanduser().resolve()
    debug_dir.mkdir(parents=True, exist_ok=True)
    log_path = debug_dir / "download_csv.log"

    def log(msg: str) -> None:
        print(msg)
        log_path.write_text(
            (log_path.read_text(encoding="utf-8") if log_path.exists() else "") + msg + "\n",
            encoding="utf-8",
        )

    failures = 0

    with sync_playwright() as pwp:
        # Prefer persistent Chrome profile; fallback to storage_state if profile doesn't exist.
        browser = None
        if user_data_dir.exists():
            context = pwp.chromium.launch_persistent_context(
                user_data_dir=str(user_data_dir),
                channel=args.channel,
                headless=args.headless,
                accept_downloads=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
        else:
            browser = pwp.chromium.launch(channel=args.channel, headless=args.headless)
            context = browser.new_context(storage_state=str(state_path), accept_downloads=True)
        page = context.new_page()
        log(f"Opening report: {report_url}")
        page.goto(report_url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        page.wait_for_timeout(3000)

        # Quick proof-of-life screenshot.
        try:
            page.screenshot(path=str(debug_dir / "report_loaded.png"), full_page=True)
        except Exception:
            pass

        for item in downloads:
            chart_id = str(item.get("id") or "").strip()
            name = str(item.get("name") or "").strip()
            selector = str(item.get("selector") or "").strip()
            output_csv = str(item.get("output_csv") or "").strip()
            if not chart_id or not selector or not output_csv:
                raise SystemExit("each downloads[] entry needs id, selector, output_csv")

            out_path = (
                (spec_path.parent / output_csv).resolve()
                if not Path(output_csv).is_absolute()
                else Path(output_csv)
            )
            out_path.parent.mkdir(parents=True, exist_ok=True)

            log(f"== {chart_id} {name}")
            try:
                box = page.locator(selector).first
                box.wait_for(state="visible", timeout=args.timeout_ms)
                box.scroll_into_view_if_needed(timeout=args.timeout_ms)
                box.click(button="right", timeout=args.timeout_ms)
                page.wait_for_timeout(800)
                log("ACTION REQUIRED: right-click menu opened. Manual download still needed.")
                log(f"Please download CSV and save as: {out_path}")
                input("Press Enter after download completes...")
            except Exception as e:
                failures += 1
                err = f"ERROR chart_id={chart_id}: {e}"
                log(err)
                log(traceback.format_exc())
                try:
                    page.screenshot(
                        path=str(debug_dir / f"{chart_id}_error.png"),
                        full_page=True,
                    )
                except Exception:
                    pass

        context.close()
        if browser is not None:
            browser.close()

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
