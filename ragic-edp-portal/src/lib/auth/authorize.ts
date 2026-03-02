import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import { loadAuthEnvConfigV0 } from "@/lib/config/env";
import { isAllowed } from "@/lib/firestore/allowlist.repo";

const env = loadAuthEnvConfigV0();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isDevBypassEnabled(): boolean {
  // TODO: restore NODE_ENV check once OAuth is configured
  return env.portalDevBypassAuth;
}

export function isEnvAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (env.portalAdminEmails.length === 0) return false;
  return env.portalAdminEmails.includes(normalizeEmail(email));
}

export async function isAllowlistedEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  if (isEnvAdminEmail(normalized)) return true; // admin fallback
  try {
    return await isAllowed(normalized);
  } catch {
    return false;
  }
}

export function authorize(session: Session | null | undefined): boolean {
  if (isDevBypassEnabled()) return true;
  if (!session?.user?.email) return false;
  const status = (session.user as any).status;
  return status !== "suspended";
}

export function isAdminSession(session: Session | null | undefined): boolean {
  if (isDevBypassEnabled()) return true;
  const email = session?.user?.email;
  if (!email) return false;
  if (isEnvAdminEmail(email)) return true;
  return (session?.user as any)?.role === "admin";
}

export function getSignInUrl(callbackUrl?: string): string {
  if (!callbackUrl) return "/api/auth/signin";
  return `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function requireAuthorized(session: Session | null | undefined, callbackUrl?: string): Session {
  if (!authorize(session)) {
    redirect(getSignInUrl(callbackUrl));
  }
  if ((session?.user as any)?.mustChangePassword) {
    const to = callbackUrl ?? "";
    if (!to.startsWith("/auth/change-password")) {
      redirect("/auth/change-password");
    }
  }

  return session as Session;
}

export function requireAdmin(session: Session | null | undefined, callbackUrl?: string): Session {
  const s = requireAuthorized(session, callbackUrl);
  if (!isAdminSession(s)) {
    redirect("/analytics");
  }
  return s;
}

export function assertAuthorized(session: Session | null | undefined): asserts session is Session {
  if (!authorize(session)) {
    throw new Error("Unauthorized");
  }
}
