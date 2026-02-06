#!/usr/bin/env python3

from __future__ import annotations

import re
import time
import urllib.parse
from pathlib import Path

from playwright.sync_api import BrowserContext, Page, sync_playwright


REPORT_NAME = "01 | 本月每日銷售趨勢"
TABLE_ID = "ls_v_01_daily_revenue_poc"
EXPECTED_METRIC = "revenue"
EXPECTED_DIMENSION = "order_date"

# Debug only. Keep false for normal runs.
DEBUG_EXPLAIN = False

OUT_DIR = Path("_local/looker_studio")
OUT_DIR.mkdir(parents=True, exist_ok=True)


_PERSISTENT_REPORT_URL_RE = re.compile(
    r"^https://lookerstudio\\.google\\.com/reporting/(?!create\\b)[^/?#]+/page/[^/?#]+",
    re.I,
)


def _is_persistent_report_url(url: str) -> bool:
    return bool(_PERSISTENT_REPORT_URL_RE.match(url))


def _wait_for_url_contains(page: Page, needle: str, timeout_ms: int) -> None:
    start = time.time()
    while True:
        if needle in page.url:
            return
        if (time.time() - start) * 1000 > timeout_ms:
            raise TimeoutError(f"Timed out waiting for url to contain {needle!r}; url={page.url}")
        page.wait_for_timeout(500)


def _wait_for_persistent_url(page: Page, timeout_ms: int) -> bool:
    start = time.time()
    while True:
        if _is_persistent_report_url(page.url):
            return True
        if (time.time() - start) * 1000 > timeout_ms:
            return False
        page.wait_for_timeout(500)


def _switch_to_newest_page(ctx: BrowserContext, pages_before: list[Page]) -> Page | None:
    try:
        pages_after = list(ctx.pages)
        new_pages = [p for p in pages_after if p not in pages_before]
        if new_pages:
            return new_pages[-1]
    except Exception:
        return None
    return None


def _try_make_copy_via_file_menu(page: Page, timeout_ms: int, tag: str) -> bool:
    """Best-effort: File/檔案 -> Make a copy/製作副本.

    Returns True if we *might* have triggered persistence. Caller must gate on URL.
    """

    print(f"[persist] {tag} try file->make copy")

    file_re = re.compile(r"^檔案$|^File$", re.I)
    make_copy_re = re.compile(r"製作副本|建立副本|Make a copy|Make copy|Copy report", re.I)

    file_triggers = [
        page.get_by_role("button", name=file_re).first,
        page.get_by_role("menuitem", name=file_re).first,
    ]

    file_trigger = None
    for cand in file_triggers:
        try:
            if cand.count() > 0 and cand.is_visible():
                file_trigger = cand
                break
        except Exception:
            continue

    if file_trigger is None:
        print(f"[persist] {tag} file trigger not found")
        return False

    _safe_click(page, file_trigger, timeout_ms=timeout_ms, label="menu_file")
    page.wait_for_timeout(500)
    _snap(page, f"persist_{tag}_file_menu_clicked", full_page=True)

    make_copy = None

    role_candidates = [
        page.get_by_role("menuitem", name=make_copy_re).first,
        page.get_by_role("menuitemcheckbox", name=make_copy_re).first,
        page.get_by_role("menuitemradio", name=make_copy_re).first,
    ]
    for cand in role_candidates:
        try:
            if cand.count() > 0 and cand.is_visible():
                make_copy = cand
                break
        except Exception:
            continue

    if make_copy is None:
        menu_roots = [
            page.locator(".cdk-overlay-container"),
            page.locator('[role="menu"]'),
        ]

        for root in menu_roots:
            try:
                item = root.get_by_role("menuitem", name=make_copy_re).first
                if item.count() > 0 and item.is_visible():
                    make_copy = item
                    break
            except Exception:
                continue

    if make_copy is None:
        try:
            item = page.get_by_text(make_copy_re).first
            if item.count() > 0 and item.is_visible():
                make_copy = item
        except Exception:
            pass

    if make_copy is None:
        print(f"[persist] {tag} make-copy menu item not found")
        return False

    _safe_click(page, make_copy, timeout_ms=timeout_ms, label="menu_make_copy")
    page.wait_for_timeout(1200)
    _snap(page, f"persist_{tag}_make_copy_clicked", full_page=True)

    _modal_sweep(page, timeout_ms=4000, rounds=12)
    return True


