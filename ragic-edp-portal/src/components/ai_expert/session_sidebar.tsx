"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Plus, Search, Trash2 } from "lucide-react";
import type { AiSessionV1 } from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/i18n";

type SessionSidebarProps = {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession?: (sessionId: string) => void;
  refreshKey?: number;
};

export function SessionSidebar({
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  refreshKey,
}: SessionSidebarProps) {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<AiSessionV1[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ scope: "own", limit: "50" });
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/ai/sessions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.items);
      }
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshKey]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-3">
        <h2 className="text-sm font-semibold">{t("ai.title")}</h2>
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
          title="新對話"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋對話..."
            className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">載入中...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            尚無對話記錄
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.sessionId}
              className={`group flex w-full items-start gap-2 border-b px-3 py-2.5 transition-colors hover:bg-muted/50 ${
                activeSessionId === s.sessionId ? "bg-muted" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSession(s.sessionId)}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
              >
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{s.title}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(s.updatedAt).toLocaleDateString("zh-TW")} · {s.messageCount} 則
                  </div>
                </div>
              </button>
              {onDeleteSession && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("確定要刪除此對話？此操作無法復原。")) {
                      onDeleteSession(s.sessionId);
                    }
                  }}
                  className="mt-0.5 hidden h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:inline-flex"
                  title="刪除對話"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
