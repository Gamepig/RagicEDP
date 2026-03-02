"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/i18n";
import { getHistory } from "@/actions/correction";
import type { CorrectionHistoryItemV0, PaginatedV0, ResultV0, TableInfoV0 } from "@/lib/data/types";
import { LoadingState, EmptyState, ErrorState } from "@/components/states/common_states";

const TABLE_NAMES: Record<string, string> = {
  "10": "品牌表", "20": "通路表", "30": "金流表", "40": "物流表", "41": "郵遞區號表",
  "50": "訂單表", "60": "客戶表", "70": "商品表", "80": "活動管理表", "99": "訂單明細表",
};

const TABLE_COLORS: Record<string, string> = {
  "50": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "60": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "70": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "99": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export function CorrectionHistory({
  initialData,
  tables,
}: {
  initialData: ResultV0<PaginatedV0<CorrectionHistoryItemV0>>;
  tables: ResultV0<TableInfoV0[]>;
}) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [tableCode, setTableCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const items = data.ok ? data.data.items : [];
  const total = data.ok ? data.data.total : 0;
  const totalPages = Math.ceil(total / limit);
  const tableList = tables.ok ? tables.data : [];

  function refresh(tc: string, df: string, dt: string, p: number) {
    startTransition(async () => {
      const res = await getHistory({ tableCode: tc || undefined, dateFrom: df || undefined, dateTo: dt || undefined, page: p, limit });
      setData(res);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.correction.history")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} {t("correction.stats.completed")}</p>
      </div>

      <div className="rounded-xl border bg-background p-4 shadow-sm">
        {/* filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.table")}</div>
            <select
              value={tableCode}
              disabled={isPending}
              onChange={(e) => { const v = e.target.value; setTableCode(v); setPage(1); refresh(v, dateFrom, dateTo, 1); }}
              className="mt-1 h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">{t("filters.channelAll")}</option>
              {tableList.map((tbl) => (
                <option key={tbl.code} value={tbl.code}>{tbl.code} - {tbl.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.dateFrom")}</div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); refresh(tableCode, e.target.value, dateTo, 1); }}
              className="mt-1 h-9 rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.dateTo")}</div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); refresh(tableCode, dateFrom, e.target.value, 1); }}
              className="mt-1 h-9 rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>

        {/* table */}
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.recordId")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.table")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.correctedAt")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.corrector")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={5} className="py-4"><LoadingState /></td></tr>
              ) : !data.ok ? (
                <tr><td colSpan={5} className="py-4"><ErrorState title={t("common.error")} message={data.error.message} /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="py-4"><EmptyState title={t("kpi.noData")} /></td></tr>
              ) : (
                items.map((row) => (
                  <tr key={row.eventId} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{row.recordId ?? row.eventId}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TABLE_COLORS[row.tableCode ?? ""] ?? "bg-muted text-foreground"}`}>
                        {TABLE_NAMES[row.tableCode ?? ""] ?? row.tableCode ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(row.occurredAt).toLocaleString("zh-Hant")}</td>
                    <td className="px-4 py-3 text-xs">{row.actorEmail}</td>
                    <td className="px-4 py-3">
                      {row.action === "SUBMIT" ? (
                        <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {t("correction.action.corrected")}
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {t("correction.action.ignored")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>{page} / {totalPages}</span>
            <div className="flex gap-1">
              <button type="button" disabled={page <= 1 || isPending} onClick={() => { setPage(page - 1); refresh(tableCode, dateFrom, dateTo, page - 1); }} className="rounded-md border px-2 py-1 hover:bg-muted/50 disabled:opacity-50">&lt;</button>
              <button type="button" disabled={page >= totalPages || isPending} onClick={() => { setPage(page + 1); refresh(tableCode, dateFrom, dateTo, page + 1); }} className="rounded-md border px-2 py-1 hover:bg-muted/50 disabled:opacity-50">&gt;</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
