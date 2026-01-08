"""
Ragic ERP Backup System v3 - 配置模組

簡化版：
- 移除 page_size、max_pages（不設 limit）
- 移除 status_field_id（不做 API 層過濾）
"""
import os
from typing import Dict, Any

# ============================================================
# Ragic API 配置
# ============================================================
RAGIC_CONFIG = {
    'api_key': os.environ.get('RAGIC_API_KEY', ''),
    'account': os.environ.get('RAGIC_ACCOUNT', 'grefun'),
    'server': os.environ.get('RAGIC_SERVER', 'ap6.ragic.com'),
    'base_url': 'https://ap6.ragic.com/grefun',
    'timeout': int(os.environ.get('RAGIC_TIMEOUT', '180')),
    'max_retries': int(os.environ.get('RAGIC_MAX_RETRIES', '3')),
}

# ============================================================
# BigQuery 配置
# ============================================================
BIGQUERY_CONFIG = {
    'project_id': os.environ.get('GCP_PROJECT_ID', 'b25h01-ragic'),
    'dataset': os.environ.get('BIGQUERY_DATASET', 'erp_backup'),
    'location': os.environ.get('BIGQUERY_LOCATION', 'asia-east1'),
}

# ============================================================
# 郵件配置
# ============================================================
EMAIL_CONFIG = {
    'smtp_server': os.environ.get('SMTP_SERVER', 'smtp.gmail.com'),
    'smtp_port': int(os.environ.get('SMTP_PORT', '587')),
    'from_email': os.environ.get('SMTP_FROM_EMAIL', 'gcp.ops.notifications@gmail.com'),
    'from_password': os.environ.get('SMTP_FROM_PASSWORD', ''),
    'to_email': os.environ.get('NOTIFICATION_EMAIL', 'gamepig1976@gmail.com'),
}

# ============================================================
# Sheet 配置
# ============================================================
SHEET_CONFIG: Dict[str, Dict[str, Any]] = {
    '10': {
        'name': '品牌管理',
        'bq_table': 'sheet_10_brand',
        'ragic_path': 'forms8/5',
        'last_modified_field_id': '1000950',
        'last_modified_field': '最後修改日期',
        'key_fields': {
            'brand_code': '品牌編號',
            'brand_name': '品牌名稱',
        },
    },
    '20': {
        'name': '通路管理',
        'bq_table': 'sheet_20_channel',
        'ragic_path': 'forms8/4',
        'last_modified_field_id': '1000939',
        'last_modified_field': '最後修改日期',
        'key_fields': {
            'channel_code': '通路編號',
            'channel_name': '通路名稱',
        },
    },
    '30': {
        'name': '金流管理',
        'bq_table': 'sheet_30_payment',
        'ragic_path': 'forms8/7',
        'last_modified_field_id': '1000961',
        'last_modified_field': '最後修改時間',  # 修正: 原 '最後修改日期'
        'key_fields': {
            'payment_code': '金流編號',
            'payment_name': '金流名稱',
        },
    },
    '40': {
        'name': '物流管理',
        'bq_table': 'sheet_40_logistics',
        'ragic_path': 'forms8/1',
        'last_modified_field_id': '1000750',
        'last_modified_field': '最後修改日期',
        'key_fields': {
            'logistics_code': '物流編號',
            'logistics_name': '物流名稱',
        },
    },
    '41': {
        'name': '郵遞區號',
        'bq_table': 'sheet_41_zipcode',
        'ragic_path': 'forms8/6',
        'last_modified_field_id': '1000972',
        'last_modified_field': '最後修改日期',
        'key_fields': {
            'zipcode': '郵遞區號',
            'city': '縣市',
            'district': '鄉鎮市區',  # 修正: 原 '區域'
        },
    },
    '50': {
        'name': '訂單管理',
        'bq_table': 'sheet_50_order',
        'ragic_path': 'forms8/17',
        'last_modified_field_id': '1000990',
        'last_modified_field': '最後修改日期',
        'key_fields': {
            'order_code': '訂單編號',
            # customer_code 已移除: 訂單表無此欄位
            'order_date': '訂單成立日期',  # 修正: 原 '訂單日期'
            'order_amount': '訂單實收',    # 修正: 原 '訂單金額'
        },
    },
    '60': {
        'name': '客戶管理',
        'bq_table': 'sheet_60_customer',
        'ragic_path': 'forms8/2',
        'last_modified_field_id': '1000730',
        'last_modified_field': '最後修改日期',
        'key_fields': {
            'customer_code': '客戶編號',
            'customer_name': '客戶名稱',
            'phone': '行動電話',  # 修正: 原 '電話'
            'email': 'E-mail',    # 修正: 原 'Email'
        },
    },
    '70': {
        'name': '商品管理',
        'bq_table': 'sheet_70_product',
        'ragic_path': 'forms8/9',
        'last_modified_field_id': '1001013',
        'last_modified_field': '最後修改日期',
        'key_fields': {
            'product_code': '商品編號',
            'product_name': '商品名稱',
            'price': '商品常態售價',  # 修正: 原 '單價'
        },
    },
    '80': {
        'name': '活動管理',
        'bq_table': 'sheet_80_campaign',
        'ragic_path': 'forms8/10',
        'last_modified_field_id': '1001030',
        'last_modified_field': '最後修改日期',
        'key_fields': {
            'campaign_code': '活動編號',
            'campaign_name': '活動名稱',
            'start_date': '活動開始日期',  # 修正: 原 '開始日期'
            'end_date': '活動結束日期',    # 修正: 原 '結束日期'
        },
    },
    '99': {
        'name': '訂單明細',
        'bq_table': 'sheet_99_order_detail',
        'ragic_path': 'forms8/3',
        'last_modified_field_id': '1000834',
        'last_modified_field': '最後修改日期',
        'key_fields': {
            'order_code': '訂單編號',
            'product_code': '商品編號',
            'order_amount': '訂單實收',
            'quantity': '數量',
            'unit_price': '商品常態售價',  # 修正: 原 '單價'
        },
    },
}

# 中文欄位名稱到欄位 ID 的映射（用於過濾邏輯）
FIELD_NAME_TO_ID = {
    '訂單編號': '1000781',
    '商品編號': '1000811',
    '訂單實收': '1000785',
    '品牌編號': '1000942',
    '通路編號': '1000921',
    '金流編號': '1000954',
    '物流編號': '1000736',
    '郵遞區號': '1000964',
    '客戶編號': '1000710',
    '活動編號': '1001019',
}
