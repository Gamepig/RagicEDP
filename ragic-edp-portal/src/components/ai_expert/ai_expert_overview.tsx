"use client";

import { useCallback, useState } from "react";
import { PanelLeftOpen, PanelRightOpen, PanelLeftClose, PanelRightClose } from "lucide-react";
import type { AiMessageV1 } from "@/lib/data/types";
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
  const [chatResetKey, setChatResetKey] = useState(0);
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [researchSections, setResearchSections] = useState<ResearchSection[]>([]);
  const [researchSummary, setResearchSummary] = useState<string | undefined>();
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showRight, setShowRight] = useState(false);

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
    setTraces([]);
    setResearchSections([]);
    setResearchSummary(undefined);
    setLastMessageId(null);
    setChatResetKey((k) => k + 1);
  }, []);

  const handleResearchReceived = useCallback(
    (research: { sections: ResearchSection[]; summary: string }) => {
      setResearchSections(research.sections);
      setResearchSummary(research.summary);
    },
    [],
  );

  const handleTraceReceived = useCallback((trace: TraceData) => {
    setTraces((prev) => [...prev, trace]);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("ai.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("ai.subtitle")}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShowSidebar((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
            title={showSidebar ? "隱藏對話記錄" : "顯示對話記錄"}
          >
            {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            <span>對話記錄</span>
          </button>
          <button
            type="button"
            onClick={() => setShowRight((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
            title={showRight ? "隱藏分析面板" : "顯示分析面板"}
          >
            <span>分析面板</span>
            {showRight ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div
        className="grid h-[calc(100vh-12rem)] gap-4"
        style={{
          gridTemplateColumns: [
            showSidebar ? "280px" : "",
            "1fr",
            showRight ? "380px" : "",
          ].filter(Boolean).join(" "),
        }}
      >
        {/* Session Sidebar */}
        {showSidebar && (
          <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
            <SessionSidebar
              activeSessionId={activeSessionId}
              onSelectSession={handleSelectSession}
              onNewSession={handleNewSession}
              refreshKey={refreshKey}
            />
          </div>
        )}

        {/* Chat Panel */}
        <div className="rounded-xl border bg-background shadow-sm">
          <ChatPanel
            sessionId={activeSessionId}
            onSessionCreated={handleSessionCreated}
            onMessageComplete={handleMessageComplete}
            onTraceReceived={handleTraceReceived}
            onResearchReceived={handleResearchReceived}
            onNewSession={handleNewSession}
            initialMessages={initialMessages}
            resetKey={chatResetKey}
          />
        </div>

        {/* Result Panel */}
        {showRight && (
          <div className="space-y-4 overflow-y-auto">
            {researchSections.length > 0 && (
              <ResearchReport
                sections={researchSections}
                summary={researchSummary}
                sessionId={activeSessionId}
                messageId={lastMessageId}
                onPinChart={() => {}}
              />
            )}
            <ResultPanel
              traces={traces}
              sessionId={activeSessionId}
              messageId={lastMessageId}
            />
            <MemorySearchPanel onSelectSession={handleSelectSession} />
          </div>
        )}
      </div>
    </div>
  );
}
