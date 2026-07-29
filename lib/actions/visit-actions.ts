"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { restaurants, visits } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { runAction } from "@/lib/action-utils";
import {
  billSchema,
  createVisitSchema,
  rescheduleVisitSchema,
  updateVisitSchema,
  visitStatusSchema,
} from "@/lib/validations/visit";

type VisitStatus = z.infer<typeof visitStatusSchema>;

async function assertRestaurantInHousehold(
  restaurantId: string,
  householdId: string,
) {
  const [row] = await db
    .select({
      id: restaurants.id,
      status: restaurants.status,
    })
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

async function assertVisitInHousehold(visitId: string, householdId: string) {
  const [row] = await db
    .select({
      id: visits.id,
      restaurantId: visits.restaurantId,
      status: visits.status,
    })
    .from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.householdId, householdId)))
    .limit(1);
  return row ?? null;
}

export async function createVisit(
  input: z.input<typeof createVisitSchema>,
): Promise<ActionResult<{ id: string; status: VisitStatus }>> {
  return runAction(async () => {
    const parsed = createVisitSchema.parse(input);
    const { userId, householdId } = await requireAuthContext();

    const restaurant = await assertRestaurantInHousehold(
      parsed.restaurantId,
      householdId,
    );
    if (!restaurant) {
      return fail("NOT_FOUND", "Restaurant not found.");
    }

    const [created] = await db
      .insert(visits)
      .values({
        householdId,
        restaurantId: parsed.restaurantId,
        visitDate: new Date(parsed.visitDate),
        visitTime: parsed.visitTime,
        meal: parsed.meal,
        dineType: parsed.dineType,
        occasion: parsed.occasion,
        partySize: parsed.partySize,
        seating: parsed.seating,
        status: parsed.status,
        createdById: userId,
      })
      .returning({ id: visits.id, status: visits.status });

    // LLD §3.2 — WISHLIST → VISITED (completed) or PLANNED; never downgrade VISITED
    if (restaurant.status === "WISHLIST") {
      if (parsed.status === "COMPLETED") {
        await db
          .update(restaurants)
          .set({ status: "VISITED" })
          .where(
            and(
              eq(restaurants.id, restaurant.id),
              eq(restaurants.householdId, householdId),
            ),
          );
      } else if (parsed.status === "PLANNED") {
        await db
          .update(restaurants)
          .set({ status: "PLANNED" })
          .where(
            and(
              eq(restaurants.id, restaurant.id),
              eq(restaurants.householdId, householdId),
            ),
          );
      }
    }

    return ok({ id: created.id, status: created.status });
  });
}

export async function updateVisit(
  input: z.input<typeof updateVisitSchema>,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = updateVisitSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertVisitInHousehold(parsed.id, householdId);
    if (!existing) {
      return fail("NOT_FOUND", "Visit not found.");
    }

    if (parsed.restaurantId !== undefined) {
      const restaurant = await assertRestaurantInHousehold(
        parsed.restaurantId,
        householdId,
      );
      if (!restaurant) {
        return fail("NOT_FOUND", "Restaurant not found.");
      }
    }

    const { id, ...fields } = parsed;

    await db
      .update(visits)
      .set({
        ...(fields.restaurantId !== undefined
          ? { restaurantId: fields.restaurantId }
          : {}),
        ...(fields.visitDate !== undefined
          ? { visitDate: new Date(fields.visitDate) }
          : {}),
        ...(fields.visitTime !== undefined
          ? { visitTime: fields.visitTime }
          : {}),
        ...(fields.meal !== undefined ? { meal: fields.meal } : {}),
        ...(fields.dineType !== undefined ? { dineType: fields.dineType } : {}),
        ...(fields.occasion !== undefined ? { occasion: fields.occasion } : {}),
        ...(fields.partySize !== undefined
          ? { partySize: fields.partySize }
          : {}),
        ...(fields.seating !== undefined ? { seating: fields.seating } : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
      })
      .where(and(eq(visits.id, id), eq(visits.householdId, householdId)));

    return ok({ id });
  });
}

export async function setBill(
  input: z.input<typeof billSchema>,
): Promise<ActionResult<{ visitId: string; totalPaid: string | null }>> {
  return runAction(async () => {
    const parsed = billSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertVisitInHousehold(parsed.visitId, householdId);
    if (!existing) {
      return fail("NOT_FOUND", "Visit not found.");
    }

    const [updated] = await db
      .update(visits)
      .set({
        ...(parsed.subtotal !== undefined ? { subtotal: parsed.subtotal } : {}),
        ...(parsed.tip !== undefined ? { tip: parsed.tip } : {}),
        ...(parsed.totalPaid !== undefined
          ? { totalPaid: parsed.totalPaid }
          : {}),
        ...(parsed.paymentSplit !== undefined
          ? { paymentSplit: parsed.paymentSplit }
          : {}),
        ...(parsed.paymentMethod !== undefined
          ? { paymentMethod: parsed.paymentMethod }
          : {}),
      })
      .where(
        and(eq(visits.id, parsed.visitId), eq(visits.householdId, householdId)),
      )
      .returning({
        visitId: visits.id,
        totalPaid: visits.totalPaid,
      });

    return ok({
      visitId: updated.visitId,
      totalPaid: updated.totalPaid,
    });
  });
}

