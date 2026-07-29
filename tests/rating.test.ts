import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";

process.env.AUTH_BYPASS = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";

describe("rating domain (Step 4)", () => {
  const restaurantIds: string[] = [];
  const visitIds: string[] = [];
  const ratingIds: string[] = [];
  const partnerUserIds: string[] = [];
  const foreignHouseholdIds: string[] = [];
  const foreignUserIds: string[] = [];
  const foreignRestaurantIds: string[] = [];
  const foreignVisitIds: string[] = [];
  const foreignRatingIds: string[] = [];

  let createRestaurant: typeof import("@/lib/actions/restaurant-actions").createRestaurant;
  let createVisit: typeof import("@/lib/actions/visit-actions").createVisit;
  let submitVisitRating: typeof import("@/lib/actions/rating-actions").submitVisitRating;
  let getRestaurantRatingComparison: typeof import("@/lib/queries/rating-queries").getRestaurantRatingComparison;
  let listVisitsMissingMyRating: typeof import("@/lib/queries/visit-queries").listVisitsMissingMyRating;
  let db: typeof import("@/lib/db").db;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;
  let and: typeof import("drizzle-orm").and;
  let count: typeof import("drizzle-orm").count;

  let bypassUserId: string;
  let bypassHouseholdId: string;
  const defaultBypassEmail =
    process.env.AUTH_BYPASS_EMAIL ?? "local@ourtable.dev";

  before(async () => {
    process.env.AUTH_BYPASS_EMAIL = defaultBypassEmail;
    const bypass = await import("@/lib/auth-bypass").then((m) =>
      m.getBypassAuthContext(),
    );
    bypassUserId = bypass.userId;
    if (!bypass.householdId) {
      throw new Error("AUTH_BYPASS: expected a household for tests");
    }
    bypassHouseholdId = bypass.householdId;

    ({ createRestaurant } = await import("@/lib/actions/restaurant-actions"));
    ({ createVisit } = await import("@/lib/actions/visit-actions"));
    ({ submitVisitRating } = await import("@/lib/actions/rating-actions"));
    ({ getRestaurantRatingComparison } = await import(
      "@/lib/queries/rating-queries"
    ));
    ({ listVisitsMissingMyRating } = await import(
      "@/lib/queries/visit-queries"
    ));
    ({ db } = await import("@/lib/db"));
    schema = await import("@/db/schema");
    ({ eq, and, count } = await import("drizzle-orm"));
  });

  after(async () => {
    process.env.AUTH_BYPASS_EMAIL = defaultBypassEmail;

    for (const id of [...ratingIds, ...foreignRatingIds]) {
      await db
        .delete(schema.visitRatings)
        .where(eq(schema.visitRatings.id, id));
    }
    for (const id of [...visitIds, ...foreignVisitIds]) {
      await db
        .delete(schema.visitRatings)
        .where(eq(schema.visitRatings.visitId, id));
      await db.delete(schema.visits).where(eq(schema.visits.id, id));
    }
    for (const id of [...restaurantIds, ...foreignRestaurantIds]) {
      await db
        .delete(schema.restaurants)
        .where(eq(schema.restaurants.id, id));
    }
    for (const id of [...partnerUserIds, ...foreignUserIds]) {
      await db.delete(schema.users).where(eq(schema.users.id, id));
    }
    for (const id of foreignHouseholdIds) {
      await db.delete(schema.households).where(eq(schema.households.id, id));
    }
    const { postgresClient } = await import("@/lib/db");
    await postgresClient.end({ timeout: 5 });
  });

  function stamp() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function seedCompletedVisit(label: string) {
    const s = stamp();
    const restaurant = await createRestaurant({
      name: `${label} ${s}`,
      address: `${s} Rating St`,
      forceCreate: true,
    });
    assert.equal(restaurant.success, true, JSON.stringify(restaurant));
    if (!restaurant.success) throw new Error("createRestaurant failed");
    restaurantIds.push(restaurant.data.id);

    const visit = await createVisit({
      restaurantId: restaurant.data.id,
      visitDate: new Date().toISOString(),
      status: "COMPLETED",
      meal: "DINNER",
    });
    assert.equal(visit.success, true, JSON.stringify(visit));
    if (!visit.success) throw new Error("createVisit failed");
    visitIds.push(visit.data.id);

    return {
      restaurantId: restaurant.data.id,
      visitId: visit.data.id,
      stamp: s,
    };
  }

  async function asPartnerEmail<T>(
    email: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    process.env.AUTH_BYPASS_EMAIL = email;
    try {
      return await fn();
    } finally {
      process.env.AUTH_BYPASS_EMAIL = defaultBypassEmail;
    }
  }

  describe("submitVisitRating", () => {
    it("happy path — first rating creates a row", async () => {
      const { visitId } = await seedCompletedVisit("Rate Happy");

      const result = await submitVisitRating({
        visitId,
        overallRating: 8.5,
        food: 5,
        service: 4,
        wouldReturn: "YES",
        reviewText: "Great night out",
      });

      assert.equal(result.success, true, JSON.stringify(result));
      if (!result.success) return;
      assert.ok(result.data.id);
      ratingIds.push(result.data.id);

      const [row] = await db
        .select()
        .from(schema.visitRatings)
        .where(eq(schema.visitRatings.id, result.data.id))
        .limit(1);
      assert.ok(row);
      assert.equal(Number(row.overallRating), 8.5);
      assert.equal(row.userId, bypassUserId);
    });

    it("upsert path — second submit updates, does not duplicate", async () => {
      const { visitId } = await seedCompletedVisit("Rate Upsert");

      const first = await submitVisitRating({
        visitId,
        overallRating: 7,
        food: 3,
      });
      assert.equal(first.success, true);
      if (!first.success) return;
      ratingIds.push(first.data.id);

      const second = await submitVisitRating({
        visitId,
        overallRating: 9,
        food: 5,
        reviewText: "Revised take",
      });
      assert.equal(second.success, true, JSON.stringify(second));
      if (!second.success) return;
      assert.equal(second.data.id, first.data.id);

      const [rowCount] = await db
        .select({ value: count() })
        .from(schema.visitRatings)
        .where(
          and(
            eq(schema.visitRatings.visitId, visitId),
            eq(schema.visitRatings.userId, bypassUserId),
          ),
        );
      assert.equal(Number(rowCount.value), 1);

      const [row] = await db
        .select()
        .from(schema.visitRatings)
        .where(eq(schema.visitRatings.id, first.data.id))
        .limit(1);
      assert.equal(Number(row?.overallRating), 9);
      assert.equal(row?.reviewText, "Revised take");
    });

    it("VALIDATION_ERROR for non-COMPLETED visit", async () => {
      const s = stamp();
      const restaurant = await createRestaurant({
        name: `Planned Rate ${s}`,
        address: `${s} Planned Rd`,
        forceCreate: true,
      });
      assert.equal(restaurant.success, true);
      if (!restaurant.success) return;
      restaurantIds.push(restaurant.data.id);

      // Seed PLANNED directly (rating still rejects non-COMPLETED)
      const visitId = createId();
      visitIds.push(visitId);
      await db.insert(schema.visits).values({
        id: visitId,
        restaurantId: restaurant.data.id,
        householdId: bypassHouseholdId,
        visitDate: new Date(Date.now() + 86400000),
        status: "PLANNED",
        createdById: bypassUserId,
      });

      const result = await submitVisitRating({
        visitId,
        overallRating: 8,
      });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.code, "VALIDATION_ERROR");
      assert.equal(
        result.error.message,
        "Visit must be marked completed before rating",
      );
    });
  });

  describe("getRestaurantRatingComparison", () => {
    it("computes per-user averages and isolates households", async () => {
      const s = stamp();
      const partnerEmail = `partner-rating-${s}@ourtable.dev`;
      const partnerId = createId();
      partnerUserIds.push(partnerId);

      await db.insert(schema.users).values({
        id: partnerId,
        householdId: bypassHouseholdId,
        email: partnerEmail,
        name: "Partner Tester",
      });

      const { restaurantId, visitId: visit1 } =
        await seedCompletedVisit("Compare A");
      const visit2Result = await createVisit({
        restaurantId,
        visitDate: new Date(Date.now() - 86400000).toISOString(),
        status: "COMPLETED",
      });
      assert.equal(visit2Result.success, true);
      if (!visit2Result.success) return;
      visitIds.push(visit2Result.data.id);
      const visit2 = visit2Result.data.id;

      // User A ratings: overall 8 and 10 → avg 9; food 4 and 5 → avg 4.5
      const a1 = await submitVisitRating({
        visitId: visit1,
        overallRating: 8,
        food: 4,
        reviewText: "A on visit 1",
      });
      const a2 = await submitVisitRating({
        visitId: visit2,
        overallRating: 10,
        food: 5,
      });
      assert.equal(a1.success, true);
      assert.equal(a2.success, true);
      if (a1.success) ratingIds.push(a1.data.id);
      if (a2.success) ratingIds.push(a2.data.id);

      // User B ratings via bypass email switch
      const b1 = await asPartnerEmail(partnerEmail, () =>
        submitVisitRating({
          visitId: visit1,
          overallRating: 6,
          food: 3,
          reviewText: "B on visit 1",
        }),
      );
      assert.equal(b1.success, true, JSON.stringify(b1));
      if (b1.success) ratingIds.push(b1.data.id);

      const comparison = await getRestaurantRatingComparison(restaurantId);
      assert.equal(comparison.perUserAverages.length, 2);

      const userA = comparison.perUserAverages.find(
        (u) => u.userId === bypassUserId,
      );
      const userB = comparison.perUserAverages.find(
        (u) => u.userId === partnerId,
      );
      assert.ok(userA);
      assert.ok(userB);
      assert.equal(userA.avgOverall, 9);
      assert.equal(userA.avgByCategory.food, 4.5);
      assert.equal(userB.avgOverall, 6);
      assert.equal(userB.avgByCategory.food, 3);
      assert.ok(
        comparison.recentReviews.some((r) => r.reviewText === "A on visit 1"),
      );

      // Foreign household isolation
      const otherHouseholdId = createId();
      const otherUserId = createId();
      const otherRestaurantId = createId();
      const otherVisitId = createId();
      const otherRatingId = createId();
      foreignHouseholdIds.push(otherHouseholdId);
      foreignUserIds.push(otherUserId);
      foreignRestaurantIds.push(otherRestaurantId);
      foreignVisitIds.push(otherVisitId);
      foreignRatingIds.push(otherRatingId);

      await db.insert(schema.households).values({
        id: otherHouseholdId,
        name: `Foreign Rating HH ${s}`,
      });
      await db.insert(schema.users).values({
        id: otherUserId,
        householdId: otherHouseholdId,
        email: `foreign-rating-${s}@example.com`,
        name: "Foreign",
      });
      await db.insert(schema.restaurants).values({
        id: otherRestaurantId,
        householdId: otherHouseholdId,
        name: `Foreign Rest ${s}`,
        status: "VISITED",
      });
      await db.insert(schema.visits).values({
        id: otherVisitId,
        restaurantId: otherRestaurantId,
        householdId: otherHouseholdId,
        visitDate: new Date(),
        status: "COMPLETED",
        createdById: otherUserId,
      });
      await db.insert(schema.visitRatings).values({
        id: otherRatingId,
        visitId: otherVisitId,
        userId: otherUserId,
        overallRating: "1",
        reviewText: "Should not leak",
      });

      const isolated = await getRestaurantRatingComparison(otherRestaurantId);
      assert.deepEqual(isolated.perUserAverages, []);
      assert.deepEqual(isolated.recentReviews, []);
      assert.ok(
        !comparison.recentReviews.some((r) => r.reviewText === "Should not leak"),
      );
    });
  });

  describe("listVisitsMissingMyRating", () => {
    it("shows for partner without rating, not for rater", async () => {
      const s = stamp();
      const partnerEmail = `partner-missing-${s}@ourtable.dev`;
      const partnerId = createId();
      partnerUserIds.push(partnerId);
      await db.insert(schema.users).values({
        id: partnerId,
        householdId: bypassHouseholdId,
        email: partnerEmail,
        name: "Missing Partner",
      });

      const { visitId } = await seedCompletedVisit("Missing Rate");

      const rated = await submitVisitRating({
        visitId,
        overallRating: 8,
      });
      assert.equal(rated.success, true);
      if (rated.success) ratingIds.push(rated.data.id);

      const forA = await listVisitsMissingMyRating(20);
      assert.ok(!forA.some((v) => v.id === visitId));

      const forB = await asPartnerEmail(partnerEmail, () =>
        listVisitsMissingMyRating(20),
      );
      assert.ok(forB.some((v) => v.id === visitId));
    });
  });
});