def _try_make_copy_via_overflow_menu(page: Page, timeout_ms: int, tag: str) -> bool:
    """Best-effort: overflow/three-dot menu -> Make a copy."""

    print(f"[persist] {tag} try overflow->make copy")

    overflow_re = re.compile(
        r"更多|More( options)?|Other actions|更多選項|更多動作|選項|Options",
        re.I,
    )
    make_copy_re = re.compile(r"製作副本|建立副本|Make a copy|Make copy|Copy report", re.I)

    overflow_btn = page.get_by_role("button", name=overflow_re).first
    try:
        if overflow_btn.count() == 0 or not overflow_btn.is_visible():
            print(f"[persist] {tag} overflow button not found")
            return False
    except Exception:
        return False

    _safe_click(page, overflow_btn, timeout_ms=timeout_ms, label="menu_overflow")
    page.wait_for_timeout(500)
    _snap(page, f"persist_{tag}_overflow_clicked", full_page=True)

    make_copy = None
    role_candidates = [
        page.get_by_role("menuitem", name=make_copy_re).first,
        page.get_by_role("menuitemcheckbox", name=make_copy_re).first,
        page.get_by_role("menuitemradio", name=make_copy_re).first,
    ]
    for cand in role_candidates:
        try:
            if cand.count() > 0 and cand.is_visible():
                make_copy = cand
                break
        except Exception:
            continue

    if make_copy is None:
        menu_roots = [
            page.locator(".cdk-overlay-container"),
            page.locator('[role="menu"]'),
        ]

        for root in menu_roots:
            try:
                item = root.get_by_role("menuitem", name=make_copy_re).first
                if item.count() > 0 and item.is_visible():
                    make_copy = item
                    break
            except Exception:
                continue

    if make_copy is None:
        try:
            item = page.get_by_text(make_copy_re).first
            if item.count() > 0 and item.is_visible():
                make_copy = item
        except Exception:
            pass

    if make_copy is None:
        print(f"[persist] {tag} overflow make-copy menu item not found")
        return False

    _safe_click(page, make_copy, timeout_ms=timeout_ms, label="menu_overflow_make_copy")
    page.wait_for_timeout(1200)
    _snap(page, f"persist_{tag}_overflow_make_copy_clicked", full_page=True)
    _modal_sweep(page, timeout_ms=4000, rounds=12)
    return True


def _complete_make_copy_dialog(page: Page, timeout_ms: int) -> bool:
    """Complete the 'Make a copy' dialog if present.

    Returns True if it found a matching dialog and clicked a primary action.
    """

    make_copy_re = re.compile(r"製作副本|建立副本|Make a copy|Copy report", re.I)
    primary_re = re.compile(r"製作副本|建立副本|Make a copy|Create|建立|確定|OK|複製報表", re.I)

    roots = [
        page.get_by_role("dialog"),
        page.locator("mat-dialog-container"),
        page.locator("mat-mdc-dialog-container"),
        page.locator(".cdk-overlay-pane"),
    ]

    for root in roots:
        try:
            dlg = root.filter(has_text=make_copy_re).first
            if dlg.count() == 0 or not dlg.is_visible():
                continue

            # If a name textbox exists and is empty, fill it.
            try:
                tb = dlg.get_by_role("textbox").first
                if tb.count() > 0 and tb.is_visible():
                    current = (tb.input_value() or "").strip()
                    if not current:
                        tb.fill(REPORT_NAME)
                        page.wait_for_timeout(200)
            except Exception:
                pass

            btn = dlg.get_by_role("button", name=primary_re).first
            if btn.count() > 0 and btn.is_visible():
                _safe_click(page, btn, timeout_ms=timeout_ms, label="make_copy_confirm")
                page.wait_for_timeout(1200)
                _modal_sweep(page, timeout_ms=4000, rounds=12)
                return True
        except Exception:
            continue

    return False


