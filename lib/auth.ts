import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";
import { authConfig, PENDING_INVITE_COOKIE } from "@/lib/auth.config";
import {
  getBypassAuthContext,
  isAuthBypassEnabled,
  type AuthContext,
} from "@/lib/auth-bypass";
import { ensureHouseholdForUser } from "@/lib/household";
import { AuthContextError } from "@/lib/errors";

export type { AuthContext };
export { PENDING_INVITE_COOKIE };

if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
  console.warn(
    "[auth] AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET missing — Google sign-in will fail until set.",
  );
}

const {
  handlers,
  auth: nextAuth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // JWT keeps middleware Edge-safe while still persisting users/accounts via the adapter.
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (trigger === "update" && session?.householdId !== undefined) {
        token.householdId = session.householdId;
      }

      // Always refresh household scope from DB on Node session access
      // (e.g. after acceptHouseholdInvite). Middleware uses Edge JWT only.
      if (token.sub) {
        const [row] = await db
          .select({ householdId: users.householdId })
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1);
        token.householdId = row?.householdId ?? null;
      }

      return token;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;

      // Invitees stay household-less until acceptHouseholdInvite (LLD §10).
      const jar = await cookies();
      if (jar.get(PENDING_INVITE_COOKIE)?.value) {
        return;
      }

      await ensureHouseholdForUser({
        userId: user.id,
        displayName: user.name,
        email: user.email,
      });
    },
  },
});

export { handlers, signIn, signOut };

/** Auth.js session, or a synthetic local session when AUTH_BYPASS=true. */
export async function auth() {
  if (isAuthBypassEnabled()) {
    const bypass = await getBypassAuthContext();
    return {
      user: {
        id: bypass.userId,
        householdId: bypass.householdId,
        name: bypass.name,
        email: bypass.email,
        image: bypass.image,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return nextAuth();
}

/**
 * Sole sanctioned way for actions/queries to obtain household scope (LLD §1.2).
 * Never accept householdId as a function argument elsewhere.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  if (isAuthBypassEnabled()) {
    const bypass = await getBypassAuthContext();
    return { userId: bypass.userId, householdId: bypass.householdId };
  }

  const session = await nextAuth();
  const userId = session?.user?.id;
  const householdId = session?.user?.householdId;

  if (!userId || !householdId) {
    throw new AuthContextError();
  }

  return { userId, householdId };
}
