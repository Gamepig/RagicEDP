"use client";

import type { DashboardStatsV0 } from "@/lib/data/analytics.repo";
import type { ResultV0 } from "@/lib/data/types";

import { useI18n } from "@/lib/i18n/i18n";

function KpiCard(props: { label: string; value: string; delta?: number }) {
  const delta = props.delta;
  const tone = delta == null ? "text-muted-foreground" : delta >= 0 ? "text-success" : "text-destructive";
  const sign = delta == null ? "" : delta >= 0 ? "+" : "";

  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <div className="text-xs font-medium uppercase text-muted-foreground">{props.label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tighter">{props.value}</div>
      {delta == null ? null : (
        <div className={`mt-1 text-xs font-medium ${tone}`}>{sign + Math.round(delta * 100) + "%"}</div>
      )}
    </div>
  );
}

export function KpiRow(props: { result: ResultV0<DashboardStatsV0>; loading?: boolean }) {
  const { t } = useI18n();

  if (props.loading) {
    return (
      <section className="grid gap-4 md:grid-cols-2">
        <div className="h-[110px] rounded-xl border bg-muted/30" />
        <div className="h-[110px] rounded-xl border bg-muted/30" />
      </section>
    );
  }

  if (!props.result.ok) {
    return (
      <section className="rounded-xl border bg-background p-4">
        <div className="text-sm font-semibold">{t("kpi.unavailable")}</div>
        <div className="mt-1 text-sm text-muted-foreground">{props.result.error.message}</div>
      </section>
    );
  }

  const kpis = props.result.data.kpis;
  if (kpis.length === 0) {
    return (
      <section className="rounded-xl border bg-background p-4">
        <div className="text-sm font-semibold">{t("kpi.noData")}</div>
        <div className="mt-1 text-sm text-muted-foreground">{t("kpi.tryNarrow")}</div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {kpis.map((k) => {
        const label = k.id === "revenue" ? t("kpi.revenue") : k.id === "orders" ? t("kpi.orders") : k.label;
        return <KpiCard key={k.id} label={label} value={Intl.NumberFormat().format(k.value)} delta={k.deltaPct} />;
      })}
    </section>
  );
}
