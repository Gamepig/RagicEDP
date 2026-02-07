"use client";

import type { AiChartDataV1, AiKnowledgeSourceV1 } from "@/lib/data/types";
import { ChartRenderer } from "./chart_renderer";
import { Loader2, FileText, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { PdfExportButton } from "./pdf_export_button";

export type ResearchSection = {
  heading: string;
  contentMarkdown: string;
  charts?: AiChartDataV1[];
};

type ResearchReportProps = {
  sections: ResearchSection[];
  summary?: string;
  knowledgeSources?: AiKnowledgeSourceV1[];
  progress?: { step: string; current: number; total: number } | null;
  sessionId?: string | null;
  messageId?: string | null;
  onPinChart?: (chart: AiChartDataV1) => void;
};

const STEP_LABELS: Record<string, string> = {
  decomposing_topic: "分解研究主題",
  querying_database: "查詢資料庫",
  searching_knowledge: "搜尋知識庫",
  generating_sections: "生成分析段落",
  generating_summary: "撰寫結論",
  complete: "研究完成",
};

export function ResearchReport({
  sections,
  summary,
  knowledgeSources,
  progress,
  sessionId,
  messageId,
  onPinChart,
}: ResearchReportProps) {
  if (progress && progress.step !== "complete") {
    return (
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            深度研究進行中...
          </h3>
          <span className="text-xs font-mono text-muted-foreground">
            {Math.round((progress.current / progress.total) * 100)}%
          </span>
        </div>
        
        <div className="space-y-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          
          <div className="grid gap-2">
            {Object.entries(STEP_LABELS).map(([key, label]) => {
              if (key === "complete") return null;
              const stepIndex = Object.keys(STEP_LABELS).indexOf(key) + 1;
              const isCompleted = progress.current > stepIndex;
              const isCurrent = progress.current === stepIndex;
              
              return (
                <div 
                  key={key}
                  className={`flex items-center gap-3 text-xs transition-colors ${
                    isCompleted ? "text-primary" : 
                    isCurrent ? "text-foreground font-medium" : 
                    "text-muted-foreground/50"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (sections.length === 0) return null;

  return (
    <div className="flex flex-col gap-6 rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="border-b bg-muted/30 p-6 rounded-t-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <FileText className="h-5 w-5 text-primary" />
              深度研究報告
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              由 AI 專家生成的完整分析報告
            </p>
          </div>
          {sessionId && messageId && (
            <PdfExportButton sessionId={sessionId} messageId={messageId} />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8 p-6">
        {sections.map((section, i) => (
          <div key={i} className="group flex flex-col gap-4">
            <div className="flex items-baseline gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <h4 className="text-base font-semibold text-foreground leading-tight">
                {section.heading}
              </h4>
            </div>
            
            <div className="pl-9 space-y-4">
              <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {section.contentMarkdown}
              </div>

              {section.charts && section.charts.length > 0 && (
                <div className="mt-4 grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
                  {section.charts.map((chart) => (
                    <div 
                      key={chart.chartId} 
                      className="rounded-lg border bg-background/50 p-4 transition-all hover:shadow-md"
                    >
                      <ChartRenderer
                        chart={chart}
                        onPin={onPinChart}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {i < sections.length - 1 && (
              <div className="ml-9 mt-4 h-px bg-border/50" />
            )}
          </div>
        ))}

        {summary && (
          <div className="rounded-lg bg-primary/5 p-6 mt-4 border border-primary/10">
            <h4 className="mb-3 text-sm font-semibold text-primary flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              結論與建議
            </h4>
            <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap">
              {summary}
            </div>
          </div>
        )}
      </div>

      {knowledgeSources && knowledgeSources.length > 0 && (
        <div className="border-t bg-muted/10 p-4 rounded-b-xl">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            參考來源
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {knowledgeSources.map((src, i) => (
              <div 
                key={i} 
                className="flex items-start gap-2 rounded-md p-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="mt-0.5 shrink-0 text-[10px] text-muted-foreground/70">
                  [{i + 1}]
                </span>
                <span className="line-clamp-2">
                  {src.docTitle}
                  <span className="ml-1.5 inline-block rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {Math.round(src.relevanceScore * 100)}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
