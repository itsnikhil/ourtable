import { z } from "zod";
import {
  and,
  asc,
  avg,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  max,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orderedItems,
  photos,
  restaurantOpinions,
  restaurantTags,
  restaurants,
  tags,
  visitRatings,
  visits,
} from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";
import {
  normalizePageParams,
  type Page,
  type PageParams,
} from "@/lib/pagination";
import {
  opinionTagSchema,
  priceRangeSchema,
  restaurantStatusSchema,
  tagCategorySchema,
} from "@/lib/validations/restaurant";

type PriceRange = z.infer<typeof priceRangeSchema>;
type RestaurantStatus = z.infer<typeof restaurantStatusSchema>;
type TagCategory = z.infer<typeof tagCategorySchema>;
type OpinionTag = z.infer<typeof opinionTagSchema>;

export type RestaurantSummary = {
  id: string;
  name: string;
  priceRange: PriceRange | null;
  neighborhood: string | null;
  status: RestaurantStatus;
  primaryPhotoUrl: string | null;
  averageRating: number | null;
  visitCount: number;
  tags: { id: string; name: string; category: TagCategory }[];
};

export type RestaurantDetail = RestaurantSummary & {
  website: string | null;
  phone: string | null;
  address: string | null;
  lat: string | null;
  lng: string | null;
  menuUrl: string | null;
  notes: string | null;
  supportsDelivery: boolean;
  supportsDineIn: boolean;
  supportsTakeout: boolean;
  averageBill: string | null;
  lastVisitDate: string | null;
  opinions: { userId: string; tag: OpinionTag }[];
};

/** Active (non-archived) restaurants in the caller's household. */
function householdActiveFilter(householdId: string): SQL {
  return and(
    eq(restaurants.householdId, householdId),
    isNull(restaurants.archivedAt),
  )!;
}

async function loadTagsByRestaurantIds(
  restaurantIds: string[],
): Promise<Map<string, RestaurantSummary["tags"]>> {
  const map = new Map<string, RestaurantSummary["tags"]>();
  if (restaurantIds.length === 0) return map;

  const rows = await db
    .select({
      restaurantId: restaurantTags.restaurantId,
      id: tags.id,
      name: tags.name,
      category: tags.category,
    })
    .from(restaurantTags)
    .innerJoin(tags, eq(restaurantTags.tagId, tags.id))
    .where(inArray(restaurantTags.restaurantId, restaurantIds));

  for (const row of rows) {
    const list = map.get(row.restaurantId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      category: row.category,
    });
    map.set(row.restaurantId, list);
  }
  return map;
}

/**
 * Computed fields per LLD §6:
 * - averageRating: AVG(VisitRating.overallRating) via Visit; null if none
 * - visitCount: COUNT(Visit) where status = COMPLETED
 * - lastVisitDate: MAX(Visit.visitDate) where status = COMPLETED
 * - averageBill: AVG(Visit.totalPaid) where totalPaid IS NOT NULL
 * - primaryPhotoUrl: not in §6 — most recent photo for the restaurant (judgment call)
 */
async function loadComputedByRestaurantIds(restaurantIds: string[]): Promise<
  Map<
    string,
    {
      averageRating: number | null;
      visitCount: number;
      averageBill: string | null;
      lastVisitDate: string | null;
      primaryPhotoUrl: string | null;
    }
  >
> {
  const map = new Map<
    string,
    {
      averageRating: number | null;
      visitCount: number;
      averageBill: string | null;
      lastVisitDate: string | null;
      primaryPhotoUrl: string | null;
    }
  >();

  for (const id of restaurantIds) {
    map.set(id, {
      averageRating: null,
      visitCount: 0,
      averageBill: null,
      lastVisitDate: null,
      primaryPhotoUrl: null,
    });
  }
  if (restaurantIds.length === 0) return map;

  const completedStats = await db
    .select({
      restaurantId: visits.restaurantId,
      visitCount: count(visits.id),
      lastVisitDate: max(visits.visitDate),
    })
    .from(visits)
    .where(
      and(
        inArray(visits.restaurantId, restaurantIds),
        eq(visits.status, "COMPLETED"),
      ),
    )
    .groupBy(visits.restaurantId);

  for (const row of completedStats) {
    const entry = map.get(row.restaurantId)!;
    entry.visitCount = Number(row.visitCount);
    entry.lastVisitDate = row.lastVisitDate
      ? row.lastVisitDate.toISOString()
      : null;
  }

  // LLD §6: AVG(totalPaid) where totalPaid IS NOT NULL — does not restrict to COMPLETED.
  const billStats = await db
    .select({
      restaurantId: visits.restaurantId,
      averageBill: avg(visits.totalPaid),
    })
    .from(visits)
    .where(
      and(
        inArray(visits.restaurantId, restaurantIds),
        isNotNull(visits.totalPaid),
      ),
    )
    .groupBy(visits.restaurantId);

  for (const row of billStats) {
    const entry = map.get(row.restaurantId)!;
    entry.averageBill =
      row.averageBill !== null && row.averageBill !== undefined
        ? String(row.averageBill)
        : null;
  }

  const ratingStats = await db
    .select({
      restaurantId: visits.restaurantId,
      averageRating: avg(visitRatings.overallRating),
    })
    .from(visitRatings)
    .innerJoin(visits, eq(visitRatings.visitId, visits.id))
    .where(inArray(visits.restaurantId, restaurantIds))
    .groupBy(visits.restaurantId);

  for (const row of ratingStats) {
    const entry = map.get(row.restaurantId)!;
    entry.averageRating =
      row.averageRating !== null && row.averageRating !== undefined
        ? Number(row.averageRating)
        : null;
  }

  const photoRows = await db
    .select({
      restaurantId: photos.restaurantId,
      url: photos.url,
    })
    .from(photos)
    .where(
      and(
        inArray(photos.restaurantId, restaurantIds),
        isNotNull(photos.restaurantId),
      ),
    )
    .orderBy(desc(photos.createdAt));

  for (const row of photoRows) {
    if (!row.restaurantId) continue;
    const entry = map.get(row.restaurantId);
    if (entry && !entry.primaryPhotoUrl) {
      entry.primaryPhotoUrl = row.url;
    }
  }

  return map;
}

