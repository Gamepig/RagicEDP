import "server-only";

import { getFirestoreAdmin } from "./admin";
import { logActivity } from "./activity-log.repo";
import type { FirestoreUserV0 } from "./schema";
import { generateStrongPassword, hashPassword } from "@/lib/auth/password";

const COLLECTION = "users";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type AuthProvider = "google" | "email";

export async function getUserByEmail(email: string): Promise<(FirestoreUserV0 & { userId: string }) | null> {
  const db = getFirestoreAdmin();
  const normalized = normalizeEmail(email);
  const snap = await db.collection(COLLECTION).where("email", "==", normalized).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { userId: doc.id, ...(doc.data() as FirestoreUserV0) };
}

export async function ensureUserForGoogleLogin(email: string, displayName?: string | null) {
  const db = getFirestoreAdmin();
  const now = nowIso();
  const normalized = normalizeEmail(email);
  const existing = await getUserByEmail(normalized);

  if (existing) {
    await db.collection(COLLECTION).doc(existing.userId).set(
      {
        displayName: displayName ?? existing.displayName ?? undefined,
        authProvider: existing.authProvider ?? "google",
        mustChangePassword: false,
        lastLoginAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    logActivity({
      userId: existing.userId,
      email: normalized,
      type: "login",
      authProvider: "google",
    }).catch((err) => console.error("[activity-log] google login log failed:", err));
    return { ...existing, mustChangePassword: false, lastLoginAt: now };
  }

  const ref = db.collection(COLLECTION).doc();
  const user: FirestoreUserV0 = {
    schemaVersion: "v0",
    email: normalized,
    displayName: displayName ?? undefined,
    authProvider: "google",
    role: "user",
    status: "active",
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  await ref.set(user);
  logActivity({
    userId: ref.id,
    email: normalized,
    type: "login",
    authProvider: "google",
  }).catch((err) => console.error("[activity-log] google login log failed:", err));
  return { userId: ref.id, ...user };
}

export async function createOrResetEmailUserFromAllowlist(email: string, actorEmail: string): Promise<{ password: string; userId: string }> {
  const db = getFirestoreAdmin();
  const now = nowIso();
  const normalized = normalizeEmail(email);
  const password = generateStrongPassword();
  const passwordHash = await hashPassword(password);
  const existing = await getUserByEmail(normalized);

  if (existing) {
    await db.collection(COLLECTION).doc(existing.userId).set(
      {
        authProvider: "email",
        status: "active",
        role: existing.role ?? "user",
        passwordHash,
        mustChangePassword: true,
        updatedAt: now,
        updatedBy: actorEmail,
      },
      { merge: true }
    );
    return { password, userId: existing.userId };
  }

  const ref = db.collection(COLLECTION).doc();
  const user: FirestoreUserV0 = {
    schemaVersion: "v0",
    email: normalized,
    authProvider: "email",
    role: "user",
    status: "active",
    passwordHash,
    mustChangePassword: true,
    createdAt: now,
    createdBy: actorEmail,
    updatedAt: now,
    updatedBy: actorEmail,
  };
  await ref.set(user);
  return { password, userId: ref.id };
}

export async function markLogin(
  userId: string,
  opts?: { email?: string; authProvider?: AuthProvider },
) {
  const db = getFirestoreAdmin();
  const now = nowIso();
  await db.collection(COLLECTION).doc(userId).set(
    {
      lastLoginAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  if (opts?.email) {
    logActivity({
      userId,
      email: opts.email,
      type: "login",
      authProvider: opts.authProvider,
    }).catch((err) => console.error("[activity-log] login log failed:", err));
  }
}

export async function updatePasswordByUserId(userId: string, plainPassword: string) {
  const db = getFirestoreAdmin();
  const now = nowIso();
  const passwordHash = await hashPassword(plainPassword);
  await db.collection(COLLECTION).doc(userId).set(
    {
      passwordHash,
      mustChangePassword: false,
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function listUsers(): Promise<Array<FirestoreUserV0 & { userId: string }>> {
  const db = getFirestoreAdmin();
  const snap = await db.collection(COLLECTION).orderBy("email", "asc").get();
  return snap.docs.map((doc) => ({ userId: doc.id, ...(doc.data() as FirestoreUserV0) }));
}

export async function updateUserRoleStatus(
  userId: string,
  updates: { role?: "admin" | "user"; status?: "active" | "suspended" },
  actorEmail: string
) {
  const db = getFirestoreAdmin();
  const now = nowIso();
  await db.collection(COLLECTION).doc(userId).set(
    {
      ...(updates.role ? { role: updates.role } : {}),
      ...(updates.status ? { status: updates.status } : {}),
      updatedAt: now,
      updatedBy: actorEmail,
    },
    { merge: true }
  );
}

export async function resetPasswordByUserId(userId: string, actorEmail: string): Promise<string> {
  const db = getFirestoreAdmin();
  const now = nowIso();
  const password = generateStrongPassword();
  const passwordHash = await hashPassword(password);
  await db.collection(COLLECTION).doc(userId).set(
    {
      passwordHash,
      authProvider: "email",
      mustChangePassword: true,
      status: "active",
      updatedAt: now,
      updatedBy: actorEmail,
    },
    { merge: true }
  );
  return password;
}

export async function deleteUsersByEmail(email: string): Promise<number> {
  const db = getFirestoreAdmin();
  const normalized = normalizeEmail(email);
  const snap = await db.collection(COLLECTION).where("email", "==", normalized).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  return snap.size;
}
