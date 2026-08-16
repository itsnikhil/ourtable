"use server";

import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  restaurantOpinions,
  restaurantTags,
  restaurants,
  tags,
  visits,
} from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { runAction } from "@/lib/action-utils";
import {
  createRestaurantSchema,
  setRestaurantOpinionSchema,
  updateRestaurantSchema,
  opinionTagSchema,
  tagCategorySchema,
} from "@/lib/validations/restaurant";

type OpinionTag = z.infer<typeof opinionTagSchema>;

const deleteRestaurantSchema = z.object({ id: z.string() });
const attachRestaurantTagsSchema = z.object({
  restaurantId: z.string(),
  tagIds: z.array(z.string()),
});
const removeRestaurantTagSchema = z.object({
  restaurantId: z.string(),
  tagId: z.string(),
});

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
      ),
    )
    .limit(1);
  return row ?? null;
}

async function findFuzzyDuplicate(input: {
  householdId: string;
  name: string;
  address?: string;
}): Promise<{ id: string } | null> {
  const needle = `${input.name} ${input.address ?? ""}`.trim();
  const result = await db.execute<{ id: string }>(sql`
    SELECT id
    FROM restaurants
    WHERE household_id = ${input.householdId}
      AND archived_at IS NULL
      AND similarity(
        name || ' ' || coalesce(address, ''),
        ${needle}
      ) >= 0.6
    ORDER BY similarity(
      name || ' ' || coalesce(address, ''),
      ${needle}
    ) DESC
    LIMIT 1
  `);

  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: { id: string }[] }).rows ?? []);
  return rows[0] ?? null;
}

export async function createRestaurant(
  input: z.input<typeof createRestaurantSchema>,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = createRestaurantSchema.parse(input);
    const { householdId } = await requireAuthContext();

    if (!parsed.forceCreate) {
      const duplicate = await findFuzzyDuplicate({
        householdId,
        name: parsed.name,
        address: parsed.address,
      });
      if (duplicate) {
        return fail(
          "CONFLICT",
          `A similar restaurant already exists (${duplicate.id}). Resubmit with forceCreate to keep both.`,
        );
      }
    }

    if (parsed.tagIds.length > 0) {
      const ownedTags = await db
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            eq(tags.householdId, householdId),
            inArray(tags.id, parsed.tagIds),
          ),
        );
      if (ownedTags.length !== parsed.tagIds.length) {
        return fail("NOT_FOUND", "One or more tags were not found.");
      }
    }

    const restaurantId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(restaurants)
        .values({
          householdId,
          name: parsed.name,
          priceRange: parsed.priceRange,
          website: parsed.website,
          phone: parsed.phone,
          address: parsed.address,
          lat: parsed.lat,
          lng: parsed.lng,
          neighborhood: parsed.neighborhood,
          area: parsed.area,
          supportsDelivery: parsed.supportsDelivery,
          supportsDineIn: parsed.supportsDineIn,
          supportsTakeout: parsed.supportsTakeout,
          menuUrl: parsed.menuUrl,
          notes: parsed.notes,
          status: "WISHLIST",
        })
        .returning({ id: restaurants.id });

      const resolvedTagIds: string[] = [...parsed.tagIds];

      for (const tag of parsed.newTagNames) {
        const [existing] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(
            and(
              eq(tags.householdId, householdId),
              eq(tags.name, tag.name),
              eq(tags.category, tag.category),
            ),
          )
          .limit(1);

        if (existing) {
          resolvedTagIds.push(existing.id);
          continue;
        }

        const [inserted] = await tx
          .insert(tags)
          .values({
            householdId,
            name: tag.name,
            category: tag.category,
          })
          .returning({ id: tags.id });
        resolvedTagIds.push(inserted.id);
      }

      const uniqueTagIds = [...new Set(resolvedTagIds)];
      if (uniqueTagIds.length > 0) {
        await tx.insert(restaurantTags).values(
          uniqueTagIds.map((tagId) => ({
            restaurantId: created.id,
            tagId,
          })),
        );
      }

      return created.id;
    });

    return ok({ id: restaurantId });
  });
}

