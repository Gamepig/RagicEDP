import { auth } from "@/lib/auth/auth";
import { assertAuthorized } from "@/lib/auth/authorize";
import { aiLog, createCorrelationId } from "@/lib/ai/logger";
import { chunkDocument, embedChunks } from "@/lib/ai/knowledge-rag";
import { AiKnowledgeRepository } from "@/lib/firestore/ai-knowledge.repo";

export async function POST(request: Request) {
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

  // TODO: Add admin role check for production
  const correlationId = createCorrelationId();

  try {
    const body = await request.json();
    const { docId, title, source, content } = body as {
      docId: string;
      title: string;
      source: string;
      content: string;
    };

    if (!docId || !title || !content) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "缺少必要欄位" } },
        { status: 400 },
      );
    }

    aiLog({
      level: "info",
      correlationId,
      module: "knowledge_rag",
      action: "ingest",
      userId,
      extra: { docId, title, contentLength: content.length },
    });

    // Chunk the document
    const chunks = chunkDocument(docId, title, content);

    // Generate embeddings
    const embeddedChunks = await embedChunks(chunks, correlationId);

    // Save to Firestore
    const repo = new AiKnowledgeRepository();
    await repo.saveDocMeta({
      docId,
      title,
      source: source || "manual",
      chunkCount: embeddedChunks.length,
      indexedAt: new Date().toISOString(),
      indexedBy: userId,
    });
    await repo.saveChunks(docId, embeddedChunks);

    aiLog({
      level: "info",
      correlationId,
      module: "knowledge_rag",
      action: "ingest",
      userId,
      extra: { docId, chunkCount: embeddedChunks.length, status: "complete" },
    });

    return Response.json({
      docId,
      chunkCount: embeddedChunks.length,
      indexedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    aiLog({
      level: "error",
      correlationId,
      module: "knowledge_rag",
      action: "ingest",
      userId,
      error: message,
    });
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "索引失敗" } },
      { status: 500 },
    );
  }
}
