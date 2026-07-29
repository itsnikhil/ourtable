import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { ensureHouseholdForUser } from "@/lib/household";
import { isAuthBypassEnabled } from "@/lib/auth-bypass-flag";

export type AuthContext = {
  userId: string;
  householdId: string;
};

export { isAuthBypassEnabled };

function bypassEmail() {
  return process.env.AUTH_BYPASS_EMAIL ?? "local@ourtable.dev";
}

function bypassName() {
  return process.env.AUTH_BYPASS_NAME ?? "Local Tester";
}

/**
 * Finds or creates a local test user + household when AUTH_BYPASS=true.
 */
export async function getBypassAuthContext(): Promise<
  AuthContext & { email: string; name: string; image: string | null }
> {
  const email = bypassEmail();
  const defaultName = bypassName();

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId = existing?.id;
  let householdId = existing?.householdId ?? null;
  let name = existing?.name || defaultName;
  let image = existing?.image ?? null;

  if (!userId) {
    userId = createId();
    await db.insert(users).values({
      id: userId,
      email,
      name: defaultName,
      emailVerified: new Date(),
    });
    name = defaultName;
  }

  if (!householdId) {
    householdId = await ensureHouseholdForUser({
      userId,
      displayName: name,
      email,
    });
  }

  if (!householdId) {
    throw new Error("AUTH_BYPASS: failed to provision local household");
  }

  return { userId, householdId, email, name, image };
}
