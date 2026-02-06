from typing import Dict, Any, Optional
from .spec_models import ChartSpec, DashboardSpec, RegistryEntry


class LookerAdapterInterface:
    def create_query(self, query_json: Dict[str, Any]) -> str:
        raise NotImplementedError

    def upsert_dashboard(self, title: str) -> str:
        raise NotImplementedError

    def add_element(self, dashboard_id: str, query_id: str, title: str) -> str:
        raise NotImplementedError


class MockLookerAdapter(LookerAdapterInterface):
    def __init__(self):
        self.query_counter = 0
        self.dash_counter = 0
        self.elem_counter = 0

    def create_query(self, query_json: Dict[str, Any]) -> str:
        self.query_counter += 1
        return f"MOCK_QUERY_{self.query_counter}"

    def upsert_dashboard(self, title: str) -> str:
        self.dash_counter += 1
        return f"MOCK_DASH_{self.dash_counter}"

    def add_element(self, dashboard_id: str, query_id: str, title: str) -> str:
        self.elem_counter += 1
        return f"MOCK_ELEM_{self.elem_counter}"


class AutoChartEngine:
    def __init__(self, adapter: LookerAdapterInterface, registry: Any):
        self.adapter = adapter
        self.registry = registry

    def deploy_chart(self, spec: ChartSpec, dashboard_id: str) -> str:
        from .renderer import LookerRenderer

        renderer = LookerRenderer()
        query_json = renderer.render_query_json(spec)

        query_id = self.adapter.create_query(query_json)
        element_id = self.adapter.add_element(dashboard_id, query_id, spec.title)

        return element_id
