"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Database, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

import { useI18n } from "@/lib/i18n/i18n";
import type { DailyBackupDetailV0, ResultV0 } from "@/lib/data/types";

function formatDuration(seconds: number) {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${seconds.toFixed(1)}s`;
}

export function BackupLogDetail({ initialDetail }: { initialDetail: ResultV0<DailyBackupDetailV0> }) {
  const { t } = useI18n();
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  if (!initialDetail.ok) {
    return (
      <div className="space-y-4">
        <Link href="/correction/backup-logs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("correction.backup.backToList")}
        </Link>
        <div className="text-sm text-red-500">{initialDetail.error.message}</div>
      </div>
    );
  }

  const detail = initialDetail.data;
  const s = detail.summary;

  function toggleLog(idx: number) {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/correction/backup-logs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("correction.backup.backToList")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("correction.backup.details")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{detail.backupDate}</p>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex items-center gap-2"><Database className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">{t("correction.backup.totalFetched")}</span></div>
          <div className="mt-1 text-xl font-bold">{s.totalFetched.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">{t("correction.backup.autoFixed")}</span></div>
          <div className="mt-1 text-xl font-bold">{s.autoFixed}</div>
        </div>
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">{t("correction.backup.manualRequired")}</span></div>
          <div className="mt-1 text-xl font-bold">{s.manualRequired}</div>
        </div>
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-violet-500" /><span className="text-xs text-muted-foreground">{t("correction.backup.status")}</span></div>
          <div className="mt-1 flex items-center gap-2">
            {s.successCount > 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{s.successCount} {t("correction.backup.success")}</span>}
            {s.failedCount > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">{s.failedCount} {t("correction.backup.failed")}</span>}
          </div>
        </div>
      </div>

      {/* sheet logs */}
      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold">{t("correction.backup.sheetLogs")}</div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.table")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.backup.totalFetched")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.backup.duration")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.backup.status")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.sheetLogs.map((log, idx) => {
                const isExpanded = expandedLogs.has(idx);
                return (
                  <Fragment key={idx}>
                    <tr className="cursor-pointer border-t transition-colors hover:bg-muted/30" onClick={() => toggleLog(idx)}>
                      <td className="px-2 py-3 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium">{log.sheetName}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{log.sheetCode}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{log.recordsFetched.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs">{formatDuration(log.durationSeconds)}</td>
                      <td className="px-4 py-3">
                        {log.status === "success" ? (
                          <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{t("correction.backup.success")}</span>
                        ) : (
                          <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">{t("correction.backup.failed")}</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-t bg-muted/10">
                        <td />
                        <td colSpan={4} className="px-4 py-3">
                          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                            <div><span className="text-muted-foreground">{t("correction.backup.syncTime")}：</span>{log.backupTime ? new Date(log.backupTime).toLocaleString("zh-Hant") : "-"}</div>
                            <div><span className="text-muted-foreground">Inserted：</span>{log.recordsInserted}</div>
                            <div><span className="text-muted-foreground">Updated：</span>{log.recordsUpdated}</div>
                            {log.errorMessage && (
                              <div className="col-span-full"><span className="text-red-500">{t("correction.backup.errorMessage")}：</span><span className="text-red-600">{log.errorMessage}</span></div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* cleaning stats */}
      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold">{t("correction.backup.cleaningStats")}</div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.table")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">Total</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.stats.autoFixed")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.stats.aiFixed")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.stats.manual")}</th>
                <th className="px-4 py-2 text-xs font-medium uppercase text-muted-foreground">{t("correction.stats.completed")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.cleaningStats.map((cs) => (
                <tr key={cs.tableCode} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium">{cs.tableName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{cs.tableCode}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{cs.totalRecords.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{cs.autoFixed}</td>
                  <td className="px-4 py-3 text-xs">{cs.aiFixed}</td>
                  <td className="px-4 py-3 text-xs">{cs.manual}</td>
                  <td className="px-4 py-3 text-xs font-medium text-emerald-600">{cs.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
