"use server";

import { randomUUID } from "node:crypto";
import { BigQuery } from "@google-cloud/bigquery";

import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { validateSql } from "@/lib/ai/sql-safety";
import { generateSql } from "@/lib/ai/sql-generator";
import type { DbOpsSchemaV0, DbOpsSqlResultV0, PaginatedV0, ResultV0, SchemaNodeV0 } from "@/lib/data/types";

const QUERY_PROJECT_ID = process.env.GCP_PROJECT_ID || "b25h01-ragic";
const LOCATION = "asia-east1";
const MAX_PREVIEW_LIMIT = 100;
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;
const DATASET_SOURCES = [
  { projectId: "b25h01", dataset: "ga4_analytics", icon: "📈" },
  { projectId: "b25h01-ragic", dataset: "erp_backup", icon: "🧾" },
] as const;
let cachedSchema: DbOpsSchemaV0 | null = null;
let cachedSchemaAt = 0;

function getBq() {
  return new BigQuery({ projectId: QUERY_PROJECT_ID, location: LOCATION });
}

async function requireAuthorizedSession() {
  const session = await auth();
  assertAuthorized(session);
}

function errorResult(err: unknown): ResultV0<never> {
  const message = err instanceof Error ? err.message : String(err);
  return { ok: false, error: { code: "SERVER_ERROR", message } };
}

function toSerializableValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => toSerializableValue(v));

  if (typeof value === "object") {
    if ("value" in (value as Record<string, unknown>)) {
      return toSerializableValue((value as { value?: unknown }).value);
    }

    const plain: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      plain[k] = toSerializableValue(v);
    }
    return plain;
  }

  return String(value);
}

function toSerializableRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = toSerializableValue(v);
    return out;
  });
}

function isAllowlistedTable(tableCode: string): boolean {
  return DATASET_SOURCES.some(({ projectId, dataset }) => tableCode.startsWith(`${projectId}.${dataset}.`));
}

async function loadGa4Schema(search?: string): Promise<DbOpsSchemaV0> {
  const canUseCache = !search || search.trim() === "";
  if (canUseCache && cachedSchema && Date.now() - cachedSchemaAt < SCHEMA_CACHE_TTL_MS) {
    return cachedSchema;
  }

  const bq = getBq();
  const q = search?.trim().toLowerCase() ?? "";
  const nodes: SchemaNodeV0[] = [];

  for (const source of DATASET_SOURCES) {
    const [rows] = await bq.query({
      query: `
        SELECT
          t.table_name,
          t.table_type,
          c.column_name,
          c.data_type
        FROM \`${source.projectId}.${source.dataset}.INFORMATION_SCHEMA.TABLES\` t
        JOIN \`${source.projectId}.${source.dataset}.INFORMATION_SCHEMA.COLUMNS\` c
          ON t.table_name = c.table_name
        ORDER BY t.table_name, c.ordinal_position
      `,
      location: LOCATION,
      useQueryCache: true,
    });

    const byTable = new Map<string, SchemaNodeV0>();
    for (const row of rows as Array<Record<string, string>>) {
      const tableName = row.table_name;
      const tableCode = `${source.projectId}.${source.dataset}.${tableName}`;
      // 過濾 ga4_analytics 中的原始 VIEW（只保留 mat_ 物化表）
      if (source.dataset === "ga4_analytics" && !tableName.startsWith("mat_")) continue;
      const hit = !q || tableCode.toLowerCase().includes(q) || tableName.toLowerCase().includes(q);
      if (!hit) continue;

      if (!byTable.has(tableCode)) {
        byTable.set(tableCode, {
          kind: "table",
          name: tableCode,
          zhName: tableName,
          tableType: row.table_type === "VIEW" ? "VIEW" : "BASE TABLE",
          children: [],
        });
      }
      byTable.get(tableCode)!.children!.push({
        kind: "field",
        name: row.column_name,
        zhName: row.column_name,
        dataType: row.data_type,
      });
    }

    nodes.push({
      kind: "category",
      name: `${source.projectId}.${source.dataset}`,
      zhName: `${source.projectId}.${source.dataset}`,
      icon: source.icon,
      children: Array.from(byTable.values()),
    });
  }

  const result = nodes.filter((n) => (n.children?.length ?? 0) > 0);
  if (canUseCache) {
    cachedSchema = result;
    cachedSchemaAt = Date.now();
  }
  return result;
}

export async function getGA4Schema(input: { search?: string }): Promise<ResultV0<DbOpsSchemaV0>> {
  try {
    await requireAuthorizedSession();
    return { ok: true, data: await loadGa4Schema(input.search) };
  } catch (err) {
    return errorResult(err);
  }
}

