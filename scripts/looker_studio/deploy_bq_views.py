#!/usr/bin/env python3

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from google.cloud import bigquery


@dataclass(frozen=True)
class ViewDef:
    view_id: str
    table: str
    sql_path: Path


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _load_manifest(path: Path) -> tuple[str, str, list[ViewDef]]:
    doc = _load_yaml(path)
    project = str(doc.get("project") or "").strip()
    dataset = str(doc.get("dataset") or "").strip()
    if not project or not dataset:
        raise ValueError("manifest must include project and dataset")

    views_raw = doc.get("views") or []
    if not isinstance(views_raw, list) or not views_raw:
        raise ValueError("manifest.views must be a non-empty list")

    views: list[ViewDef] = []
    for v in views_raw:
        if not isinstance(v, dict):
            raise ValueError("each views[] entry must be a mapping")
        view_id = str(v.get("id") or "").strip()
        table = str(v.get("table") or "").strip()
        sql_path = str(v.get("sql_path") or "").strip()
        if not view_id or not table or not sql_path:
            raise ValueError("each views[] entry needs id, table, sql_path")
        p = Path(sql_path)
        if not p.is_absolute():
            p = (path.parent / p).resolve()
        views.append(ViewDef(view_id=view_id, table=table, sql_path=p))
    return project, dataset, views


def _render_create_view(project: str, dataset: str, table: str, sql: str) -> str:
    return f"""\
CREATE OR REPLACE VIEW `{project}.{dataset}.{table}` AS
{sql.rstrip()}
"""


def _strip_leading_comments(sql: str) -> str:
    lines = sql.splitlines()
    cleaned: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("--"):
            continue
        cleaned.append(line)
        break
    return "\n".join(cleaned)


def _is_create_view_sql(sql: str) -> bool:
    probe = _strip_leading_comments(sql)
    return re.search(r"^\s*CREATE\s+OR\s+REPLACE\s+VIEW\b", probe, re.I) is not None


def main() -> int:
    p = argparse.ArgumentParser(description="Deploy BigQuery views for Looker Studio")
    p.add_argument(
        "--manifest",
        default="scripts/looker_studio/views.yaml",
        help="Path to views.yaml",
    )
    p.add_argument(
        "--only",
        action="append",
        default=[],
        help="Only deploy view id(s) (repeatable)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print SQL without executing",
    )
    args = p.parse_args()

    manifest_path = Path(args.manifest).resolve()
    project, dataset, views = _load_manifest(manifest_path)

    if args.only:
        wanted = set(args.only)
        views = [v for v in views if v.view_id in wanted]

    if not views:
        raise SystemExit("No views selected")

    client = bigquery.Client(project=project)

    failures = 0
    for v in views:
        if not v.sql_path.exists():
            print(f"ERROR: missing sql_path for {v.view_id}: {v.sql_path}")
            failures += 1
            continue

        sql = v.sql_path.read_text(encoding="utf-8")
        stmt = sql.rstrip()
        if not _is_create_view_sql(sql):
            stmt = _render_create_view(project, dataset, v.table, sql)

        print(f"== {v.view_id} -> {project}.{dataset}.{v.table}")
        if args.dry_run:
            print(stmt)
            continue
        try:
            client.query(stmt).result()
            print("OK")
        except Exception as e:
            failures += 1
            print(f"FAILED: {e}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
