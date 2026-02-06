#!/usr/bin/env python3
from google.cloud import bigquery


def create_chinese_view():
    client = bigquery.Client(project="b25h01-ragic")

    # 01 | 本月每日銷售趨勢 - 欄位全中文
    sql = """
    CREATE OR REPLACE VIEW `b25h01-ragic.erp_backup.ls_v_01_chinese_trend` AS
    SELECT 
      order_date AS `日期`,
      SUM(order_amount) AS `單日營收`
    FROM `b25h01-ragic.erp_backup.fact_orders`
    WHERE order_date >= DATE_TRUNC(CURRENT_DATE('Asia/Taipei'), MONTH)
    GROUP BY 1
    ORDER BY 1
    """

    query_job = client.query(sql)
    query_job.result()
    print("已成功建立全中文欄位視圖: ls_v_01_chinese_trend")


if __name__ == "__main__":
    create_chinese_view()
