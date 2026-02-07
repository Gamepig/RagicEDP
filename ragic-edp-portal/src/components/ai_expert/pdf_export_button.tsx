"use client";

import { useCallback, useState } from "react";
import { Download, Loader2, Check, X } from "lucide-react";

type PdfStatus = "idle" | "generating" | "ready" | "failed";

type PdfExportButtonProps = {
  sessionId: string;
  messageId: string;
};

export function PdfExportButton({ sessionId, messageId }: PdfExportButtonProps) {
  const [status, setStatus] = useState<PdfStatus>("idle");

  const handleExport = useCallback(async () => {
    if (status === "generating") return;

    setStatus("generating");
    try {
      const res = await fetch(
        `/api/ai/sessions/${sessionId}/messages/${messageId}/export-pdf`,
        { method: "POST" },
      );

      if (!res.ok) {
        setStatus("failed");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }

      // Download the PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${messageId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus("ready");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("failed");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [sessionId, messageId, status]);

  const config = {
    idle: {
      icon: <Download className="h-3.5 w-3.5" />,
      label: "匯出 PDF",
      className: "border hover:bg-muted/50 text-foreground",
    },
    generating: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      label: "生成中…",
      className: "border bg-muted/30 text-muted-foreground cursor-wait",
    },
    ready: {
      icon: <Check className="h-3.5 w-3.5 text-green-600" />,
      label: "已下載",
      className: "border border-green-200 bg-green-50 text-green-700",
    },
    failed: {
      icon: <X className="h-3.5 w-3.5 text-red-500" />,
      label: "匯出失敗",
      className: "border border-red-200 bg-red-50 text-red-600",
    },
  }[status];

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={status === "generating"}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${config.className}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </button>
  );
}
