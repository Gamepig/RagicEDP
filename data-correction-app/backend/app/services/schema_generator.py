"""
星狀模型生成器（動態版本）

從 BigQuery INFORMATION_SCHEMA 動態讀取表結構
"""
from typing import Dict, Any, Optional
import logging
import os
import re

from google.cloud import bigquery

from .metadata_inspector import MetadataInspector, SchemaMetadata

logger = logging.getLogger(__name__)

# BigQuery identifier 白名單驗證（保留現有驗證）
_BQ_PROJECT_PATTERN = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")
_BQ_DATASET_TABLE_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,1023}$")


def _validate_project_id(value: str) -> str:
    """驗證 GCP project ID"""
    if not _BQ_PROJECT_PATTERN.match(value):
        raise ValueError(f"Invalid project_id format: {value!r}")
    return value


def _validate_identifier(value: str, field: str) -> str:
    """驗證 BigQuery dataset/table identifier"""
    if not _BQ_DATASET_TABLE_PATTERN.match(value):
        raise ValueError(f"Invalid {field} format: {value!r}")
    return value


# 表格中英文名稱映射（用於顯示）
TABLE_DISPLAY_NAMES = {
    'fact_orders': '訂單表',
    'fact_order_details': '訂單明細表',
    'dim_brand': '品牌表',
    'dim_channel': '通路表',
    'dim_payment': '金流表',
    'dim_logistics': '物流表',
    'dim_postal': '郵遞區號表',
    'dim_customer': '客戶表',
    'dim_product': '商品表',
    'dim_campaign': '活動管理表',
}

# 關聯定義（維度表 -> 事實表）
# 這個配置定義了維度表與事實表之間的關係
RELATIONSHIPS = {
    'dim_brand': ['fact_order_details'],
    'dim_channel': ['fact_orders'],
    'dim_payment': ['fact_orders'],
    'dim_logistics': ['fact_orders'],
    'dim_postal': ['fact_orders'],
    'dim_customer': ['fact_orders'],
    'dim_product': ['fact_order_details'],
    'dim_campaign': ['fact_orders'],
}


