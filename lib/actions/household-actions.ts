"use server";

import { randomBytes } from "crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  householdInvites,
  households,
  lists,
  restaurants,
  tags,
  users,
  visits,
} from "@/db/schema";
import { PENDING_INVITE_COOKIE, auth, requireAuthContext } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { runAction } from "@/lib/action-utils";
import {
  acceptInviteSchema,
  createInviteSchema,
} from "@/lib/validations/household";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HOUSEHOLD_MEMBER_CAP = 2;

/** Best-effort cleanup after a solo user leaves their household for an invite. */
async function orphanAbandonedHousehold(householdId: string): Promise<void> {
  await db
    .delete(householdInvites)
    .where(eq(householdInvites.householdId, householdId));
  await db.delete(lists).where(eq(lists.householdId, householdId));

  const [[restaurantCount], [tagCount], [visitCount]] = await Promise.all([
    db
      .select({ value: count() })
      .from(restaurants)
      .where(eq(restaurants.householdId, householdId)),
    db
      .select({ value: count() })
      .from(tags)
      .where(eq(tags.householdId, householdId)),
    db
      .select({ value: count() })
      .from(visits)
      .where(eq(visits.householdId, householdId)),
  ]);

  const hasChildData =
    (restaurantCount?.value ?? 0) > 0 ||
    (tagCount?.value ?? 0) > 0 ||
    (visitCount?.value ?? 0) > 0;

  if (!hasChildData) {
    await db.delete(households).where(eq(households.id, householdId));
  }
}

async function clearPendingInviteCookie(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(PENDING_INVITE_COOKIE);
  } catch {
    // No request cookie store outside Next.js (e.g. node:test).
  }
}

export async function createHouseholdInvite(
  input: z.infer<typeof createInviteSchema> = {},
): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  return runAction(async () => {
    createInviteSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const [memberCount] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.householdId, householdId));

    if ((memberCount?.value ?? 0) >= HOUSEHOLD_MEMBER_CAP) {
      return fail(
        "CONFLICT",
        "This household already has the maximum of 2 members.",
      );
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await db.insert(householdInvites).values({
      householdId,
      token,
      expiresAt,
    });

    return ok({ token, expiresAt: expiresAt.toISOString() });
  });
}

export async function acceptHouseholdInvite(
  input: z.infer<typeof acceptInviteSchema>,
): Promise<ActionResult<{ householdId: string }>> {
  return runAction(async () => {
    const parsed = acceptInviteSchema.parse(input);
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return fail("UNAUTHORIZED", "You must be signed in.");
    }

    const [dbUser] = await db
      .select({ householdId: users.householdId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const currentHouseholdId = dbUser?.householdId ?? null;

    const [invite] = await db
      .select()
      .from(householdInvites)
      .where(
        and(
          eq(householdInvites.token, parsed.token),
          gt(householdInvites.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!invite) {
      return fail("NOT_FOUND", "Invite not found or expired.");
    }

    if (currentHouseholdId === invite.householdId) {
      await clearPendingInviteCookie();
      return ok({ householdId: invite.householdId });
    }

    let abandonedHouseholdId: string | null = null;

    if (currentHouseholdId) {
      const [ownMemberCount] = await db
        .select({ value: count() })
        .from(users)
        .where(eq(users.householdId, currentHouseholdId));

      if ((ownMemberCount?.value ?? 0) >= 2) {
        return fail(
          "CONFLICT",
          "You already belong to a household with another member.",
        );
      }

      abandonedHouseholdId = currentHouseholdId;
    }

    const [memberCount] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.householdId, invite.householdId));

    if ((memberCount?.value ?? 0) >= HOUSEHOLD_MEMBER_CAP) {
      return fail(
        "CONFLICT",
        "This household already has the maximum of 2 members.",
      );
    }

    await db
      .update(users)
      .set({ householdId: invite.householdId })
      .where(eq(users.id, userId));

    await db
      .delete(householdInvites)
      .where(eq(householdInvites.id, invite.id));

    if (abandonedHouseholdId) {
      await orphanAbandonedHousehold(abandonedHouseholdId);
    }

    await clearPendingInviteCookie();

    // Smart lists are seeded on household creation (first sign-up), not on accept.
    return ok({ householdId: invite.householdId });
  });
}
