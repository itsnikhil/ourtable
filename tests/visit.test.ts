import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";

process.env.AUTH_BYPASS = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";

describe("visit + ordered-item domain (Step 4)", () => {
  const restaurantIds: string[] = [];
  const visitIds: string[] = [];
  const orderedItemIds: string[] = [];
  const foreignHouseholdIds: string[] = [];
  const foreignUserIds: string[] = [];
  const foreignRestaurantIds: string[] = [];
  const foreignVisitIds: string[] = [];

  let createRestaurant: typeof import("@/lib/actions/restaurant-actions").createRestaurant;
  let createVisit: typeof import("@/lib/actions/visit-actions").createVisit;
  let updateVisit: typeof import("@/lib/actions/visit-actions").updateVisit;
  let setBill: typeof import("@/lib/actions/visit-actions").setBill;
  let addOrderedItem: typeof import("@/lib/actions/ordered-item-actions").addOrderedItem;
  let updateOrderedItem: typeof import("@/lib/actions/ordered-item-actions").updateOrderedItem;
  let removeOrderedItem: typeof import("@/lib/actions/ordered-item-actions").removeOrderedItem;
  let getVisitDetail: typeof import("@/lib/queries/visit-queries").getVisitDetail;
  let listVisitsForRestaurant: typeof import("@/lib/queries/visit-queries").listVisitsForRestaurant;
  let getRestaurantDetail: typeof import("@/lib/queries/restaurant-queries").getRestaurantDetail;
  let orderedItemSchema: typeof import("@/lib/validations/ordered-item").orderedItemSchema;
  let db: typeof import("@/lib/db").db;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;

  let bypassUserId: string;
  let bypassHouseholdId: string;

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
    ({ createVisit, updateVisit, setBill } = await import(
      "@/lib/actions/visit-actions"
    ));
    ({ addOrderedItem, updateOrderedItem, removeOrderedItem } = await import(
      "@/lib/actions/ordered-item-actions"
    ));
    ({ getVisitDetail, listVisitsForRestaurant } = await import(
      "@/lib/queries/visit-queries"
    ));
    ({ getRestaurantDetail } = await import(
      "@/lib/queries/restaurant-queries"
    ));
    ({ orderedItemSchema } = await import("@/lib/validations/ordered-item"));
    ({ db } = await import("@/lib/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
  });

  after(async () => {
    for (const id of orderedItemIds) {
      await db
        .delete(schema.orderedItems)
        .where(eq(schema.orderedItems.id, id));
    }
    for (const id of [...visitIds, ...foreignVisitIds]) {
      await db
        .delete(schema.orderedItems)
        .where(eq(schema.orderedItems.visitId, id));
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

  async function seedWishlistRestaurant(label: string) {
    const s = stamp();
    const created = await createRestaurant({
      name: `${label} ${s}`,
      address: `${s} ${label} St`,
      forceCreate: true,
    });
    assert.equal(created.success, true, JSON.stringify(created));
    if (!created.success) throw new Error("createRestaurant failed");
    restaurantIds.push(created.data.id);

    const detail = await getRestaurantDetail(created.data.id);
    assert.equal(detail?.status, "WISHLIST");
    return created.data.id;
  }

  describe("createVisit", () => {
    it("happy path — creates and flips restaurant WISHLIST → VISITED", async () => {
      const restaurantId = await seedWishlistRestaurant("Visit Happy");

      const result = await createVisit({
        restaurantId,
        visitDate: new Date().toISOString(),
        meal: "DINNER",
        dineType: "DINE_IN",
        status: "COMPLETED",
      });

      assert.equal(result.success, true, JSON.stringify(result));
      if (!result.success) return;
      assert.ok(result.data.id);
      assert.equal(result.data.status, "COMPLETED");
      visitIds.push(result.data.id);

      const restaurant = await getRestaurantDetail(restaurantId);
      assert.equal(restaurant?.status, "VISITED");
    });

    it("happy path — status PLANNED creates and flips WISHLIST → PLANNED", async () => {
      const restaurantId = await seedWishlistRestaurant("Visit Planned");

      const result = await createVisit({
        restaurantId,
        visitDate: new Date(Date.now() + 86400000).toISOString(),
        status: "PLANNED",
      });

      assert.equal(result.success, true, JSON.stringify(result));
      if (!result.success) return;
      assert.equal(result.data.status, "PLANNED");
      visitIds.push(result.data.id);

      const restaurant = await getRestaurantDetail(restaurantId);
      assert.equal(restaurant?.status, "PLANNED");
    });

    it("schema refine — past-dated PLANNED rejected before insert", async () => {
      const restaurantId = await seedWishlistRestaurant("Visit Past Plan");

      const result = await createVisit({
        restaurantId,
        visitDate: new Date(Date.now() - 86400000).toISOString(),
        status: "PLANNED",
      });

      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.code, "VALIDATION_ERROR");
    });
  });

  describe("updateVisit", () => {
    it("happy path — updates meal and occasion", async () => {
      const restaurantId = await seedWishlistRestaurant("Update Visit");
      const created = await createVisit({
        restaurantId,
        visitDate: new Date().toISOString(),
        meal: "LUNCH",
        status: "COMPLETED",
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      visitIds.push(created.data.id);

      const updated = await updateVisit({
        id: created.data.id,
        meal: "DINNER",
        occasion: "Anniversary",
      });
      assert.equal(updated.success, true, JSON.stringify(updated));

      const detail = await getVisitDetail(created.data.id);
      assert.equal(detail?.meal, "DINNER");
      assert.equal(detail?.occasion, "Anniversary");
    });

    it("NOT_FOUND for a visit belonging to another household", async () => {
      const s = stamp();
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
        name: `Other Household ${s}`,
      });
      await db.insert(schema.users).values({
        id: otherUserId,
        householdId: otherHouseholdId,
        email: `other-${s}@example.com`,
        name: "Other User",
      });
      await db.insert(schema.restaurants).values({
        id: otherRestaurantId,
        householdId: otherHouseholdId,
        name: `Theirs ${s}`,
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

      const result = await updateVisit({
        id: otherVisitId,
        occasion: "Should not apply",
      });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.code, "NOT_FOUND");
    });
  });

  describe("setBill", () => {
    it("happy path — updates subtotal/tip/total", async () => {
      const restaurantId = await seedWishlistRestaurant("Bill Visit");
      const created = await createVisit({
        restaurantId,
        visitDate: new Date().toISOString(),
        status: "COMPLETED",
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      visitIds.push(created.data.id);

      const billed = await setBill({
        visitId: created.data.id,
        subtotal: "80.00",
        tip: "16.00",
        totalPaid: "96.00",
        paymentSplit: "EQUAL",
        paymentMethod: "Card",
      });
      assert.equal(billed.success, true, JSON.stringify(billed));
      if (!billed.success) return;
      assert.equal(billed.data.visitId, created.data.id);
      assert.equal(Number(billed.data.totalPaid), 96);

      const detail = await getVisitDetail(created.data.id);
      assert.equal(Number(detail?.subtotal), 80);
      assert.equal(Number(detail?.tip), 16);
      assert.equal(Number(detail?.totalPaid), 96);
      assert.equal(detail?.paymentSplit, "EQUAL");
      assert.equal(detail?.paymentMethod, "Card");
    });
  });

  describe("ordered items", () => {
    it("addOrderedItem happy path", async () => {
      const restaurantId = await seedWishlistRestaurant("Item Add");
      const created = await createVisit({
        restaurantId,
        visitDate: new Date().toISOString(),
        status: "COMPLETED",
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      visitIds.push(created.data.id);

      const added = await addOrderedItem({
        visitId: created.data.id,
        dishName: "Cacio e Pepe",
        price: "24.00",
        shared: true,
      });
      assert.equal(added.success, true, JSON.stringify(added));
      if (!added.success) return;
      orderedItemIds.push(added.data.id);
    });

    it("updateOrderedItem happy path", async () => {
      const restaurantId = await seedWishlistRestaurant("Item Update");
      const created = await createVisit({
        restaurantId,
        visitDate: new Date().toISOString(),
        status: "COMPLETED",
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      visitIds.push(created.data.id);

      const added = await addOrderedItem({
        visitId: created.data.id,
        dishName: "Carbonara",
        shared: true,
      });
      assert.equal(added.success, true);
      if (!added.success) return;
      orderedItemIds.push(added.data.id);

      const updated = await updateOrderedItem({
        id: added.data.id,
        dishName: "Carbonara (extra pepper)",
        wouldOrderAgain: true,
      });
      assert.equal(updated.success, true, JSON.stringify(updated));

      const detail = await getVisitDetail(created.data.id);
      const item = detail?.orderedItems.find((i) => i.id === added.data.id);
      assert.equal(item?.dishName, "Carbonara (extra pepper)");
      assert.equal(item?.wouldOrderAgain, true);
    });

    it("removeOrderedItem happy path", async () => {
      const restaurantId = await seedWishlistRestaurant("Item Remove");
      const created = await createVisit({
        restaurantId,
        visitDate: new Date().toISOString(),
        status: "COMPLETED",
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      visitIds.push(created.data.id);

      const added = await addOrderedItem({
        visitId: created.data.id,
        dishName: "Tiramisu",
        shared: true,
      });
      assert.equal(added.success, true);
      if (!added.success) return;

      const removed = await removeOrderedItem({ id: added.data.id });
      assert.equal(removed.success, true, JSON.stringify(removed));

      const detail = await getVisitDetail(created.data.id);
      assert.ok(!detail?.orderedItems.some((i) => i.id === added.data.id));
    });

    it("validation — shared=false without orderedById fails", async () => {
      const parsed = orderedItemSchema.safeParse({
        visitId: "any",
        dishName: "Solo Pasta",
        shared: false,
      });
      assert.equal(parsed.success, false);

      const restaurantId = await seedWishlistRestaurant("Item Shared");
      const created = await createVisit({
        restaurantId,
        visitDate: new Date().toISOString(),
        status: "COMPLETED",
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      visitIds.push(created.data.id);

      const added = await addOrderedItem({
        visitId: created.data.id,
        dishName: "Solo Pasta",
        shared: false,
      });
      assert.equal(added.success, false);
      if (added.success) return;
      assert.equal(added.error.code, "VALIDATION_ERROR");
    });
  });

  describe("getVisitDetail", () => {
    it("returns nested ordered items and empty photos/ratings", async () => {
      const restaurantId = await seedWishlistRestaurant("Detail Nest");
      const created = await createVisit({
        restaurantId,
        visitDate: new Date().toISOString(),
        meal: "DINNER",
        status: "COMPLETED",
      });
      assert.equal(created.success, true);
      if (!created.success) return;
      visitIds.push(created.data.id);

      const item = await addOrderedItem({
        visitId: created.data.id,
        dishName: "Bruschetta",
        price: "12.00",
        shared: true,
      });
      assert.equal(item.success, true);
      if (!item.success) return;
      orderedItemIds.push(item.data.id);

      const detail = await getVisitDetail(created.data.id);
      assert.ok(detail);
      assert.equal(detail?.orderedItems.length, 1);
      assert.equal(detail?.orderedItems[0]?.dishName, "Bruschetta");
      assert.deepEqual(detail?.photos, []);
      assert.deepEqual(detail?.ratings, []);
      assert.equal(detail?.coupleAverageRating, null);
      assert.deepEqual(detail?.photoThumbnails, []);
    });
  });

  describe("listVisitsForRestaurant household scoping", () => {
    it("never returns another household's visit", async () => {
      const s = stamp();
      const restaurantId = await seedWishlistRestaurant("List Mine");
      const mine = await createVisit({
        restaurantId,
        visitDate: new Date().toISOString(),
        status: "COMPLETED",
      });
      assert.equal(mine.success, true);
      if (!mine.success) return;
      visitIds.push(mine.data.id);

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
        name: `List Other ${s}`,
      });
      await db.insert(schema.users).values({
        id: otherUserId,
        householdId: otherHouseholdId,
        email: `list-other-${s}@example.com`,
        name: "List Other",
      });
      // Same restaurantId would be wrong — seed a restaurant+visit in other household
      // that we try to list under our restaurantId (should not leak).
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

      const page = await listVisitsForRestaurant(restaurantId, { limit: 100 });
      assert.ok(page.items.some((v) => v.id === mine.data.id));
      assert.ok(!page.items.some((v) => v.id === otherVisitId));

      // Listing by foreign restaurant id under our auth must not return their visit
      const foreignPage = await listVisitsForRestaurant(otherRestaurantId, {
        limit: 100,
      });
      assert.equal(foreignPage.items.length, 0);
      assert.equal(await getVisitDetail(otherVisitId), null);
    });
  });
});
