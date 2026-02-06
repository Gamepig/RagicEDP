import { ChartFiltersV0, DateRangeV0 } from "../data/types";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultDateRangeV0(now = new Date()): DateRangeV0 {
  const from = new Date(now);
  from.setDate(1);
  return { from: toIsoDate(from), to: toIsoDate(now) };
}

export function defaultFiltersV0(now = new Date()): ChartFiltersV0 {
  return { dateRange: defaultDateRangeV0(now) };
}
