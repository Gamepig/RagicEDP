"use client";

import type { DashboardStatsV0 } from "@/lib/data/analytics.repo";
import type { ResultV0 } from "@/lib/data/types";

import { useI18n } from "@/lib/i18n/i18n";
import { LoadingState, EmptyState, ErrorState } from "@/components/states/common_states";

function KpiCard(props: { label: string; value: string; delta?: number; compareLabel?: string }) {
  const delta = props.delta;
  const tone = delta == null ? "text-muted-foreground" : delta >= 0 ? "text-success" : "text-destructive";
  const sign = delta == null ? "" : delta >= 0 ? "+" : "";

  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <div className="text-xs font-medium uppercase text-muted-foreground">{props.label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tighter">{props.value}</div>
      {delta == null ? null : (
        <div className={`mt-1 text-xs font-medium ${tone}`}>
          {sign + Math.round(delta * 100) + "%"}
          {props.compareLabel && (
            <span className="ml-1 font-normal text-muted-foreground">vs {props.compareLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Format date range as month label, e.g. "2026/02" or "2025/08-2026/02" */
function dateRangeMonthLabel(from: string, to: string): string {
  const fm = from.slice(0, 7).replace("-", "/");
  const tm = to.slice(0, 7).replace("-", "/");
  return fm === tm ? fm : `${fm}-${tm}`;
}

/** Calculate previous period label for comparison */
function prevPeriodLabel(from: string, to: string): string {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 86400000); // day before 'from'
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return dateRangeMonthLabel(
    prevFrom.toISOString().slice(0, 10),
    prevTo.toISOString().slice(0, 10)
  );
}

export function KpiRow(props: {
  result: ResultV0<DashboardStatsV0>;
  loading?: boolean;
  dateRange?: { from: string; to: string };
}) {
  const { t } = useI18n();

  if (props.loading) {
    return <LoadingState />;
  }

  if (!props.result.ok) {
    return <ErrorState title={t("kpi.unavailable")} message={props.result.error.message} />;
  }

  const kpis = props.result.data.kpis;
  if (kpis.length === 0) {
    return <EmptyState title={t("kpi.noData")} message={t("kpi.tryNarrow")} />;
  }

  const monthLabel = props.dateRange
    ? dateRangeMonthLabel(props.dateRange.from, props.dateRange.to)
    : "";

  const compareLabel = props.dateRange
    ? prevPeriodLabel(props.dateRange.from, props.dateRange.to)
    : undefined;

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {kpis.map((k) => {
        let label: string;
        if (k.id === "revenue") {
          label = monthLabel ? `${monthLabel} 營收` : t("kpi.revenue");
        } else if (k.id === "orders") {
          label = monthLabel ? `${monthLabel} 訂單數` : t("kpi.orders");
        } else {
          label = k.label;
        }
        return (
          <KpiCard
            key={k.id}
            label={label}
            value={Intl.NumberFormat().format(k.value)}
            delta={k.deltaPct}
            compareLabel={compareLabel}
          />
        );
      })}
    </section>
  );
}
