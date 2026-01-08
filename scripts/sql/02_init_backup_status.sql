-- Ragic ERP Backup System v2
-- 初始化 backup_status 表資料
-- 建立日期: 2025-12-30

INSERT INTO `b25h01-ragic.erp_backup.backup_status`
  (sheet_code, sheet_name, bq_table_name, ragic_path, status, updated_at)
VALUES
  ('10', '品牌管理', 'sheet_10_brand', 'forms8/5', 'active', CURRENT_TIMESTAMP()),
  ('20', '通路管理', 'sheet_20_channel', 'forms8/4', 'active', CURRENT_TIMESTAMP()),
  ('30', '金流管理', 'sheet_30_payment', 'forms8/7', 'active', CURRENT_TIMESTAMP()),
  ('40', '物流管理', 'sheet_40_logistics', 'forms8/1', 'active', CURRENT_TIMESTAMP()),
  ('41', '郵遞區號', 'sheet_41_zipcode', 'forms8/6', 'active', CURRENT_TIMESTAMP()),
  ('50', '訂單管理', 'sheet_50_order', 'forms8/17', 'active', CURRENT_TIMESTAMP()),
  ('60', '客戶管理', 'sheet_60_customer', 'forms8/2', 'active', CURRENT_TIMESTAMP()),
  ('70', '商品管理', 'sheet_70_product', 'forms8/9', 'active', CURRENT_TIMESTAMP()),
  ('80', '活動管理', 'sheet_80_campaign', 'forms8/10', 'active', CURRENT_TIMESTAMP()),
  ('99', '訂單明細', 'sheet_99_order_detail', 'forms8/3', 'active', CURRENT_TIMESTAMP());