export async function previewGA4Data(input: {
  tableCode: string;
  page: number;
  limit: number;
}): Promise<ResultV0<PaginatedV0<Record<string, unknown>>>> {
  try {
    await requireAuthorizedSession();
    const tableCode = input.tableCode.replace(/[^a-zA-Z0-9_.-]/g, "");
    if (!isAllowlistedTable(tableCode)) {
      return { ok: false, error: { code: "TABLE_BLOCKED", message: "資料表不在允許清單內" } };
    }

    const schema = await loadGa4Schema();
    const knownTables = new Set(
      schema.flatMap((cat) => (cat.children ?? []).map((t) => t.name)),
    );
    if (!knownTables.has(tableCode)) {
      return { ok: false, error: { code: "TABLE_NOT_FOUND", message: `找不到資料表: ${tableCode}` } };
    }

    const [projectId, dataset, table] = tableCode.split(".");
    if (!projectId || !dataset || !table) {
      return { ok: false, error: { code: "TABLE_FORMAT_ERROR", message: `資料表格式錯誤: ${tableCode}` } };
    }
    const page = Math.max(1, input.page);
    const limit = Math.min(Math.max(1, input.limit), MAX_PREVIEW_LIMIT);
    const offset = (page - 1) * limit;
    const bq = getBq();

    const [rows] = await bq.query({
      query: `SELECT * FROM \`${projectId}.${dataset}.${table}\` LIMIT ${limit + 1} OFFSET ${offset}`,
      location: LOCATION,
      useQueryCache: true,
    });
    const rawRows = rows as Array<Record<string, unknown>>;
    const hasMore = rawRows.length > limit;
    const pageRows = hasMore ? rawRows.slice(0, limit) : rawRows;
    const estimatedTotal = hasMore ? (page - 1) * limit + limit + 1 : (page - 1) * limit + pageRows.length;

    return {
      ok: true,
      data: {
        items: toSerializableRows(pageRows),
        page,
        limit,
        total: estimatedTotal,
      },
    };
  } catch (err) {
    return errorResult(err);
  }
}

export async function executeGA4Sql(input: { sql: string }): Promise<ResultV0<DbOpsSqlResultV0>> {
  const correlationId = randomUUID();
  try {
    await requireAuthorizedSession();
    const safety = validateSql(input.sql);
    if (!safety.safe) {
      return { ok: false, error: { code: "SQL_BLOCKED", message: safety.reason } };
    }

    const sqlUpper = safety.sql.toUpperCase();
    const allowedRefs = DATASET_SOURCES.map((s) => `${s.projectId}.${s.dataset}`.toUpperCase());
    if (!allowedRefs.some((ref) => sqlUpper.includes(ref))) {
      return {
        ok: false,
        error: {
          code: "DATASET_BLOCKED",
          message: `SQL 必須查詢以下資料集其中之一: ${DATASET_SOURCES.map((s) => `${s.projectId}.${s.dataset}`).join(", ")}`,
        },
      };
    }

    const bq = getBq();
    const start = Date.now();
    const [job] = await bq.createQueryJob({ query: safety.sql, location: LOCATION, useQueryCache: true });
    const [rows] = await job.getQueryResults({ maxResults: 10000 });
    const [metadata] = await job.getMetadata();

    return {
      ok: true,
      data: {
        data: toSerializableRows(rows as Array<Record<string, unknown>>),
        trace: {
          correlationId,
          mode: "real",
          sourceSurface: { type: "QUERY", name: "ga4_ops" },
          sql: safety.sql,
          bytesProcessed: Number(metadata.statistics?.totalBytesProcessed ?? 0),
          executionMs: Date.now() - start,
          cacheHit: metadata.statistics?.query?.cacheHit ?? false,
          readonlyValidated: true,
          allowlistValidated: true,
        },
      },
    };
  } catch (err) {
    return errorResult(err);
  }
}

export async function nlToGA4Sql(input: { prompt: string }): Promise<ResultV0<{ sql: string; explanation: string }>> {
  try {
    await requireAuthorizedSession();
    const correlationId = randomUUID();
    const result = await generateSql(input.prompt, correlationId);
    if (!result.safetyCheck.safe) {
      return { ok: false, error: { code: "SQL_UNSAFE", message: result.safetyCheck.reason } };
    }
    return {
      ok: true,
      data: {
        sql: result.safetyCheck.sql,
        explanation: `Generated from prompt: ${input.prompt.slice(0, 120)}`,
      },
    };
  } catch (err) {
    return errorResult(err);
  }
}
