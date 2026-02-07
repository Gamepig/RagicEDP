import "server-only";

import { getFirestoreAdmin } from "./admin";
import type { KnowledgeChunk } from "@/lib/ai/knowledge-rag";

const COLLECTION = "ai_knowledge";

export type KnowledgeDocMeta = {
  docId: string;
  title: string;
  source: string; // file path or URL
  chunkCount: number;
  indexedAt: string;
  indexedBy: string;
};

export class AiKnowledgeRepository {
  private db = getFirestoreAdmin();

  /** Save document metadata */
  async saveDocMeta(meta: KnowledgeDocMeta): Promise<void> {
    await this.db.collection(COLLECTION).doc(meta.docId).set(meta);
  }

  /** Save chunks as subcollection */
  async saveChunks(docId: string, chunks: KnowledgeChunk[]): Promise<void> {
    const batch = this.db.batch();
    const chunksRef = this.db
      .collection(COLLECTION)
      .doc(docId)
      .collection("chunks");

    for (const chunk of chunks) {
      batch.set(chunksRef.doc(`chunk_${chunk.chunkIndex}`), {
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        embedding: chunk.embedding,
      });
    }

    await batch.commit();
  }

  /** Load all chunks for all documents (for MVP in-memory search) */
  async loadAllChunks(): Promise<KnowledgeChunk[]> {
    const docsSnap = await this.db.collection(COLLECTION).get();
    const allChunks: KnowledgeChunk[] = [];

    for (const docSnap of docsSnap.docs) {
      const meta = docSnap.data() as KnowledgeDocMeta;
      const chunksSnap = await docSnap.ref.collection("chunks").get();

      for (const chunkSnap of chunksSnap.docs) {
        const data = chunkSnap.data();
        allChunks.push({
          docId: meta.docId,
          docTitle: meta.title,
          chunkIndex: data.chunkIndex,
          text: data.text,
          embedding: data.embedding,
        });
      }
    }

    return allChunks;
  }

  /** List all indexed documents */
  async listDocs(): Promise<KnowledgeDocMeta[]> {
    const snap = await this.db
      .collection(COLLECTION)
      .orderBy("indexedAt", "desc")
      .get();
    return snap.docs.map((d) => d.data() as KnowledgeDocMeta);
  }

  /** Delete a document and its chunks */
  async deleteDoc(docId: string): Promise<void> {
    const docRef = this.db.collection(COLLECTION).doc(docId);
    const chunksSnap = await docRef.collection("chunks").get();
    const batch = this.db.batch();
    for (const chunk of chunksSnap.docs) {
      batch.delete(chunk.ref);
    }
    batch.delete(docRef);
    await batch.commit();
  }
}
