import "server-only";

import { embed, getEmbeddingModel } from "./vertex-client";
import { aiLog } from "./logger";
import type { AiKnowledgeSourceV1 } from "@/lib/data/types";

/** Maximum chunk size in characters */
const CHUNK_SIZE = 800;
/** Overlap between chunks */
const CHUNK_OVERLAP = 100;
/** Max chunks to return from similarity search */
const TOP_K = 5;
/** Minimum relevance score threshold */
const MIN_SCORE = 0.65;

export type KnowledgeChunk = {
  docId: string;
  docTitle: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
};

/**
 * Split a document into overlapping chunks for embedding.
 */
export function chunkDocument(
  docId: string,
  docTitle: string,
  text: string,
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunkText = text.slice(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({
        docId,
        docTitle,
        chunkIndex,
        text: chunkText,
        embedding: [], // filled later
      });
      chunkIndex++;
    }

    start = end - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Generate embeddings for chunks using Vertex AI text-embedding-005.
 */
export async function embedChunks(
  chunks: KnowledgeChunk[],
  correlationId: string,
): Promise<KnowledgeChunk[]> {
  const model = getEmbeddingModel();
  const results: KnowledgeChunk[] = [];

  // Process in batches of 5 to respect rate limits
  const batchSize = 5;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await Promise.all(
      batch.map((chunk) => embed({ model, value: chunk.text })),
    );

    for (let j = 0; j < batch.length; j++) {
      results.push({ ...batch[j], embedding: embeddings[j].embedding });
    }
  }

  aiLog({
    level: "info",
    correlationId,
    module: "knowledge_rag",
    action: "embed_chunks",
    extra: { totalChunks: results.length },
  });

  return results;
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Search knowledge base chunks by query similarity.
 * Uses in-memory cosine similarity for MVP (Firestore-stored embeddings).
 * Production should migrate to Vertex AI Vector Search.
 */
export async function searchKnowledge(
  query: string,
  allChunks: KnowledgeChunk[],
  correlationId: string,
): Promise<AiKnowledgeSourceV1[]> {
  if (allChunks.length === 0) return [];

  const model = getEmbeddingModel();
  const queryEmbedding = await embed({ model, value: query });

  const scored = allChunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding.embedding, chunk.embedding),
    }))
    .filter((item) => item.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  aiLog({
    level: "info",
    correlationId,
    module: "knowledge_rag",
    action: "search",
    extra: {
      query: query.slice(0, 100),
      candidates: allChunks.length,
      results: scored.length,
      topScore: scored[0]?.score ?? 0,
    },
  });

  return scored.map((item) => ({
    docTitle: item.chunk.docTitle,
    chunkText: item.chunk.text,
    relevanceScore: Math.round(item.score * 100) / 100,
  }));
}

/**
 * Format knowledge sources into a context string for the system prompt.
 */
export function formatKnowledgeContext(
  sources: AiKnowledgeSourceV1[],
): string {
  if (sources.length === 0) return "";

  return sources
    .map(
      (s, i) =>
        `### 來源 ${i + 1}: ${s.docTitle} (相關度: ${s.relevanceScore})\n${s.chunkText}`,
    )
    .join("\n\n");
}
