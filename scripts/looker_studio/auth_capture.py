#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> int:
    p = argparse.ArgumentParser(description="Capture Google login storage_state for Looker Studio")
    p.add_argument(
        "--url", required=True, help="Any Looker Studio URL (will open in a new browser)"
    )
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
        help="Where to save storage_state.json (gitignored)",
    )
    args = p.parse_args()

    state_path = Path(args.state).expanduser().resolve()
    state_path.parent.mkdir(parents=True, exist_ok=True)
    user_data_dir = Path(args.user_data_dir).expanduser().resolve()
    user_data_dir.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pwp:
        # Use installed Chrome + persistent profile to avoid Google blocks on automated Chromium.
        context = pwp.chromium.launch_persistent_context(
            user_data_dir=str(user_data_dir),
            channel=args.channel,
            headless=False,
            accept_downloads=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.new_page()
        page.goto(args.url, wait_until="domcontentloaded")

        print("\nLogin flow:")
        print("- Complete Google login in the opened browser window")
        print("- Ensure the Looker Studio page fully loads")
        print("- Then press Enter here to save storage_state")
        input("\nPress Enter to save storage_state...")

        context.storage_state(path=str(state_path))
        print(f"Saved: {state_path}")

        context.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
