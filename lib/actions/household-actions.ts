"use server";

import { randomBytes } from "crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { householdInvites, users } from "@/db/schema";
import { PENDING_INVITE_COOKIE, auth, requireAuthContext } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { runAction } from "@/lib/action-utils";
import {
  acceptInviteSchema,
  createInviteSchema,
} from "@/lib/validations/household";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HOUSEHOLD_MEMBER_CAP = 2;

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

    if (session.user.householdId) {
      return fail("CONFLICT", "You already belong to a household.");
    }

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

    const jar = await cookies();
    jar.delete(PENDING_INVITE_COOKIE);

    // Smart lists are seeded on household creation (first sign-up), not on accept.
    return ok({ householdId: invite.householdId });
  });
}
