#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


def main() -> int:
    p = argparse.ArgumentParser(
        description="Search Looker Studio reports and print matching report URLs"
    )
    p.add_argument("--query", required=True, help="Search text, e.g. Ragic-SSOT-HA70")
    p.add_argument("--channel", default="chrome")
    p.add_argument("--user-data-dir", default="_local/looker_studio/chrome_profile")
    p.add_argument("--headless", action="store_true")
    p.add_argument("--timeout-ms", type=int, default=30000)
    p.add_argument("--out-dir", default="_local/looker_studio/debug")
    args = p.parse_args()

    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    user_data_dir = Path(args.user_data_dir).expanduser().resolve()

    url = "https://lookerstudio.google.com/u/0/navigation/reporting"
    results: list[dict[str, str]] = []

    with sync_playwright() as pwp:
        context = pwp.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            channel=args.channel,
            headless=args.headless,
            accept_downloads=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        page.wait_for_timeout(3000)

        # Try to focus the search box and type.
        typed = False
        candidates = [
            page.locator('input[type="search"]').first,
            page.locator(
                'input[aria-label*="Search"], input[aria-label*="搜尋"], input[aria-label*="搜索"]'
            ).first,
            page.get_by_role("textbox").first,
        ]
        for c in candidates:
            try:
                c.wait_for(state="visible", timeout=5000)
                c.click(timeout=2000)
                c.fill(args.query, timeout=2000)
                typed = True
                break
            except Exception:
                continue

        if not typed:
            page.screenshot(path=str(out_dir / "search_reports_no_searchbox.png"), full_page=True)
            context.close()
            raise SystemExit("Could not find search box on Looker Studio home")

        page.wait_for_timeout(4000)

        # Collect report links.
        links = page.locator('a[href*="/reporting/"]').all()
        for a in links:
            try:
                href = a.get_attribute("href")
                if not href:
                    continue
                # Title text often in descendant.
                text = a.inner_text().strip()
                if not text:
                    # Try aria-label.
                    text = (a.get_attribute("aria-label") or "").strip()
                if not text:
                    continue
                full = href if href.startswith("http") else "https://lookerstudio.google.com" + href
                results.append({"title": text.splitlines()[0][:200], "url": full})
            except PlaywrightTimeoutError:
                continue
            except Exception:
                continue

        # Deduplicate by url.
        seen: set[str] = set()
        uniq: list[dict[str, str]] = []
        for r in results:
            if r["url"] in seen:
                continue
            seen.add(r["url"])
            uniq.append(r)

        (out_dir / "search_reports.png").write_bytes(page.screenshot(full_page=True))
        (out_dir / "search_results.json").write_text(
            json.dumps({"query": args.query, "results": uniq}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        for r in uniq[:20]:
            print(f"- {r['title']}: {r['url']}")
        if len(uniq) > 20:
            print(f"(and {len(uniq) - 20} more)")

        context.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