/** Reschedule a PLANNED visit only (LLD §3.2). */
export async function rescheduleVisit(
  input: z.input<typeof rescheduleVisitSchema>,
): Promise<ActionResult<{ id: string; visitDate: string }>> {
  return runAction(async () => {
    const parsed = rescheduleVisitSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertVisitInHousehold(parsed.id, householdId);
    if (!existing || existing.status !== "PLANNED") {
      return fail("NOT_FOUND", "Planned visit not found.");
    }

    const [updated] = await db
      .update(visits)
      .set({
        visitDate: new Date(parsed.visitDate),
        ...(parsed.visitTime !== undefined
          ? { visitTime: parsed.visitTime }
          : {}),
      })
      .where(and(eq(visits.id, parsed.id), eq(visits.householdId, householdId)))
      .returning({ id: visits.id, visitDate: visits.visitDate });

    return ok({
      id: updated.id,
      visitDate: updated.visitDate.toISOString(),
    });
  });
}

/** Hard-delete a PLANNED visit; CONFLICT if COMPLETED (LLD §3.2). */
export async function cancelVisit(
  input: { id: string },
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = z.object({ id: z.string() }).parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertVisitInHousehold(parsed.id, householdId);
    if (!existing) {
      return fail("NOT_FOUND", "Visit not found.");
    }

    if (existing.status === "COMPLETED") {
      return fail(
        "CONFLICT",
        "Completed visits cannot be cancelled. Edit them instead.",
      );
    }

    if (existing.status !== "PLANNED") {
      return fail("NOT_FOUND", "Planned visit not found.");
    }

    await db.delete(visits).where(
      and(eq(visits.id, parsed.id), eq(visits.householdId, householdId)),
    );

    return ok({ id: parsed.id });
  });
}

/**
 * PLANNED → COMPLETED. `confirmed` distinguishes user tap vs cron auto-complete
 * for logs only (LLD §3.2 / §9.4).
 *
 * `asSystem: true` skips session auth (cron route only — token already verified).
 */
export async function completeVisit(
  input: { id: string; confirmed: boolean },
  options?: { asSystem?: boolean },
): Promise<ActionResult<{ id: string; status: "COMPLETED" }>> {
  return runAction(async () => {
    const parsed = z
      .object({ id: z.string(), confirmed: z.boolean() })
      .parse(input);

    let householdId: string;
    let restaurantId: string;

    if (options?.asSystem) {
      const [row] = await db
        .select({
          id: visits.id,
          status: visits.status,
          householdId: visits.householdId,
          restaurantId: visits.restaurantId,
        })
        .from(visits)
        .where(eq(visits.id, parsed.id))
        .limit(1);

      if (!row) {
        return fail("NOT_FOUND", "Visit not found.");
      }
      if (row.status !== "PLANNED") {
        return fail(
          "VALIDATION_ERROR",
          "Only planned visits can be marked completed.",
        );
      }
      householdId = row.householdId;
      restaurantId = row.restaurantId;
    } else {
      const { householdId: authHouseholdId } = await requireAuthContext();
      const existing = await assertVisitInHousehold(
        parsed.id,
        authHouseholdId,
      );
      if (!existing) {
        return fail("NOT_FOUND", "Visit not found.");
      }
      if (existing.status !== "PLANNED") {
        return fail(
          "VALIDATION_ERROR",
          "Only planned visits can be marked completed.",
        );
      }
      householdId = authHouseholdId;
      restaurantId = existing.restaurantId;
    }

    const [updated] = await db
      .update(visits)
      .set({ status: "COMPLETED" })
      .where(and(eq(visits.id, parsed.id), eq(visits.householdId, householdId)))
      .returning({ id: visits.id, status: visits.status });

    const [restaurant] = await db
      .select({ id: restaurants.id, status: restaurants.status })
      .from(restaurants)
      .where(
        and(
          eq(restaurants.id, restaurantId),
          eq(restaurants.householdId, householdId),
        ),
      )
      .limit(1);

    if (
      restaurant &&
      (restaurant.status === "PLANNED" || restaurant.status === "WISHLIST")
    ) {
      await db
        .update(restaurants)
        .set({ status: "VISITED" })
        .where(eq(restaurants.id, restaurant.id));
    }

    console.info("[completeVisit]", {
      id: updated.id,
      confirmed: parsed.confirmed,
      source: parsed.confirmed ? "user" : "system",
    });

    return ok({ id: updated.id, status: "COMPLETED" as const });
  });
}
