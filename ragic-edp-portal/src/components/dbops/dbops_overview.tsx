"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

import { executeSql, nlToSql, previewData } from "@/actions/db-ops";
import type { DbOpsSchemaV0, DbOpsSqlResultV0, PaginatedV0, ResultV0, SchemaNodeV0 } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/i18n";
import { EmptyState, ErrorState } from "@/components/states/common_states";

const PAGE_SIZE = 100;

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function LoadingInline({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status" aria-live="polite">
      <Spinner />
      <span>{message}</span>
    </div>
  );
}


function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-background p-4 shadow-sm">{children}</div>;
}

/* ─── Schema Tree (categorized with Chinese labels) ─── */

function SchemaTree({ data, onSelect }: { data: SchemaNodeV0[]; onSelect: (node: SchemaNodeV0) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Expand first two categories by default
    const init = new Set<string>();
    data.slice(0, 2).forEach((cat) => init.add(cat.name));
    return init;
  });
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const toggle = (key: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  // Filter by search
  const filteredData = search.trim()
    ? data.map((cat) => ({
        ...cat,
        children: cat.children?.filter((tbl) => {
          const q = search.toLowerCase();
          return tbl.name.toLowerCase().includes(q)
            || (tbl.zhName ?? "").includes(q)
            || (tbl.description ?? "").includes(q);
        }),
      })).filter((cat) => cat.children && cat.children.length > 0)
    : data;

  return (
    <div className="space-y-1">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋表格名稱..."
        className="mb-3 h-8 w-full rounded-md border bg-background px-3 text-xs"
      />
      {filteredData.map((cat) => (
        <div key={cat.name}>
          {/* Category header */}
          <button
            onClick={() => toggle(cat.name, expanded, setExpanded)}
            className="flex w-full items-center gap-1.5 rounded px-1 py-1.5 text-xs font-semibold hover:bg-muted/50"
          >
            <span className="text-sm">{cat.icon}</span>
            <span>{cat.zhName}</span>
            <span className="ml-auto text-muted-foreground">{cat.children?.length ?? 0}</span>
            <span className="text-muted-foreground">{expanded.has(cat.name) ? "▾" : "▸"}</span>
          </button>

          {/* Tables in category */}
          {expanded.has(cat.name) && cat.children?.map((tbl) => (
            <div key={tbl.name} className="ml-4 border-l pl-2">
              <div className="flex items-center gap-1 py-0.5">
                {/* Expand toggle */}
                <button
                  onClick={() => toggle(tbl.name, expandedTables, setExpandedTables)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  {expandedTables.has(tbl.name) ? "▾" : "▸"}
                </button>
                {/* Table name (clickable for preview) */}
                <button
                  onClick={() => onSelect(tbl)}
                  className="group flex flex-1 min-w-0 flex-col text-left text-xs hover:text-primary"
                  title={`${tbl.zhName ?? tbl.name}\n${tbl.name}\n${tbl.description ?? ""}`}
                >
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="shrink-0 rounded bg-muted/50 px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {tbl.tableType === "VIEW" ? "V" : "T"}
                    </span>
                    <span className="font-medium truncate">{tbl.zhName ?? tbl.name}</span>
                  </span>
                  <span className="ml-5 truncate font-mono text-[10px] text-muted-foreground group-hover:text-primary/70">{tbl.name}</span>
                </button>
              </div>

              {/* Fields (expanded) */}
              {expandedTables.has(tbl.name) && tbl.children && (
                <div className="ml-5 border-l pl-2 py-1">
                  {tbl.children.map((field) => (
                    <div key={field.name} className="flex items-baseline gap-2 py-0.5 text-[11px]">
                      <span className="min-w-[90px] font-mono text-muted-foreground">{field.name}</span>
                      <span className="text-muted-foreground/70">{field.zhName !== field.name ? field.zhName : ""}</span>
                      <span className="ml-auto shrink-0 rounded bg-muted/30 px-1 text-[10px] text-muted-foreground">{field.dataType}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Download Helpers ─── */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => {
      const v = row[c];
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename);
}

function exportExcel(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, filename);
}

/* ─── Paginated Data Table ─── */

function DataTable({
  rows,
  page,
  totalRows,
  onPageChange,
  isPending,
  allRows,
  exportName,
}: {
  rows: Record<string, unknown>[];
  page: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  isPending: boolean;
  allRows?: Record<string, unknown>[];
  exportName?: string;
}) {
  if (rows.length === 0) return <EmptyState title="無資料" message="查詢未返回任何結果" />;

  const columns = Object.keys(rows[0]);
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30">
            <tr>
              {columns.map((col) => (
                <th key={col} className="whitespace-nowrap px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t hover:bg-muted/30">
                {columns.map((col) => (
                  <td key={col} className="whitespace-nowrap px-3 py-1.5 font-mono text-xs">
                    {row[col] == null ? <span className="text-muted-foreground/50">NULL</span> : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>共 {totalRows.toLocaleString()} 筆，第 {page} / {totalPages} 頁</span>
          {(allRows ?? rows).length > 0 && (
            <span className="flex gap-1">
              <button onClick={() => exportCsv(allRows ?? rows, `${exportName ?? "data"}.csv`)} className="rounded border px-2 py-1 hover:bg-muted/50" title="下載 CSV">CSV</button>
              <button onClick={() => exportExcel(allRows ?? rows, `${exportName ?? "data"}.xlsx`)} className="rounded border px-2 py-1 hover:bg-muted/50" title="下載 Excel">Excel</button>
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={() => onPageChange(1)} disabled={page <= 1 || isPending} className="rounded border px-2 py-1 hover:bg-muted/50 disabled:opacity-40">«</button>
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1 || isPending} className="rounded border px-2 py-1 hover:bg-muted/50 disabled:opacity-40">‹</button>
          <span className="flex items-center px-2 font-medium">{page}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || isPending} className="rounded border px-2 py-1 hover:bg-muted/50 disabled:opacity-40">›</button>
          <button onClick={() => onPageChange(totalPages)} disabled={page >= totalPages || isPending} className="rounded border px-2 py-1 hover:bg-muted/50 disabled:opacity-40">»</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Overview ─── */

export function DbOpsOverview(props: { initialSchema: ResultV0<DbOpsSchemaV0> }) {
  const { t } = useI18n();

  // #1 Fix: Independent loading states per action
  const [nlLoading, setNlLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [nlResult, setNlResult] = useState<{ sql: string; explanation: string } | null>(null);
  const [nlError, setNlError] = useState<string | null>(null);
  const [sqlResult, setSqlResult] = useState<ResultV0<DbOpsSqlResultV0> | null>(null);
  const [sqlPage, setSqlPage] = useState(1);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedTableZh, setSelectedTableZh] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResultV0<PaginatedV0<Record<string, unknown>>> | null>(null);
  const [previewPage, setPreviewPage] = useState(1);

  // #3 Fix: Race condition protection via request IDs
  const previewReqId = useRef(0);

  const onNlRun = useCallback(async () => {
    if (!prompt.trim() || nlLoading) return;
    setNlLoading(true);
    setNlError(null);
    setNlResult(null);
    setSqlResult(null);
    setSqlPage(1);

    // Step 1: Generate SQL
    const nlRes = await nlToSql({ prompt });
    if (!nlRes.ok) {
      setNlError(nlRes.error.message);
      setNlLoading(false);
      return;
    }
    setNlResult(nlRes.data);

    // Step 2: Auto-execute (read-only enforced by sql-safety on server)
    const sqlRes = await executeSql({ sql: nlRes.data.sql });
    setSqlResult(sqlRes);
    setNlLoading(false);
  }, [prompt, nlLoading]);

  const onSelectTable = useCallback(async (node: SchemaNodeV0) => {
    setSelectedTable(node.name);
    setSelectedTableZh(node.zhName ?? node.name);
    setPreviewPage(1);
    setPreview(null);
    setPreviewLoading(true);
    const reqId = ++previewReqId.current;
    const res = await previewData({ tableCode: node.name, page: 1, limit: PAGE_SIZE });
    // #3: Only apply if this is still the latest request
    if (previewReqId.current === reqId) {
      setPreview(res);
      setPreviewLoading(false);
    }
  }, []);

  const onPreviewPageChange = useCallback(async (newPage: number) => {
    if (!selectedTable) return;
    setPreviewPage(newPage);
    setPreviewLoading(true);
    const reqId = ++previewReqId.current;
    const res = await previewData({ tableCode: selectedTable, page: newPage, limit: PAGE_SIZE });
    if (previewReqId.current === reqId) {
      setPreview(res);
      setPreviewLoading(false);
    }
  }, [selectedTable]);

  const sqlPagedRows = (() => {
    if (!sqlResult?.ok) return [];
    const allRows = sqlResult.data.data as Record<string, unknown>[];
    const start = (sqlPage - 1) * PAGE_SIZE;
    return allRows.slice(start, start + PAGE_SIZE);
  })();
  const sqlTotalRows = sqlResult?.ok ? (sqlResult.data.data as unknown[]).length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dbops.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dbops.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Schema Tree (left panel) */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("dbops.schema")}</div>
            <div className="mt-4 max-h-[600px] overflow-y-auto">
              {!props.initialSchema.ok ? (
                <ErrorState title={t("common.error")} message={props.initialSchema.error.message} />
              ) : (
                <SchemaTree data={props.initialSchema.data} onSelect={onSelectTable} />
              )}
            </div>
          </Card>
        </div>

        {/* Right panel */}
        <div className="space-y-6 lg:col-span-2">
          {/* NL-to-SQL */}
          <Card>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("dbops.nl")}</div>
            <div className="mt-2 flex gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.shiftKey && !nlLoading) {
                    e.preventDefault();
                    onNlRun();
                  }
                }}
                placeholder={t("dbops.promptPlaceholder")}
                rows={2}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={onNlRun}
                disabled={nlLoading || !prompt.trim()}
                className="inline-flex h-auto shrink-0 items-center gap-1.5 self-end whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {nlLoading && <Spinner className="text-primary-foreground" />}
                {t("dbops.run")}
              </button>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">Shift + Enter 送出</div>

            {nlLoading && (
              <LoadingInline message="AI 生成 SQL 中..." />
            )}

            {nlError && !nlLoading && (
              <div className="mt-4">
                <ErrorState title={t("common.error")} message={nlError} />
              </div>
            )}

            {nlResult && (
              <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-medium uppercase text-muted-foreground">生成的 SQL</div>
                  <button onClick={() => { setNlResult(null); setSqlResult(null); setNlError(null); }} className="text-[10px] text-muted-foreground hover:text-foreground">
                    清除
                  </button>
                </div>
                <div className="mt-1 text-xs font-mono text-muted-foreground break-all">{nlResult.sql}</div>
              </div>
            )}

            {sqlResult && !nlLoading && (
              <div className="mt-4">
                <div className="text-xs font-medium uppercase text-muted-foreground mb-2">{t("ai.result")}</div>
                {!sqlResult.ok ? (
                  <ErrorState title={t("common.error")} message={sqlResult.error.message} />
                ) : (
                  <DataTable rows={sqlPagedRows} page={sqlPage} totalRows={sqlTotalRows} onPageChange={setSqlPage} isPending={false} allRows={sqlResult.ok ? sqlResult.data.data as Record<string, unknown>[] : undefined} exportName="query_result" />
                )}
              </div>
            )}
          </Card>

          {/* Data Preview */}
          {selectedTable && (
            <Card>
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  {t("dbops.preview")}: {selectedTableZh} <span className="font-mono text-muted-foreground/70">({selectedTable})</span>
                </div>
                {previewLoading && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Spinner /> {t("common.loading")}</span>
                )}
              </div>
              <div className="mt-3">
                {previewLoading && !preview ? (
                  <LoadingInline message="載入資料中..." />
                ) : !preview ? (
                  <EmptyState title={t("kpi.noData")} message={t("dbops.subtitle")} />
                ) : !preview.ok ? (
                  <ErrorState title={t("common.error")} message={preview.error.message} />
                ) : (
                  <DataTable rows={preview.data.items} page={previewPage} totalRows={preview.data.total} onPageChange={onPreviewPageChange} isPending={previewLoading} exportName={selectedTable ?? "preview"} />
                )}
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
