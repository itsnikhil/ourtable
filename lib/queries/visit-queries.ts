import { z } from "zod";
import {
  and,
  asc,
  avg,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orderedItems,
  restaurants,
  users,
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
  dineTypeSchema,
  mealSchema,
  paymentSplitSchema,
  visitStatusSchema,
} from "@/lib/validations/visit";
import {
  listPhotosForVisit,
  type PhotoDto,
} from "@/lib/queries/photo-queries";

export type { PhotoDto };

type Meal = z.infer<typeof mealSchema>;
type DineType = z.infer<typeof dineTypeSchema>;
type VisitStatus = z.infer<typeof visitStatusSchema>;
type PaymentSplit = z.infer<typeof paymentSplitSchema>;
type WouldReturn = "YES" | "MAYBE" | "NO";

/** LLD §4 nested shape — not given a standalone type block; mirrors `ordered_items`. */
export type OrderedItemDto = {
  id: string;
  visitId: string;
  dishName: string;
  price: string | null;
  shared: boolean;
  orderedById: string | null;
  wouldOrderAgain: boolean | null;
};

/** LLD §5.3 — kept here so VisitDetail can nest ratings before rating-queries exists. */
export type VisitRatingDto = {
  id: string;
  userId: string;
  overallRating: number;
  food: number | null;
  service: number | null;
  atmosphere: number | null;
  value: number | null;
  drinks: number | null;
  presentation: number | null;
  waitingTime: number | null;
  cleanliness: number | null;
  wouldReturn: WouldReturn | null;
  favoriteDishId: string | null;
  reviewText: string | null;
};

export type VisitListItem = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  visitDate: string;
  meal: Meal | null;
  occasion: string | null;
  status: VisitStatus;
  coupleAverageRating: number | null;
  photoThumbnails: string[];
  totalPaid: string | null;
};

