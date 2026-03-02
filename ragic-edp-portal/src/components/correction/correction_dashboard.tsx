"use client";

import { useI18n } from "@/lib/i18n/i18n";
import type { CorrectionStatsV0, ResultV0 } from "@/lib/data/types";
import { ClipboardList, CheckCircle2, Cpu, Bot, TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b"];

export function CorrectionDashboard({ initialStats }: { initialStats: ResultV0<CorrectionStatsV0> }) {
  const { t } = useI18n();

  if (!initialStats.ok) {
    return <div className="text-sm text-muted-foreground">{initialStats.error.message}</div>;
  }

  const s = initialStats.data;
  const total = s.completed + s.pending;
  const completionPct = total > 0 ? Math.round((s.completed / total) * 100) : 0;

  const pieData = [
    { name: t("correction.stats.autoFixed"), value: s.autoFixed, color: COLORS[0] },
    { name: t("correction.stats.aiFixed"), value: s.aiFixed, color: COLORS[1] },
    { name: t("correction.stats.manual"), value: s.manual, color: COLORS[2] },
  ];

  const statCards = [
    { label: t("correction.stats.pending"), value: s.pending, icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: t("correction.stats.completed"), value: s.completed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
    { label: t("correction.stats.autoFixed"), value: s.autoFixed, icon: Cpu, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { label: t("correction.stats.aiFixed"), value: s.aiFixed, icon: Bot, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("correction.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("nav.correction.dashboard")}</p>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight">{card.value.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{card.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* completion rate */}
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {t("correction.stats.completionRate")}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{completionPct}%</div>
            <div className="flex-1">
              <div className="h-3 overflow-hidden rounded-full bg-muted/50">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionPct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{s.completed.toLocaleString()} {t("correction.stats.completed")}</span>
                <span>{s.pending.toLocaleString()} {t("correction.stats.pending")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* source distribution pie chart */}
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="mb-4 text-sm font-semibold">{t("correction.stats.sourceDistribution")}</div>
          <div className="flex items-center justify-center gap-6">
            <ResponsiveContainer width="45%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-medium">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
