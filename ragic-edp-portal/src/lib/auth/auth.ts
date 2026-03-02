import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { isAllowlistedEmail, isEnvAdminEmail } from "@/lib/auth/authorize";
import { loadAuthEnvConfigV0 } from "@/lib/config/env";
import { isAllowed } from "@/lib/firestore/allowlist.repo";
import { ensureUserForGoogleLogin, getUserByEmail, markLogin } from "@/lib/firestore/user.repo";
import { verifyPassword } from "@/lib/auth/password";

const env = loadAuthEnvConfigV0();

const authConfig = {
  providers: [
    Google({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    }),
    Credentials({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const allowed = await isAllowlistedEmail(email);
        if (!allowed) return null;

        const user = await getUserByEmail(email);
        if (!user || user.status === "suspended" || !user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        await markLogin(user.userId, { email, authProvider: "email" });
        return {
          id: user.userId,
          email: user.email,
          name: user.displayName ?? undefined,
          role: user.role ?? (isEnvAdminEmail(email) ? "admin" : "user"),
          status: user.status ?? "active",
          mustChangePassword: Boolean(user.mustChangePassword),
        } as any;
      },
    }),
  ],
  trustHost: true,
  secret: env.nextAuthSecret,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user, account }) {
      try {
        const email = user.email?.trim().toLowerCase();
        if (!email) { console.error("[auth] signIn: no email"); return false; }

        const allowed = await isAllowlistedEmail(email);
        if (!allowed) { console.error("[auth] signIn: not allowlisted:", email); return false; }

        if (account?.provider === "google") {
          const dbAllowed = await isAllowed(email);
          if (!dbAllowed && !isEnvAdminEmail(email)) {
            console.error("[auth] signIn: not in Firestore allowlist and not admin:", email);
            return false;
          }
          const dbUser = await ensureUserForGoogleLogin(email, user.name);
          if (dbUser.status === "suspended") { console.error("[auth] signIn: user suspended:", email); return false; }
          (user as any).id = dbUser.userId;
          (user as any).role = dbUser.role ?? (isEnvAdminEmail(email) ? "admin" : "user");
          (user as any).status = dbUser.status ?? "active";
          (user as any).mustChangePassword = Boolean(dbUser.mustChangePassword);
        }
        console.log("[auth] signIn: success for", email);
        return true;
      } catch (err) {
        console.error("[auth] signIn callback error:", err);
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as any).id ?? token.sub;
        token.role = (user as any).role ?? token.role ?? "user";
        token.status = (user as any).status ?? token.status ?? "active";
        token.mustChangePassword = (user as any).mustChangePassword ?? token.mustChangePassword ?? false;
      } else if (token.email) {
        // Keep token synced with Firestore role/status across requests
        const dbUser = await getUserByEmail(token.email);
        if (dbUser) {
          token.userId = dbUser.userId;
          token.role = dbUser.role ?? (isEnvAdminEmail(dbUser.email) ? "admin" : "user");
          token.status = dbUser.status ?? "active";
          token.mustChangePassword = Boolean(dbUser.mustChangePassword);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId ?? token.sub;
        (session.user as any).role = token.role ?? "user";
        (session.user as any).status = token.status ?? "active";
        (session.user as any).mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