export async function updateRestaurant(
  input: z.input<typeof updateRestaurantSchema>,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const parsed = updateRestaurantSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertRestaurantInHousehold(parsed.id, householdId);
    if (!existing) {
      return fail("NOT_FOUND", "Restaurant not found.");
    }

    const { id, tagIds, newTagNames, forceCreate, ...fields } = parsed;
    void forceCreate;

    await db
      .update(restaurants)
      .set({
        ...(fields.name !== undefined ? { name: fields.name } : {}),
        ...(fields.priceRange !== undefined
          ? { priceRange: fields.priceRange }
          : {}),
        ...(fields.website !== undefined ? { website: fields.website } : {}),
        ...(fields.phone !== undefined ? { phone: fields.phone } : {}),
        ...(fields.address !== undefined ? { address: fields.address } : {}),
        ...(fields.lat !== undefined ? { lat: fields.lat } : {}),
        ...(fields.lng !== undefined ? { lng: fields.lng } : {}),
        ...(fields.neighborhood !== undefined
          ? { neighborhood: fields.neighborhood }
          : {}),
        ...(fields.area !== undefined ? { area: fields.area } : {}),
        ...(fields.supportsDelivery !== undefined
          ? { supportsDelivery: fields.supportsDelivery }
          : {}),
        ...(fields.supportsDineIn !== undefined
          ? { supportsDineIn: fields.supportsDineIn }
          : {}),
        ...(fields.supportsTakeout !== undefined
          ? { supportsTakeout: fields.supportsTakeout }
          : {}),
        ...(fields.menuUrl !== undefined ? { menuUrl: fields.menuUrl } : {}),
        ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
      })
      .where(
        and(eq(restaurants.id, id), eq(restaurants.householdId, householdId)),
      );

    const tagIdsToAttach: string[] = [...(tagIds ?? [])];

    async function findOrCreateTag(tag: {
      name: string;
      category: z.infer<typeof tagCategorySchema>;
    }): Promise<string> {
      const [existingTag] = await db
        .select({ id: tags.id })
        .from(tags)
        .where(
          and(
            eq(tags.householdId, householdId),
            eq(tags.name, tag.name),
            eq(tags.category, tag.category),
          ),
        )
        .limit(1);

      if (existingTag) return existingTag.id;

      const [inserted] = await db
        .insert(tags)
        .values({
          householdId,
          name: tag.name,
          category: tag.category,
        })
        .returning({ id: tags.id });
      return inserted.id;
    }

    if (newTagNames !== undefined) {
      const foodTypeTags = newTagNames.filter((t) => t.category === "FOOD_TYPE");
      const otherTags = newTagNames.filter((t) => t.category !== "FOOD_TYPE");

      const desiredFoodTypeIds: string[] = [];
      for (const tag of foodTypeTags) {
        desiredFoodTypeIds.push(await findOrCreateTag(tag));
      }

      const currentFoodType = await db
        .select({
          tagId: restaurantTags.tagId,
        })
        .from(restaurantTags)
        .innerJoin(tags, eq(restaurantTags.tagId, tags.id))
        .where(
          and(
            eq(restaurantTags.restaurantId, id),
            eq(tags.category, "FOOD_TYPE"),
          ),
        );

      const desiredSet = new Set(desiredFoodTypeIds);
      const toRemove = currentFoodType.filter((row) => !desiredSet.has(row.tagId));
      if (toRemove.length > 0) {
        await db.delete(restaurantTags).where(
          and(
            eq(restaurantTags.restaurantId, id),
            inArray(
              restaurantTags.tagId,
              toRemove.map((row) => row.tagId),
            ),
          ),
        );
      }

      tagIdsToAttach.push(...desiredFoodTypeIds);
      for (const tag of otherTags) {
        tagIdsToAttach.push(await findOrCreateTag(tag));
      }
    }

    if (tagIdsToAttach.length > 0) {
      const attachResult = await attachRestaurantTags({
        restaurantId: id,
        tagIds: [...new Set(tagIdsToAttach)],
      });
      if (!attachResult.success) return attachResult;
    }

    return ok({ id });
  });
}

/**
 * Hard-deletes when there are no visits.
 * If any visits exist: sets `archivedAt = now()` and returns success with `archived: true`
 * (resolved LLD §12.2 — soft archive instead of CONFLICT).
 */
