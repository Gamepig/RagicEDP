import json
from typing import Dict, Any
from .spec_models import ChartSpec, DashboardSpec, VisType


class LookerRenderer:
    def render_query_json(self, spec: ChartSpec) -> Dict[str, Any]:
        query = {
            "model": spec.model,
            "view": spec.explore,
            "fields": spec.dimensions + spec.measures,
            "filters": spec.filters,
            "sorts": spec.sorts,
            "limit": str(spec.limit),
            "vis_config": spec.viz_config.model_dump(),
        }
        return query


class StudioRenderer:
    def render_linking_params(self, spec: ChartSpec) -> Dict[str, str]:
        # 對齊 Linking API 格式
        alias = spec.datasource.alias
        params = {
            f"ds.{alias}.connector": "bigQuery",
            f"ds.{alias}.projectId": spec.datasource.project_id,
            f"ds.{alias}.datasetId": spec.datasource.dataset_id,
            f"ds.{alias}.refreshFields": str(spec.datasource.refresh_fields).lower(),
        }

        if spec.datasource.table_id:
            params[f"ds.{alias}.tableId"] = spec.datasource.table_id
            params[f"ds.{alias}.type"] = "TABLE"
        elif spec.datasource.sql:
            params[f"ds.{alias}.sql"] = spec.datasource.sql
            params[f"ds.{alias}.type"] = "CUSTOM_QUERY"

        return params

    def build_url(self, params: Dict[str, str]) -> str:
        from urllib.parse import urlencode

        base_url = "https://lookerstudio.google.com/reporting/create"
        # KB Ref: Wildcards like ds.*.projectId must retain '*' literal
        return f"{base_url}?{urlencode(params, safe='*')}"
