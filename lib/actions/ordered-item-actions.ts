"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orderedItems, users, visits } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { runAction } from "@/lib/action-utils";
import {
  orderedItemSchema,
  updateOrderedItemSchema,
} from "@/lib/validations/ordered-item";

async function assertVisitInHousehold(visitId: string, householdId: string) {
  const [row] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.householdId, householdId)))
    .limit(1);
  return row ?? null;
}

async function assertOrderedItemInHousehold(
  itemId: string,
  householdId: string,
) {
  const [row] = await db
    .select({
      id: orderedItems.id,
      visitId: orderedItems.visitId,
      dishName: orderedItems.dishName,
      price: orderedItems.price,
      shared: orderedItems.shared,
      orderedById: orderedItems.orderedById,
      wouldOrderAgain: orderedItems.wouldOrderAgain,
    })
    .from(orderedItems)
    .innerJoin(visits, eq(orderedItems.visitId, visits.id))
    .where(and(eq(orderedItems.id, itemId), eq(visits.householdId, householdId)))
    .limit(1);
  return row ?? null;
}

async function assertUserInHousehold(userId: string, householdId: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.householdId, householdId)))
    .limit(1);
  return row ?? null;
}

export async function addOrderedItem(
  input: z.input<typeof orderedItemSchema>,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = orderedItemSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const visit = await assertVisitInHousehold(parsed.visitId, householdId);
    if (!visit) {
      return fail("NOT_FOUND", "Visit not found.");
    }

    if (parsed.orderedById) {
      const member = await assertUserInHousehold(
        parsed.orderedById,
        householdId,
      );
      if (!member) {
        return fail("NOT_FOUND", "User not found.");
      }
    }

    const [created] = await db
      .insert(orderedItems)
      .values({
        visitId: parsed.visitId,
        dishName: parsed.dishName,
        price: parsed.price,
        shared: parsed.shared,
        orderedById: parsed.orderedById,
        wouldOrderAgain: parsed.wouldOrderAgain,
      })
      .returning({ id: orderedItems.id });

    return ok({ id: created.id });
  });
}

export async function updateOrderedItem(
  input: z.input<typeof updateOrderedItemSchema>,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = updateOrderedItemSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertOrderedItemInHousehold(parsed.id, householdId);
    if (!existing) {
      return fail("NOT_FOUND", "Ordered item not found.");
    }

    if (parsed.visitId !== undefined && parsed.visitId !== existing.visitId) {
      const visit = await assertVisitInHousehold(parsed.visitId, householdId);
      if (!visit) {
        return fail("NOT_FOUND", "Visit not found.");
      }
    }

    const nextShared = parsed.shared ?? existing.shared;
    const nextOrderedById =
      parsed.orderedById !== undefined
        ? parsed.orderedById
        : (existing.orderedById ?? undefined);

    if (!nextShared && !nextOrderedById) {
      return fail(
        "VALIDATION_ERROR",
        "orderedById is required when shared=false",
        { orderedById: ["orderedById is required when shared=false"] },
      );
    }

    if (parsed.orderedById) {
      const member = await assertUserInHousehold(
        parsed.orderedById,
        householdId,
      );
      if (!member) {
        return fail("NOT_FOUND", "User not found.");
      }
    }

    const { id, ...fields } = parsed;

    await db
      .update(orderedItems)
      .set({
        ...(fields.visitId !== undefined ? { visitId: fields.visitId } : {}),
        ...(fields.dishName !== undefined ? { dishName: fields.dishName } : {}),
        ...(fields.price !== undefined ? { price: fields.price } : {}),
        ...(fields.shared !== undefined ? { shared: fields.shared } : {}),
        ...(fields.orderedById !== undefined
          ? { orderedById: fields.orderedById }
          : {}),
        ...(fields.wouldOrderAgain !== undefined
          ? { wouldOrderAgain: fields.wouldOrderAgain }
          : {}),
      })
      .where(eq(orderedItems.id, id));

    return ok({ id });
  });
}

export async function removeOrderedItem(
  input: { id: string },
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = z.object({ id: z.string() }).parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertOrderedItemInHousehold(
      parsed.id,
      householdId,
    );
    if (!existing) {
      return fail("NOT_FOUND", "Ordered item not found.");
    }

    await db.delete(orderedItems).where(eq(orderedItems.id, parsed.id));
    return ok({ id: parsed.id });
  });
}
