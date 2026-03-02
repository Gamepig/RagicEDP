import "server-only";

import { Timestamp } from "firebase-admin/firestore";

import { getFirestoreAdmin } from "./admin";
import type { FirestoreActivityLogV0 } from "./schema";

const COLLECTION = "activity_logs";
const TTL_DAYS = 30;

function nowIso(): string {
  return new Date().toISOString();
}

function ttlTimestamp(): Timestamp {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);
  return Timestamp.fromDate(expiresAt);
}

export async function logActivity(data: {
  userId: string;
  email: string;
  type: "login" | "page_view";
  authProvider?: "google" | "email";
  path?: string;
  userAgent?: string;
}): Promise<void> {
  const db = getFirestoreAdmin();
  const doc: FirestoreActivityLogV0 = {
    schemaVersion: "v0",
    userId: data.userId,
    email: data.email,
    type: data.type,
    ...(data.authProvider ? { authProvider: data.authProvider } : {}),
    ...(data.path ? { path: data.path } : {}),
    ...(data.userAgent ? { userAgent: data.userAgent } : {}),
    timestamp: nowIso(),
    expiresAt: ttlTimestamp(),
  };
  await db.collection(COLLECTION).add(doc);
}

export type ActivityLogEntry = FirestoreActivityLogV0 & { id: string };

export async function getActivityLogsByUserId(
  userId: string,
  options?: { type?: "login" | "page_view"; limit?: number },
): Promise<ActivityLogEntry[]> {
  const db = getFirestoreAdmin();
  let query = db
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc");

  if (options?.type) {
    query = query.where("type", "==", options.type);
  }

  const limit = options?.limit ?? 100;
  query = query.limit(limit);

  const snap = await query.get();
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as FirestoreActivityLogV0),
  }));
}

export async function getRecentActivityLogs(limit = 50): Promise<ActivityLogEntry[]> {
  const db = getFirestoreAdmin();
  const snap = await db
    .collection(COLLECTION)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as FirestoreActivityLogV0),
  }));
}
