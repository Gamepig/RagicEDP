import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { AiSessionRepository } from "@/lib/firestore/ai-session.repo";
import { aiLog, createCorrelationId } from "@/lib/ai/logger";
import type { AiSessionV1 } from "@/lib/data/types";

const sessionRepo = new AiSessionRepository();

export async function GET(request: Request) {
  const session = await auth();
  assertAuthorized(session);

  const userId = session.user?.email ?? "unknown";
  const correlationId = createCorrelationId();

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "own";
  const q = searchParams.get("q") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  aiLog({
    level: "info",
    correlationId,
    module: "ai_expert",
    action: "chat",
    userId,
    extra: { endpoint: "sessions.list", scope, q, page, limit },
  });

  let result: { items: AiSessionV1[]; total: number };

  if (scope === "org") {
    result = await sessionRepo.listOrgSessions({ query: q, limit, offset });
    // Strip userId from org results for privacy
    result.items = result.items.map((s) => ({
      ...s,
      userId: s.userId === userId ? s.userId : "",
    }));
  } else {
    result = await sessionRepo.listByUser(userId, { limit, offset });
  }

  return Response.json({
    items: result.items,
    page,
    limit,
    total: result.total,
  });
}
