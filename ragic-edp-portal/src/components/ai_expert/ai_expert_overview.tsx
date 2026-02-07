"use client";

import { useCallback, useState } from "react";
import type { AiChartDataV1, AiMessageV1 } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/i18n";
import { ChatPanel } from "./chat_panel";
import { ResearchReport, type ResearchSection } from "./research_report";
import { MemorySearchPanel } from "./memory_search_panel";
import { ResultPanel } from "./result_panel";
import { SessionSidebar } from "./session_sidebar";

type TraceData = {
  correlationId: string;
  sql?: string;
  bytesProcessed?: number;
};

export function AiExpertOverview() {
  const { t } = useI18n();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<AiMessageV1[] | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [charts, setCharts] = useState<AiChartDataV1[]>([]);
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [researchSections, setResearchSections] = useState<ResearchSection[]>([]);
  const [researchSummary, setResearchSummary] = useState<string | undefined>();
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  const handleSelectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    try {
      const res = await fetch(`/api/ai/sessions/${sessionId}/messages?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setInitialMessages(data.items);
      }
    } catch {
      setInitialMessages([]);
    }
  }, []);

  const handleNewSession = useCallback(() => {
    setActiveSessionId(null);
    setInitialMessages(undefined);
    setCharts([]);
    setTraces([]);
    setResearchSections([]);
    setResearchSummary(undefined);
    setLastMessageId(null);
  }, []);

  const handleResearchReceived = useCallback(
    (research: { sections: ResearchSection[]; summary: string }) => {
      setResearchSections(research.sections);
      setResearchSummary(research.summary);
    },
    [],
  );

  const handleChartReceived = useCallback((chart: AiChartDataV1) => {
    setCharts((prev) => [...prev, chart]);
  }, []);

  const handleTraceReceived = useCallback((trace: TraceData) => {
    setTraces((prev) => [...prev, trace]);
  }, []);

  const handlePinChart = useCallback(async (chart: AiChartDataV1) => {
    try {
      await fetch(`/api/ai/charts/${chart.chartId}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: chart.ref, title: chart.title }),
      });
    } catch {
      // pin failure is non-critical
    }
  }, []);

  const handleSessionCreated = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleMessageComplete = useCallback((messageId: string) => {
    setLastMessageId(messageId);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("ai.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("ai.subtitle")}</p>
      </div>

      <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-4 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_380px]">
        {/* Session Sidebar */}
        <div className="hidden rounded-xl border bg-background shadow-sm lg:block">
          <SessionSidebar
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            refreshKey={refreshKey}
          />
        </div>

        {/* Chat Panel */}
        <div className="rounded-xl border bg-background shadow-sm">
          <ChatPanel
            sessionId={activeSessionId}
            onSessionCreated={handleSessionCreated}
            onMessageComplete={handleMessageComplete}
            onChartReceived={handleChartReceived}
            onTraceReceived={handleTraceReceived}
            onResearchReceived={handleResearchReceived}
            initialMessages={initialMessages}
          />
        </div>

        {/* Result Panel */}
        <div className="hidden space-y-4 overflow-y-auto xl:block">
          {researchSections.length > 0 && (
            <ResearchReport
              sections={researchSections}
              summary={researchSummary}
              sessionId={activeSessionId}
              messageId={lastMessageId}
              onPinChart={handlePinChart}
            />
          )}
          <ResultPanel
            charts={charts}
            traces={traces}
            sessionId={activeSessionId}
            messageId={lastMessageId}
            onPinChart={handlePinChart}
          />
          <MemorySearchPanel onSelectSession={handleSelectSession} />
        </div>
      </div>
    </div>
  );
}
