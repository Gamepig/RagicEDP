"use client";

import type { ChartFiltersV0 } from "@/lib/data/types";

import { useI18n } from "@/lib/i18n/i18n";

export function GlobalFilters(props: {
  value: ChartFiltersV0;
  disabled?: boolean;
  onChange: (next: ChartFiltersV0) => void;
}) {
  const { t } = useI18n();
  const v = props.value;

  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">{t("filters.from")}</div>
          <input
            type="date"
            value={v.dateRange.from}
            disabled={props.disabled}
            onChange={(e) => props.onChange({ ...v, dateRange: { ...v.dateRange, from: e.target.value } })}
            className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">{t("filters.to")}</div>
          <input
            type="date"
            value={v.dateRange.to}
            disabled={props.disabled}
            onChange={(e) => props.onChange({ ...v, dateRange: { ...v.dateRange, to: e.target.value } })}
            className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>

        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">{t("filters.channel")}</div>
          <select
            value={v.channel || ""}
            disabled={props.disabled}
            onChange={(e) => props.onChange({ ...v, channel: e.target.value || undefined })}
            className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{t("filters.channelAll")}</option>
            <option value="online">{t("filters.channelOnline")}</option>
            <option value="offline">{t("filters.channelOffline")}</option>
          </select>
        </div>
      </div>
    </section>
  );
}
