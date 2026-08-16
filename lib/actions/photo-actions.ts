"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { photos, restaurants, visits } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { runAction } from "@/lib/action-utils";
import { attachPhotoSchema } from "@/lib/validations/photo";
import { isHouseholdPhotoUrl } from "@/lib/r2";

async function assertVisitInHousehold(visitId: string, householdId: string) {
  const [row] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.householdId, householdId)))
    .limit(1);
  return row ?? null;
}

async function assertRestaurantInHousehold(
  restaurantId: string,
  householdId: string,
) {
  const [row] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(
      and(
        eq(restaurants.id, restaurantId),
        eq(restaurants.householdId, householdId),
        isNull(restaurants.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function assertPhotoInHousehold(photoId: string, householdId: string) {
  const [row] = await db
    .select({
      id: photos.id,
      visitId: photos.visitId,
      restaurantId: photos.restaurantId,
    })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (!row) return null;

  if (row.visitId) {
    const visit = await assertVisitInHousehold(row.visitId, householdId);
    return visit ? row : null;
  }
  if (row.restaurantId) {
    const restaurant = await assertRestaurantInHousehold(
      row.restaurantId,
      householdId,
    );
    return restaurant ? row : null;
  }
  return null;
}

export async function attachPhoto(
  input: z.input<typeof attachPhotoSchema>,
): Promise<ActionResult<{ id: string; url: string }>> {
  return runAction(async () => {
    const parsed = attachPhotoSchema.parse(input);
    const { userId, householdId } = await requireAuthContext();

    if (!isHouseholdPhotoUrl(parsed.objectUrl, householdId)) {
      return fail("VALIDATION_ERROR", "Invalid photo URL for this household.");
    }

    if (parsed.visitId) {
      const visit = await assertVisitInHousehold(parsed.visitId, householdId);
      if (!visit) {
        return fail("NOT_FOUND", "Visit not found.");
      }
    } else if (parsed.restaurantId) {
      const restaurant = await assertRestaurantInHousehold(
        parsed.restaurantId,
        householdId,
      );
      if (!restaurant) {
        return fail("NOT_FOUND", "Restaurant not found.");
      }
    }

    const [created] = await db
      .insert(photos)
      .values({
        url: parsed.objectUrl,
        visitId: parsed.visitId,
        restaurantId: parsed.restaurantId,
        uploadedById: userId,
      })
      .returning({ id: photos.id, url: photos.url });

    return ok({ id: created.id, url: created.url });
  });
}

/**
 * Deletes the Photo DB row only. R2 objects are GC'd async by the worker
 * (LLD §8.2) — do not call R2 delete here.
 */
export async function removePhoto(
  input: { id: string },
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = z.object({ id: z.string() }).parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertPhotoInHousehold(parsed.id, householdId);
    if (!existing) {
      return fail("NOT_FOUND", "Photo not found.");
    }

    await db.delete(photos).where(eq(photos.id, parsed.id));
    return ok({ id: parsed.id });
  });
}
