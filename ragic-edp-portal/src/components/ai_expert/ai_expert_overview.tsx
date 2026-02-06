"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { runAiExpert } from "@/actions/ai_expert";
import { pinWidget } from "@/actions/analytics";
import type { AiExpertOutputV0, ChartRefV0, QueryTraceV0, ResultV0 } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/i18n";

type ChatMsgV0 =
  | { id: string; role: "user"; content: string; createdAt: string }
  | { id: string; role: "assistant"; content: string; createdAt: string; streaming?: boolean };

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-background p-4 shadow-sm">{children}</div>;
}

function nowIso() {
  return new Date().toISOString();
}

function safeChartId(ref: ChartRefV0): string | null {
  if (ref.kind === "catalog") return ref.chartId;
  return null;
}

function TraceRow({ trace }: { trace: QueryTraceV0 }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
      <div className="font-mono text-muted-foreground">{trace.correlationId}</div>
      <div className="text-muted-foreground">{trace.mode}</div>
      {typeof trace.bytesProcessed === "number" ? <div>{trace.bytesProcessed.toLocaleString()} bytes</div> : null}
      {trace.blocked ? <div className="text-destructive">blocked: {trace.blockedReason || ""}</div> : null}
    </div>
  );
}

export function AiExpertOverview() {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  const [modelId, setModelId] = useState<string>("mock-default");
  const [prompt, setPrompt] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsgV0[]>([]);
  const [result, setResult] = useState<ResultV0<AiExpertOutputV0> | null>(null);

  const streamTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
    };
  }, []);

  const allowlistedModels = useMemo(
    () => [
      { id: "mock-default", label: "Mock Default" },
      { id: "mock-fast", label: "Mock Fast" },
    ],
    []
  );

  async function onRun() {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const sessionId = "sess_demo";
    const userId = "demo";
    const userMsg: ChatMsgV0 = { id: `u_${Date.now()}`, role: "user", content: trimmed, createdAt: nowIso() };
    const asstId = `a_${Date.now()}`;
    const asstMsg: ChatMsgV0 = { id: asstId, role: "assistant", content: t("ai.streaming"), createdAt: nowIso(), streaming: true };
    setMessages((prev) => prev.concat(userMsg, asstMsg));
    setPrompt("");
    setResult(null);

    startTransition(async () => {
      const res = await runAiExpert({ sessionId, userId, prompt: trimmed, modelId, selectedChartId: "01" });
      setResult(res);

      if (!res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: res.error.message, streaming: false } : m)));
        return;
      }

      // Fake streaming: reveal answerMarkdown gradually after response arrived.
      const full = res.data.answerMarkdown;
      let i = 0;
      setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: "", streaming: true } : m)));

      if (streamTimerRef.current) window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = window.setInterval(() => {
        i += Math.max(1, Math.floor(full.length / 60));
        const next = full.slice(0, i);
        setMessages((prev) => prev.map((m) => (m.id === asstId ? { ...m, content: next, streaming: i < full.length } : m)));
        if (i >= full.length && streamTimerRef.current) {
          window.clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
        }
      }, 30);
    });
  }

  async function onPin(ref: ChartRefV0) {
    const chartId = safeChartId(ref);
    if (!chartId) return;
    await pinWidget({ userId: "demo", chartId });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("ai.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("ai.subtitle")}</p>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("ai.model")}</div>
            <select
              value={modelId}
              disabled={isPending}
              onChange={(e) => setModelId(e.target.value)}
              className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {allowlistedModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-medium uppercase text-muted-foreground">{t("ai.prompt")}</div>
            <div className="mt-2 flex gap-2">
              <input
                value={prompt}
                disabled={isPending}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("ai.promptPlaceholder")}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRun();
                }}
              />
              <button
                type="button"
                disabled={isPending}
                onClick={onRun}
                className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {t("ai.send")}
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold tracking-tight">{t("ai.chat")}</div>
            <div className="text-xs text-muted-foreground">{isPending ? t("common.loading") : ""}</div>
          </div>
          <div className="mt-4 flex max-h-[400px] flex-col space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("ai.chatEmpty")}</div>
            ) : (
              messages
                .slice()
                .reverse()
                .map((m) => (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[90%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                          : "max-w-[90%] rounded-2xl border bg-background px-4 py-2 text-sm"
                      }
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-semibold tracking-tight">{t("ai.result")}</div>
          <div className="mt-4 space-y-4">
            {!result ? (
              <div className="text-sm text-muted-foreground">{t("ai.resultEmpty")}</div>
            ) : !result.ok ? (
              <div className="text-sm text-muted-foreground">{result.error.message}</div>
            ) : (
              <>
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">{t("ai.insights")}</div>
                  <div className="mt-2 space-y-2">
                    {result.data.insights.map((ins, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="text-sm font-semibold">{ins.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{ins.detailMarkdown}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">{t("ai.charts")}</div>
                  <div className="mt-2 space-y-2">
                    {result.data.charts.length === 0 ? (
                      <div className="text-sm text-muted-foreground">{t("kpi.noData")}</div>
                    ) : (
                      result.data.charts.map((c, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{c.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {c.ref.kind === "catalog" ? `catalog:${c.ref.chartId}` : `saved:${c.ref.savedChartId}`}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted/50"
                            onClick={() => onPin(c.ref)}
                            disabled={c.ref.kind !== "catalog"}
                          >
                            {t("ai.pin")}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">{t("ai.traces")}</div>
                  <div className="mt-2 space-y-2">
                    {(result.data.traces || []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">{t("kpi.noData")}</div>
                    ) : (
                      (result.data.traces || []).map((tr) => <TraceRow key={tr.correlationId} trace={tr} />)
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
