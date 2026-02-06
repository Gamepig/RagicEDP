#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> int:
    p = argparse.ArgumentParser(description="Open a Looker Studio report and dump debug artifacts")
    p.add_argument("--url", required=True, help="Looker Studio report URL (non-/edit)")
    p.add_argument("--channel", default="chrome")
    p.add_argument("--user-data-dir", default="_local/looker_studio/chrome_profile")
    p.add_argument("--headless", action="store_true")
    p.add_argument("--out-dir", default="_local/looker_studio/debug")
    p.add_argument("--timeout-ms", type=int, default=30000)
    p.add_argument("--wait-ms", type=int, default=20000, help="Extra wait after DOM load")
    args = p.parse_args()

    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    user_data_dir = Path(args.user_data_dir).expanduser().resolve()

    with sync_playwright() as pwp:
        context = pwp.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            channel=args.channel,
            headless=args.headless,
            accept_downloads=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.new_page()
        page.goto(args.url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        page.wait_for_timeout(args.wait_ms)

        (out_dir / "title.txt").write_text(page.title(), encoding="utf-8")
        (out_dir / "url.txt").write_text(page.url, encoding="utf-8")
        page.screenshot(path=str(out_dir / "report.png"), full_page=True)

        # Small DOM excerpt for debugging selectors.
        html = page.content()
        (out_dir / "dom.html").write_text(html, encoding="utf-8")

        context.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
