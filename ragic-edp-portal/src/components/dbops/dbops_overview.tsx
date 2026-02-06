"use client";

import { useMemo, useState, useTransition } from "react";

import { executeSql, getJoinHealth, nlToSql, previewData } from "@/actions/db-ops";
import type { DbOpsSchemaV0, DbOpsSqlResultV0, JoinHealthReportV0, PaginatedV0, ResultV0, SchemaNodeV0 } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/i18n";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-background p-4 shadow-sm">{children}</div>;
}

function SchemaTree({ data, onSelect }: { data: SchemaNodeV0[]; onSelect: (node: SchemaNodeV0) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      {data.map((node, i) => (
        <div key={i} className="pl-2">
          <div
            className={`flex items-center gap-2 py-1 text-sm ${node.kind === "table" ? "cursor-pointer hover:text-primary" : "text-muted-foreground"}`}
            onClick={() => node.kind === "table" && onSelect(node)}
          >
            <span className="text-xs uppercase opacity-70">{node.kind === "dataset" ? "DS" : node.kind === "table" ? "TBL" : "FLD"}</span>
            <span>{node.name}</span>
          </div>
          {node.children && (
            <div className="border-l pl-2">
              <SchemaTree data={node.children} onSelect={onSelect} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function DbOpsOverview(props: { initialSchema: ResultV0<DbOpsSchemaV0> }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  const [prompt, setPrompt] = useState("");
  const [nlResult, setNlResult] = useState<{ sql: string; explanation: string } | null>(null);
  const [sqlResult, setSqlResult] = useState<ResultV0<DbOpsSqlResultV0> | null>(null);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResultV0<PaginatedV0<Record<string, unknown>>> | null>(null);

  const [joinResult, setJoinResult] = useState<ResultV0<JoinHealthReportV0> | null>(null);

  async function onNlRun() {
    startTransition(async () => {
      setSqlResult(null);
      const res = await nlToSql({ prompt });
      if (res.ok) setNlResult(res.data);
    });
  }

  async function onSqlExecute() {
    if (!nlResult) return;
    startTransition(async () => {
      const res = await executeSql({ sql: nlResult.sql });
      setSqlResult(res);
    });
  }

  async function onSelectTable(node: SchemaNodeV0) {
    setSelectedTable(node.name);
    startTransition(async () => {
      const res = await previewData({ tableCode: node.name, page: 1, limit: 10 });
      setPreview(res);
    });
  }

  async function onCheckJoin() {
    startTransition(async () => {
      const res = await getJoinHealth({ joinName: "orders_customers" });
      setJoinResult(res);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("dbops.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dbops.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("dbops.schema")}</div>
            <div className="mt-4 max-h-[400px] overflow-y-auto">
              {!props.initialSchema.ok ? (
                <div className="text-sm text-destructive">{props.initialSchema.error.message}</div>
              ) : (
                <SchemaTree data={props.initialSchema.data} onSelect={onSelectTable} />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("dbops.nl")}</div>
            <div className="mt-2 flex gap-2">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("dbops.promptPlaceholder")}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
              <button
                onClick={onNlRun}
                disabled={isPending}
                className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {t("dbops.run")}
              </button>
            </div>

            {nlResult && (
              <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                <div className="text-xs font-mono text-muted-foreground">{nlResult.sql}</div>
                <div className="mt-1 text-xs text-muted-foreground">{nlResult.explanation}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={onSqlExecute}
                    disabled={isPending}
                    className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                  >
                    {t("dbops.execute")}
                  </button>
                  <button
                    onClick={() => setNlResult(null)}
                    className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border px-3 text-xs hover:bg-muted/50"
                  >
                    {t("dbops.cancel")}
                  </button>
                </div>
              </div>
            )}

            {sqlResult && (
              <div className="mt-4">
                <div className="text-xs font-medium uppercase text-muted-foreground mb-2">{t("ai.result")}</div>
                {!sqlResult.ok ? (
                  <div className="text-sm text-destructive">{sqlResult.error.message}</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <pre className="p-3 text-xs">{JSON.stringify(sqlResult.data.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </Card>

          {selectedTable && (
            <Card>
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  {t("dbops.preview")}: {selectedTable}
                </div>
                <div className="text-xs text-muted-foreground">{isPending ? t("common.loading") : ""}</div>
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border">
                {!preview ? null : !preview.ok ? (
                  <div className="p-4 text-sm text-destructive">{preview.error.message}</div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        {preview.data.items.length > 0 &&
                          Object.keys(preview.data.items[0]).map((k) => (
                            <th key={k} className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
                              {k}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.data.items.map((row, i) => (
                        <tr key={i} className="border-t hover:bg-muted/30">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-4 py-2 font-mono text-xs">
                              {String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase text-muted-foreground">{t("dbops.joinHealth")}</div>
              <button
                onClick={onCheckJoin}
                className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md border px-3 text-xs hover:bg-muted/50"
              >
                Run Check
              </button>
            </div>
            {joinResult && joinResult.ok && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="text-sm font-medium">Match Rate</div>
                  <div
                    className={`text-xl font-bold ${
                      joinResult.data.matchRate >= 0.9 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {(joinResult.data.matchRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ({joinResult.data.matchedCount} / {joinResult.data.matchedCount + joinResult.data.unmatchedCount})
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">{t("dbops.reasons")}</div>
                  {joinResult.data.reasonsTop.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="font-mono">{r.code}</div>
                      <div>
                        {r.count} ({(r.ratio * 100).toFixed(1)}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
