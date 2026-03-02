import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { AiSessionRepository } from "@/lib/firestore/ai-session.repo";
import { AiMessageRepository } from "@/lib/firestore/ai-message.repo";
import { aiLog, createCorrelationId } from "@/lib/ai/logger";

const PDF_WORKER_URL = process.env.PDF_WORKER_URL || "http://localhost:8080";
const PDF_WORKER_SECRET = process.env.PDF_WORKER_SECRET || "dev-secret";

const sessionRepo = new AiSessionRepository();
const messageRepo = new AiMessageRepository();

export async function POST(
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

  const userId = session?.user?.email ?? "dev@local";
  if (!userId) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "無法識別使用者" } },
      { status: 401 },
    );
  }

  const { id: sessionId, mid: messageId } = await params;
  const correlationId = createCorrelationId();

  try {
    // Verify session ownership
    const aiSession = await sessionRepo.get(sessionId);
    if (!aiSession || aiSession.userId !== userId) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "無權存取此對話" } },
        { status: 403 },
      );
    }

    // Get message
    const message = await messageRepo.get(sessionId, messageId);
    if (!message) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "訊息不存在" } },
        { status: 404 },
      );
    }

    // Mark as generating
    await messageRepo.updatePdfStatus(sessionId, messageId, "generating");

    aiLog({
      level: "info",
      correlationId,
      module: "ai_expert",
      action: "pdf",
      userId,
      extra: { sessionId, messageId, contentLength: message.content.length },
    });

    // Build HTML from message content
    const html = buildHtmlFromMessage(message.content, aiSession.title);

    // Call PDF Worker
    const pdfRes = await fetch(`${PDF_WORKER_URL}/render-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PDF_WORKER_SECRET}`,
      },
      body: JSON.stringify({ html }),
    });

    if (!pdfRes.ok) {
      await messageRepo.updatePdfStatus(sessionId, messageId, "failed");
      return Response.json(
        { error: { code: "PDF_FAILED", message: "PDF 生成失敗" } },
        { status: 500 },
      );
    }

    // Store PDF URL (in production, upload to GCS and return URL)
    // For MVP, return the PDF directly
    const pdfBuffer = await pdfRes.arrayBuffer();

    await messageRepo.updatePdfStatus(sessionId, messageId, "ready");

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${messageId.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    aiLog({
      level: "error",
      correlationId,
      module: "ai_expert",
      action: "pdf",
      userId,
      error: errorMsg,
    });
    await messageRepo.updatePdfStatus(sessionId, messageId, "failed").catch(() => {});
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "PDF 匯出失敗" } },
      { status: 500 },
    );
  }
}

/** Convert markdown-like content to simple HTML for PDF rendering */
function buildHtmlFromMessage(content: string, title: string): string {
  // Escape HTML first to prevent XSS, then apply markdown transforms
  let html = escapeHtml(content)
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Paragraphs (simple)
    .replace(/\n\n/g, "</p><p>")
    // Line breaks
    .replace(/\n/g, "<br>");

  // Wrap lists
  html = html.replace(/((?:<li>.+<\/li>\s*)+)/g, "<ul>$1</ul>");

  return `<h1>${escapeHtml(title)}</h1><p>${html}</p>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