def _complete_copy_report_datasource_mapping_dialog(page: Page, timeout_ms: int) -> bool:
    """Handle the 'Copy this report' dialog that asks to map data sources.

    Observed zh dialog text:
    - title: 複製這份報表
    - prompt: 請選取要加進新報表的資料來源。
    - columns: 原資料來源 / 新資料來源
    - primary action: 複製報表
    """

    title_re = re.compile(r"複製這份報表|Copy this report", re.I)
    mapping_hint_re = re.compile(r"原資料來源|新資料來源|資料來源", re.I)
    copy_btn_re = re.compile(r"^複製報表$|^Copy report$", re.I)

    # The container is sometimes not exposed as role=dialog; search multiple roots.
    roots = [
        page.get_by_role("dialog"),
        page.locator("mat-dialog-container"),
        page.locator("mat-mdc-dialog-container"),
        page.locator(".cdk-overlay-pane"),
        page.locator(".cdk-overlay-container"),
    ]

    dlg = None
    start = time.time()
    while True:
        for root in roots:
            try:
                cand = root.filter(has_text=title_re).first
                if cand.count() > 0 and cand.is_visible():
                    dlg = cand
                    break
            except Exception:
                pass
        if dlg is None:
            for root in roots:
                try:
                    cand = root.filter(has_text=mapping_hint_re).first
                    if cand.count() > 0 and cand.is_visible():
                        dlg = cand
                        break
                except Exception:
                    pass

        if dlg is not None:
            break
        if (time.time() - start) * 1000 > timeout_ms:
            return False
        page.wait_for_timeout(300)

    print("[persist] copy-report datasource mapping dialog detected")
    _snap(page, "persist_copy_report_dialog_detected", full_page=True)

    # Choose the most likely new datasource option.
    # Prefer the canonical table id name if it appears; otherwise fallback to a stable substring.
    preferred_values = [
        TABLE_ID,
        "daily_revenue_poc",
        "revenue_poc",
    ]

    def _pick_option_from_overlay() -> bool:
        for val in preferred_values:
            try:
                if _select_from_overlay(page, val, timeout_ms=timeout_ms):
                    return True
            except Exception:
                continue
        return False

    # Try all combobox/select-like controls inside the dialog and fill them.
    combos: list = []
    buttons: list = []
    try:
        combos = dlg.get_by_role("combobox").all()
    except Exception:
        combos = []
    try:
        buttons = dlg.get_by_role("button").all()
    except Exception:
        buttons = []

    # Fallback: mat-select / aria-haspopup listbox.
    if not combos:
        try:
            combos = dlg.locator("mat-select, [role='combobox'], [aria-haspopup='listbox']").all()
        except Exception:
            combos = []

    filled_any = False

    # Prefer combobox first.
    for combo in combos[:6]:
        try:
            if not combo.is_visible():
                continue
            _safe_click(page, combo, timeout_ms=timeout_ms, label="ds_map_combo")
            page.wait_for_timeout(400)
            if _pick_option_from_overlay():
                filled_any = True
                page.wait_for_timeout(300)
        except Exception:
            continue

    # Some variants render the selector as a button rather than combobox.
    if not filled_any:
        for btn in buttons[:20]:
            try:
                if not btn.is_visible():
                    continue
                txt = (btn.text_content() or "").strip()
                if not txt:
                    continue
                # Skip obvious non-select actions.
                if re.search(r"取消|Cancel|複製報表|Copy report", txt, re.I):
                    continue
                # Heuristic: click buttons that look like a datasource selector.
                if re.search(r"資料來源|data source|@|poc|revenue", txt, re.I):
                    _safe_click(page, btn, timeout_ms=timeout_ms, label="ds_map_btn")
                    page.wait_for_timeout(400)
                    if _pick_option_from_overlay():
                        filled_any = True
                        page.wait_for_timeout(300)
            except Exception:
                continue

    # Click the primary 'Copy report' action.
    try:
        copy_btn = dlg.get_by_role("button", name=copy_btn_re).first
        if copy_btn.count() == 0:
            copy_btn = dlg.get_by_text(copy_btn_re).first
        if copy_btn.count() > 0 and copy_btn.is_visible():
            _safe_click(page, copy_btn, timeout_ms=timeout_ms, label="copy_report")
            page.wait_for_timeout(1500)
            _modal_sweep(page, timeout_ms=4000, rounds=12)
            _snap(page, "persist_copy_report_clicked", full_page=True)
            return True
    except Exception:
        pass

    return False


def _try_extract_persistent_url_from_share(page: Page, timeout_ms: int) -> str | None:
    """Try to obtain the stable report URL from Share UI as a fallback."""

    share_btn = page.get_by_role(
        "button", name=re.compile(r"儲存及共用|Save and share|共用|Share", re.I)
    ).first
    try:
        if share_btn.count() == 0 or not share_btn.is_visible():
            return None
    except Exception:
        return None

    _safe_click(page, share_btn, timeout_ms=timeout_ms, label="share_open")
    page.wait_for_timeout(1000)
    _modal_sweep(page, timeout_ms=4000, rounds=6)
    _snap(page, "persist_share_dialog_open", full_page=True)

    def _scan_attr(root, selector: str, attr: str) -> str | None:
        try:
            els = root.locator(selector).all()
        except Exception:
            return None
        for el in els[:50]:
            try:
                val = (el.get_attribute(attr) or "").strip()
            except Exception:
                continue
            if not val:
                continue
            if _is_persistent_report_url(val):
                return val
        return None

    # Try to find a textbox containing a stable lookerstudio URL.
    roots = [
        page.get_by_role("dialog"),
        page.locator(".cdk-overlay-container"),
    ]
    for root in roots:
        # Prefer attribute-based extraction (works even if link isn't in a textbox).
        for sel, attr in [
            ('a[href*="lookerstudio.google.com/reporting/"]', "href"),
            ('input[value*="lookerstudio.google.com/reporting/"]', "value"),
            ('[data-clipboard-text*="lookerstudio.google.com/reporting/"]', "data-clipboard-text"),
        ]:
            found = _scan_attr(root, sel, attr)
            if found is not None:
                return found

        try:
            boxes = root.get_by_role("textbox").all()
        except Exception:
            continue

        for tb in boxes[:25]:
            try:
                val = (tb.input_value() or "").strip()
            except Exception:
                continue
            if not val:
                continue
            if "lookerstudio.google.com/reporting/" not in val.lower():
                continue
            if "/reporting/create" in val.lower():
                continue
            if _is_persistent_report_url(val):
                return val

    return None


