"use client";

import { useCallback, useState } from "react";
import { Download, Loader2, Check } from "lucide-react";

type PdfStatus = "idle" | "generating" | "ready";

type PdfExportButtonProps = {
  sessionId: string;
  messageId: string;
};

export function PdfExportButton(_props: PdfExportButtonProps) {
  const [status, setStatus] = useState<PdfStatus>("idle");

  const handleExport = useCallback(() => {
    if (status === "generating") return;
    setStatus("generating");

    // Find the assistant message bubble that contains charts + text
    // Look for the message container with matching data or the last assistant message
    const chatArea = document.querySelector("[data-chat-scroll]");
    if (!chatArea) {
      // Fallback: print whole page
      window.print();
      setStatus("ready");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }

    // Collect all assistant message content (charts + text)
    const assistantBubbles = chatArea.querySelectorAll("[data-role='assistant']");
    if (assistantBubbles.length === 0) {
      window.print();
      setStatus("ready");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }

    // Clone content for print
    const printContent = document.createElement("div");
    assistantBubbles.forEach((bubble) => {
      const clone = bubble.cloneNode(true) as HTMLElement;
      // Remove interactive elements (type switcher buttons, pin buttons)
      clone.querySelectorAll("button").forEach((btn) => btn.remove());
      printContent.appendChild(clone);
    });

    // Open print window with styled content
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      setStatus("ready");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>AI 分析報告</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 24px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
  h2 { font-size: 20px; margin-top: 24px; }
  h3 { font-size: 16px; margin-top: 16px; }
  strong { color: #1e40af; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; font-size: 14px; }
  th { background: #f3f4f6; font-weight: 600; }
  ul, ol { padding-left: 24px; }
  li { margin: 4px 0; }
  svg { max-width: 100%; height: auto; }
  .recharts-wrapper { margin: 16px 0; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .date { color: #6b7280; font-size: 14px; }
  @media print { body { margin: 20px; } }
</style>
</head><body>
<div class="header">
  <h1>AI 分析報告</h1>
  <span class="date">${new Date().toLocaleDateString("zh-TW")} ${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span>
</div>
${printContent.innerHTML}
</body></html>`);

    printWindow.document.close();
    // Wait for charts (SVG) to render
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      setStatus("ready");
      setTimeout(() => setStatus("idle"), 3000);
    }, 500);
  }, [status]);

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
      label: "已匯出",
      className: "border border-green-200 bg-green-50 text-green-700",
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
