import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import { isAllowlistedEmail } from "@/lib/auth/authorize";
import { loadAuthEnvConfigV0 } from "@/lib/config/env";

const env = loadAuthEnvConfigV0();

const authConfig = {
  providers: [
    Google({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    }),
  ],
  secret: env.nextAuthSecret,
  callbacks: {
    signIn({ user }) {
      return isAllowlistedEmail(user.email);
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