class StarSchemaGenerator:
    """星狀模型圖生成器（動態版本）"""

    def __init__(
        self,
        bq_client: Optional[bigquery.Client] = None,
        project_id: Optional[str] = None,
        dataset: Optional[str] = None,
    ):
        """
        初始化生成器

        Args:
            bq_client: BigQuery 客戶端
            project_id: GCP 專案 ID
            dataset: 資料集名稱

        Raises:
            ValueError: 如果 project_id 或 dataset 格式不正確
        """
        raw_project = project_id or os.getenv("GCP_PROJECT_ID", "b25h01-ragic")
        raw_dataset = dataset or os.getenv("BQ_DATASET", "erp_backup")

        # 驗證 identifier 防止注入
        self.project_id = _validate_project_id(raw_project)
        self.dataset = _validate_identifier(raw_dataset, "dataset")
        self.client = bq_client or bigquery.Client(project=self.project_id)

        # 元數據檢查器
        self._inspector = MetadataInspector(
            client=self.client,
            project_id=self.project_id,
            dataset=self.dataset,
        )

        # 快取的元數據
        self._metadata: Optional[SchemaMetadata] = None

    def get_metadata(self, force_refresh: bool = False) -> SchemaMetadata:
        """
        獲取 Schema 元數據（使用內部快取）

        Args:
            force_refresh: 強制重新獲取

        Returns:
            SchemaMetadata
        """
        if self._metadata is None or force_refresh:
            self._metadata = self._inspector.fetch_all_metadata(include_columns=True)
            logger.info(f"Schema 元數據已更新: {self._metadata.total_tables} 表格")
        return self._metadata

    @property
    def last_updated_at(self) -> Optional[float]:
        """上次更新時間（Unix timestamp）"""
        if self._metadata:
            return self._metadata.fetched_at
        return None

    def invalidate_cache(self) -> None:
        """清除快取"""
        self._metadata = None
        logger.info("Schema 快取已清除")

    def generate_mermaid(self, level: str = "overview") -> str:
        """
        生成 Mermaid 圖表程式碼

        Args:
            level: "overview" 或 "detailed"

        Returns:
            Mermaid 程式碼
        """
        metadata = self.get_metadata()

        if level == "detailed":
            return self._generate_detailed_mermaid(metadata)
        return self._generate_overview_mermaid(metadata)

    def _generate_overview_mermaid(self, metadata: SchemaMetadata) -> str:
        """生成概覽圖（動態從 BigQuery 讀取）"""
        lines = ["erDiagram", "    %% Fact Tables"]

        # 動態生成事實表
        for name, table in metadata.fact_tables.items():
            lines.append(f"    {name} {{")
            # 找出 PK 欄位（通常是第一個 *_id 欄位或 order_id）
            pk_cols = [c for c in table.columns if c.name.endswith('_id')]
            if pk_cols:
                lines.append(f"        string {pk_cols[0].name} PK")
            # 找出數值欄位作為 measures
            for col in table.columns:
                if col.data_type in ('INT64', 'FLOAT64', 'NUMERIC', 'DECIMAL', 'BIGNUMERIC'):
                    if not col.name.endswith('_id'):
                        lines.append(f"        number {col.name}")
            lines.append("    }")

        lines.append("    %% Dimension Tables")

        # 動態生成維度表
        for name, table in metadata.dim_tables.items():
            lines.append(f"    {name} {{")
            # PK 欄位（通常是第一個欄位或 *_id / postal_code）
            pk_cols = [c for c in table.columns if c.name.endswith('_id') or c.name == 'postal_code']
            if pk_cols:
                lines.append(f"        string {pk_cols[0].name} PK")
            elif table.columns:
                # 如果沒有明顯的 PK，使用第一個欄位
                lines.append(f"        string {table.columns[0].name} PK")
            lines.append("    }")

        lines.append("    %% Relationships")

        # 生成關聯（使用配置的 RELATIONSHIPS）
        for dim_name in metadata.dim_tables:
            related_facts = RELATIONSHIPS.get(dim_name, [])
            for fact_name in related_facts:
                if fact_name in metadata.fact_tables:
                    lines.append(f"    {dim_name} ||--o{{ {fact_name} : \"\"")

        return "\n".join(lines)

    def _generate_detailed_mermaid(self, metadata: SchemaMetadata) -> str:
        """生成詳細圖（含所有欄位，動態從 BigQuery 讀取）"""
        lines = ["erDiagram", "    %% Fact Tables with all fields"]

        for name, table in metadata.fact_tables.items():
            lines.append(f"    {name} {{")
            for col in table.columns:
                col_type = self._map_bq_type(col.data_type)
                # 判斷 PK/FK
                suffix = ""
                if col.ordinal_position == 1 and col.name.endswith('_id'):
                    suffix = " PK"
                elif col.name.endswith('_id'):
                    suffix = " FK"
                lines.append(f"        {col_type} {col.name}{suffix}")
            lines.append("    }")

        lines.append("    %% Dimension Tables with all fields")

        for name, table in metadata.dim_tables.items():
            lines.append(f"    {name} {{")
            for col in table.columns:
                col_type = self._map_bq_type(col.data_type)
                suffix = " PK" if col.ordinal_position == 1 else ""
                lines.append(f"        {col_type} {col.name}{suffix}")
            lines.append("    }")

        lines.append("    %% Relationships")

        for dim_name in metadata.dim_tables:
            related_facts = RELATIONSHIPS.get(dim_name, [])
            for fact_name in related_facts:
                if fact_name in metadata.fact_tables:
                    # 提取 key 名稱
                    key_col = dim_name.replace('dim_', '') + '_id'
                    if dim_name == 'dim_postal':
                        key_col = 'postal_code'
                    lines.append(f"    {dim_name} ||--o{{ {fact_name} : \"{key_col}\"")

        return "\n".join(lines)

    def _map_bq_type(self, bq_type: str) -> str:
        """BigQuery 類型映射到 Mermaid 類型"""
        type_map = {
            'STRING': 'string',
            'INT64': 'number',
            'FLOAT64': 'number',
            'NUMERIC': 'number',
            'DECIMAL': 'number',
            'BIGNUMERIC': 'number',
            'BOOL': 'boolean',
            'BOOLEAN': 'boolean',
            'DATE': 'date',
            'DATETIME': 'datetime',
            'TIMESTAMP': 'timestamp',
            'TIME': 'time',
            'JSON': 'json',
            'BYTES': 'bytes',
            'GEOGRAPHY': 'geography',
        }
        return type_map.get(bq_type.upper(), 'string')

    def generate_stats(self) -> Dict[str, Any]:
        """
        生成統計資訊（使用動態元數據）

        Returns:
            統計資訊字典
        """
        metadata = self.get_metadata()

        stats: Dict[str, Any] = {
            'fact_tables': {},
            'dim_tables': {},
            'total_records': 0,
            'total_tables': metadata.total_tables,
            'last_updated_at': metadata.fetched_at,
        }

        # 事實表統計
        for name, table in metadata.fact_tables.items():
            display_name = TABLE_DISPLAY_NAMES.get(name, name)
            stats['fact_tables'][name] = {
                'name': display_name,
                'count': table.row_count,
            }
            stats['total_records'] += table.row_count

        # 維度表統計
        for name, table in metadata.dim_tables.items():
            display_name = TABLE_DISPLAY_NAMES.get(name, name)
            stats['dim_tables'][name] = {
                'name': display_name,
                'count': table.row_count,
            }
            stats['total_records'] += table.row_count

        return stats

    def generate_html(self, level: str = "overview") -> str:
        """
        生成完整的 HTML 頁面

        Args:
            level: 詳細程度

        Returns:
            HTML 字串
        """
        mermaid_code = self.generate_mermaid(level)
        stats = self.generate_stats()

        html = f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RagicEDP 星狀模型</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        h1 {{
            color: #1890ff;
            text-align: center;
        }}
        .update-info {{
            text-align: center;
            color: #888;
            font-size: 12px;
            margin-bottom: 16px;
        }}
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        .stat-card {{
            background: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .stat-card h3 {{
            margin: 0 0 8px 0;
            color: #666;
            font-size: 14px;
        }}
        .stat-card .value {{
            font-size: 24px;
            font-weight: bold;
            color: #1890ff;
        }}
        .diagram {{
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow-x: auto;
        }}
        .mermaid {{
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>RagicEDP 星狀模型圖</h1>
        <div class="update-info">
            資料來源: BigQuery INFORMATION_SCHEMA (動態讀取)
        </div>

        <div class="stats">
            <div class="stat-card">
                <h3>總表格數</h3>
                <div class="value">{stats['total_tables']}</div>
            </div>
            <div class="stat-card">
                <h3>總記錄數</h3>
                <div class="value">{stats['total_records']:,}</div>
            </div>
            <div class="stat-card">
                <h3>事實表</h3>
                <div class="value">{len(stats['fact_tables'])}</div>
            </div>
            <div class="stat-card">
                <h3>維度表</h3>
                <div class="value">{len(stats['dim_tables'])}</div>
            </div>
        </div>

        <div class="diagram">
            <div class="mermaid">
{mermaid_code}
            </div>
        </div>
    </div>

    <script>
        mermaid.initialize({{
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'strict',
            er: {{
                useMaxWidth: true,
                layoutDirection: 'TB'
            }}
        }});
    </script>
</body>
</html>"""

        return html
