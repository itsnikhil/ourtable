import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";

process.env.AUTH_BYPASS = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";

describe("restaurant domain (Step 4)", () => {
  const restaurantIds: string[] = [];
  const visitIds: string[] = [];
  const foreignHouseholdIds: string[] = [];
  const foreignRestaurantIds: string[] = [];

  let createRestaurant: typeof import("@/lib/actions/restaurant-actions").createRestaurant;
  let deleteRestaurant: typeof import("@/lib/actions/restaurant-actions").deleteRestaurant;
  let setRestaurantOpinion: typeof import("@/lib/actions/restaurant-actions").setRestaurantOpinion;
  let listRestaurants: typeof import("@/lib/queries/restaurant-queries").listRestaurants;
  let getRestaurantDetail: typeof import("@/lib/queries/restaurant-queries").getRestaurantDetail;
  let db: typeof import("@/lib/db").db;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;
  let and: typeof import("drizzle-orm").and;
  let count: typeof import("drizzle-orm").count;
  let bypassUserId: string;
  let bypassHouseholdId: string;

  before(async () => {
    const bypass = await import("@/lib/auth-bypass").then((m) =>
      m.getBypassAuthContext(),
    );
    bypassUserId = bypass.userId;
    bypassHouseholdId = bypass.householdId;

    ({
      createRestaurant,
      deleteRestaurant,
      setRestaurantOpinion,
    } = await import("@/lib/actions/restaurant-actions"));
    ({ listRestaurants, getRestaurantDetail } = await import(
      "@/lib/queries/restaurant-queries"
    ));
    ({ db } = await import("@/lib/db"));
    schema = await import("@/db/schema");
    ({ eq, and, count } = await import("drizzle-orm"));
  });

  after(async () => {
    for (const visitId of visitIds) {
      await db.delete(schema.visits).where(eq(schema.visits.id, visitId));
    }
    for (const id of [...restaurantIds, ...foreignRestaurantIds]) {
      await db
        .delete(schema.restaurantTags)
        .where(eq(schema.restaurantTags.restaurantId, id));
      await db
        .delete(schema.restaurantOpinions)
        .where(eq(schema.restaurantOpinions.restaurantId, id));
      await db
        .delete(schema.restaurants)
        .where(eq(schema.restaurants.id, id));
    }
    for (const householdId of foreignHouseholdIds) {
      await db
        .delete(schema.households)
        .where(eq(schema.households.id, householdId));
    }
    const { postgresClient } = await import("@/lib/db");
    await postgresClient.end({ timeout: 5 });
  });

  function stamp() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  describe("createRestaurant", () => {
    it("happy path — creates successfully and returns id", async () => {
      const s = stamp();
      const result = await createRestaurant({
        name: `Create Happy ${s}`,
        address: `${s} Happy St`,
        forceCreate: true,
      });

      assert.equal(result.success, true, JSON.stringify(result));
      if (!result.success) return;
      assert.ok(result.data.id);
      restaurantIds.push(result.data.id);

      const detail = await getRestaurantDetail(result.data.id);
      assert.ok(detail);
      assert.equal(detail?.name, `Create Happy ${s}`);
    });

    it("failure — duplicate name+address returns CONFLICT with matched id", async () => {
      const s = stamp();
      const name = `Dup Cafe ${s}`;
      const address = `${s} Dup Ave`;

      const first = await createRestaurant({ name, address, forceCreate: true });
      assert.equal(first.success, true);
      if (!first.success) return;
      restaurantIds.push(first.data.id);

      const second = await createRestaurant({ name, address });
      assert.equal(second.success, false);
      if (second.success) return;
      assert.equal(second.error.code, "CONFLICT");
      assert.match(second.error.message, new RegExp(first.data.id));
    });
  });

  describe("deleteRestaurant", () => {
    it("happy path — no visits → hard delete", async () => {
      const s = stamp();
      const created = await createRestaurant({
        name: `Hard Delete ${s}`,
        address: `${s} Delete Rd`,
        forceCreate: true,
      });
      assert.equal(created.success, true);
      if (!created.success) return;

      const deleted = await deleteRestaurant({ id: created.data.id });
      assert.equal(deleted.success, true);
      if (!deleted.success) return;
      assert.equal(deleted.data.archived, false);

      const [row] = await db
        .select({ id: schema.restaurants.id })
        .from(schema.restaurants)
        .where(eq(schema.restaurants.id, created.data.id))
        .limit(1);
      assert.equal(row, undefined);

      const detail = await getRestaurantDetail(created.data.id);
      assert.equal(detail, null);
    });

    it("archive branch — visit exists → archivedAt set, row still present", async () => {
      const s = stamp();
      const created = await createRestaurant({
        name: `Archive Me ${s}`,
        address: `${s} Archive Rd`,
        forceCreate: true,
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      restaurantIds.push(created.data.id);

      const visitId = createId();
      visitIds.push(visitId);
      await db.insert(schema.visits).values({
        id: visitId,
        restaurantId: created.data.id,
        householdId: bypassHouseholdId,
        visitDate: new Date(),
        status: "COMPLETED",
        createdById: bypassUserId,
      });

      const deleted = await deleteRestaurant({ id: created.data.id });
      assert.equal(deleted.success, true);
      if (!deleted.success) return;
      assert.equal(deleted.data.archived, true);

      const [row] = await db
        .select({
          id: schema.restaurants.id,
          archivedAt: schema.restaurants.archivedAt,
        })
        .from(schema.restaurants)
        .where(eq(schema.restaurants.id, created.data.id))
        .limit(1);

      assert.ok(row);
      assert.ok(row.archivedAt);
      // Archived restaurants are hidden from detail queries.
      assert.equal(await getRestaurantDetail(created.data.id), null);
    });
  });

  describe("setRestaurantOpinion", () => {
    it("happy path — upserts opinion for caller", async () => {
      const s = stamp();
      const created = await createRestaurant({
        name: `Opinion Spot ${s}`,
        address: `${s} Opinion Ave`,
        forceCreate: true,
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      restaurantIds.push(created.data.id);

      const result = await setRestaurantOpinion({
        restaurantId: created.data.id,
        tag: "FAVORITE",
      });
      assert.equal(result.success, true);
      if (!result.success) return;
      assert.equal(result.data.tag, "FAVORITE");

      const detail = await getRestaurantDetail(created.data.id);
      assert.ok(detail?.opinions.some((o) => o.tag === "FAVORITE"));
    });

    it("idempotency — second call with same tag does not create a second row", async () => {
      const s = stamp();
      const created = await createRestaurant({
        name: `Opinion Idem ${s}`,
        address: `${s} Idem Ave`,
        forceCreate: true,
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      restaurantIds.push(created.data.id);

      const first = await setRestaurantOpinion({
        restaurantId: created.data.id,
        tag: "LIKE_IT",
      });
      const second = await setRestaurantOpinion({
        restaurantId: created.data.id,
        tag: "LIKE_IT",
      });
      assert.equal(first.success, true);
      assert.equal(second.success, true);

      const [rowCount] = await db
        .select({ value: count() })
        .from(schema.restaurantOpinions)
        .where(
          and(
            eq(schema.restaurantOpinions.restaurantId, created.data.id),
            eq(schema.restaurantOpinions.userId, bypassUserId),
          ),
        );

      assert.equal(Number(rowCount.value), 1);
    });
  });

  describe("listRestaurants / getRestaurantDetail household scoping", () => {
    it("never returns another household's restaurant", async () => {
      const s = stamp();

      const mine = await createRestaurant({
        name: `Mine ${s}`,
        address: `${s} Mine St`,
        forceCreate: true,
      });
      assert.equal(mine.success, true);
      if (!mine.success) return;
      restaurantIds.push(mine.data.id);

      const otherHouseholdId = createId();
      const otherRestaurantId = createId();
      foreignHouseholdIds.push(otherHouseholdId);
      foreignRestaurantIds.push(otherRestaurantId);

      await db.insert(schema.households).values({
        id: otherHouseholdId,
        name: `Other Household ${s}`,
      });
      await db.insert(schema.restaurants).values({
        id: otherRestaurantId,
        householdId: otherHouseholdId,
        name: `Theirs ${s}`,
        address: `${s} Theirs St`,
        status: "WISHLIST",
      });

      const page = await listRestaurants({ limit: 100 });
      assert.ok(page.items.some((r) => r.id === mine.data.id));
      assert.ok(!page.items.some((r) => r.id === otherRestaurantId));

      assert.ok(await getRestaurantDetail(mine.data.id));
      assert.equal(await getRestaurantDetail(otherRestaurantId), null);
    });
  });
});
