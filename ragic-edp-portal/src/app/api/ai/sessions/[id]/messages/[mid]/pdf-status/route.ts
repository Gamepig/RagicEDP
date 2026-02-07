import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { AiSessionRepository } from "@/lib/firestore/ai-session.repo";
import { AiMessageRepository } from "@/lib/firestore/ai-message.repo";

const sessionRepo = new AiSessionRepository();
const messageRepo = new AiMessageRepository();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; mid: string }> },
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

  const userId = session!.user?.email;
  if (!userId) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "無法識別使用者" } },
      { status: 401 },
    );
  }

  const { id: sessionId, mid: messageId } = await params;

  // Verify session ownership
  const aiSession = await sessionRepo.get(sessionId);
  if (!aiSession || aiSession.userId !== userId) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "無權存取此對話" } },
      { status: 403 },
    );
  }

  const message = await messageRepo.get(sessionId, messageId);
  if (!message) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "訊息不存在" } },
      { status: 404 },
    );
  }

  return Response.json({
    status: message.pdfStatus ?? "none",
    pdfUrl: message.pdfUrl ?? null,
  });
}
