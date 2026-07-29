import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const PENDING_INVITE_COOKIE = "ot_pending_invite";

/**
 * Edge-safe Auth.js config (no DB / adapter imports).
 * Used by middleware and merged into the full Node auth setup.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
      }
      // Allow client/server session updates to refresh householdId after invite accept.
      if (trigger === "update" && session?.householdId !== undefined) {
        token.householdId = session.householdId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.householdId =
          (token.householdId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
