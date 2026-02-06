#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from google.cloud import bigquery
import looker_sdk


@dataclass(frozen=True)
class ChartSpec:
    chart_id: str
    name: str
    looker_query_id: int | None
    look_id: int | None
    bq_sql_path: Path
    key_columns: list[str]
    value_columns: list[str]
    float_tolerance_ratio: float


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_specs(spec_path: Path) -> list[ChartSpec]:
    raw = _load_yaml(spec_path)
    charts = raw.get("charts") or []
    if not isinstance(charts, list):
        raise ValueError("charts must be a list")

    specs: list[ChartSpec] = []
    for item in charts:
        if not isinstance(item, dict):
            raise ValueError("each chart entry must be a mapping")

        chart_id = str(item.get("id") or item.get("chart_id") or "").strip()
        name = str(item.get("name") or "").strip()
        if not chart_id or not name:
            raise ValueError("each chart needs id and name")

        looker_query_id = item.get("looker_query_id")
        look_id = item.get("look_id")
        if looker_query_id is None and look_id is None:
            raise ValueError(f"{chart_id}: must provide looker_query_id or look_id")
        if looker_query_id is not None and look_id is not None:
            raise ValueError(f"{chart_id}: provide only one of looker_query_id or look_id")

        bq_sql_path = Path(str(item.get("bq_sql_path") or "").strip())
        if not bq_sql_path.as_posix():
            raise ValueError(f"{chart_id}: bq_sql_path is required")
        if not bq_sql_path.is_absolute():
            bq_sql_path = (spec_path.parent / bq_sql_path).resolve()

        key_columns = list(item.get("key_columns") or [])
        value_columns = list(item.get("value_columns") or [])
        float_tolerance_ratio = float(item.get("float_tolerance_ratio") or 0.0001)

        specs.append(
            ChartSpec(
                chart_id=chart_id,
                name=name,
                looker_query_id=int(looker_query_id) if looker_query_id is not None else None,
                look_id=int(look_id) if look_id is not None else None,
                bq_sql_path=bq_sql_path,
                key_columns=key_columns,
                value_columns=value_columns,
                float_tolerance_ratio=float_tolerance_ratio,
            )
        )
    return specs


def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _to_key(row: dict[str, Any], keys: list[str]) -> tuple[Any, ...]:
    return tuple(row.get(k) for k in keys)


def _safe_float(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v))
    except Exception:
        return None


def compare_rows(
    *,
    looker_rows: list[dict[str, Any]],
    bq_rows: list[dict[str, Any]],
    key_columns: list[str],
    value_columns: list[str],
    float_tolerance_ratio: float,
) -> list[str]:
    """Return list of mismatch messages (empty means pass)."""

    if not looker_rows and not bq_rows:
        return []

    # Best-effort defaults.
    if not key_columns:
        # If both sets share obvious date fields, keep them as key.
        for candidate in ("order_date", "date", "day", "month"):
            if looker_rows and candidate in looker_rows[0] and bq_rows and candidate in bq_rows[0]:
                key_columns = [candidate]
                break

    if not value_columns:
        # Compare numeric columns common to both.
        common = set(looker_rows[0].keys() if looker_rows else []) & set(
            bq_rows[0].keys() if bq_rows else []
        )
        value_columns = [
            c
            for c in sorted(common)
            if _is_number((looker_rows[0] or {}).get(c)) or _is_number((bq_rows[0] or {}).get(c))
        ]
        # If nothing numeric in first row, compare all common columns.
        if not value_columns:
            value_columns = sorted(common)

    mismatches: list[str] = []

    if key_columns:
        looker_map = {_to_key(r, key_columns): r for r in looker_rows}
        bq_map = {_to_key(r, key_columns): r for r in bq_rows}
        all_keys = sorted(set(looker_map.keys()) | set(bq_map.keys()))
        for k in all_keys:
            lr = looker_map.get(k)
            br = bq_map.get(k)
            if lr is None:
                mismatches.append(f"missing_in_looker key={k}")
                continue
            if br is None:
                mismatches.append(f"missing_in_bq key={k}")
                continue
            mismatches.extend(
                _compare_row_values(
                    key=k,
                    looker_row=lr,
                    bq_row=br,
                    value_columns=value_columns,
                    float_tolerance_ratio=float_tolerance_ratio,
                )
            )
    else:
        if len(looker_rows) != len(bq_rows):
            mismatches.append(f"row_count_mismatch looker={len(looker_rows)} bq={len(bq_rows)}")
        for i, (lr, br) in enumerate(zip(looker_rows, bq_rows)):
            mismatches.extend(
                _compare_row_values(
                    key=(i,),
                    looker_row=lr,
                    bq_row=br,
                    value_columns=value_columns,
                    float_tolerance_ratio=float_tolerance_ratio,
                )
            )

    return mismatches