def _debug_dump_persist_ui(page: Page) -> None:
    """Print a small, safe snapshot of candidate controls for persistence."""

    def _sample_buttons(max_items: int = 25) -> None:
        try:
            texts = page.get_by_role("button").all_text_contents()
        except Exception:
            return
        cleaned: list[str] = []
        for t in texts:
            t = (t or "").strip()
            if not t:
                continue
            if t not in cleaned:
                cleaned.append(t)
            if len(cleaned) >= max_items:
                break
        if cleaned:
            print(f"[debug] role=button sample={cleaned}")

    def _sample_menuitems(max_items: int = 25) -> None:
        try:
            texts = page.get_by_role("menuitem").all_text_contents()
        except Exception:
            return
        cleaned: list[str] = []
        for t in texts:
            t = (t or "").strip()
            if not t:
                continue
            if t not in cleaned:
                cleaned.append(t)
            if len(cleaned) >= max_items:
                break
        if cleaned:
            print(f"[debug] role=menuitem sample={cleaned}")

    try:
        print(f"[debug] persist url={page.url}")
    except Exception:
        pass

    for pat in [r"檔案|File", r"製作副本|Make a copy|Copy report", r"共用|Share", r"儲存|Save"]:
        try:
            c = page.get_by_text(re.compile(pat, re.I)).count()
            if c:
                print(f"[debug] text_count {pat!r} = {c}")
        except Exception:
            pass

    _sample_buttons()
    _sample_menuitems()


def _save_report_and_get_edit_url(page: Page, timeout_ms: int) -> str:
    """Persist the report so a stable /reporting/... URL is produced."""

    print("[step] save report")

    ctx = page.context

    # Strategy order:
    # 1) File -> Make a copy (most deterministic way to create a saved asset)
    # 2) Edit and share / Save and share button (account-dependent)

    persist_btn_patterns = [
        r"編輯.*共用|Edit.*share",
        r"儲存.*共用|Save.*share",
        r"共用|Share",
    ]

    def _try_share_button() -> bool:
        persist_btn = None
        for pat in persist_btn_patterns:
            loc = page.get_by_role("button", name=re.compile(pat, re.I)).first
            try:
                if loc.count() > 0:
                    loc.wait_for(state="visible", timeout=4000)
                    persist_btn = loc
                    break
            except Exception:
                continue

        if persist_btn is None:
            return False

        try:
            print("[persist] try share button")
        except Exception:
            pass
        _safe_click(page, persist_btn, timeout_ms=timeout_ms, label="persist_share_btn")
        page.wait_for_timeout(1200)
        _modal_sweep(page, timeout_ms=4000, rounds=12)
        _complete_make_copy_dialog(page, timeout_ms=timeout_ms)
        _complete_copy_report_datasource_mapping_dialog(page, timeout_ms=timeout_ms)
        return True

    # Some accounts require acknowledging data access warnings before saving/copying.
    # Try multiple times, sweeping dialogs and switching tabs between attempts.
    for attempt in range(1, 5):
        pages_before = list(ctx.pages)
        tag = f"attempt{attempt}"

        triggered = False
        try:
            if not _is_persistent_report_url(page.url):
                triggered = _try_make_copy_via_file_menu(page, timeout_ms=timeout_ms, tag=tag)
        except Exception as e:
            print(f"[warn] make-copy attempt failed: {e}")

        if triggered:
            _complete_make_copy_dialog(page, timeout_ms=timeout_ms)
            _complete_copy_report_datasource_mapping_dialog(page, timeout_ms=timeout_ms)

        if not triggered:
            try:
                triggered = _try_make_copy_via_overflow_menu(page, timeout_ms=timeout_ms, tag=tag)
            except Exception as e:
                print(f"[warn] overflow-menu make-copy attempt failed: {e}")

        if triggered:
            _complete_make_copy_dialog(page, timeout_ms=timeout_ms)
            _complete_copy_report_datasource_mapping_dialog(page, timeout_ms=timeout_ms)

        if not triggered:
            try:
                triggered = _try_share_button()
            except Exception as e:
                print(f"[warn] share-button attempt failed: {e}")

        new_page = _switch_to_newest_page(ctx, pages_before)
        if new_page is not None:
            page = new_page

        if _wait_for_persistent_url(page, timeout_ms=timeout_ms):
            break
        page.wait_for_timeout(1500)

    if not _is_persistent_report_url(page.url):
        # Fallback: sometimes the stable URL is available in Share UI even if the
        # address bar didn't transition away from /reporting/create.
        stable = _try_extract_persistent_url_from_share(page, timeout_ms=timeout_ms)
        if stable is not None:
            try:
                page.goto(stable, timeout=timeout_ms)
                page.wait_for_timeout(1200)
            except Exception:
                pass
            if _is_persistent_report_url(page.url):
                # Re-enter save flow success path.
                pass
            else:
                # Use extracted stable URL as view URL even if navigation failed.
                view_url = re.sub(r"/edit(?:[?#].*)?$", "", stable)
                edit_url = view_url.rstrip("/") + "/edit"
                (OUT_DIR / "chart01_verification_url.txt").write_text(
                    view_url + "\n" + edit_url + "\n",
                    encoding="utf-8",
                )
                print(f"[verify-url] {view_url}")
                print(f"[verify-url-edit] {edit_url}")
                return edit_url

        _debug_dump_persist_ui(page)
        _snap(page, "gate_save_failed", full_page=True)
        raise RuntimeError(f"Failed to get persistent report URL; url={page.url}")

    # Prefer edit URL (only after we have a persistent /reporting/<id>/page/<id> URL).
    current_url = page.url
    view_url = re.sub(r"/edit(?:[?#].*)?$", "", current_url)
    edit_url = view_url.rstrip("/") + "/edit"

    try:
        page.goto(edit_url, timeout=timeout_ms)
        page.wait_for_timeout(2000)
        if _is_persistent_report_url(page.url) and "/edit" in page.url:
            edit_url = page.url
    except Exception:
        # Keep edit_url as derived; still useful for users.
        pass

    (OUT_DIR / "chart01_verification_url.txt").write_text(
        view_url + "\n" + edit_url + "\n",
        encoding="utf-8",
    )
    print(f"[verify-url] {view_url}")
    print(f"[verify-url-edit] {edit_url}")
    return edit_url