export async function deleteRestaurant(
  input: z.infer<typeof deleteRestaurantSchema>,
): Promise<ActionResult<{ id: string; archived: boolean }>> {
  return runAction(async () => {
    const parsed = deleteRestaurantSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertRestaurantInHousehold(parsed.id, householdId);
    if (!existing) {
      return fail("NOT_FOUND", "Restaurant not found.");
    }

    const [visitCount] = await db
      .select({ value: count() })
      .from(visits)
      .where(eq(visits.restaurantId, parsed.id));

    if ((visitCount?.value ?? 0) > 0) {
      await db
        .update(restaurants)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(restaurants.id, parsed.id),
            eq(restaurants.householdId, householdId),
          ),
        );
      return ok({ id: parsed.id, archived: true });
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(restaurantTags)
        .where(eq(restaurantTags.restaurantId, parsed.id));
      await tx
        .delete(restaurantOpinions)
        .where(eq(restaurantOpinions.restaurantId, parsed.id));
      await tx
        .delete(restaurants)
        .where(
          and(
            eq(restaurants.id, parsed.id),
            eq(restaurants.householdId, householdId),
            isNull(restaurants.archivedAt),
          ),
        );
    });

    return ok({ id: parsed.id, archived: false });
  });
}

export async function setRestaurantOpinion(
  input: z.infer<typeof setRestaurantOpinionSchema>,
): Promise<ActionResult<{ restaurantId: string; tag: OpinionTag }>> {
  return runAction(async () => {
    const parsed = setRestaurantOpinionSchema.parse(input);
    const { userId, householdId } = await requireAuthContext();

    const existing = await assertRestaurantInHousehold(
      parsed.restaurantId,
      householdId,
    );
    if (!existing) {
      return fail("NOT_FOUND", "Restaurant not found.");
    }

    await db
      .insert(restaurantOpinions)
      .values({
        restaurantId: parsed.restaurantId,
        userId,
        tag: parsed.tag,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [restaurantOpinions.restaurantId, restaurantOpinions.userId],
        set: {
          tag: parsed.tag,
          updatedAt: new Date(),
        },
      });

    return ok({ restaurantId: parsed.restaurantId, tag: parsed.tag });
  });
}

export async function attachRestaurantTags(
  input: z.infer<typeof attachRestaurantTagsSchema>,
): Promise<ActionResult<{ restaurantId: string }>> {
  return runAction(async () => {
    const parsed = attachRestaurantTagsSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertRestaurantInHousehold(
      parsed.restaurantId,
      householdId,
    );
    if (!existing) {
      return fail("NOT_FOUND", "Restaurant not found.");
    }

    if (parsed.tagIds.length === 0) {
      return ok({ restaurantId: parsed.restaurantId });
    }

    const ownedTags = await db
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.householdId, householdId),
          inArray(tags.id, parsed.tagIds),
        ),
      );
    if (ownedTags.length !== parsed.tagIds.length) {
      return fail("NOT_FOUND", "One or more tags were not found.");
    }

    await db
      .insert(restaurantTags)
      .values(
        parsed.tagIds.map((tagId) => ({
          restaurantId: parsed.restaurantId,
          tagId,
        })),
      )
      .onConflictDoNothing();

    return ok({ restaurantId: parsed.restaurantId });
  });
}

export async function removeRestaurantTag(
  input: z.infer<typeof removeRestaurantTagSchema>,
): Promise<ActionResult<{ restaurantId: string }>> {
  return runAction(async () => {
    const parsed = removeRestaurantTagSchema.parse(input);
    const { householdId } = await requireAuthContext();

    const existing = await assertRestaurantInHousehold(
      parsed.restaurantId,
      householdId,
    );
    if (!existing) {
      return fail("NOT_FOUND", "Restaurant not found.");
    }

    await db
      .delete(restaurantTags)
      .where(
        and(
          eq(restaurantTags.restaurantId, parsed.restaurantId),
          eq(restaurantTags.tagId, parsed.tagId),
        ),
      );

    return ok({ restaurantId: parsed.restaurantId });
  });
}
