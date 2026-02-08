"use client";

import { Download } from "lucide-react";
import type { AiChartDataV1 } from "@/lib/data/types";

type DataDownloadButtonsProps = {
  chart: AiChartDataV1;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^\w\u4e00-\u9fff-]/g, "_").slice(0, 50);
}

function toCsv(data: Record<string, unknown>[]): string {
  if (!data.length) return "";
  const keys = Object.keys(data[0]);
  const header = keys.map((k) => `"${k}"`).join(",");
  const rows = data.map((row) =>
    keys
      .map((k) => {
        const v = row[k];
        if (v == null) return "";
        if (typeof v === "number") return String(v);
        return `"${String(v).replace(/"/g, '""')}"`;
      })
      .join(","),
  );
  return "\uFEFF" + [header, ...rows].join("\n");
}

export function handleDownloadCsv(chart: AiChartDataV1) {
  const csv = toCsv(chart.data as Record<string, unknown>[]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${sanitizeFilename(chart.title)}.csv`);
}

export async function handleDownloadExcel(chart: AiChartDataV1) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(chart.data as Record<string, unknown>[]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `${sanitizeFilename(chart.title)}.xlsx`);
}

export function DataDownloadButtons({ chart }: DataDownloadButtonsProps) {
  if (!chart.data || chart.data.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleDownloadCsv(chart)}
        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted/50"
      >
        <Download className="h-3 w-3" />
        CSV
      </button>
      <button
        type="button"
        onClick={() => handleDownloadExcel(chart)}
        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted/50"
      >
        <Download className="h-3 w-3" />
        Excel
      </button>
    </div>
  );
}
