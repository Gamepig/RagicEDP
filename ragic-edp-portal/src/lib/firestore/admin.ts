import "server-only";

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

let firestoreSingleton: Firestore | null = null;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Firestore admin is server-only.");
  }
}

export function getFirestoreAdmin(): Firestore {
  assertServerOnly();
  if (firestoreSingleton) return firestoreSingleton;

  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: applicationDefault() });
  firestoreSingleton = getFirestore(app);
  return firestoreSingleton;
}
