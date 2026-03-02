/**
 * Ragic Sheet 配置 — 移植自 Python app/backup/config.py
 */

export type RagicSheetConfig = {
  /** Sheet 代碼 (e.g. "50") */
  code: string;
  /** 中文名稱 */
  name: string;
  /** Ragic API 路徑 (e.g. "forms8/17") */
  ragicPath: string;
  /** 最後修改日期欄位 ID（用於 incremental 篩選） */
  lastModifiedFieldId: string;
  /** 關鍵欄位：BQ column name → Ragic 中文欄位名 */
  keyFields: Record<string, string>;
};

export const RAGIC_SHEETS: RagicSheetConfig[] = [
  {
    code: "10",
    name: "品牌管理",
    ragicPath: "forms8/5",
    lastModifiedFieldId: "1000950",
    keyFields: {
      brand_code: "品牌編號",
      brand_name: "品牌名稱",
    },
  },
  {
    code: "20",
    name: "通路管理",
    ragicPath: "forms8/4",
    lastModifiedFieldId: "1000939",
    keyFields: {
      channel_code: "通路編號",
      channel_name: "通路名稱",
    },
  },
  {
    code: "30",
    name: "金流管理",
    ragicPath: "forms8/7",
    lastModifiedFieldId: "1000961",
    keyFields: {
      payment_code: "金流編號",
      payment_name: "金流名稱",
    },
  },
  {
    code: "40",
    name: "物流管理",
    ragicPath: "forms8/1",
    lastModifiedFieldId: "1000750",
    keyFields: {
      logistics_code: "物流編號",
      logistics_name: "物流名稱",
    },
  },
  {
    code: "41",
    name: "郵遞區號",
    ragicPath: "forms8/6",
    lastModifiedFieldId: "1000972",
    keyFields: {
      zipcode: "郵遞區號",
      city: "縣市",
      district: "鄉鎮市區",
    },
  },
  {
    code: "50",
    name: "訂單管理",
    ragicPath: "forms8/17",
    lastModifiedFieldId: "1000990",
    keyFields: {
      order_code: "訂單編號",
      customer_code: "客戶編號",
      order_date: "訂單成立日期",
      order_amount: "訂單實收",
      status: "使用狀態",
    },
  },
  {
    code: "60",
    name: "客戶管理",
    ragicPath: "forms8/2",
    lastModifiedFieldId: "1000730",
    keyFields: {
      customer_code: "客戶編號",
      customer_name: "客戶名稱",
      phone: "行動電話",
      email: "E-mail",
    },
  },
  {
    code: "70",
    name: "商品管理",
    ragicPath: "forms8/9",
    lastModifiedFieldId: "1001013",
    keyFields: {
      product_code: "商品編號",
      product_name: "商品名稱",
      price: "商品常態售價",
      product_series: "商品系列",
      brand_code: "品牌編號",
    },
  },
  {
    code: "80",
    name: "活動管理",
    ragicPath: "forms8/10",
    lastModifiedFieldId: "1001030",
    keyFields: {
      campaign_code: "活動編號",
      campaign_name: "活動名稱",
      start_date: "活動開始日期",
      end_date: "活動結束日期",
    },
  },
  {
    code: "99",
    name: "訂單明細",
    ragicPath: "forms8/3",
    lastModifiedFieldId: "1000834",
    keyFields: {
      order_code: "訂單編號",
      product_code: "商品編號",
      order_amount: "訂單實收",
      quantity: "數量",
      channel_code: "通路編號",
      channel_name: "通路名稱",
      shipping_income: "運費收入",
    },
  },
];

/** 用中文名稱、代碼或關鍵字找 Sheet */
export function findSheet(query: string): RagicSheetConfig | undefined {
  const q = query.toLowerCase().trim();
  return RAGIC_SHEETS.find(
    (s) =>
      s.code === q ||
      s.name === q ||
      s.name.includes(q) ||
      q.includes(s.name),
  );
}

/** 取得所有 Sheet 的摘要（用於 LLM prompt） */
export function formatSheetsForPrompt(): string {
  return RAGIC_SHEETS.map(
    (s) => `- ${s.name} (code=${s.code}): 欄位 ${Object.values(s.keyFields).join(", ")}`,
  ).join("\n");
}
