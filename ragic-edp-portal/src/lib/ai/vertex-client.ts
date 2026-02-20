import "server-only";

import { createVertex } from "@ai-sdk/google-vertex";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, embed } from "ai";

// Main model: prefer Google AI Studio (Gemini 3.1 Pro) if API key available, else Vertex AI
const MAIN_MODEL_ID = (process.env.MAIN_MODEL_ID || "gemini-3.1-pro-preview") as string;
// Fast model:
// - Prefer AI Studio Flash when API key is available
// - Fallback to Vertex Flash when running on Vertex-only credentials
const FAST_MODEL_ID = (process.env.FAST_MODEL_ID || "gemini-3-flash-preview") as string;
const VERTEX_FAST_MODEL_ID = (process.env.VERTEX_FAST_MODEL_ID || "gemini-2.5-flash") as string;
const EMBEDDING_MODEL_ID = "text-embedding-005" as const;

// --- Vertex AI (for Flash + embeddings) ---
let vertexInstance: ReturnType<typeof createVertex> | null = null;

function getVertex() {
  if (vertexInstance) return vertexInstance;

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION || "us-central1";

  if (!project) throw new Error("Missing env: GOOGLE_VERTEX_PROJECT");

  vertexInstance = createVertex({ project, location });
  return vertexInstance;
}

// --- Google AI Studio (for Gemini 3.1 Pro) ---
let googleAiInstance: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getGoogleAi() {
  if (googleAiInstance) return googleAiInstance;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing env: GEMINI_API_KEY");

  googleAiInstance = createGoogleGenerativeAI({ apiKey });
  return googleAiInstance;
}

/** Main chat model — Gemini 3.1 Pro via Google AI Studio, fallback to Vertex AI */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getChatModel(): any {
  if (process.env.GEMINI_API_KEY) {
    return getGoogleAi()(MAIN_MODEL_ID);
  }
  // Fallback to Vertex AI
  return getVertex()(process.env.VERTEX_MODEL_ID || "gemini-2.5-pro");
}

/** Fast model — now also uses Gemini 3 Pro for better accuracy */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFastModel(): any {
  if (process.env.GEMINI_API_KEY) {
    return getGoogleAi()(MAIN_MODEL_ID);
  }
  return getVertex()(process.env.VERTEX_MODEL_ID || "gemini-2.5-pro");
}

export function getEmbeddingModel() {
  return getVertex().textEmbeddingModel(EMBEDDING_MODEL_ID);
}

export { streamText, embed };
