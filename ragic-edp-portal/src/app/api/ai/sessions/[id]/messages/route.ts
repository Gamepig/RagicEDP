import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { AiSessionRepository } from "@/lib/firestore/ai-session.repo";
import { AiMessageRepository } from "@/lib/firestore/ai-message.repo";

const sessionRepo = new AiSessionRepository();
const messageRepo = new AiMessageRepository();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  try {
    assertAuthorized(session);
  } catch {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "未授權" } },
      { status: 401 }
    );
  }

  const userId = session?.user?.email ?? (process.env.NODE_ENV === "development" ? "dev@local" : "unknown");
  const { id: sessionId } = await params;

  // Verify ownership
  const aiSession = await sessionRepo.get(sessionId);
  if (!aiSession || aiSession.userId !== userId) {
    return Response.json({ error: { code: "FORBIDDEN", message: "無權存取此對話" } }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const offset = (page - 1) * limit;

  const result = await messageRepo.listBySession(sessionId, { limit, offset });

  return Response.json({
    items: result.items,
    page,
    limit,
    total: result.total,
  });
}
