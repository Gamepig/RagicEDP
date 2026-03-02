import "server-only";

import { getFirestoreAdmin } from "./admin";
import type { AiMessageV1, RFC3339String } from "../data/types";

const PARENT_COLLECTION = "ai_sessions";
const SUB_COLLECTION = "messages";

function nowIso(): RFC3339String {
  return new Date().toISOString();
}

export type CreateMessageInput = {
  sessionId: string;
  role: AiMessageV1["role"];
  content: string;
  mode: AiMessageV1["mode"];
  charts?: AiMessageV1["charts"];
  traces?: AiMessageV1["traces"];
  knowledgeSources?: AiMessageV1["knowledgeSources"];
};

export class AiMessageRepository {
  private messagesCol(sessionId: string) {
    return getFirestoreAdmin()
      .collection(PARENT_COLLECTION)
      .doc(sessionId)
      .collection(SUB_COLLECTION);
  }

  async create(input: CreateMessageInput): Promise<AiMessageV1> {
    const col = this.messagesCol(input.sessionId);
    const ref = col.doc();
    const message: AiMessageV1 = {
      messageId: ref.id,
      role: input.role,
      content: input.content,
      mode: input.mode,
      createdAt: nowIso(),
    };
    if (input.charts) message.charts = input.charts;
    if (input.traces) message.traces = input.traces;
    if (input.knowledgeSources) message.knowledgeSources = input.knowledgeSources;
    // Strip undefined values — Firestore rejects them
    await ref.set(JSON.parse(JSON.stringify(message)));
    return message;
  }

  async listBySession(
    sessionId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<{ items: AiMessageV1[]; total: number }> {
    const col = this.messagesCol(sessionId);
    const limit = opts.limit ?? 50;

    const countSnap = await col.count().get();
    const total = countSnap.data().count;

    let query = col.orderBy("createdAt", "asc").limit(limit);

    if (opts.offset) {
      const offsetSnap = await col
        .orderBy("createdAt", "asc")
        .limit(opts.offset)
        .get();
      const lastDoc = offsetSnap.docs[offsetSnap.docs.length - 1];
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.get();
    return {
      items: snap.docs.map((d) => d.data() as AiMessageV1),
      total,
    };
  }

  async get(sessionId: string, messageId: string): Promise<AiMessageV1 | null> {
    const snap = await this.messagesCol(sessionId).doc(messageId).get();
    if (!snap.exists) return null;
    return snap.data() as AiMessageV1;
  }

  async updatePdfStatus(
    sessionId: string,
    messageId: string,
    status: NonNullable<AiMessageV1["pdfStatus"]>,
    pdfUrl?: string
  ): Promise<void> {
    const data: Record<string, unknown> = { pdfStatus: status };
    if (pdfUrl) data.pdfUrl = pdfUrl;
    await this.messagesCol(sessionId).doc(messageId).update(data);
  }
}