def _snap(page, name: str, full_page: bool = False) -> None:
    out = OUT_DIR / f"chart01_{name}.png"
    try:
        page.screenshot(path=str(out), full_page=full_page)
        print(f"[snap] {out}")
    except Exception as e:
        print(f"[snap] failed name={name}: {e}")


def _dismiss_backdrops(page, rounds: int = 5) -> None:
    """Dismiss known overlay backdrops that intercept clicks."""

    backdrop_selectors = [
        ".ng2-subheader-menu-dropback",
        ".cdk-overlay-backdrop",
        ".cdk-overlay-backdrop-showing",
    ]

    for _ in range(rounds):
        any_visible = False
        for sel in backdrop_selectors:
            try:
                el = page.locator(sel).first
                if el.count() > 0 and el.is_visible():
                    any_visible = True
                    # Escape tends to close menus; clicking backdrop is a fallback.
                    try:
                        page.keyboard.press("Escape")
                    except Exception:
                        pass
                    page.wait_for_timeout(150)
                    try:
                        el.click(timeout=500, force=True)
                    except Exception:
                        pass
            except Exception:
                pass
        if not any_visible:
            break
        page.wait_for_timeout(250)


def _safe_click(page, locator, timeout_ms: int, label: str) -> None:
    """Click with recovery for click-intercepting overlays."""

    try:
        locator.click(timeout=timeout_ms)
        return
    except Exception as e:
        msg = str(e)
        if (
            "intercepts pointer events" not in msg
            and "not receiving pointer events" not in msg
            and "Element is not attached" not in msg
        ):
            raise

    print(f"[click] intercepted label={label}; attempting backdrop dismiss")

    # Recover from intercepting dropbacks.
    _dismiss_backdrops(page)
    try:
        locator.click(timeout=timeout_ms)
        return
    except Exception:
        pass

    # Last resort.
    _dismiss_backdrops(page)
    locator.click(timeout=timeout_ms, force=True)


