"""
星狀模型生成器

生成 Mermaid 圖表和統計資訊
"""
from typing import Dict, List, Any, Optional
import logging
import os
import re

from google.cloud import bigquery

logger = logging.getLogger(__name__)

# BigQuery identifier 白名單驗證（project 可含 '-'，dataset/table 通常只含 '_'）
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


class StarSchemaGenerator:
    """星狀模型圖生成器"""

    # 事實表
    FACT_TABLES = ['fact_orders', 'fact_order_details']

    # 維度表與關聯（key_en 用於 Mermaid，key 用於顯示）
    DIM_TABLES = {
        'dim_brand': {
            'name': '品牌表',
            'key': '品牌編號',
            'key_en': 'brand_id',
            'facts': ['fact_order_details'],
        },
        'dim_channel': {
            'name': '通路表',
            'key': '通路編號',
            'key_en': 'channel_id',
            'facts': ['fact_orders'],
        },
        'dim_payment': {
            'name': '金流表',
            'key': '金流編號',
            'key_en': 'payment_id',
            'facts': ['fact_orders'],
        },
        'dim_logistics': {
            'name': '物流表',
            'key': '物流編號',
            'key_en': 'logistics_id',
            'facts': ['fact_orders'],
        },
        'dim_postal': {
            'name': '郵遞區號表',
            'key': '郵遞區號',
            'key_en': 'postal_code',
            'facts': ['fact_orders'],
        },
        'dim_customer': {
            'name': '客戶表',
            'key': '客戶編號',
            'key_en': 'customer_id',
            'facts': ['fact_orders'],
        },
        'dim_product': {
            'name': '商品表',
            'key': '商品編號',
            'key_en': 'product_id',
            'facts': ['fact_order_details'],
        },
        'dim_campaign': {
            'name': '活動管理表',
            'key': '活動編號',
            'key_en': 'campaign_id',
            'facts': ['fact_orders'],
        },
    }

    # 事實表欄位（使用英文欄位名稱給 Mermaid）
    FACT_FIELDS = {
        'fact_orders': {
            'name': '訂單表',
            'key': '訂單編號',
            'key_en': 'order_id',
            'measures': ['total_amount', 'discount'],
            'fks': ['customer_id', 'channel_id', 'payment_id', 'logistics_id', 'postal_code', 'campaign_id'],
        },
        'fact_order_details': {
            'name': '訂單明細表',
            'key': '訂單編號',
            'key_en': 'order_id',
            'measures': ['quantity', 'unit_price', 'subtotal', 'discount'],
            'fks': ['product_id', 'brand_id'],
        },
    }

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

    def generate_mermaid(self, level: str = "overview") -> str:
        """
        生成 Mermaid 圖表程式碼

        Args:
            level: "overview" 或 "detailed"

        Returns:
            Mermaid 程式碼
        """
        if level == "detailed":
            return self._generate_detailed_mermaid()
        return self._generate_overview_mermaid()

    def _generate_overview_mermaid(self) -> str:
        """生成概覽圖（使用英文欄位名稱）"""
        lines = [
            "erDiagram",
            "    %% Fact Tables",
        ]

        # 事實表
        for fact_table, info in self.FACT_FIELDS.items():
            lines.append(f"    {fact_table} {{")
            lines.append(f"        string {info['key_en']} PK")
            for measure in info['measures']:
                lines.append(f"        number {measure}")
            lines.append("    }")

        lines.append("    %% Dimension Tables")

        # 維度表
        for dim_table, info in self.DIM_TABLES.items():
            lines.append(f"    {dim_table} {{")
            lines.append(f"        string {info['key_en']} PK")
            lines.append("    }")

        lines.append("    %% Relationships")

        # 關聯
        for dim_table, info in self.DIM_TABLES.items():
            for fact_table in info['facts']:
                lines.append(f"    {dim_table} ||--o{{ {fact_table} : \"\"")

        return "\n".join(lines)

    def _generate_detailed_mermaid(self) -> str:
        """生成詳細圖（含所有欄位，使用英文名稱）"""
        lines = [
            "erDiagram",
            "    %% Fact Tables with all fields",
        ]

        # 事實表
        for fact_table, info in self.FACT_FIELDS.items():
            lines.append(f"    {fact_table} {{")
            lines.append(f"        string {info['key_en']} PK")
            for fk in info['fks']:
                lines.append(f"        string {fk} FK")
            for measure in info['measures']:
                lines.append(f"        number {measure}")
            lines.append("        timestamp order_date")
            lines.append("        timestamp backup_date")
            lines.append("    }")

        lines.append("    %% Dimension Tables with all fields")

        # 維度表額外欄位（英文）
        dim_extra_fields = {
            'dim_brand': ['brand_name'],
            'dim_channel': ['channel_name', 'brand_id', 'phone', 'email'],
            'dim_payment': ['payment_name'],
            'dim_logistics': ['logistics_name'],
            'dim_postal': ['city', 'district'],
            'dim_customer': ['customer_name', 'mobile', 'phone', 'email', 'tax_id'],
            'dim_product': ['product_name', 'brand_id', 'unit_price'],
            'dim_campaign': ['campaign_name', 'start_date', 'end_date'],
        }

        for dim_table, info in self.DIM_TABLES.items():
            lines.append(f"    {dim_table} {{")
            lines.append(f"        string {info['key_en']} PK")
            for field in dim_extra_fields.get(dim_table, []):
                field_type = "timestamp" if "date" in field else "string"
                lines.append(f"        {field_type} {field}")
            lines.append("        timestamp backup_date")
            lines.append("    }")

        lines.append("    %% Relationships")

        # 關聯
        for dim_table, info in self.DIM_TABLES.items():
            for fact_table in info['facts']:
                lines.append(f"    {dim_table} ||--o{{ {fact_table} : \"{info['key_en']}\"")

        return "\n".join(lines)

    def generate_stats(self) -> Dict[str, Any]:
        """
        生成統計資訊

        Returns:
            統計資訊字典
        """
        stats = {
            'fact_tables': {},
            'dim_tables': {},
            'total_records': 0,
            'total_tables': len(self.FACT_TABLES) + len(self.DIM_TABLES),
        }

        # 查詢各表記錄數
        for fact_table in self.FACT_TABLES:
            try:
                count = self._get_table_count(fact_table)
                stats['fact_tables'][fact_table] = {
                    'name': self.FACT_FIELDS[fact_table]['name'],
                    'count': count,
                }
                stats['total_records'] += count
            except Exception as e:
                logger.warning(f"查詢 {fact_table} 失敗: {e}")
                stats['fact_tables'][fact_table] = {
                    'name': self.FACT_FIELDS[fact_table]['name'],
                    'count': 0,
                    'error': str(e),
                }

        for dim_table, info in self.DIM_TABLES.items():
            try:
                count = self._get_table_count(dim_table)
                stats['dim_tables'][dim_table] = {
                    'name': info['name'],
                    'count': count,
                }
                stats['total_records'] += count
            except Exception as e:
                logger.warning(f"查詢 {dim_table} 失敗: {e}")
                stats['dim_tables'][dim_table] = {
                    'name': info['name'],
                    'count': 0,
                    'error': str(e),
                }

        return stats

    def _get_table_count(self, table_name: str) -> int:
        """
        取得表格記錄數

        Args:
            table_name: 表格名稱（已在 FACT_TABLES/DIM_TABLES 中定義）

        Returns:
            記錄數量
        """
        # 額外驗證 table_name（即使來自常數也做防護）
        validated_table = _validate_identifier(table_name, "table_name")

        query = f"""
            SELECT COUNT(*) as count
            FROM `{self.project_id}.{self.dataset}.{validated_table}`
        """
        result = self.client.query(query).result()
        for row in result:
            return row.count
        return 0

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
