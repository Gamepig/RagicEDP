"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { useI18n } from "@/lib/i18n/i18n";
import { getBackupList } from "@/actions/correction";
import type { DailyBackupSummaryV0, PaginatedV0, ResultV0 } from "@/lib/data/types";
import { LoadingState, EmptyState, ErrorState } from "@/components/states/common_states";

export function BackupLogList({
  initialData,
}: {
  initialData: ResultV0<PaginatedV0<DailyBackupSummaryV0>>;
}) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const items = data.ok ? data.data.items : [];
  const total = data.ok ? data.data.total : 0;
  const totalPages = Math.ceil(total / limit);

  function refresh(df: string, dt: string, p: number) {
    startTransition(async () => {
      const res = await getBackupList({ dateFrom: df || undefined, dateTo: dt || undefined, page: p, limit });
      setData(res);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("correction.backup.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("correction.backup.subtitle")}</p>
      </div>

      <div className="rounded-xl border bg-background p-4 shadow-sm">
        {/* filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.dateFrom")}</div>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); refresh(e.target.value, dateTo, 1); }} className="mt-1 h-9 rounded-md border bg-background px-3 text-sm" />
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.dateTo")}</div>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); refresh(dateFrom, e.target.value, 1); }} className="mt-1 h-9 rounded-md border bg-background px-3 text-sm" />
          </div>
        </div>

        {/* table */}
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.backup.date")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.backup.totalFetched")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.backup.autoFixed")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.stats.aiFixed")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.backup.manualRequired")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.backup.status")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={7} className="py-4"><LoadingState /></td></tr>
              ) : !data.ok ? (
                <tr><td colSpan={7} className="py-4"><ErrorState title={t("common.error")} message={data.error.message} /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="py-4"><EmptyState title={t("kpi.noData")} /></td></tr>
              ) : (
                items.map((row) => (
                  <tr key={row.backupDate} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs font-medium">{row.backupDate}</td>
                    <td className="px-4 py-3 text-xs">{row.totalFetched.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs">{row.autoFixed}</td>
                    <td className="px-4 py-3 text-xs">{row.aiFixed}</td>
                    <td className="px-4 py-3 text-xs">{row.manualRequired}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.successCount > 0 && (
                          <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {row.successCount} {t("correction.backup.success")}
                          </span>
                        )}
                        {row.failedCount > 0 && (
                          <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            {row.failedCount} {t("correction.backup.failed")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/correction/backup-logs/${row.backupDate}`}
                        className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted/50"
                      >
                        {t("correction.backup.details")}
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
              <button type="button" disabled={page <= 1 || isPending} onClick={() => { setPage(page - 1); refresh(dateFrom, dateTo, page - 1); }} className="rounded-md border px-2 py-1 hover:bg-muted/50 disabled:opacity-50">&lt;</button>
              <button type="button" disabled={page >= totalPages || isPending} onClick={() => { setPage(page + 1); refresh(dateFrom, dateTo, page + 1); }} className="rounded-md border px-2 py-1 hover:bg-muted/50 disabled:opacity-50">&gt;</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
