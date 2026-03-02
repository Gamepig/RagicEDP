import "server-only";

import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

let firestoreSingleton: Firestore | null = null;
const DEFAULT_FIRESTORE_PROJECT_ID = "b25h01-ragic";
const FIRESTORE_ADMIN_APP_NAME = "firestore-admin";

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Firestore admin is server-only.");
  }
}

export function getFirestoreAdmin(): Firestore {
  assertServerOnly();
  if (firestoreSingleton) return firestoreSingleton;

  const firestoreProjectId = process.env.FIRESTORE_PROJECT_ID || DEFAULT_FIRESTORE_PROJECT_ID;
  const app = getApps().some((a) => a.name === FIRESTORE_ADMIN_APP_NAME)
    ? getApp(FIRESTORE_ADMIN_APP_NAME)
    : initializeApp(
        {
          credential: applicationDefault(),
          projectId: firestoreProjectId,
        },
        FIRESTORE_ADMIN_APP_NAME,
      );
  firestoreSingleton = getFirestore(app);
  return firestoreSingleton;
}
