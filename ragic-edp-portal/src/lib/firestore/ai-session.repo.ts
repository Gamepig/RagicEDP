import "server-only";

import { getFirestoreAdmin } from "./admin";
import type { AiSessionV1, RFC3339String } from "../data/types";

const COLLECTION = "ai_sessions";

function nowIso(): RFC3339String {
  return new Date().toISOString();
}

export type CreateSessionInput = {
  userId: string;
  title: string;
  mode: AiSessionV1["mode"];
};

export type UpdateSessionInput = Partial<
  Pick<AiSessionV1, "title" | "summary" | "tags" | "conclusion" | "mode">
>;

export class AiSessionRepository {
  private get col() {
    return getFirestoreAdmin().collection(COLLECTION);
  }

  async create(input: CreateSessionInput): Promise<AiSessionV1> {
    const now = nowIso();
    const ref = this.col.doc();
    const session: AiSessionV1 = {
      sessionId: ref.id,
      userId: input.userId,
      title: input.title,
      mode: input.mode,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(session);
    return session;
  }

  async get(sessionId: string): Promise<AiSessionV1 | null> {
    const snap = await this.col.doc(sessionId).get();
    if (!snap.exists) return null;
    return snap.data() as AiSessionV1;
  }

  async update(sessionId: string, data: UpdateSessionInput): Promise<void> {
    await this.col.doc(sessionId).update({
      ...data,
      updatedAt: nowIso(),
    });
  }

  async incrementMessageCount(sessionId: string): Promise<void> {
    const { FieldValue } = await import("firebase-admin/firestore");
    await this.col.doc(sessionId).update({
      messageCount: FieldValue.increment(1),
      updatedAt: nowIso(),
    });
  }

  async listByUser(
    userId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<{ items: AiSessionV1[]; total: number }> {
    const limit = opts.limit ?? 20;

    const countSnap = await this.col
      .where("userId", "==", userId)
      .count()
      .get();
    const total = countSnap.data().count;

    let query = this.col
      .where("userId", "==", userId)
      .orderBy("updatedAt", "desc")
      .limit(limit);

    if (opts.offset) {
      const offsetSnap = await this.col
        .where("userId", "==", userId)
        .orderBy("updatedAt", "desc")
        .limit(opts.offset)
        .get();
      const lastDoc = offsetSnap.docs[offsetSnap.docs.length - 1];
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.get();
    return {
      items: snap.docs.map((d) => d.data() as AiSessionV1),
      total,
    };
  }

  async listOrgSessions(opts: {
    query?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: AiSessionV1[]; total: number }> {
    const limit = opts.limit ?? 20;

    let query = this.col.orderBy("updatedAt", "desc").limit(limit);

    const countSnap = await this.col.count().get();
    const total = countSnap.data().count;

    if (opts.offset) {
      const offsetSnap = await this.col
        .orderBy("updatedAt", "desc")
        .limit(opts.offset)
        .get();
      const lastDoc = offsetSnap.docs[offsetSnap.docs.length - 1];
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.get();
    let items = snap.docs.map((d) => d.data() as AiSessionV1);

    // Client-side keyword filter (Firestore doesn't support full-text search)
    if (opts.query) {
      const q = opts.query.toLowerCase();
      items = items.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.summary?.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)) ||
          s.conclusion?.toLowerCase().includes(q)
      );
    }

    return { items, total };
  }
}
