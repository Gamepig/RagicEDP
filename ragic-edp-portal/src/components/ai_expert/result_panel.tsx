"use client";

import { PdfExportButton } from "./pdf_export_button";
import { TraceViewer } from "./trace_viewer";

type TraceData = {
  correlationId: string;
  sql?: string;
  bytesProcessed?: number;
};

type ResultPanelProps = {
  traces: TraceData[];
  sessionId?: string | null;
  messageId?: string | null;
};

export function ResultPanel({ traces, sessionId, messageId }: ResultPanelProps) {
  if (traces.length === 0 && !sessionId) return null;

  return (
    <div className="space-y-4 rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">查詢記錄</h3>
        {sessionId && messageId && (
          <PdfExportButton sessionId={sessionId} messageId={messageId} />
        )}
      </div>

      <TraceViewer traces={traces} />
    </div>
  );
}
