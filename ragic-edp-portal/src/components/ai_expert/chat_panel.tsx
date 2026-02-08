"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Plus } from "lucide-react";
import type { AiChartDataV1, AiKnowledgeSourceV1, AiMessageV1 } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/i18n";
import { ChartRenderer } from "./chart_renderer";
import { PdfExportButton } from "./pdf_export_button";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  knowledgeSources?: AiKnowledgeSourceV1[];
  charts?: AiChartDataV1[];
};

type TraceData = {
  correlationId: string;
  sql?: string;
  bytesProcessed?: number;
};

type ResearchData = {
  sections: Array<{ heading: string; contentMarkdown: string; charts?: AiChartDataV1[] }>;
  summary: string;
};

type ChatPanelProps = {
  sessionId: string | null;
  onSessionCreated: (sessionId: string, title: string) => void;
  onMessageComplete: (messageId: string) => void;
  onChartReceived?: (chart: AiChartDataV1) => void;
  onTraceReceived?: (trace: TraceData) => void;
  onResearchReceived?: (research: ResearchData) => void;
  onNewSession?: () => void;
  initialMessages?: AiMessageV1[];
  resetKey?: number;
};

export function ChatPanel({
  sessionId,
  onSessionCreated,
  onMessageComplete,
  onChartReceived,
  onTraceReceived,
  onResearchReceived,
  onNewSession,
  initialMessages,
  resetKey,
}: ChatPanelProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [mode, setMode] = useState<"auto" | "deep_research">("auto");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load initial messages when switching to an existing session
  useEffect(() => {
    if (initialMessages) {
      setMessages(
        initialMessages.map((m) => ({
          id: m.messageId,
          role: m.role,
          content: m.content,
        }))
      );
    }
  }, [initialMessages]);

  // Clear messages when starting a new session (sessionId becomes null or resetKey changes)
  useEffect(() => {
    if (sessionId === null) {
      setMessages([]);
      setPrompt("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, resetKey]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const asstId = `a_${Date.now()}`;
    const asstMsg: ChatMessage = {
      id: asstId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setPrompt("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, prompt: trimmed, mode: mode === "auto" ? undefined : mode }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId
              ? { ...m, content: err.error?.message ?? "錯誤", streaming: false }
              : m
          )
        );
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventName = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventName) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventName === "token") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstId
                      ? { ...m, content: m.content + data.text }
                      : m
                  )
                );
              } else if (eventName === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstId ? { ...m, streaming: false } : m
                  )
                );
                if (!sessionId && data.sessionId) {
                  onSessionCreated(data.sessionId, data.title);
                }
                onMessageComplete(data.messageId);
              } else if (eventName === "chart") {
                if (onChartReceived) onChartReceived(data);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstId
                      ? { ...m, charts: [...(m.charts ?? []), data] }
                      : m
                  )
                );
              } else if (eventName === "trace" && onTraceReceived) {
                onTraceReceived(data);
              } else if (eventName === "research" && onResearchReceived) {
                onResearchReceived(data);
              } else if (eventName === "knowledge") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstId
                      ? { ...m, knowledgeSources: data.sources }
                      : m
                  )
                );
              } else if (eventName === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === asstId
                      ? { ...m, content: data.message, streaming: false }
                      : m
                  )
                );
              }
            } catch {
              // skip malformed data
            }
            eventName = "";
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, content: "連線中斷，請重試", streaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [prompt, isStreaming, sessionId, mode, onSessionCreated, onMessageComplete, onChartReceived, onTraceReceived, onResearchReceived]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{t("ai.chat")}</h2>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="text-xs text-muted-foreground">{t("ai.streaming")}</span>
          )}
          {onNewSession && (
            <button
              type="button"
              onClick={onNewSession}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              title="新對話"
            >
              <Plus className="h-3.5 w-3.5" />
              新對話
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} data-chat-scroll className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("ai.chatEmpty")}
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                data-role={m.role}
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                    : `${m.charts?.length ? "w-full" : "max-w-[85%]"} rounded-2xl border bg-background px-4 py-2 text-sm`
                }
              >
                {m.charts && m.charts.length > 0 && (
                  <div className="mb-3 space-y-3">
                    {m.charts.map((chart) => (
                      <ChartRenderer key={chart.chartId} chart={chart} onPin={() => {}} />
                    ))}
                  </div>
                )}
                {m.role === "assistant" ? (
                  <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
                {m.streaming && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                    <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                    <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-primary" />
                    <span className="ml-2 text-xs text-muted-foreground">思考中...</span>
                  </div>
                )}
                {m.knowledgeSources && m.knowledgeSources.length > 0 && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    <p className="text-[10px] font-medium text-muted-foreground">參考來源：</p>
                    {m.knowledgeSources.map((src, i) => (
                      <div key={i} className="text-[10px] text-muted-foreground">
                        [{i + 1}] {src.docTitle} (相關度: {src.relevanceScore})
                      </div>
                    ))}
                  </div>
                )}
                {m.role === "assistant" && !m.streaming && m.content && (
                  <div className="mt-2 flex gap-2 border-t pt-2">
                    <PdfExportButton sessionId={sessionId ?? ""} messageId={m.id} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-4">
        <div className="mb-2 flex gap-1">
          {(["auto", "deep_research"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-muted/50"
              }`}
            >
              {m === "auto" ? "一般" : "深度研究"}
            </button>
          ))}
        </div>
        <p className="mb-1 text-[10px] text-muted-foreground">Shift + Enter 送出</p>
        <div className="flex gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={t("ai.promptPlaceholder")}
            disabled={isStreaming}
            rows={2}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={isStreaming || !prompt.trim()}
            className="inline-flex h-auto w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
