import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { AiSessionRepository } from "@/lib/firestore/ai-session.repo";

const sessionRepo = new AiSessionRepository();

/**
 * GET /api/ai/memory?q=keyword&limit=20
 * Search organization memory (all sessions with summary/tags/conclusion).
 */
export async function GET(request: Request) {
  const session = await auth();
  try {
    assertAuthorized(session);
  } catch {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "未授權" } },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);

  const result = await sessionRepo.listOrgSessions({ query, limit });

  // Only return sessions that have a summary (i.e. have been summarized)
  const memorySessions = result.items
    .filter((s) => s.summary || s.conclusion)
    .map((s) => ({
      sessionId: s.sessionId,
      title: s.title,
      summary: s.summary ?? null,
      tags: s.tags ?? [],
      conclusion: s.conclusion ?? null,
      messageCount: s.messageCount,
      updatedAt: s.updatedAt,
    }));

  return Response.json({ items: memorySessions, total: memorySessions.length });
}