def _modal_sweep(page, timeout_ms: int = 3000, rounds: int = 3) -> None:
    """Best-effort click-away for blocking dialogs/overlays."""

    # IMPORTANT: scope clicks to overlay containers only.
    # Do not click toolbar buttons like "新增資料", which can open unrelated dialogs.
    btn_re = re.compile(
        r"新增至報表|ADD TO REPORT|確認|新增|Confirm|Continue|繼續|OK|知道了|Got it|"
        r"查看資料存取權|View data access|允許|Allow|接受|Accept|完成|Done|"
        r"儲存|Save|建立|Create|下一步|Next|製作副本|建立副本|Make a copy",
        re.I,
    )

    roots = [
        page.locator(".cdk-overlay-container"),
        page.locator("mat-dialog-container"),
        page.locator("mat-mdc-dialog-container"),
        page.get_by_role("dialog"),
    ]

    for i in range(rounds):
        _dismiss_backdrops(page)

        clicked = False
        for root in roots:
            try:
                btn = root.get_by_role("button", name=btn_re).first
                if btn.count() > 0 and btn.is_visible():
                    _safe_click(page, btn, timeout_ms=timeout_ms, label="modal_btn")
                    clicked = True
                    break
            except Exception:
                pass

        if not clicked:
            # Close/cancel buttons (best-effort)
            for root in roots:
                try:
                    close_btn = root.get_by_role(
                        "button", name=re.compile(r"關閉|Close|取消|Cancel", re.I)
                    ).first
                    if close_btn.count() > 0 and close_btn.is_visible():
                        _safe_click(page, close_btn, timeout_ms=timeout_ms, label="modal_close")
                        clicked = True
                        break
                except Exception:
                    pass

        if clicked:
            page.wait_for_timeout(1200)
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
            _dismiss_backdrops(page)
            page.wait_for_timeout(300)
        else:
            # No more modals found.
            break


def _ensure_edit_mode(page, timeout_ms: int) -> None:
    """Gate: must be in report editor with chart tools usable."""

    # Prefer a stable editor root.
    editor_probe = page.locator("report-editing-tools")
    add_chart = page.get_by_role("button", name=re.compile(r"新增圖表|Add a chart", re.I)).first

    start = time.time()
    while True:
        if editor_probe.count() > 0:
            return
        try:
            if add_chart.count() > 0 and add_chart.is_visible():
                return
        except Exception:
            pass

        if (time.time() - start) * 1000 > timeout_ms:
            break
        page.wait_for_timeout(800)

    _snap(page, "gate_not_in_edit_mode", full_page=True)
    raise RuntimeError(f"Edit mode gate failed; url={page.url}")


def _focus_canvas(page) -> None:
    # Best-effort: close overlays and click a safe area.
    try:
        page.keyboard.press("Escape")
    except Exception:
        pass
    _dismiss_backdrops(page)
    page.wait_for_timeout(200)
    try:
        page.mouse.click(350, 250)
    except Exception:
        pass
    page.wait_for_timeout(200)


def _open_setup_tab(page) -> None:
    setup = page.get_by_text(re.compile(r"^設定$|^Setup$", re.I)).first
    if setup.count() > 0:
        try:
            setup.click(timeout=3000)
            page.wait_for_timeout(500)
        except Exception:
            pass


def _select_from_overlay(page, text: str, timeout_ms: int) -> bool:
    overlay = page.locator(".cdk-overlay-pane").last
    if overlay.count() == 0:
        return False
    try:
        if not overlay.is_visible():
            return False
    except Exception:
        return False

    # Optional: search
    try:
        search = overlay.locator('input[placeholder="Search"], input[placeholder="搜尋"]').first
        if search.count() > 0 and search.is_visible():
            search.click(timeout=timeout_ms)
            search.fill(text)
            page.wait_for_timeout(1200)
    except Exception:
        pass

    # Prefer exact match, then fallback.
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


