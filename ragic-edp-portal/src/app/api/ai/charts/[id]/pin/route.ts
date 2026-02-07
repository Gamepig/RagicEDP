import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { aiLog, createCorrelationId } from "@/lib/ai/logger";
import type { ChartRefV0 } from "@/lib/data/types";

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

  const userId = session!.user?.email;
  if (!userId) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "無法識別使用者" } }, { status: 401 });
  }

  const { id: chartId } = await params;
  const correlationId = createCorrelationId();

  try {
    const body = await request.json();
    const { ref, title } = body as { ref: ChartRefV0; title?: string };

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
    const widgets = existing?.pinnedWidgets ?? [];

    widgets.push({
      widgetId,
      ref,
      order: widgets.length,
      pinnedAt: now,
      titleOverride: title,
    });

    await dashRef.set({ ...existing, pinnedWidgets: widgets, updatedAt: now }, { merge: true });

    return Response.json({ widgetId, pinnedAt: now });
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
