"use client";

import type { AiChartDataV1 } from "@/lib/data/types";
import { ChartRenderer } from "./chart_renderer";
import { PdfExportButton } from "./pdf_export_button";
import { TraceViewer } from "./trace_viewer";

type TraceData = {
  correlationId: string;
  sql?: string;
  bytesProcessed?: number;
};

type ResultPanelProps = {
  charts: AiChartDataV1[];
  traces: TraceData[];
  sessionId?: string | null;
  messageId?: string | null;
  onPinChart?: (chart: AiChartDataV1) => void;
};

export function ResultPanel({ charts, traces, sessionId, messageId, onPinChart }: ResultPanelProps) {
  if (charts.length === 0 && traces.length === 0) return null;

  return (
    <div className="space-y-4 rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">分析結果</h3>
        {sessionId && messageId && (
          <PdfExportButton sessionId={sessionId} messageId={messageId} />
        )}
      </div>

      {charts.map((chart) => (
        <ChartRenderer
          key={chart.chartId}
          chart={chart}
          onPin={onPinChart}
        />
      ))}

      <TraceViewer traces={traces} />
    </div>
  );
}