def _configure_metric_and_dimension(page, timeout_ms: int) -> None:
    _open_setup_tab(page)

    side_panel = page.locator("ng2-legacy-side-panel").first
    panel_mode = "legacy"
    if side_panel.count() == 0:
        panel_mode = "modern"
        # Modern properties panel (seen in current UI): title like "「時間序列」資源".
        title = page.get_by_text(re.compile(r"時間序列.*資源", re.I)).first
        try:
            title.wait_for(state="visible", timeout=5000)
        except Exception:
            _snap(page, "gate_no_side_panel", full_page=True)
            raise RuntimeError("Setup side panel not found")

        # Walk up to find a container that includes the Settings/Setup tab.
        side_panel = title.locator("..")
        for _ in range(5):
            if side_panel.get_by_text(re.compile(r"^設定$|^Setup$", re.I)).count() > 0:
                break
            side_panel = side_panel.locator("..")

    # Metric: replace Record Count -> revenue
    replaced = False
    try:
        if panel_mode == "legacy":
            rc_chip = (
                side_panel.locator(".cdk-drag.chip")
                .filter(has_text=re.compile(r"Record Count", re.I))
                .first
            )
            if rc_chip.count() > 0 and rc_chip.is_visible():
                rc_chip.click(timeout=timeout_ms)
                page.wait_for_timeout(500)
                replaced = _select_from_overlay(page, EXPECTED_METRIC, timeout_ms)
                page.wait_for_timeout(800)
        else:
            # Modern panel: click the current metric field (often shown as 'Record Count')
            rc_field = side_panel.get_by_text(re.compile(r"^\s*Record Count\s*$", re.I)).first
            if rc_field.count() > 0 and rc_field.is_visible():
                _safe_click(page, rc_field, timeout_ms=15000, label="metric_record_count")
                page.wait_for_timeout(500)
                replaced = _select_from_overlay(page, EXPECTED_METRIC, timeout_ms)
                page.wait_for_timeout(800)
    except Exception as e:
        print(f"[warn] metric replace failed: {e}")
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass

    if not replaced:
        # Fallback: remove Record Count chip if possible, then add metric.
        try:
            if panel_mode == "legacy":
                rc_x = (
                    side_panel.locator(".chip")
                    .filter(has_text=re.compile(r"Record Count", re.I))
                    .locator("mat-icon")
                    .first
                )
                if rc_x.count() > 0 and rc_x.is_visible():
                    rc_x.click(timeout=timeout_ms, force=True)
                    page.wait_for_timeout(800)
        except Exception:
            pass

        try:
            add_metric = page.get_by_text(re.compile(r"新增指標|Add metric", re.I)).first
            if add_metric.count() > 0:
                add_metric.click(timeout=timeout_ms)
                page.wait_for_timeout(500)
                if not _select_from_overlay(page, EXPECTED_METRIC, timeout_ms):
                    raise RuntimeError("Could not select metric from overlay")
                page.wait_for_timeout(800)
        except Exception as e:
            _snap(page, "gate_metric_add_failed", full_page=True)
            raise RuntimeError(f"Failed to add metric {EXPECTED_METRIC}: {e}")

    # Dimension: ensure order_date
    try:
        if panel_mode == "legacy":
            dim_ok = (
                side_panel.locator(".cdk-drag.chip")
                .filter(has_text=re.compile(r"\border_date\b", re.I))
                .count()
                > 0
            )
        else:
            dim_ok = side_panel.get_by_text(re.compile(r"\border_date\b", re.I)).count() > 0
    except Exception:
        dim_ok = False

    if not dim_ok:
        try:
            add_dim = page.get_by_text(re.compile(r"新增維度|Add dimension", re.I)).first
            if add_dim.count() > 0:
                add_dim.click(timeout=timeout_ms)
                page.wait_for_timeout(500)
                if not _select_from_overlay(page, EXPECTED_DIMENSION, timeout_ms):
                    raise RuntimeError("Could not select dimension from overlay")
                page.wait_for_timeout(800)
            else:
                # Try replacing an existing date-ish dimension chip
                if panel_mode == "legacy":
                    date_chip = (
                        side_panel.locator(".cdk-drag.chip")
                        .filter(has_text=re.compile(r"Date|日期|order_date", re.I))
                        .first
                    )
                    if date_chip.count() > 0:
                        date_chip.click(timeout=timeout_ms)
                        page.wait_for_timeout(500)
                        if not _select_from_overlay(page, EXPECTED_DIMENSION, timeout_ms):
                            raise RuntimeError("Could not replace dimension from overlay")
                        page.wait_for_timeout(800)
                else:
                    # Modern: click an existing dimension field if present.
                    date_field = side_panel.get_by_text(
                        re.compile(r"Date|日期|order_date", re.I)
                    ).first
                    if date_field.count() > 0 and date_field.is_visible():
                        _safe_click(page, date_field, timeout_ms=15000, label="dimension_field")
                        page.wait_for_timeout(500)
                        if not _select_from_overlay(page, EXPECTED_DIMENSION, timeout_ms):
                            raise RuntimeError("Could not replace dimension from overlay")
                        page.wait_for_timeout(800)
        except Exception as e:
            _snap(page, "gate_dimension_failed", full_page=True)
            raise RuntimeError(f"Failed to set dimension {EXPECTED_DIMENSION}: {e}")

    # Gate checks
    try:
        if panel_mode == "legacy":
            metric_ok = (
                side_panel.locator(".cdk-drag.chip")
                .filter(has_text=re.compile(r"\brevenue\b", re.I))
                .count()
                > 0
            )
            metric_bad = (
                side_panel.locator(".cdk-drag.chip")
                .filter(has_text=re.compile(r"Record Count", re.I))
                .count()
                > 0
            )
        else:
            metric_ok = side_panel.get_by_text(re.compile(r"\brevenue\b", re.I)).count() > 0
            metric_bad = side_panel.get_by_text(re.compile(r"\bRecord Count\b", re.I)).count() > 0
    except Exception:
        metric_ok = False
        metric_bad = False

    if not metric_ok or metric_bad:
        _snap(page, "gate_metric_dimension_not_applied", full_page=True)
        raise RuntimeError(
            f"Metric/Dimension gate failed metric_ok={metric_ok} metric_bad={metric_bad}"
        )


