import { ChartFiltersV0, DateRangeV0, type RevenueField } from "../data/types";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultDateRangeV0(now = new Date()): DateRangeV0 {
  const from = new Date(now);
  from.setDate(1); // 當月 1 號
  return { from: toIsoDate(from), to: toIsoDate(now) };
}

export function defaultFiltersV0(now = new Date()): ChartFiltersV0 {
  return { dateRange: defaultDateRangeV0(now) };
}

export function filtersFromSearchParams(searchParams: URLSearchParams | Record<string, string>): ChartFiltersV0 {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);
  
  const from = params.get("from");
  const to = params.get("to");
  const channel = params.get("channel");
  const revenue = params.get("revenue");
  const brand = params.get("brand");

  const defaultFilters = defaultFiltersV0();

  return {
    dateRange: {
      from: from || defaultFilters.dateRange.from,
      to: to || defaultFilters.dateRange.to,
    },
    channel: channel || undefined,
    revenueField: (revenue === "net" ? "net" : "with_shipping") as RevenueField,
    brand: brand || undefined,
  };
}

export function filtersToSearchParams(filters: ChartFiltersV0): URLSearchParams {
  const params = new URLSearchParams();
  
  params.set("from", filters.dateRange.from);
  params.set("to", filters.dateRange.to);
  
  if (filters.channel) {
    params.set("channel", filters.channel);
  }
  if (filters.revenueField && filters.revenueField !== "with_shipping") {
    params.set("revenue", filters.revenueField);
  }
  if (filters.brand) {
    params.set("brand", filters.brand);
  }

  return params;
}
