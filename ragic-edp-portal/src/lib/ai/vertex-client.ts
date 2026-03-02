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

/** Model entry with display name for fallback chain */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModelEntry = { model: any; name: string };

/** Fallback model chain: Gemini 3.1 Pro → Gemini 3 Flash */
const FALLBACK_MODEL_IDS: Array<{ id: string; name: string }> = [
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
  { id: FAST_MODEL_ID, name: "Gemini 3 Flash" },
];

export function getModelChain(): ModelEntry[] {
  if (process.env.GEMINI_API_KEY) {
    const ai = getGoogleAi();
    return [
      { model: ai(MAIN_MODEL_ID), name: getMainModelDisplayName() },
      ...FALLBACK_MODEL_IDS.map((m) => ({ model: ai(m.id), name: m.name })),
    ];
  }
  const vtx = getVertex();
  return [
    { model: vtx(process.env.VERTEX_MODEL_ID || "gemini-2.5-pro"), name: "Gemini 2.5 Pro" },
    { model: vtx(VERTEX_FAST_MODEL_ID), name: "Gemini 2.5 Flash" },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFallbackModels(): any[] {
  if (process.env.GEMINI_API_KEY) {
    const ai = getGoogleAi();
    return FALLBACK_MODEL_IDS.map((m) => ai(m.id));
  }
  return [getVertex()(VERTEX_FAST_MODEL_ID)];
}

export function getMainModelDisplayName(): string {
  const id = MAIN_MODEL_ID;
  if (id.includes("3.1")) return "Gemini 3.1 Pro";
  if (id.includes("3-pro") || id.includes("3.0")) return "Gemini 3.1 Pro";
  return id;
}

/** Fast model — Flash for routing, SQL gen, titles (lower latency) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFastModel(): any {
  if (process.env.GEMINI_API_KEY) {
    return getGoogleAi()(FAST_MODEL_ID);
  }
  return getVertex()(VERTEX_FAST_MODEL_ID);
}

export function getEmbeddingModel() {
  return getVertex().textEmbeddingModel(EMBEDDING_MODEL_ID);
}

export { streamText, embed };
