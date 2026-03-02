"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { RefreshCw, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

import { useI18n } from "@/lib/i18n/i18n";
import { getSchemaMermaid, getSchemaStats, refreshSchema } from "@/actions/correction";
import type { ResultV0, SchemaStatsV0, SchemaMermaidV0 } from "@/lib/data/types";
import { LoadingState } from "@/components/states/common_states";

function MermaidRenderer({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
        er: { useMaxWidth: true },
      });
      if (cancelled || !containerRef.current) return;
      try {
        const { svg } = await mermaid.render("mermaid-schema", code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (containerRef.current) {
          containerRef.current.innerHTML = `<p class="text-sm text-muted-foreground">Mermaid render failed</p>`;
        }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button type="button" onClick={() => setScale((s) => Math.min(s + 0.2, 3))} className="rounded-md border p-1.5 hover:bg-muted/50"><ZoomIn className="h-4 w-4" /></button>
        <button type="button" onClick={() => setScale((s) => Math.max(s - 0.2, 0.3))} className="rounded-md border p-1.5 hover:bg-muted/50"><ZoomOut className="h-4 w-4" /></button>
        <button type="button" onClick={() => setScale(1)} className="rounded-md border p-1.5 hover:bg-muted/50"><RotateCcw className="h-4 w-4" /></button>
      </div>
      <div className="overflow-auto rounded-lg border bg-muted/10 p-4" style={{ maxHeight: 600 }}>
        <div ref={containerRef} style={{ transform: `scale(${scale})`, transformOrigin: "top left" }} />
      </div>
    </div>
  );
}

export function CorrectionStarSchema({
  initialMermaid,
  initialStats,
}: {
  initialMermaid: ResultV0<SchemaMermaidV0>;
  initialStats: ResultV0<SchemaStatsV0>;
}) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [level, setLevel] = useState<"overview" | "detailed">("overview");
  const [mermaidData, setMermaidData] = useState(initialMermaid);
  const [stats, setStats] = useState(initialStats);

  const switchLevel = useCallback((newLevel: "overview" | "detailed") => {
    setLevel(newLevel);
    startTransition(async () => {
      const res = await getSchemaMermaid({ level: newLevel });
      setMermaidData(res);
    });
  }, []);

  function handleRefresh() {
    startTransition(async () => {
      await refreshSchema();
      const [m, s] = await Promise.all([getSchemaMermaid({ level }), getSchemaStats()]);
      setMermaidData(m);
      setStats(s);
    });
  }

  const factCount = stats.ok ? Object.keys(stats.data.factTables).length : 0;
  const dimCount = stats.ok ? Object.keys(stats.data.dimTables).length : 0;
  const totalRecords = stats.ok ? stats.data.totalRecords : 0;
  const totalTables = stats.ok ? stats.data.totalTables : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("correction.schema.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("correction.schema.subtitle")}</p>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("correction.schema.totalTables"), value: totalTables },
          { label: t("correction.schema.totalRecords"), value: totalRecords.toLocaleString() },
          { label: t("correction.schema.factTables"), value: factCount },
          { label: t("correction.schema.dimTables"), value: dimCount },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border bg-background p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">{card.label}</div>
            <div className="mt-1 text-xl font-bold">{card.value}</div>
          </div>
        ))}
      </div>

      {/* controls */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => switchLevel("overview")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${level === "overview" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("correction.schema.overview")}
          </button>
          <button
            type="button"
            onClick={() => switchLevel("detailed")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${level === "detailed" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t("correction.schema.detailed")}
          </button>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={handleRefresh}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted/50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          {t("correction.schema.refresh")}
        </button>
      </div>

      {/* mermaid diagram */}
      {isPending ? (
        <LoadingState />
      ) : mermaidData.ok ? (
        <MermaidRenderer code={mermaidData.data.mermaid} />
      ) : (
        <div className="text-sm text-red-500">{mermaidData.error.message}</div>
      )}

      {/* table details */}
      {stats.ok && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* fact tables */}
          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold">{t("correction.schema.factTables")}</div>
            <div className="space-y-2">
              {Object.entries(stats.data.factTables).map(([key, tbl]) => (
                <div key={key} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{key}</span>
                  <span className="text-xs text-muted-foreground">{tbl.count.toLocaleString()} rows</span>
                </div>
              ))}
            </div>
          </div>
          {/* dim tables */}
          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold">{t("correction.schema.dimTables")}</div>
            <div className="space-y-2">
              {Object.entries(stats.data.dimTables).map(([key, tbl]) => (
                <div key={key} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{key}</span>
                  <span className="text-xs text-muted-foreground">{tbl.count.toLocaleString()} rows</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
