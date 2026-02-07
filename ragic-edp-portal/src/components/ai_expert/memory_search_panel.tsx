"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, MessageSquare, Clock, Brain } from "lucide-react";

type MemorySession = {
  sessionId: string;
  title: string;
  summary: string | null;
  tags: string[];
  conclusion: string | null;
  messageCount: number;
  updatedAt: string;
};

type MemorySearchPanelProps = {
  onSelectSession?: (sessionId: string) => void;
};

export function MemorySearchPanel({ onSelectSession }: MemorySearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemorySession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    setIsLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("limit", "20");
      const res = await fetch(`/api/ai/memory?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.items);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load recent memories on mount
  useEffect(() => {
    search("");
  }, [search]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">組織記憶</h3>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search(query);
          }}
          placeholder="搜尋過去的分析結論..."
          className="h-9 w-full rounded-lg border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="max-h-[400px] space-y-2 overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            搜尋中...
          </div>
        ) : results.length === 0 && hasSearched ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {query ? "找不到相關記憶" : "尚無組織記憶"}
          </div>
        ) : (
          results.map((item) => (
            <button
              key={item.sessionId}
              type="button"
              onClick={() => onSelectSession?.(item.sessionId)}
              className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium leading-tight line-clamp-1">
                  {item.title}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {item.updatedAt.slice(0, 10)}
                </span>
              </div>

              {item.summary && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {item.summary}
                </p>
              )}

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MessageSquare className="h-2.5 w-2.5" />
                  {item.messageCount}
                </span>
              </div>

              {item.conclusion && (
                <div className="mt-2 rounded-md bg-muted/30 px-2 py-1.5">
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    <Clock className="mr-1 inline h-2.5 w-2.5" />
                    {item.conclusion}
                  </p>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