export type VisitDetail = VisitListItem & {
  visitTime: string | null;
  dineType: DineType | null;
  partySize: number | null;
  seating: string | null;
  subtotal: string | null;
  tip: string | null;
  paymentSplit: PaymentSplit | null;
  paymentMethod: string | null;
  createdById: string;
  /** Display name for NFR-11 auditability (“logged by …”). */
  createdByName: string;
  orderedItems: OrderedItemDto[];
  photos: PhotoDto[];
  ratings: VisitRatingDto[];
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function loadCoupleAverages(
  visitIds: string[],
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  for (const id of visitIds) map.set(id, null);
  if (visitIds.length === 0) return map;

  const rows = await db
    .select({
      visitId: visitRatings.visitId,
      average: avg(visitRatings.overallRating),
    })
    .from(visitRatings)
    .where(inArray(visitRatings.visitId, visitIds))
    .groupBy(visitRatings.visitId);

  for (const row of rows) {
    map.set(
      row.visitId,
      row.average != null ? Number(row.average) : null,
    );
  }
  return map;
}

async function toListItems(
  rows: Array<{
    id: string;
    restaurantId: string;
    restaurantName: string;
    visitDate: Date;
    meal: Meal | null;
    occasion: string | null;
    status: VisitStatus;
    totalPaid: string | null;
  }>,
): Promise<VisitListItem[]> {
  const averages = await loadCoupleAverages(rows.map((r) => r.id));
  return rows.map((row) => ({
    id: row.id,
    restaurantId: row.restaurantId,
    restaurantName: row.restaurantName,
    visitDate: toIso(row.visitDate),
    meal: row.meal,
    occasion: row.occasion,
    status: row.status,
    coupleAverageRating: averages.get(row.id) ?? null,
    photoThumbnails: [],
    totalPaid: row.totalPaid,
  }));
}

/**
 * Paginated visits for one restaurant in the caller's household.
 * Sort: visitDate desc, id desc. Cursor = last seen visit id.
 */
export async function listVisitsForRestaurant(
  restaurantId: string,
  params: PageParams = {},
): Promise<Page<VisitListItem>> {
  const { householdId } = await requireAuthContext();
  const { cursor, limit } = normalizePageParams(params);

  const conditions = [
    eq(visits.householdId, householdId),
    eq(visits.restaurantId, restaurantId),
  ];

  if (cursor) {
    const [cursorRow] = await db
      .select({ id: visits.id, visitDate: visits.visitDate })
      .from(visits)
      .where(
        and(eq(visits.id, cursor), eq(visits.householdId, householdId)),
      )
      .limit(1);

    if (cursorRow) {
      conditions.push(
        sql`(
          ${visits.visitDate} < ${cursorRow.visitDate}
          OR (
            ${visits.visitDate} = ${cursorRow.visitDate}
            AND ${visits.id} < ${cursorRow.id}
          )
        )`,
      );
    }
  }

  const rows = await db
    .select({
      id: visits.id,
      restaurantId: visits.restaurantId,
      restaurantName: restaurants.name,
      visitDate: visits.visitDate,
      meal: visits.meal,
      occasion: visits.occasion,
      status: visits.status,
      totalPaid: visits.totalPaid,
    })
    .from(visits)
    .innerJoin(restaurants, eq(visits.restaurantId, restaurants.id))
    .where(and(...conditions))
    .orderBy(desc(visits.visitDate), desc(visits.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = await toListItems(pageRows);

  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

export async function getVisitDetail(
  id: string,
): Promise<VisitDetail | null> {
  const { householdId } = await requireAuthContext();

  const [row] = await db
    .select({
      id: visits.id,
      restaurantId: visits.restaurantId,
      restaurantName: restaurants.name,
      visitDate: visits.visitDate,
      visitTime: visits.visitTime,
      meal: visits.meal,
      dineType: visits.dineType,
      occasion: visits.occasion,
      partySize: visits.partySize,
      status: visits.status,
      seating: visits.seating,
      subtotal: visits.subtotal,
      tip: visits.tip,
      totalPaid: visits.totalPaid,
      paymentSplit: visits.paymentSplit,
      paymentMethod: visits.paymentMethod,
      createdById: visits.createdById,
      createdByName: users.name,
    })
    .from(visits)
    .innerJoin(restaurants, eq(visits.restaurantId, restaurants.id))
    .innerJoin(users, eq(visits.createdById, users.id))
    .where(and(eq(visits.id, id), eq(visits.householdId, householdId)))
    .limit(1);

  if (!row) return null;

  const [listItem] = await toListItems([
    {
      id: row.id,
      restaurantId: row.restaurantId,
      restaurantName: row.restaurantName,
      visitDate: row.visitDate,
      meal: row.meal,
      occasion: row.occasion,
      status: row.status,
      totalPaid: row.totalPaid,
    },
  ]);

  const itemRows = await db
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
    .where(eq(orderedItems.visitId, id))
    .orderBy(asc(orderedItems.dishName));

  const ratingRows = await db
    .select({
      id: visitRatings.id,
      userId: visitRatings.userId,
      overallRating: visitRatings.overallRating,
      food: visitRatings.food,
      service: visitRatings.service,
      atmosphere: visitRatings.atmosphere,
      value: visitRatings.value,
      drinks: visitRatings.drinks,
      presentation: visitRatings.presentation,
      waitingTime: visitRatings.waitingTime,
      cleanliness: visitRatings.cleanliness,
      wouldReturn: visitRatings.wouldReturn,
      favoriteDishId: visitRatings.favoriteDishId,
      reviewText: visitRatings.reviewText,
    })
    .from(visitRatings)
    .where(eq(visitRatings.visitId, id));

  const photoRows = await listPhotosForVisit(id);

  return {
    ...listItem,
    photoThumbnails: photoRows.map((p) => p.url).slice(0, 4),
    visitTime: row.visitTime,
    dineType: row.dineType,
    partySize: row.partySize,
    seating: row.seating,
    subtotal: row.subtotal,
    tip: row.tip,
    paymentSplit: row.paymentSplit,
    paymentMethod: row.paymentMethod,
    createdById: row.createdById,
    createdByName: row.createdByName?.trim() || "Partner",
    orderedItems: itemRows,
    photos: photoRows,
    ratings: ratingRows.map((r) => ({
      ...r,
      overallRating: Number(r.overallRating),
      wouldReturn: r.wouldReturn as WouldReturn | null,
    })),
  };
}

/**
 * Upcoming planned visits for Home (LLD §3.3).
 * `status = PLANNED`, `visitDate >= now`, ascending, default limit 5.
 */
export async function listUpcomingVisits(
  limit = 5,
): Promise<VisitListItem[]> {
  const { householdId } = await requireAuthContext();
  const capped = Math.min(Math.max(limit, 1), 100);
  const now = new Date();

  const rows = await db
    .select({
      id: visits.id,
      restaurantId: visits.restaurantId,
      restaurantName: restaurants.name,
      visitDate: visits.visitDate,
      meal: visits.meal,
      occasion: visits.occasion,
      status: visits.status,
      totalPaid: visits.totalPaid,
    })
    .from(visits)
    .innerJoin(restaurants, eq(visits.restaurantId, restaurants.id))
    .where(
      and(
        eq(visits.householdId, householdId),
        eq(visits.status, "PLANNED"),
        gte(visits.visitDate, now),
      ),
    )
    .orderBy(asc(visits.visitDate), asc(visits.id))
    .limit(capped);

  return toListItems(rows);
}

/**
 * Calendar/Timeline data (HLD §6.5) — one query for month-grid and flat list.
 * Inclusive `[start, end]` on `visitDate`; both PLANNED and COMPLETED.
 */
export async function listVisitsInRange(
  start: string,
  end: string,
): Promise<VisitListItem[]> {
  const { householdId } = await requireAuthContext();
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const rows = await db
    .select({
      id: visits.id,
      restaurantId: visits.restaurantId,
      restaurantName: restaurants.name,
      visitDate: visits.visitDate,
      meal: visits.meal,
      occasion: visits.occasion,
      status: visits.status,
      totalPaid: visits.totalPaid,
    })
    .from(visits)
    .innerJoin(restaurants, eq(visits.restaurantId, restaurants.id))
    .where(
      and(
        eq(visits.householdId, householdId),
        gte(visits.visitDate, startDate),
        lte(visits.visitDate, endDate),
      ),
    )
    .orderBy(asc(visits.visitDate), asc(visits.id));

  return toListItems(rows);
}

/**
 * COMPLETED visits with no VisitRating for the caller (LLD §3.3).
 * Powers the Home “missing your rating” badge (NFR-7 in-app fallback).
 */
export async function listVisitsMissingMyRating(
  limit = 10,
): Promise<VisitListItem[]> {
  const { userId, householdId } = await requireAuthContext();
  const capped = Math.min(Math.max(limit, 1), 100);

  const rows = await db
    .select({
      id: visits.id,
      restaurantId: visits.restaurantId,
      restaurantName: restaurants.name,
      visitDate: visits.visitDate,
      meal: visits.meal,
      occasion: visits.occasion,
      status: visits.status,
      totalPaid: visits.totalPaid,
    })
    .from(visits)
    .innerJoin(restaurants, eq(visits.restaurantId, restaurants.id))
    .where(
      and(
        eq(visits.householdId, householdId),
        eq(visits.status, "COMPLETED"),
        sql`NOT EXISTS (
          SELECT 1 FROM visit_ratings vr
          WHERE vr.visit_id = ${visits.id}
            AND vr.user_id = ${userId}
        )`,
      ),
    )
    .orderBy(desc(visits.visitDate), desc(visits.id))
    .limit(capped);

  return toListItems(rows);
}
