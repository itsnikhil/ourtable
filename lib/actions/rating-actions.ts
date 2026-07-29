"use server";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orderedItems, users, visitRatings, visits } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { runAction } from "@/lib/action-utils";
import { submitRatingSchema } from "@/lib/validations/rating";

/**
 * Notify partner that a rating is waiting (HLD §6.3 / FR-3.4).
 * Looks up their push_subscriptions and sends via web-push; drops 404/410 rows.
 */
export async function notifyPartnerRatingPending(
  visitId: string,
  partnerUserId: string,
): Promise<void> {
  const { deliverPartnerRatingPush } = await import("@/lib/push-notify");
  await deliverPartnerRatingPush(visitId, partnerUserId);
}

export async function submitVisitRating(
  input: z.input<typeof submitRatingSchema>,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = submitRatingSchema.parse(input);
    const { userId, householdId } = await requireAuthContext();

    const [visit] = await db
      .select({
        id: visits.id,
        status: visits.status,
      })
      .from(visits)
      .where(
        and(eq(visits.id, parsed.visitId), eq(visits.householdId, householdId)),
      )
      .limit(1);

    if (!visit) {
      return fail("NOT_FOUND", "Visit not found.");
    }

    // LLD §5.2 — exact message even though PLANNED visits aren't creatable until M4
    if (visit.status !== "COMPLETED") {
      return fail(
        "VALIDATION_ERROR",
        "Visit must be marked completed before rating",
      );
    }

    if (parsed.favoriteDishId) {
      const [dish] = await db
        .select({ id: orderedItems.id })
        .from(orderedItems)
        .where(
          and(
            eq(orderedItems.id, parsed.favoriteDishId),
            eq(orderedItems.visitId, parsed.visitId),
          ),
        )
        .limit(1);
      if (!dish) {
        return fail("NOT_FOUND", "Favorite dish not found on this visit.");
      }
    }

    const [existing] = await db
      .select({ id: visitRatings.id })
      .from(visitRatings)
      .where(
        and(
          eq(visitRatings.visitId, parsed.visitId),
          eq(visitRatings.userId, userId),
        ),
      )
      .limit(1);

    const isFirstInsert = !existing;

    const values = {
      visitId: parsed.visitId,
      userId,
      overallRating: String(parsed.overallRating),
      food: parsed.food,
      service: parsed.service,
      atmosphere: parsed.atmosphere,
      value: parsed.value,
      drinks: parsed.drinks,
      presentation: parsed.presentation,
      waitingTime: parsed.waitingTime,
      cleanliness: parsed.cleanliness,
      wouldReturn: parsed.wouldReturn,
      favoriteDishId: parsed.favoriteDishId,
      reviewText: parsed.reviewText,
    };

    const [row] = await db
      .insert(visitRatings)
      .values(values)
      .onConflictDoUpdate({
        target: [visitRatings.visitId, visitRatings.userId],
        set: {
          overallRating: values.overallRating,
          food: values.food,
          service: values.service,
          atmosphere: values.atmosphere,
          value: values.value,
          drinks: values.drinks,
          presentation: values.presentation,
          waitingTime: values.waitingTime,
          cleanliness: values.cleanliness,
          wouldReturn: values.wouldReturn,
          favoriteDishId: values.favoriteDishId,
          reviewText: values.reviewText,
        },
      })
      .returning({ id: visitRatings.id });

    if (isFirstInsert) {
      const partners = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(eq(users.householdId, householdId), ne(users.id, userId)),
        );

      for (const partner of partners) {
        const [partnerRating] = await db
          .select({ id: visitRatings.id })
          .from(visitRatings)
          .where(
            and(
              eq(visitRatings.visitId, parsed.visitId),
              eq(visitRatings.userId, partner.id),
            ),
          )
          .limit(1);

        if (!partnerRating) {
          await notifyPartnerRatingPending(parsed.visitId, partner.id);
        }
      }
    }

    return ok({ id: row.id });
  });
}

/** Alias of submitVisitRating (LLD §5.2) — same upsert body. */
export async function updateVisitRating(
  input: z.input<typeof submitRatingSchema>,
): Promise<ActionResult<{ id: string }>> {
  return submitVisitRating(input);
}
