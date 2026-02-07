import "server-only";

import { createHash } from "crypto";

import { getFirestoreAdmin } from "./admin";
import type { FirestoreAllowlistUserV0 } from "./schema";

const COLLECTION_NAME = "allowlist_users";
const DEFAULT_ACTOR_EMAIL = "system";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SCHEMA_VERSION: FirestoreAllowlistUserV0["schemaVersion"] = "v0";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email is required.");
  if (!EMAIL_PATTERN.test(normalized)) throw new Error(`Invalid email format: ${email}`);
  return normalized;
}

function docIdForEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

function getDocRef(email: string) {
  const db = getFirestoreAdmin();
  return db.collection(COLLECTION_NAME).doc(docIdForEmail(email));
}

export async function addToAllowlist(email: string): Promise<FirestoreAllowlistUserV0> {
  const normalized = normalizeEmail(email);
  const docRef = getDocRef(normalized);
  const snapshot = await docRef.get();
  const existing = snapshot.exists ? (snapshot.data() as FirestoreAllowlistUserV0 | undefined) : undefined;
  const now = nowIso();

  const next: FirestoreAllowlistUserV0 = {
    schemaVersion: SCHEMA_VERSION,
    email: normalized,
    status: "allowed",
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? DEFAULT_ACTOR_EMAIL,
    updatedAt: now,
    updatedBy: DEFAULT_ACTOR_EMAIL,
  };

  await docRef.set(next, { merge: true });
  return next;
}

export async function removeFromAllowlist(email: string): Promise<FirestoreAllowlistUserV0> {
  const normalized = normalizeEmail(email);
  const docRef = getDocRef(normalized);
  const snapshot = await docRef.get();
  const existing = snapshot.exists ? (snapshot.data() as FirestoreAllowlistUserV0 | undefined) : undefined;
  const now = nowIso();

  const next: FirestoreAllowlistUserV0 = {
    schemaVersion: SCHEMA_VERSION,
    email: normalized,
    status: "revoked",
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? DEFAULT_ACTOR_EMAIL,
    updatedAt: now,
    updatedBy: DEFAULT_ACTOR_EMAIL,
  };

  await docRef.set(next, { merge: true });
  return next;
}

export async function isAllowed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const snapshot = await getDocRef(normalized).get();
  const data = snapshot.exists ? (snapshot.data() as FirestoreAllowlistUserV0 | undefined) : undefined;
  return data?.status === "allowed";
}

export async function getAllowlist(): Promise<FirestoreAllowlistUserV0[]> {
  const db = getFirestoreAdmin();
  const snapshot = await db.collection(COLLECTION_NAME).get();
  return snapshot.docs
    .map((doc) => doc.data() as FirestoreAllowlistUserV0)
    .filter((doc) => Boolean(doc?.email))
    .sort((a, b) => a.email.localeCompare(b.email));
}
