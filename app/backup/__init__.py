"""
備份模組

包含:
- incremental.py: 增量備份核心 (v3)
- main.py: Cloud Function 入口
- full_backup.py: 全量備份
- manual_backup.py: 手動補抓
- bigquery_uploader.py: BQ 上傳
- config.py: 配置管理
"""

__version__ = "3.0.0"
