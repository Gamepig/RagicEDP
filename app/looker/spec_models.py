from typing import List, Dict, Optional, Any, Union
from pydantic import BaseModel, Field
from enum import Enum


class VisType(str, Enum):
    COLUMN = "looker_column"
    LINE = "looker_line"
    AREA = "looker_area"
    PIE = "looker_pie"
    SCATTER = "looker_scatter"
    TABLE = "looker_grid"
    SINGLE_VALUE = "single_value"
    SCORECARD = "scorecard"


class DataSourceType(str, Enum):
    TABLE = "TABLE"
    CUSTOM_QUERY = "CUSTOM_QUERY"


class DataSourceSpec(BaseModel):
    type: DataSourceType = DataSourceType.TABLE
    project_id: str
    dataset_id: str
    table_id: Optional[str] = None
    sql: Optional[str] = None
    alias: str = "ds0"
    refresh_fields: bool = True


class VizConfig(BaseModel):
    type: VisType
    show_value_labels: bool = True
    series_colors: Dict[str, str] = Field(default_factory=dict)
    x_axis_gridlines: bool = False
    y_axis_gridlines: bool = True
    show_view_names: bool = False
    stacking: Optional[str] = None
    extras: Dict[str, Any] = Field(default_factory=dict)


class ChartSpec(BaseModel):
    functional_id: str
    title: str
    description: Optional[str] = None
    model: str = "erp_analytics"
    explore: str
    dimensions: List[str]
    measures: List[str]
    filters: Dict[str, str] = Field(default_factory=dict)
    sorts: List[str] = Field(default_factory=list)
    limit: int = 500
    viz_config: VizConfig
    datasource: DataSourceSpec


class DashboardSpec(BaseModel):
    dashboard_id: str
    title: str
    charts: List[ChartSpec]
    tags: List[str] = Field(default_factory=list)


class RegistryEntry(BaseModel):
    functional_id: str
    spec_checksum: str
    looker_dashboard_id: Optional[str] = None
    looker_element_ids: Dict[str, str] = Field(default_factory=dict)
    studio_report_id: Optional[str] = None
    studio_stable_url: Optional[str] = None
    last_applied_at: Optional[str] = None
    status: str = "pending"
