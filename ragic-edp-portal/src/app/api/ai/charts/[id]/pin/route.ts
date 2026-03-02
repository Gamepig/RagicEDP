import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { aiLog, createCorrelationId } from "@/lib/ai/logger";
import type { AiChartDataV1, ChartRefV0, PinnedWidgetV0 } from "@/lib/data/types";

function isSameRef(a: ChartRefV0, b: ChartRefV0): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "catalog" && b.kind === "catalog") return a.chartId === b.chartId;
  if (a.kind === "saved" && b.kind === "saved") return a.savedChartId === b.savedChartId;
  return false;
}

function normalizePinnedWidgets(widgets: PinnedWidgetV0[]): PinnedWidgetV0[] {
  return widgets
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((widget, index) => ({ ...widget, order: index }));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  try {
    assertAuthorized(session);
  } catch {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "未授權" } }, { status: 401 });
  }

  const userId = session?.user?.email ?? "dev@local";
  if (!userId) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "無法識別使用者" } }, { status: 401 });
  }

  const { id: chartId } = await params;
  const correlationId = createCorrelationId();

  try {
    const body = await request.json();
    const { ref, title, chartData } = body as { ref: ChartRefV0; title?: string; chartData?: AiChartDataV1 };

    aiLog({
      level: "info",
      correlationId,
      module: "ai_expert",
      action: "chat",
      userId,
      extra: { endpoint: "charts.pin", chartId, ref },
    });

    // Save to dashboard_config via Firestore
    const { getFirestoreAdmin } = await import("@/lib/firestore/admin");
    const db = getFirestoreAdmin();
    const now = new Date().toISOString();
    const widgetId = `ai_${chartId}_${Date.now()}`;

    const dashRef = db.collection("dashboard_config").doc(userId);
    const snap = await dashRef.get();
    const existing = snap.exists ? snap.data() : { schemaVersion: "v0", pinnedWidgets: [] };
    const widgets = normalizePinnedWidgets((existing?.pinnedWidgets ?? []) as PinnedWidgetV0[]);
    const existed = widgets.find((w) => isSameRef(w.ref, ref));
    if (existed) {
      return Response.json({ widgetId: existed.widgetId, pinnedAt: existed.pinnedAt, duplicated: true });
    }

    widgets.push({
      widgetId,
      ref,
      order: widgets.length,
      pinnedAt: now,
      titleOverride: title,
      ...(chartData ? { aiChartData: chartData } : {}),
    });

    await dashRef.set(
      { ...existing, pinnedWidgets: normalizePinnedWidgets(widgets), updatedAt: now },
      { merge: true }
    );

    return Response.json({ widgetId, pinnedAt: now, duplicated: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    aiLog({
      level: "error",
      correlationId,
      module: "ai_expert",
      action: "chat",
      userId,
      error: message,
    });
    return Response.json({ error: { code: "INTERNAL_ERROR", message: "釘選失敗" } }, { status: 500 });
  }
}