async function toSummaries(
  rows: Array<{
    id: string;
    name: string;
    priceRange: PriceRange | null;
    neighborhood: string | null;
    status: RestaurantStatus;
  }>,
): Promise<RestaurantSummary[]> {
  const ids = rows.map((r) => r.id);
  const [tagMap, computed] = await Promise.all([
    loadTagsByRestaurantIds(ids),
    loadComputedByRestaurantIds(ids),
  ]);

  return rows.map((row) => {
    const c = computed.get(row.id)!;
    return {
      id: row.id,
      name: row.name,
      priceRange: row.priceRange,
      neighborhood: row.neighborhood,
      status: row.status,
      primaryPhotoUrl: c.primaryPhotoUrl,
      averageRating: c.averageRating,
      visitCount: c.visitCount,
      tags: tagMap.get(row.id) ?? [],
    };
  });
}

export async function listRestaurants(
  filters: {
    cuisine?: string;
    neighborhood?: string;
    status?: RestaurantStatus;
    sort?: "rating_desc" | "recent" | "name_asc";
  } & PageParams = {},
): Promise<Page<RestaurantSummary>> {
  const { householdId } = await requireAuthContext();
  const { cursor, limit } = normalizePageParams(filters);

  const conditions: SQL[] = [householdActiveFilter(householdId)];

  if (filters.neighborhood) {
    conditions.push(eq(restaurants.neighborhood, filters.neighborhood));
  }
  if (filters.status) {
    conditions.push(eq(restaurants.status, filters.status));
  }

  if (filters.cuisine) {
    const cuisineRows = await db
      .select({ restaurantId: restaurantTags.restaurantId })
      .from(restaurantTags)
      .innerJoin(tags, eq(restaurantTags.tagId, tags.id))
      .where(
        and(
          eq(tags.householdId, householdId),
          eq(tags.category, "FOOD_TYPE"),
          eq(tags.name, filters.cuisine),
        ),
      );
    const cuisineIds = cuisineRows.map((r) => r.restaurantId);
    if (cuisineIds.length === 0) {
      return { items: [], nextCursor: null };
    }
    conditions.push(inArray(restaurants.id, cuisineIds));
  }

  // Cursor = last seen restaurant id (keyed with createdAt desc / id desc).
  if (cursor) {
    conditions.push(sql`${restaurants.id} < ${cursor}`);
  }

  const sort = filters.sort ?? "recent";

  if (sort === "rating_desc") {
    // Rating is computed — fetch a bounded window, sort in memory, then page.
    const window = await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        priceRange: restaurants.priceRange,
        neighborhood: restaurants.neighborhood,
        status: restaurants.status,
      })
      .from(restaurants)
      .where(and(...conditions))
      .orderBy(desc(restaurants.createdAt), desc(restaurants.id))
      .limit(Math.min(limit * 10, 200));

    const summaries = (await toSummaries(window)).sort(
      (a, b) => (b.averageRating ?? -1) - (a.averageRating ?? -1),
    );
    const page = summaries.slice(0, limit + 1);
    const hasMore = page.length > limit;
    const items = hasMore ? page.slice(0, limit) : page;
    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  const orderBy =
    sort === "name_asc"
      ? [asc(restaurants.name), desc(restaurants.id)]
      : [desc(restaurants.createdAt), desc(restaurants.id)];

  const rows = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      priceRange: restaurants.priceRange,
      neighborhood: restaurants.neighborhood,
      status: restaurants.status,
    })
    .from(restaurants)
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(limit + 1);

  const summaries = await toSummaries(rows);
  const hasMore = summaries.length > limit;
  const items = hasMore ? summaries.slice(0, limit) : summaries;

  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

