import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { AiSessionRepository } from "@/lib/firestore/ai-session.repo";

const sessionRepo = new AiSessionRepository();

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  try {
    assertAuthorized(session);
  } catch {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "未授權" } },
      { status: 401 },
    );
  }

  const userId = session?.user?.email ?? "dev@local";
  const { id: sessionId } = await params;

  try {
    await sessionRepo.delete(sessionId, userId);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "Not authorized" ? 403 : message === "Session not found" ? 404 : 500;
    return Response.json(
      { error: { code: status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR", message } },
      { status },
    );
  }
}
