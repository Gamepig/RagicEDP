"use client";

import { useCallback, useEffect, useState } from "react";

type ActivityLog = {
  id: string;
  type: "login" | "page_view";
  timestamp: string;
  authProvider?: string;
  path?: string;
  userAgent?: string;
};

type TabType = "all" | "login" | "page_view";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function UserActivityPanel({
  userId,
  email,
  onClose,
}: {
  userId: string;
  email: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("all");

  const fetchLogs = useCallback(
    async (type: TabType) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ userId, limit: "200" });
        if (type !== "all") params.set("type", type);
        const res = await fetch(`/api/activity/logs?${params}`);
        const json = await res.json();
        setLogs(json.data ?? []);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    fetchLogs(tab);
  }, [tab, fetchLogs]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const tabs: { key: TabType; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "login", label: "登入" },
    { key: "page_view", label: "頁面瀏覽" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 mx-4 mt-8 flex max-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col rounded-xl border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">活動記錄</h2>
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">
              {email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b px-6 py-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
          {!loading && (
            <span className="ml-auto self-center text-xs text-muted-foreground">
              共 {logs.length} 筆記錄
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                載入中...
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground">
              無記錄
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b bg-muted/30">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium uppercase text-muted-foreground">
                    時間
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase text-muted-foreground">
                    類型
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase text-muted-foreground">
                    詳情
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase text-muted-foreground">
                    User Agent
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t hover:bg-muted/20">
                    <td className="whitespace-nowrap px-6 py-3 text-muted-foreground">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={[
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                          log.type === "login"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                        ].join(" ")}
                      >
                        {log.type === "login" ? "登入" : "瀏覽"}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-sm">
                      {log.type === "login"
                        ? (log.authProvider ?? "-")
                        : (log.path ?? "-")}
                    </td>
                    <td className="max-w-xs truncate px-6 py-3 text-xs text-muted-foreground">
                      {log.userAgent ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