def _insert_title(page, timeout_ms: int) -> None:
    print("[step] insert title")
    try:
        btn = page.get_by_role("button", name=re.compile(r"文字|Text", re.I)).first
        btn.wait_for(state="visible", timeout=timeout_ms)
        _safe_click(page, btn, timeout_ms=timeout_ms, label="text_tool")
        page.wait_for_timeout(400)

        # Create a textbox near the top of the canvas (click-drag is more reliable than click).
        page.mouse.move(80, 190)
        page.mouse.down()
        page.mouse.move(760, 240)
        page.mouse.up()
        page.wait_for_timeout(200)

        # Prefer insert_text (less IME-sensitive). Fallback to type.
        try:
            page.keyboard.insert_text(REPORT_NAME)
        except Exception:
            page.keyboard.type(REPORT_NAME)

        # Commit via Escape / click-away.
        page.wait_for_timeout(200)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
        _focus_canvas(page)
    except Exception as e:
        _snap(page, "warn_title_insert_failed", full_page=True)
        print(f"[warn] title insert failed: {e}")


def main() -> int:
    nav_timeout_ms = 120000
    ui_timeout_ms = 20000
    overlay_timeout_ms = 15000

    # Build Linking API URL (force edit mode)
    params: dict[str, str] = {
        "c.mode": "edit",
        "ds.connector": "bigQuery",
        "ds.projectId": "b25h01-ragic",
        "ds.type": "TABLE",
        "ds.tableId": TABLE_ID,
        "ds.datasetId": "erp_backup",
        "r.reportName": REPORT_NAME,
    }
    if DEBUG_EXPLAIN:
        params["c.explain"] = "true"

    linking_url = (
        f"https://lookerstudio.google.com/reporting/create?{urllib.parse.urlencode(params)}"
    )

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(OUT_DIR / "chrome_profile"),
            headless=True,
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        print("[step] open report")
        page.goto(linking_url, timeout=nav_timeout_ms, wait_until="domcontentloaded")
        page.wait_for_timeout(8000)
        _snap(page, "opened", full_page=True)

        _modal_sweep(page)
        _ensure_edit_mode(page, timeout_ms=45000)
        _snap(page, "editor_ready", full_page=True)

        # Pre-ops sweep
        _modal_sweep(page)

        # Step 3: clear canvas
        print("[step] clear canvas")
        _focus_canvas(page)
        page.keyboard.press("Control+a")
        page.keyboard.press("Delete")
        page.wait_for_timeout(1200)
        _snap(page, "canvas_cleared")

        # Step 4: insert time series chart
        print("[step] insert time series chart")
        _modal_sweep(page)
        try:
            add_chart = page.get_by_role(
                "button", name=re.compile(r"新增圖表|Add a chart", re.I)
            ).first
            add_chart.wait_for(state="visible", timeout=ui_timeout_ms)
            _snap(page, "before_add_chart")
            _safe_click(page, add_chart, timeout_ms=ui_timeout_ms, label="add_chart")
            page.wait_for_timeout(800)
            _snap(page, "after_add_chart_click")
            header = page.get_by_text(re.compile(r"^\s*(時間序列|Time series)\s*$", re.I)).first
            header.wait_for(state="visible", timeout=overlay_timeout_ms)
            header.scroll_into_view_if_needed()
            box = header.bounding_box()
            if not box:
                raise RuntimeError("Could not locate chart picker header bounding box")
            page.mouse.click(box["x"] + 30, box["y"] + 60)
            page.wait_for_timeout(600)
            # Place chart lower to reserve space for the page title.
            page.mouse.click(300, 380)
            page.wait_for_timeout(4000)
        except Exception as e:
            _snap(page, "gate_insert_chart_failed", full_page=True)
            raise RuntimeError(f"Failed to insert chart: {e}")

        _snap(page, "chart_placed", full_page=True)

        # Step 5: configure metric/dimension
        print("[step] configure metric/dimension")
        _modal_sweep(page)
        _configure_metric_and_dimension(page, timeout_ms=nav_timeout_ms)
        _snap(page, "chart_configured", full_page=True)

        # Step 6: title (after config; avoid losing chart selection during setup)
        print("[step] insert title")
        _modal_sweep(page)
        _insert_title(page, timeout_ms=ui_timeout_ms)
        _snap(page, "title_applied", full_page=True)

        # Allow chart to re-render after field changes.
        page.wait_for_timeout(5000)

        # Final verification artifact
        page.screenshot(path=str(OUT_DIR / "final_verification_01.png"), full_page=True)

        # Persist report so user can verify via a stable URL.
        verification_url = _save_report_and_get_edit_url(page, timeout_ms=60000)
        _snap(page, "saved", full_page=True)

        # Optional: quick text probes (best-effort)
        try:
            title_count = page.get_by_text(REPORT_NAME, exact=False).count()
            print(f"[verify] title_count={title_count}")
        except Exception:
            pass

        print(f"DONE url={page.url}")
        print(f"VERIFICATION_URL {verification_url}")
        context.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
