import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";

process.env.AUTH_BYPASS = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";
process.env.INTERNAL_CRON_TOKEN =
  process.env.INTERNAL_CRON_TOKEN ?? "test-cron-token-m4";

describe("calendar & planning (Step 5)", () => {
  const restaurantIds: string[] = [];
  const visitIds: string[] = [];
  const foreignHouseholdIds: string[] = [];
  const foreignUserIds: string[] = [];
  const foreignRestaurantIds: string[] = [];
  const foreignVisitIds: string[] = [];

  let createRestaurant: typeof import("@/lib/actions/restaurant-actions").createRestaurant;
  let createVisit: typeof import("@/lib/actions/visit-actions").createVisit;
  let rescheduleVisit: typeof import("@/lib/actions/visit-actions").rescheduleVisit;
  let cancelVisit: typeof import("@/lib/actions/visit-actions").cancelVisit;
  let completeVisit: typeof import("@/lib/actions/visit-actions").completeVisit;
  let listUpcomingVisits: typeof import("@/lib/queries/visit-queries").listUpcomingVisits;
  let listVisitsInRange: typeof import("@/lib/queries/visit-queries").listVisitsInRange;
  let getVisitDetail: typeof import("@/lib/queries/visit-queries").getVisitDetail;
  let cronPost: typeof import("@/app/api/cron/complete-planned-visits/route").POST;
  let db: typeof import("@/lib/db").db;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;

  let bypassUserId: string;
  let bypassHouseholdId: string;
  const cronToken = process.env.INTERNAL_CRON_TOKEN!;

  before(async () => {
    const bypass = await import("@/lib/auth-bypass").then((m) =>
      m.getBypassAuthContext(),
    );
    bypassUserId = bypass.userId;
    if (!bypass.householdId) {
      throw new Error("AUTH_BYPASS: expected a household for tests");
    }
    bypassHouseholdId = bypass.householdId;

    ({ createRestaurant } = await import("@/lib/actions/restaurant-actions"));
    ({
      createVisit,
      rescheduleVisit,
      cancelVisit,
      completeVisit,
    } = await import("@/lib/actions/visit-actions"));
    ({ listUpcomingVisits, listVisitsInRange, getVisitDetail } = await import(
      "@/lib/queries/visit-queries"
    ));
    ({ POST: cronPost } = await import(
      "@/app/api/cron/complete-planned-visits/route"
    ));
    ({ db } = await import("@/lib/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
  });

  after(async () => {
    for (const id of [...visitIds, ...foreignVisitIds]) {
      await db.delete(schema.visits).where(eq(schema.visits.id, id));
    }
    for (const id of [...restaurantIds, ...foreignRestaurantIds]) {
      await db
        .delete(schema.restaurants)
        .where(eq(schema.restaurants.id, id));
    }
    for (const id of foreignUserIds) {
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

  async function seedRestaurant(label: string) {
    const s = stamp();
    const created = await createRestaurant({
      name: `${label} ${s}`,
      address: `${s} Cal St`,
      forceCreate: true,
    });
    assert.equal(created.success, true, JSON.stringify(created));
    if (!created.success) throw new Error("createRestaurant failed");
    restaurantIds.push(created.data.id);
    return created.data.id;
  }

  async function seedPlannedVisit(restaurantId: string, daysAhead = 3) {
    const result = await createVisit({
      restaurantId,
      visitDate: new Date(Date.now() + daysAhead * 86400000).toISOString(),
      status: "PLANNED",
      meal: "DINNER",
    });
    assert.equal(result.success, true, JSON.stringify(result));
    if (!result.success) throw new Error("createVisit planned failed");
    visitIds.push(result.data.id);
    return result.data.id;
  }

  async function seedCompletedVisit(restaurantId: string) {
    const result = await createVisit({
      restaurantId,
      visitDate: new Date().toISOString(),
      status: "COMPLETED",
    });
    assert.equal(result.success, true, JSON.stringify(result));
    if (!result.success) throw new Error("createVisit completed failed");
    visitIds.push(result.data.id);
    return result.data.id;
  }

  describe("rescheduleVisit", () => {
    it("happy path — updates planned visit date", async () => {
      const restaurantId = await seedRestaurant("Reschedule");
      const visitId = await seedPlannedVisit(restaurantId);
      const nextDate = new Date(Date.now() + 5 * 86400000).toISOString();

      const result = await rescheduleVisit({
        id: visitId,
        visitDate: nextDate,
        visitTime: "19:30",
      });
      assert.equal(result.success, true, JSON.stringify(result));
      if (!result.success) return;
      assert.equal(result.data.id, visitId);
      assert.ok(result.data.visitDate);

      const detail = await getVisitDetail(visitId);
      assert.equal(detail?.visitTime, "19:30");
      assert.equal(detail?.status, "PLANNED");
    });

    it("NOT_FOUND when attempted on COMPLETED visit", async () => {
      const restaurantId = await seedRestaurant("Reschedule Done");
      const visitId = await seedCompletedVisit(restaurantId);

      const result = await rescheduleVisit({
        id: visitId,
        visitDate: new Date(Date.now() + 86400000).toISOString(),
      });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.code, "NOT_FOUND");
    });
  });

  describe("cancelVisit", () => {
    it("happy path — PLANNED visit row is deleted", async () => {
      const restaurantId = await seedRestaurant("Cancel Plan");
      const visitId = await seedPlannedVisit(restaurantId);

      const result = await cancelVisit({ id: visitId });
      assert.equal(result.success, true, JSON.stringify(result));

      const [row] = await db
        .select({ id: schema.visits.id })
        .from(schema.visits)
        .where(eq(schema.visits.id, visitId))
        .limit(1);
      assert.equal(row, undefined);
      // already deleted — don't try to delete again in after()
      const idx = visitIds.indexOf(visitId);
      if (idx >= 0) visitIds.splice(idx, 1);
    });

    it("CONFLICT on COMPLETED visit", async () => {
      const restaurantId = await seedRestaurant("Cancel Done");
      const visitId = await seedCompletedVisit(restaurantId);

      const result = await cancelVisit({ id: visitId });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.code, "CONFLICT");
    });
  });

  describe("completeVisit", () => {
    it("happy path with confirmed: true", async () => {
      const restaurantId = await seedRestaurant("Complete User");
      const visitId = await seedPlannedVisit(restaurantId);

      const result = await completeVisit({ id: visitId, confirmed: true });
      assert.equal(result.success, true, JSON.stringify(result));
      if (!result.success) return;
      assert.equal(result.data.status, "COMPLETED");

      const detail = await getVisitDetail(visitId);
      assert.equal(detail?.status, "COMPLETED");
    });

    it("happy path with confirmed: false", async () => {
      const restaurantId = await seedRestaurant("Complete System");
      const visitId = await seedPlannedVisit(restaurantId);

      const result = await completeVisit({ id: visitId, confirmed: false });
      assert.equal(result.success, true, JSON.stringify(result));
      if (!result.success) return;
      assert.equal(result.data.status, "COMPLETED");

      const detail = await getVisitDetail(visitId);
      assert.equal(detail?.status, "COMPLETED");
    });
  });

  describe("cron complete-planned-visits", () => {
    it("returns 401 for missing or wrong token", async () => {
      const missing = await cronPost(
        new Request("http://localhost/api/cron/complete-planned-visits", {
          method: "POST",
        }),
      );
      assert.equal(missing.status, 401);

      const wrong = await cronPost(
        new Request("http://localhost/api/cron/complete-planned-visits", {
          method: "POST",
          headers: { "X-Internal-Token": "definitely-wrong-token" },
        }),
      );
      assert.equal(wrong.status, 401);
    });

    it("transitions overdue planned visit and returns count", async () => {
      const restaurantId = await seedRestaurant("Cron Overdue");
      // Past-dated PLANNED must be seeded directly (create schema refine blocks it)
      const visitId = createId();
      visitIds.push(visitId);
      await db.insert(schema.visits).values({
        id: visitId,
        restaurantId,
        householdId: bypassHouseholdId,
        visitDate: new Date(Date.now() - 30 * 3600_000), // 30h ago
        status: "PLANNED",
        createdById: bypassUserId,
      });

      const res = await cronPost(
        new Request("http://localhost/api/cron/complete-planned-visits", {
          method: "POST",
          headers: { "X-Internal-Token": cronToken },
        }),
      );
      assert.equal(res.status, 200);
      const body = (await res.json()) as { transitioned: number };
      assert.ok(body.transitioned >= 1);

      const detail = await getVisitDetail(visitId);
      assert.equal(detail?.status, "COMPLETED");
    });
  });

  describe("listUpcomingVisits / listVisitsInRange household scoping", () => {
    it("never returns another household's visits", async () => {
      const s = stamp();
      const restaurantId = await seedRestaurant("Scope Mine");
      const minePlanned = await seedPlannedVisit(restaurantId, 2);
      const mineCompleted = await seedCompletedVisit(restaurantId);

      const otherHouseholdId = createId();
      const otherUserId = createId();
      const otherRestaurantId = createId();
      const otherVisitId = createId();
      foreignHouseholdIds.push(otherHouseholdId);
      foreignUserIds.push(otherUserId);
      foreignRestaurantIds.push(otherRestaurantId);
      foreignVisitIds.push(otherVisitId);

      await db.insert(schema.households).values({
        id: otherHouseholdId,
        name: `Cal Other ${s}`,
      });
      await db.insert(schema.users).values({
        id: otherUserId,
        householdId: otherHouseholdId,
        email: `cal-other-${s}@example.com`,
        name: "Cal Other",
      });
      await db.insert(schema.restaurants).values({
        id: otherRestaurantId,
        householdId: otherHouseholdId,
        name: `Foreign Cal ${s}`,
        status: "PLANNED",
      });
      await db.insert(schema.visits).values({
        id: otherVisitId,
        restaurantId: otherRestaurantId,
        householdId: otherHouseholdId,
        visitDate: new Date(Date.now() + 2 * 86400000),
        status: "PLANNED",
        createdById: otherUserId,
      });

      const upcoming = await listUpcomingVisits(50);
      assert.ok(upcoming.some((v) => v.id === minePlanned));
      assert.ok(!upcoming.some((v) => v.id === otherVisitId));

      const start = new Date(Date.now() - 86400000).toISOString();
      const end = new Date(Date.now() + 10 * 86400000).toISOString();
      const ranged = await listVisitsInRange(start, end);
      assert.ok(ranged.some((v) => v.id === minePlanned));
      assert.ok(ranged.some((v) => v.id === mineCompleted));
      assert.ok(!ranged.some((v) => v.id === otherVisitId));
    });
  });
});
