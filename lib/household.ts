import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { households, lists, users } from "@/db/schema";
import { DEFAULT_SMART_LISTS } from "@/lib/smart-lists";

export async function seedDefaultLists(householdId: string): Promise<void> {
  await db.insert(lists).values(
    DEFAULT_SMART_LISTS.map((list) => ({
      householdId,
      name: list.name,
      type: "SMART" as const,
      smartRule: list.smartRule,
      icon: list.icon,
    })),
  );
}

/**
 * Creates a household for a newly signed-up user and seeds the 6 smart lists.
 * No-op if the user already belongs to a household.
 */
export async function ensureHouseholdForUser(input: {
  userId: string;
  displayName: string | null | undefined;
  email: string | null | undefined;
}): Promise<string | null> {
  const [existing] = await db
    .select({ householdId: users.householdId })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (existing?.householdId) {
    return existing.householdId;
  }

  const label =
    input.displayName?.trim() ||
    input.email?.split("@")[0] ||
    "Our Table";

  const [household] = await db
    .insert(households)
    .values({ name: `${label}'s household` })
    .returning({ id: households.id });

  await db
    .update(users)
    .set({
      householdId: household.id,
      name: input.displayName?.trim() || label,
    })
    .where(eq(users.id, input.userId));

  await seedDefaultLists(household.id);
  return household.id;
}
