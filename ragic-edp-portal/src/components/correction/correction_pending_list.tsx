"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { useI18n } from "@/lib/i18n/i18n";
import { getPendingRecords } from "@/actions/correction";
import type { PaginatedV0, PendingRecordV0, ResultV0, TableInfoV0 } from "@/lib/data/types";
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

function confidenceColor(c: number) {
  if (c >= 0.9) return "text-emerald-600";
  if (c >= 0.75) return "text-amber-600";
  return "text-red-500";
}

export function CorrectionPendingList({
  initialData,
  tables,
}: {
  initialData: ResultV0<PaginatedV0<PendingRecordV0>>;
  tables: ResultV0<TableInfoV0[]>;
}) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [tableCode, setTableCode] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const items = data.ok ? data.data.items : [];
  const total = data.ok ? data.data.total : 0;
  const totalPages = Math.ceil(total / limit);
  const tableList = tables.ok ? tables.data : [];

  function refresh(nextTableCode: string, nextPage: number) {
    startTransition(async () => {
      const res = await getPendingRecords({ tableCode: nextTableCode || undefined, page: nextPage, limit });
      setData(res);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.correction.pending")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} {t("correction.stats.pending")}</p>
      </div>

      <div className="rounded-xl border bg-background p-4 shadow-sm">
        {/* filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.table")}</div>
            <select
              value={tableCode}
              disabled={isPending}
              onChange={(e) => {
                const v = e.target.value;
                setTableCode(v);
                setPage(1);
                refresh(v, 1);
              }}
              className="mt-1 h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">{t("filters.channelAll")}</option>
              {tableList.map((tbl) => (
                <option key={tbl.code} value={tbl.code}>{tbl.code} - {tbl.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* table */}
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.recordId")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.table")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.violationCount")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.confidence")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.detectedAt")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={6} className="py-4"><LoadingState /></td></tr>
              ) : !data.ok ? (
                <tr><td colSpan={6} className="py-4"><ErrorState title={t("common.error")} message={data.error.message} /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-4"><EmptyState title={t("kpi.noData")} /></td></tr>
              ) : (
                items.map((row) => (
                  <tr key={row.recordId} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{row.recordId}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TABLE_COLORS[row.tableCode] ?? "bg-muted text-foreground"}`}>
                        {TABLE_NAMES[row.tableCode] ?? row.tableCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{row.violationCount ?? "-"}</td>
                    <td className={`px-4 py-3 text-xs font-semibold ${row.confidenceScore ? confidenceColor(row.confidenceScore) : ""}`}>
                      {row.confidenceScore ? `${Math.round(row.confidenceScore * 100)}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.updatedAt ? new Date(row.updatedAt).toLocaleString("zh-Hant") : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/correction/pending/${row.recordId}`}
                        className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted/50"
                      >
                        {t("correction.open")}
                      </Link>
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
              <button
                type="button"
                disabled={page <= 1 || isPending}
                onClick={() => { setPage(page - 1); refresh(tableCode, page - 1); }}
                className="rounded-md border px-2 py-1 hover:bg-muted/50 disabled:opacity-50"
              >
                &lt;
              </button>
              <button
                type="button"
                disabled={page >= totalPages || isPending}
                onClick={() => { setPage(page + 1); refresh(tableCode, page + 1); }}
                className="rounded-md border px-2 py-1 hover:bg-muted/50 disabled:opacity-50"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
