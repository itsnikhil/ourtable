import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";

export async function getHouseholdMembers(): Promise<
  Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
    color: string | null;
  }>
> {
  const { householdId } = await requireAuthContext();

  const rows = await db
    .select({
      id: users.id,
      displayName: users.name,
      avatarUrl: users.image,
      color: users.color,
    })
    .from(users)
    .where(eq(users.householdId, householdId));

  return rows;
}