export async function searchRestaurants(
  query: string,
  limit = 10,
): Promise<RestaurantSummary[]> {
  const { householdId } = await requireAuthContext();
  const q = query.trim();
  if (!q) return [];

  const pattern = `%${q}%`;
  const capped = Math.min(Math.max(limit, 1), 100);

  const [byName, byCuisine, byDish, byTrigram] = await Promise.all([
    db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(
        and(householdActiveFilter(householdId), ilike(restaurants.name, pattern)),
      )
      .limit(capped),
    db
      .select({ id: restaurants.id })
      .from(restaurants)
      .innerJoin(
        restaurantTags,
        eq(restaurantTags.restaurantId, restaurants.id),
      )
      .innerJoin(tags, eq(restaurantTags.tagId, tags.id))
      .where(
        and(
          householdActiveFilter(householdId),
          eq(tags.category, "FOOD_TYPE"),
          ilike(tags.name, pattern),
        ),
      )
      .limit(capped),
    db
      .select({ id: restaurants.id })
      .from(restaurants)
      .innerJoin(visits, eq(visits.restaurantId, restaurants.id))
      .innerJoin(orderedItems, eq(orderedItems.visitId, visits.id))
      .where(
        and(
          householdActiveFilter(householdId),
          ilike(orderedItems.dishName, pattern),
        ),
      )
      .limit(capped),
    db.execute<{ id: string }>(sql`
      SELECT id
      FROM restaurants
      WHERE household_id = ${householdId}
        AND archived_at IS NULL
        AND similarity(name, ${q}) >= 0.3
      ORDER BY similarity(name, ${q}) DESC
      LIMIT ${capped}
    `),
  ]);

  const trigramRows = Array.isArray(byTrigram)
    ? byTrigram
    : ((byTrigram as { rows?: { id: string }[] }).rows ?? []);

  const ids = [
    ...new Set([
      ...byName.map((r) => r.id),
      ...byCuisine.map((r) => r.id),
      ...byDish.map((r) => r.id),
      ...trigramRows.map((r) => r.id),
    ]),
  ].slice(0, capped);

  if (ids.length === 0) return [];

  const rows = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      priceRange: restaurants.priceRange,
      neighborhood: restaurants.neighborhood,
      status: restaurants.status,
    })
    .from(restaurants)
    .where(and(householdActiveFilter(householdId), inArray(restaurants.id, ids)));

  return toSummaries(rows);
}

export async function getRestaurantDetail(
  id: string,
): Promise<RestaurantDetail | null> {
  const { householdId } = await requireAuthContext();

  const [row] = await db
    .select()
    .from(restaurants)
    .where(
      and(
        eq(restaurants.id, id),
        eq(restaurants.householdId, householdId),
        isNull(restaurants.archivedAt),
      ),
    )
    .limit(1);

  if (!row) return null;

  const [summary] = await toSummaries([
    {
      id: row.id,
      name: row.name,
      priceRange: row.priceRange,
      neighborhood: row.neighborhood,
      status: row.status,
    },
  ]);

  const computed = (await loadComputedByRestaurantIds([id])).get(id)!;

  const opinionRows = await db
    .select({
      userId: restaurantOpinions.userId,
      tag: restaurantOpinions.tag,
    })
    .from(restaurantOpinions)
    .where(eq(restaurantOpinions.restaurantId, id));

  return {
    ...summary,
    website: row.website,
    phone: row.phone,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    menuUrl: row.menuUrl,
    notes: row.notes,
    supportsDelivery: row.supportsDelivery,
    supportsDineIn: row.supportsDineIn,
    supportsTakeout: row.supportsTakeout,
    averageBill: computed.averageBill,
    lastVisitDate: computed.lastVisitDate,
    opinions: opinionRows,
  };
}

export async function listRestaurantsForMap(
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  },
): Promise<
  Array<
    Pick<RestaurantSummary, "id" | "name" | "status" | "averageRating"> & {
      lat: string;
      lng: string;
    }
  >
> {
  const { householdId } = await requireAuthContext();

  const conditions: SQL[] = [
    householdActiveFilter(householdId),
    isNotNull(restaurants.lat),
    isNotNull(restaurants.lng),
  ];

  if (bounds) {
    conditions.push(
      sql`${restaurants.lat}::float8 BETWEEN ${bounds.south} AND ${bounds.north}`,
    );
    conditions.push(
      sql`${restaurants.lng}::float8 BETWEEN ${bounds.west} AND ${bounds.east}`,
    );
  }

  const rows = await db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      status: restaurants.status,
      lat: restaurants.lat,
      lng: restaurants.lng,
    })
    .from(restaurants)
    .where(and(...conditions));

  const computed = await loadComputedByRestaurantIds(rows.map((r) => r.id));

  return rows
    .filter((r): r is typeof r & { lat: string; lng: string } =>
      Boolean(r.lat && r.lng),
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      averageRating: computed.get(r.id)?.averageRating ?? null,
      lat: r.lat,
      lng: r.lng,
    }));
}
