"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Database } from "lucide-react";

type TraceData = {
  correlationId: string;
  sql?: string;
  bytesProcessed?: number;
};

type TraceViewerProps = {
  traces: TraceData[];
};

export function TraceViewer({ traces }: TraceViewerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (traces.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Database className="h-3 w-3" />
        Query Traces
      </h4>
      {traces.map((trace) => {
        const isExpanded = expandedId === trace.correlationId;
        return (
          <div key={trace.correlationId} className="rounded-lg border text-xs">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : trace.correlationId)}
              className="flex w-full items-center justify-between px-3 py-2 hover:bg-muted/30"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="font-mono text-muted-foreground">
                  {trace.correlationId.slice(0, 8)}...
                </span>
              </div>
              {typeof trace.bytesProcessed === "number" && (
                <span className="text-muted-foreground">
                  {(trace.bytesProcessed / 1024).toFixed(1)} KB
                </span>
              )}
            </button>
            {isExpanded && trace.sql && (
              <div className="border-t bg-muted/20 px-3 py-2">
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                  {trace.sql}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
