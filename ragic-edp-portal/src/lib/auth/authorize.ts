import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import { loadAuthEnvConfigV0 } from "@/lib/config/env";

const env = loadAuthEnvConfigV0();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isDevBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development" && env.portalDevBypassAuth;
}

export function isAllowlistedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (env.portalAdminEmails.length === 0) return false;
  return env.portalAdminEmails.includes(normalizeEmail(email));
}

export function authorize(session: Session | null | undefined): boolean {
  if (isDevBypassEnabled()) return true;
  return isAllowlistedEmail(session?.user?.email);
}

export function getSignInUrl(callbackUrl?: string): string {
  if (!callbackUrl) return "/api/auth/signin";
  return `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function requireAuthorized(session: Session | null | undefined, callbackUrl?: string): Session {
  if (!authorize(session)) {
    redirect(getSignInUrl(callbackUrl));
  }

  return session as Session;
}

export function assertAuthorized(session: Session | null | undefined): asserts session is Session {
  if (!authorize(session)) {
    throw new Error("Unauthorized");
  }
}
