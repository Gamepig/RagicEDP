import json
import os
import hashlib
from typing import Dict, Optional, Union
from .spec_models import RegistryEntry, ChartSpec, DashboardSpec


class RegistryManager:
    def __init__(self, registry_path: str):
        self.registry_path = registry_path
        self.registry: Dict[str, RegistryEntry] = self._load()

    def _load(self) -> Dict[str, RegistryEntry]:
        if not os.path.exists(self.registry_path):
            return {}
        try:
            with open(self.registry_path, "r") as f:
                data = json.load(f)
                return {k: RegistryEntry(**v) for k, v in data.items()}
        except Exception:
            return {}

    def save(self):
        with open(self.registry_path, "w") as f:
            data = {k: v.model_dump() for k, v in self.registry.items()}
            json.dump(data, f, indent=2)

    def get_entry(self, functional_id: str) -> Optional[RegistryEntry]:
        return self.registry.get(functional_id)

    def calculate_checksum(self, spec: Union[ChartSpec, DashboardSpec]) -> str:
        spec_json = spec.model_dump_json(serialize_as_any=True)
        return hashlib.sha256(spec_json.encode()).hexdigest()

    def update_entry(self, entry: RegistryEntry):
        self.registry[entry.functional_id] = entry
        self.save()

    def is_changed(self, functional_id: str, new_spec: Union[ChartSpec, DashboardSpec]) -> bool:
        entry = self.get_entry(functional_id)
        if not entry:
            return True
        return entry.spec_checksum != self.calculate_checksum(new_spec)
