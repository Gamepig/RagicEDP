import "server-only";

import { RAGIC_SHEETS } from "./sheets";

const RAGIC_TIMEOUT_MS = 15_000;
const MAX_RECORDS = 100;

export type RagicRecord = Record<string, unknown> & {
  _ragicId?: number;
};

export type RagicQueryOptions = {
  /** Ragic where filter: "fieldId,operator,value" (can be array for AND/OR) */
  where?: string | string[];
  /** Max records to return (capped at 100) */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Reverse sort order (newest first) */
  reverse?: boolean;
  /** Exclude subtable data (default: true for performance) */
  excludeSubtables?: boolean;
};

export type RagicQueryResult = {
  records: RagicRecord[];
  sheetName: string;
  sheetCode: string;
  totalFetched: number;
};

function getRagicConfig() {
  const apiKey = process.env.RAGIC_API_KEY;
  if (!apiKey) throw new Error("Missing env: RAGIC_API_KEY");
  const baseUrl = process.env.RAGIC_BASE_URL || "https://ap6.ragic.com/grefun";
  return { apiKey, baseUrl };
}

function parseRagicResponse(data: Record<string, unknown>): RagicRecord[] {
  const records: RagicRecord[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) continue;
    if (typeof value !== "object" || value === null) continue;
    const record = value as RagicRecord;
    records.push(record);
  }
  return records;
}

/**
 * 查詢 Ragic 指定表單的資料
 */
export async function fetchRagicSheet(
  sheetCode: string,
  options?: RagicQueryOptions,
): Promise<RagicQueryResult> {
  const config = RAGIC_SHEETS.find((s) => s.code === sheetCode);
  if (!config) throw new Error(`Unknown Ragic sheet code: ${sheetCode}`);

  const { apiKey, baseUrl } = getRagicConfig();
  const limit = Math.min(options?.limit ?? MAX_RECORDS, MAX_RECORDS);

  const url = new URL(`${baseUrl}/${config.ragicPath}`);
  url.searchParams.set("api", "");
  url.searchParams.set("v", "3");
  url.searchParams.set("limit", String(limit));
  if (options?.offset) url.searchParams.set("offset", String(options.offset));

  // Support single or multiple where conditions (multiple = AND/OR logic per Ragic API)
  if (options?.where) {
    const wheres = Array.isArray(options.where) ? options.where : [options.where];
    for (const w of wheres) {
      url.searchParams.append("where", w);
    }
  }

  // Exclude subtables by default for performance
  if (options?.excludeSubtables !== false) {
    url.searchParams.set("subtables", "0");
  }

  // Reverse sort for newest-first queries
  if (options?.reverse) {
    url.searchParams.set("reverse", "true");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAGIC_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ragic API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();

    if (data.status === "ERROR") {
      throw new Error(`Ragic API error: ${data.msg || "unknown"}`);
    }

    const records = parseRagicResponse(data);

    return {
      records,
      sheetName: config.name,
      sheetCode: config.code,
      totalFetched: records.length,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 查詢 Ragic 單筆記錄（by ragicId）
 */
export async function fetchRagicRecord(
  sheetCode: string,
  ragicId: number,
): Promise<RagicRecord | null> {
  const config = RAGIC_SHEETS.find((s) => s.code === sheetCode);
  if (!config) throw new Error(`Unknown Ragic sheet code: ${sheetCode}`);

  const { apiKey, baseUrl } = getRagicConfig();

  const url = new URL(`${baseUrl}/${config.ragicPath}/${ragicId}`);
  url.searchParams.set("api", "");
  url.searchParams.set("v", "3");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAGIC_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === "ERROR") return null;

    const records = parseRagicResponse(data);
    return records[0] ?? null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 查詢最近修改的記錄（用於「最新資料」類查詢）
 */
export async function fetchRecentRecords(
  sheetCode: string,
  sinceDaysAgo = 7,
  limit = 50,
): Promise<RagicQueryResult> {
  const config = RAGIC_SHEETS.find((s) => s.code === sheetCode);
  if (!config) throw new Error(`Unknown Ragic sheet code: ${sheetCode}`);

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - sinceDaysAgo);
  const dateStr = sinceDate.toISOString().replace("T", " ").slice(0, 19).replace(/-/g, "/");
  const where = `${config.lastModifiedFieldId},gt,${dateStr}`;

  return fetchRagicSheet(sheetCode, { where, limit });
}
