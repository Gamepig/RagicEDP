import { getChartSpec, type ChartDimension, type ChartMetric, type ChartSpecV0 } from "@/lib/analytics/chart_registry";
import { displayNameWithField, officialFieldDisplayName } from "@/lib/analytics/field-display-names";

export type ChartAxisLabelsV0 = {
  x?: string;
  y?: string;
  y1?: string;
  y2?: string;
  z?: string;
  series?: string;
  category?: string;
  label?: string;
  value?: string;
};

export type ChartAxisSpecV0 = {
  x?: AxisFieldSpec;
  y?: AxisFieldSpec;
  y1?: AxisFieldSpec;
  y2?: AxisFieldSpec;
  z?: AxisFieldSpec;
  series?: AxisFieldSpec;
  category?: AxisFieldSpec;
  label?: AxisFieldSpec;
  value?: AxisFieldSpec;
};

type ChartSpecWithAxisV0 = ChartSpecV0 & {
  axis?: ChartAxisSpecV0;
};

type AxisFieldSpec = {
  field: string;
  displayName?: string;
};

export function humanizeFieldName(field: string): string {
  const officialName = officialFieldDisplayName(field, false);
  if (officialName) return officialName;
  return field
    .replace(/^is_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

export function formatAxisLabel(displayName: string | undefined, field: string | undefined): string {
  if (!field) return displayName?.trim() || "";
  if (!displayName || displayName.trim() === field.trim()) {
    return officialFieldDisplayName(field) ?? field;
  }
  return displayNameWithField(field, displayName);
}

function fromFieldSpec(spec?: AxisFieldSpec): string | undefined {
  if (!spec?.field) return undefined;
  const displayName = spec.displayName?.trim() || humanizeFieldName(spec.field);
  return formatAxisLabel(displayName, spec.field);
}

function firstDimensionLabel(dimensions: ChartDimension[] | undefined): string | undefined {
  const first = dimensions?.[0];
  if (!first) return undefined;
  return formatAxisLabel(humanizeFieldName(first.field), first.field);
}

function firstMetricLabel(metrics: ChartMetric[] | undefined): string | undefined {
  const first = metrics?.[0];
  if (!first) return undefined;
  const displayName = first.formula ? humanizeFieldName(first.field) : humanizeFieldName(first.field);
  return formatAxisLabel(displayName, first.field);
}

export function buildChartAxisLabels(chartId: string): ChartAxisLabelsV0 {
  const spec = getChartSpec(chartId);
  if (!spec) return {};
  return buildChartAxisLabelsFromSpec(spec);
}

export function buildChartAxisLabelsFromSpec(spec: ChartSpecV0): ChartAxisLabelsV0 {
  const axis = (spec as ChartSpecWithAxisV0).axis ?? {};
  return {
    x: fromFieldSpec(axis.x) ?? firstDimensionLabel(spec.dimensions),
    y: fromFieldSpec(axis.y) ?? firstMetricLabel(spec.metrics),
    y1: fromFieldSpec(axis.y1),
    y2: fromFieldSpec(axis.y2),
    z: fromFieldSpec(axis.z),
    series: fromFieldSpec(axis.series),
    category: fromFieldSpec(axis.category),
    label: fromFieldSpec(axis.label),
    value: fromFieldSpec(axis.value),
  };
}
