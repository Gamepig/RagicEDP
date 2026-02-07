import { createHash } from "node:crypto";

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

import { PinnedWidgetV0, RFC3339String } from "../data/types";

export type FirestoreUserV0 = {
  schemaVersion: "v0";
  email: string;
  displayName?: string;
  theme?: "light" | "dark" | "system";
  lastLoginAt?: RFC3339String;
  createdAt: RFC3339String;
};

export type FirestoreAllowlistUserV0 = {
  schemaVersion: "v0";
  email: string;
  status: "allowed" | "revoked";
  createdAt: RFC3339String;
  createdBy: string;
  updatedAt?: RFC3339String;
  updatedBy?: string;
};

export type FirestoreDashboardConfigV0 = {
  schemaVersion: "v0";
  pinnedWidgets: PinnedWidgetV0[];
  updatedAt: RFC3339String;
};

export type FirestoreChatSessionV0 = {
  schemaVersion: "v0";
  userId: string;
  title?: string;
  selectedModelId: string;
  createdAt: RFC3339String;
  updatedAt: RFC3339String;
  contextSnapshot?: {
    filters?: unknown;
  };
};

export type FirestoreChatMessageV0 = {
  schemaVersion: "v0";
  role: "user" | "assistant";
  contentMarkdown: string;
  createdAt: RFC3339String;
  aiOutput?: { schemaVersion: "v0" };
};

const ALLOWLIST_COLLECTION = "allowlist_users";
const SYSTEM_ACTOR = "system";

let cachedFirestore: Firestore | null = null;

function getFirestoreClient(): Firestore {
  if (cachedFirestore) return cachedFirestore;
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  cachedFirestore = getFirestore();
  return cachedFirestore;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertValidEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  if (!isValid) {
    throw new Error("Invalid email format");
  }
  return normalized;
}

function allowlistDocId(normalizedEmail: string): string {
  return createHash("sha256").update(normalizedEmail).digest("hex");
}

function nowIso(): RFC3339String {
  return new Date().toISOString();
}

export class AllowlistRepository {
  async addToAllowlist(email: string): Promise<FirestoreAllowlistUserV0> {
    const normalized = assertValidEmail(email);
    const docId = allowlistDocId(normalized);
    const firestore = getFirestoreClient();
    const ref = firestore.collection(ALLOWLIST_COLLECTION).doc(docId);
    const timestamp = nowIso();

    const snapshot = await ref.get();
    if (snapshot.exists) {
      const existing = snapshot.data() as FirestoreAllowlistUserV0;
      const updated: FirestoreAllowlistUserV0 = {
        schemaVersion: "v0",
        email: normalized,
        status: "allowed",
        createdAt: existing.createdAt,
        createdBy: existing.createdBy || SYSTEM_ACTOR,
        updatedAt: timestamp,
        updatedBy: SYSTEM_ACTOR,
      };
      await ref.set(updated, { merge: true });
      return updated;
    }

    const created: FirestoreAllowlistUserV0 = {
      schemaVersion: "v0",
      email: normalized,
      status: "allowed",
      createdAt: timestamp,
      createdBy: SYSTEM_ACTOR,
      updatedAt: timestamp,
      updatedBy: SYSTEM_ACTOR,
    };
    await ref.set(created, { merge: true });
    return created;
  }

  async removeFromAllowlist(email: string): Promise<FirestoreAllowlistUserV0> {
    const normalized = assertValidEmail(email);
    const docId = allowlistDocId(normalized);
    const firestore = getFirestoreClient();
    const ref = firestore.collection(ALLOWLIST_COLLECTION).doc(docId);
    const timestamp = nowIso();

    const snapshot = await ref.get();
    if (snapshot.exists) {
      const existing = snapshot.data() as FirestoreAllowlistUserV0;
      const updated: FirestoreAllowlistUserV0 = {
        schemaVersion: "v0",
        email: normalized,
        status: "revoked",
        createdAt: existing.createdAt,
        createdBy: existing.createdBy || SYSTEM_ACTOR,
        updatedAt: timestamp,
        updatedBy: SYSTEM_ACTOR,
      };
      await ref.set(updated, { merge: true });
      return updated;
    }

    const created: FirestoreAllowlistUserV0 = {
      schemaVersion: "v0",
      email: normalized,
      status: "revoked",
      createdAt: timestamp,
      createdBy: SYSTEM_ACTOR,
      updatedAt: timestamp,
      updatedBy: SYSTEM_ACTOR,
    };
    await ref.set(created, { merge: true });
    return created;
  }

  async isAllowed(email: string): Promise<boolean> {
    const normalized = assertValidEmail(email);
    const docId = allowlistDocId(normalized);
    const firestore = getFirestoreClient();
    const snapshot = await firestore.collection(ALLOWLIST_COLLECTION).doc(docId).get();
    if (!snapshot.exists) return false;
    const data = snapshot.data() as FirestoreAllowlistUserV0;
    return data.status === "allowed";
  }

  async getAllowlist(): Promise<FirestoreAllowlistUserV0[]> {
    const firestore = getFirestoreClient();
    const snapshot = await firestore.collection(ALLOWLIST_COLLECTION).get();
    const items = snapshot.docs.map((doc) => doc.data() as FirestoreAllowlistUserV0);
    return items.sort((a, b) => a.email.localeCompare(b.email));
  }
}
