"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle, XCircle } from "lucide-react";
import Link from "next/link";

import { useI18n } from "@/lib/i18n/i18n";
import { submitCorrection, ignoreCorrection } from "@/actions/correction";
import type { RecordDetailV0, ResultV0, ViolationV0 } from "@/lib/data/types";

const TABLE_NAMES: Record<string, string> = {
  "10": "品牌表", "20": "通路表", "30": "金流表", "40": "物流表", "41": "郵遞區號表",
  "50": "訂單表", "60": "客戶表", "70": "商品表", "80": "活動管理表", "99": "訂單明細表",
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "error") return <XCircle className="h-4 w-4 text-red-500" />;
  return <AlertTriangle className="h-4 w-4 text-amber-500" />;
}

export function CorrectionDetail({ initialDetail }: { initialDetail: ResultV0<RecordDetailV0> }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    if (!initialDetail.ok) return {};
    const vals: Record<string, string> = {};
    for (const [k, v] of Object.entries(initialDetail.data.fields)) {
      vals[k] = String(v ?? "");
    }
    return vals;
  });

  if (!initialDetail.ok) {
    return (
      <div className="space-y-4">
        <Link href="/correction/pending" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("nav.correction.pending")}
        </Link>
        <div className="text-sm text-red-500">{initialDetail.error.message}</div>
      </div>
    );
  }

  const detail = initialDetail.data;
  const violations = detail.violations ?? [];

  function handleSubmit() {
    startTransition(async () => {
      await submitCorrection({ recordId: detail.recordId, tableCode: detail.tableCode, values: formValues });
      router.push("/correction/pending");
    });
  }

  function handleIgnore() {
    startTransition(async () => {
      await ignoreCorrection({ recordId: detail.recordId, tableCode: detail.tableCode });
      router.push("/correction/pending");
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/correction/pending" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("nav.correction.pending")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("correction.detail")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {detail.recordId} · {TABLE_NAMES[detail.tableCode] ?? detail.tableCode}
        </p>
      </div>

      {/* record info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">{t("correction.recordId")}</div>
          <div className="mt-1 font-mono text-sm font-medium">{detail.recordId}</div>
        </div>
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">{t("correction.table")}</div>
          <div className="mt-1 text-sm font-medium">{TABLE_NAMES[detail.tableCode] ?? detail.tableCode}</div>
        </div>
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">{t("correction.confidence")}</div>
          <div className="mt-1 text-sm font-medium">{detail.confidenceScore ? `${Math.round(detail.confidenceScore * 100)}%` : "-"}</div>
        </div>
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">{t("correction.violationCount")}</div>
          <div className="mt-1 text-sm font-medium">{violations.length}</div>
        </div>
      </div>

      {/* violations */}
      {violations.length > 0 && (
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.violationInfo")}</div>
          <div className="mt-3 space-y-3">
            {violations.map((v: ViolationV0, i: number) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <SeverityIcon severity={v.severity} />
                  <span className="font-mono text-xs font-medium">{v.field}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{v.ruleType}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{v.reason}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">{t("correction.currentValue")}：</span>
                    <span className="font-mono text-red-500 line-through">{v.before ?? "(null)"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("correction.suggestedValue")}：</span>
                    <span className="font-mono text-emerald-600">{v.after ?? "-"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* correction form */}
      <div className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="text-xs font-medium uppercase text-muted-foreground">{t("correction.fieldCorrection")}</div>
        <div className="mt-3 space-y-3">
          {Object.entries(formValues).map(([field, value]) => {
            const hasViolation = violations.some((v: ViolationV0) => v.field === field);
            return (
              <div key={field} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <label className={`w-32 shrink-0 text-xs font-medium ${hasViolation ? "text-amber-600" : "text-muted-foreground"}`}>
                  {hasViolation && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                  {field}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, [field]: e.target.value }))}
                  className={`h-9 flex-1 rounded-md border px-3 text-sm ${hasViolation ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20" : "bg-background"}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={handleIgnore}
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted/50 disabled:opacity-50"
        >
          {t("correction.ignore")}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? t("common.loading") : t("correction.confirmCorrection")}
        </button>
      </div>
    </div>
  );
}
