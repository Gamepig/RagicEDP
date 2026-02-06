"use client";

import { useMemo, useState, useTransition } from "react";

import { getPendingRecords, getRecordDetail, ignoreCorrection, submitCorrection } from "@/actions/correction";
import type { PaginatedV0, PendingRecordV0, RecordDetailV0, ResultV0 } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/i18n";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-background p-4 shadow-sm">{children}</div>;
}

function Sheet(props: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={props.onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l bg-background shadow-xl">
        {props.children}
      </div>
    </div>
  );
}

export function CorrectionOverview(props: { initialPending: ResultV0<PaginatedV0<PendingRecordV0>> }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  const [tableCode, setTableCode] = useState<string>("");
  const [pending, setPending] = useState(props.initialPending);

  const [selected, setSelected] = useState<PendingRecordV0 | null>(null);
  const [detail, setDetail] = useState<ResultV0<RecordDetailV0> | null>(null);

  const items = useMemo(() => (pending.ok ? pending.data.items : []), [pending]);

  function refresh(nextTableCode: string) {
    startTransition(async () => {
      const res = await getPendingRecords({ tableCode: nextTableCode || undefined, page: 1, limit: 20 });
      setPending(res);
    });
  }

  async function openRow(row: PendingRecordV0) {
    setSelected(row);
    setDetail({ ok: true, data: { recordId: row.recordId, tableCode: row.tableCode, fields: {} } });
    const res = await getRecordDetail({ recordId: row.recordId });
    setDetail(res);
  }

  async function onIgnore() {
    if (!selected) return;
    await ignoreCorrection({ recordId: selected.recordId, tableCode: selected.tableCode });
    setPending((prev) => {
      if (!prev.ok) return prev;
      const nextItems = prev.data.items.filter((r) => r.recordId !== selected.recordId);
      return { ok: true, data: { ...prev.data, items: nextItems, total: Math.max(0, prev.data.total - 1) } };
    });
    setSelected(null);
    setDetail(null);
  }

  async function onSubmit() {
    if (!selected) return;
    await submitCorrection({ recordId: selected.recordId, tableCode: selected.tableCode, values: detail?.ok ? detail.data.fields : {} });
    setPending((prev) => {
      if (!prev.ok) return prev;
      const nextItems = prev.data.items.filter((r) => r.recordId !== selected.recordId);
      return { ok: true, data: { ...prev.data, items: nextItems, total: Math.max(0, prev.data.total - 1) } };
    });
    setSelected(null);
    setDetail(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("correction.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("correction.subtitle")}</p>
      </div>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.pending")}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {pending.ok ? `${pending.data.total} ${t("analytics.widgets")}` : t("common.error")}
            </div>
          </div>

          <div className="w-full md:w-64">
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.table")}</div>
            <select
              value={tableCode}
              disabled={isPending}
              onChange={(e) => {
                const v = e.target.value;
                setTableCode(v);
                refresh(v);
              }}
              className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">{t("filters.channelAll")}</option>
              <option value="sheet_10">sheet_10</option>
              <option value="sheet_20">sheet_20</option>
            </select>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.recordId")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.table")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-sm text-muted-foreground">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : !pending.ok ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-sm text-muted-foreground">
                    {pending.error.message}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-sm text-muted-foreground">
                    {t("kpi.noData")}
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.recordId} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{row.recordId}</td>
                    <td className="px-4 py-3 text-sm">{row.tableCode}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
                        onClick={() => openRow(row)}
                      >
                        {t("correction.open")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setDetail(null);
        }}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <div>
            <div className="text-sm font-semibold tracking-tight">{t("correction.detail")}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {selected?.recordId} · {selected?.tableCode}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
            onClick={() => {
              setSelected(null);
              setDetail(null);
            }}
          >
            {t("common.close")}
          </button>
        </div>

        <div className="h-[calc(100%-4rem)] overflow-auto p-6">
          {!detail ? null : !detail.ok ? (
            <div className="text-sm text-muted-foreground">{detail.error.message}</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.fields")}</div>
                <div className="mt-3 space-y-2">
                  {Object.keys(detail.data.fields).length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t("common.placeholderFields")}</div>
                  ) : (
                    Object.entries(detail.data.fields).map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-3">
                        <div className="text-xs font-medium text-muted-foreground">{k}</div>
                        <div className="min-w-0 flex-1 text-right font-mono text-xs">{String(v)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onIgnore}
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
                >
                  {t("correction.ignore")}
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                >
                  {t("correction.submit")}
                </button>
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
