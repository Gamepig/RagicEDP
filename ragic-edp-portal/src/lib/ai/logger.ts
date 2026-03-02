import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

export type AiLogEntry = {
  level: LogLevel;
  correlationId: string;
  module: "ai_expert" | "knowledge_rag" | "deep_research" | "org_memory" | "db_ops";
  action: "chat" | "query" | "embed" | "pdf" | "reindex" | "usage" | "embed_chunks" | "search" | "ingest" | "summarize" | "ragic_query" | "rolling_summary";
  userId?: string;
  model?: string;
  bytesProcessed?: number;
  durationMs?: number;
  error?: string;
  extra?: Record<string, unknown>;
};

export function createCorrelationId(): string {
  return randomUUID();
}

export function aiLog(entry: AiLogEntry): void {
  const payload = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  switch (entry.level) {
    case "error":
      console.error(JSON.stringify(payload));
      break;
    case "warn":
      console.warn(JSON.stringify(payload));
      break;
    default:
      console.log(JSON.stringify(payload));
  }
}
