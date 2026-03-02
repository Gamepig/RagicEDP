"use client";

import { Download } from "lucide-react";
import type { AiChartDataV1 } from "@/lib/data/types";

type DataDownloadButtonsProps = {
  chart: AiChartDataV1;
  chartRef?: React.RefObject<HTMLDivElement | null>;
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

function inlineComputedStyles(source: HTMLElement, target: HTMLElement) {
  const srcEls = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const tgtEls = [target, ...Array.from(target.querySelectorAll<HTMLElement>("*"))];
  srcEls.forEach((srcEl, idx) => {
    const tgtEl = tgtEls[idx];
    if (!tgtEl) return;
    const style = window.getComputedStyle(srcEl);
    let cssText = "";
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      cssText += `${prop}:${style.getPropertyValue(prop)};`;
    }
    tgtEl.setAttribute("style", cssText);
  });
}

async function handleDownloadPng(target: HTMLElement, title: string) {
  const width = Math.max(1, Math.round(target.clientWidth));
  const height = Math.max(1, Math.round(target.clientHeight));
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const clonedNode = target.cloneNode(true) as HTMLElement;
  inlineComputedStyles(target, clonedNode);
  const wrappedSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject x="0" y="0" width="100%" height="100%">
        ${new XMLSerializer().serializeToString(clonedNode)}
      </foreignObject>
    </svg>
  `;
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wrappedSvg)}`;
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, width, height); resolve(); };
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = dataUrl;
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  downloadBlob(blob, `${sanitizeFilename(title)}.png`);
}

export function DataDownloadButtons({ chart, chartRef }: DataDownloadButtonsProps) {
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
      {chartRef && (
        <button
          type="button"
          onClick={() => chartRef.current && handleDownloadPng(chartRef.current, chart.title)}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted/50"
        >
          <Download className="h-3 w-3" />
          PNG
        </button>
      )}
    </div>
  );
}
