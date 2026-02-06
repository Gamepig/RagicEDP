"use client";

import { AlertCircle, FileWarning, Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n/i18n";

export function LoadingState(props: { message?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border bg-muted/10 p-8">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <div className="text-sm text-muted-foreground">{props.message || t("common.loading")}</div>
    </div>
  );
}

export function EmptyState(props: { title?: string; message?: string; action?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border bg-muted/10 p-8 text-center">
      <div className="rounded-full bg-muted p-3">
        <FileWarning className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="mt-2 text-sm font-semibold">{props.title || t("kpi.noData")}</div>
      {props.message && <div className="text-xs text-muted-foreground">{props.message}</div>}
      {props.action && <div className="mt-4">{props.action}</div>}
    </div>
  );
}

export function ErrorState(props: { title?: string; message?: string; traceId?: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-8 text-center">
      <div className="rounded-full bg-destructive/20 p-3">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <div className="mt-2 text-sm font-semibold text-destructive">{props.title || t("chart.error")}</div>
      <div className="text-xs text-muted-foreground">{props.message}</div>
      {props.traceId && (
        <div className="mt-2 font-mono text-[10px] text-muted-foreground">Trace ID: {props.traceId}</div>
      )}
      {props.onRetry && (
        <button
          type="button"
          onClick={props.onRetry}
          className="mt-4 inline-flex h-8 items-center rounded-md border border-destructive/30 bg-background px-3 text-xs font-medium hover:bg-muted"
        >
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