def _compare_row_values(
    *,
    key: tuple[Any, ...],
    looker_row: dict[str, Any],
    bq_row: dict[str, Any],
    value_columns: list[str],
    float_tolerance_ratio: float,
) -> list[str]:
    mismatches: list[str] = []
    for col in value_columns:
        lv = looker_row.get(col)
        bv = bq_row.get(col)

        lf = _safe_float(lv)
        bf = _safe_float(bv)
        if lf is not None and bf is not None:
            denom = max(abs(bf), 1.0)
            rel = abs(lf - bf) / denom
            if rel > float_tolerance_ratio and not (math.isnan(lf) and math.isnan(bf)):
                mismatches.append(
                    f"value_mismatch key={key} col={col} looker={lv} bq={bv} rel={rel}"
                )
            continue

        if lv != bv:
            mismatches.append(f"value_mismatch key={key} col={col} looker={lv} bq={bv}")
    return mismatches


def run_bq_sql(sql_path: Path) -> list[dict[str, Any]]:
    sql = sql_path.read_text(encoding="utf-8")
    client = bigquery.Client()
    rows = client.query(sql).result()
    return [dict(r.items()) for r in rows]


def run_looker(spec: ChartSpec, *, ini_path: Path, ini_section: str) -> list[dict[str, Any]]:
    sdk = looker_sdk.init40(config_file=str(ini_path), section=ini_section)
    if spec.looker_query_id is not None:
        raw = sdk.run_query(query_id=str(spec.looker_query_id), result_format="json")
    else:
        if spec.look_id is None:
            raise ValueError("look_id is required when looker_query_id is not set")
        raw = sdk.run_look(look_id=str(spec.look_id), result_format="json")
    data = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(data, list):
        raise ValueError(f"unexpected Looker result type: {type(data)}")
    return [dict(r) for r in data]


def main() -> int:
    p = argparse.ArgumentParser(description="Verify Looker charts against BigQuery truth SQL")
    p.add_argument("--spec", required=True, help="Path to charts YAML")
    p.add_argument("--looker-ini", default=os.environ.get("LOOKER_INI", "_local/looker/looker.ini"))
    p.add_argument("--looker-section", default=os.environ.get("LOOKER_SECTION", "dev"))
    p.add_argument("--only", action="append", default=[], help="Only run chart id(s) (repeatable)")
    p.add_argument(
        "--dump-dir", default=os.environ.get("LOOKER_VERIFY_DUMP_DIR", "_local/looker/verify")
    )
    args = p.parse_args()

    spec_path = Path(args.spec).resolve()
    ini_path = Path(args.looker_ini).expanduser().resolve()
    dump_dir = Path(args.dump_dir).expanduser().resolve()
    dump_dir.mkdir(parents=True, exist_ok=True)

    specs = load_specs(spec_path)
    if args.only:
        wanted = set(args.only)
        specs = [s for s in specs if s.chart_id in wanted]

    if not ini_path.exists():
        raise SystemExit(
            f"Looker ini not found: {ini_path}. Create it from scripts/looker/looker.ini.example (DO NOT commit secrets)."
        )

    failures = 0
    for spec in specs:
        print(f"== {spec.chart_id} {spec.name}")
        if not spec.bq_sql_path.exists():
            print(f"ERROR: missing BQ SQL file: {spec.bq_sql_path}")
            failures += 1
            continue

        looker_rows = run_looker(spec, ini_path=ini_path, ini_section=args.looker_section)
        bq_rows = run_bq_sql(spec.bq_sql_path)

        (dump_dir / f"{spec.chart_id}_looker.json").write_text(
            json.dumps(looker_rows, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (dump_dir / f"{spec.chart_id}_bq.json").write_text(
            json.dumps(bq_rows, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        mismatches = compare_rows(
            looker_rows=looker_rows,
            bq_rows=bq_rows,
            key_columns=spec.key_columns,
            value_columns=spec.value_columns,
            float_tolerance_ratio=spec.float_tolerance_ratio,
        )
        if mismatches:
            failures += 1
            print("FAIL")
            for m in mismatches[:50]:
                print("  " + m)
            if len(mismatches) > 50:
                print(f"  ... ({len(mismatches) - 50} more)")
        else:
            print("PASS")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
