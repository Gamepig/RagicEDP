import "server-only";

import { createVertex } from "@ai-sdk/google-vertex";
import { streamText, embed, type LanguageModelV1 } from "ai";

const MODEL_ID = "gemini-3-pro" as const;
const EMBEDDING_MODEL_ID = "text-embedding-005" as const;

let vertexInstance: ReturnType<typeof createVertex> | null = null;

function getVertex() {
  if (vertexInstance) return vertexInstance;

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION || "asia-east1";

  if (!project) throw new Error("Missing env: GOOGLE_VERTEX_PROJECT");

  vertexInstance = createVertex({ project, location });
  return vertexInstance;
}

export function getChatModel(): LanguageModelV1 {
  return getVertex()(MODEL_ID);
}

export function getEmbeddingModel() {
  return getVertex().textEmbeddingModel(EMBEDDING_MODEL_ID);
}

export { streamText, embed };
