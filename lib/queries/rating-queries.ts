import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  restaurants,
  users,
  visitRatings,
  visits,
} from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";
import type { VisitRatingDto } from "@/lib/queries/visit-queries";

export type { VisitRatingDto };

const CATEGORY_KEYS = [
  "food",
  "service",
  "atmosphere",
  "value",
  "drinks",
  "presentation",
  "waitingTime",
  "cleanliness",
] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type RestaurantRatingComparison = {
  perUserAverages: Array<{
    userId: string;
    displayName: string;
    avgOverall: number;
    avgByCategory: Record<CategoryKey, number | null>;
  }>;
  recentReviews: Array<{
    userId: string;
    visitId: string;
    visitDate: string;
    reviewText: string | null;
  }>;
};

/** LLD silent on count — cap recent review snippets at 10. */
const RECENT_REVIEWS_LIMIT = 10;

function avgNullable(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Side-by-side Reviews screen data for one restaurant (LLD §5.3).
 * Averages across ALL visits at that restaurant for the caller's household.
 */
export async function getRestaurantRatingComparison(
  restaurantId: string,
): Promise<RestaurantRatingComparison> {
  const { householdId } = await requireAuthContext();

  const [restaurant] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(
      and(
        eq(restaurants.id, restaurantId),
        eq(restaurants.householdId, householdId),
      ),
    )
    .limit(1);

  if (!restaurant) {
    return { perUserAverages: [], recentReviews: [] };
  }

  const ratingRows = await db
    .select({
      userId: visitRatings.userId,
      displayName: users.name,
      overallRating: visitRatings.overallRating,
      food: visitRatings.food,
      service: visitRatings.service,
      atmosphere: visitRatings.atmosphere,
      value: visitRatings.value,
      drinks: visitRatings.drinks,
      presentation: visitRatings.presentation,
      waitingTime: visitRatings.waitingTime,
      cleanliness: visitRatings.cleanliness,
      visitId: visitRatings.visitId,
      visitDate: visits.visitDate,
      reviewText: visitRatings.reviewText,
    })
    .from(visitRatings)
    .innerJoin(visits, eq(visitRatings.visitId, visits.id))
    .innerJoin(users, eq(visitRatings.userId, users.id))
    .where(
      and(
        eq(visits.restaurantId, restaurantId),
        eq(visits.householdId, householdId),
      ),
    )
    .orderBy(desc(visits.visitDate), desc(visitRatings.id));

  const byUser = new Map<
    string,
    {
      displayName: string;
      overall: number[];
      categories: Record<CategoryKey, Array<number | null>>;
    }
  >();

  for (const row of ratingRows) {
    let bucket = byUser.get(row.userId);
    if (!bucket) {
      bucket = {
        displayName: row.displayName || "Partner",
        overall: [],
        categories: {
          food: [],
          service: [],
          atmosphere: [],
          value: [],
          drinks: [],
          presentation: [],
          waitingTime: [],
          cleanliness: [],
        },
      };
      byUser.set(row.userId, bucket);
    }
    bucket.overall.push(Number(row.overallRating));
    for (const key of CATEGORY_KEYS) {
      bucket.categories[key].push(row[key]);
    }
  }

  const perUserAverages = [...byUser.entries()].map(([userId, bucket]) => ({
    userId,
    displayName: bucket.displayName,
    avgOverall:
      bucket.overall.reduce((a, b) => a + b, 0) / bucket.overall.length,
    avgByCategory: {
      food: avgNullable(bucket.categories.food),
      service: avgNullable(bucket.categories.service),
      atmosphere: avgNullable(bucket.categories.atmosphere),
      value: avgNullable(bucket.categories.value),
      drinks: avgNullable(bucket.categories.drinks),
      presentation: avgNullable(bucket.categories.presentation),
      waitingTime: avgNullable(bucket.categories.waitingTime),
      cleanliness: avgNullable(bucket.categories.cleanliness),
    },
  }));

  // Prefer snippets with text; otherwise most recent ratings (text may be null).
  const withText = ratingRows.filter(
    (r) => r.reviewText != null && r.reviewText.trim().length > 0,
  );
  const reviewSource =
    withText.length > 0 ? withText : ratingRows.slice(0, RECENT_REVIEWS_LIMIT);

  const recentReviews = reviewSource
    .slice(0, RECENT_REVIEWS_LIMIT)
    .map((r) => ({
      userId: r.userId,
      visitId: r.visitId,
      visitDate:
        r.visitDate instanceof Date
          ? r.visitDate.toISOString()
          : new Date(r.visitDate).toISOString(),
      reviewText: r.reviewText,
    }));

  return { perUserAverages, recentReviews };
}
