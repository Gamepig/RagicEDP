const PERCENT_EXACT_KEYS = new Set([
  "cvr",
  "ctr",
  "conversion_rate",
  "bounce_rate",
  "engaged_rate",
  "engagement_rate",
  "deltaPct",
]);
const PERCENT_KEY_RE = /(^|_)(rate|pct|percent|ratio|share|growth|delta)(_|$)/i;

export function isPercentMetricKey(key: string | undefined): boolean {
  if (!key) return false;
  const normalized = key.trim();
  return PERCENT_EXACT_KEYS.has(normalized) || PERCENT_KEY_RE.test(normalized);
}

export function isPercentUnit(unit: string | undefined): boolean {
  const normalized = unit?.trim();
  return normalized === "%" || normalized === "％";
}

export function toPercentDisplayValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

export function formatPercentMetric(value: number, fractionDigits = 2): string {
  return `${new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toPercentDisplayValue(value))}%`;
}

export function normalizeBqNumberValue(key: string, value: number): number {
  if (isPercentMetricKey(key)) {
    return Number(value.toFixed(6));
  }
  return Math.round(value);
}

export function formatMetricValueByKey(key: string | undefined, value: number): string {
  if (isPercentMetricKey(key)) {
    return formatPercentMetric(value);
  }
  if (value >= 1e8) return `${Math.round(value / 1e8)}億`;
  if (value >= 1e4) return `${Math.round(value / 1e4)}萬`;
  return Math.round(value).toLocaleString("zh-TW");
}
