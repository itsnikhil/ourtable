import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";
import { config } from "dotenv";

config({ path: ".env" });

process.env.AUTH_BYPASS = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";
process.env.VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ?? "mailto:local@ourtable.dev";
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "test-public-key";
process.env.VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ?? "test-private-key";

describe("push notifications (Step A5)", () => {
  const restaurantIds: string[] = [];
  const visitIds: string[] = [];
  const subscriptionIds: string[] = [];
  const partnerUserIds: string[] = [];

  let createRestaurant: typeof import("@/lib/actions/restaurant-actions").createRestaurant;
  let createVisit: typeof import("@/lib/actions/visit-actions").createVisit;
  let notifyPartnerRatingPending: typeof import("@/lib/actions/rating-actions").notifyPartnerRatingPending;
  let deliverPartnerRatingPush: typeof import("@/lib/push-notify").deliverPartnerRatingPush;
  let pushPost: typeof import("@/app/api/push/subscribe/route").POST;
  let pushDelete: typeof import("@/app/api/push/subscribe/route").DELETE;
  let AuthContextError: typeof import("@/lib/errors").AuthContextError;
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
    ({ createVisit } = await import("@/lib/actions/visit-actions"));
    ({ notifyPartnerRatingPending } = await import(
      "@/lib/actions/rating-actions"
    ));
    ({ deliverPartnerRatingPush } = await import("@/lib/push-notify"));
    ({ POST: pushPost, DELETE: pushDelete } = await import(
      "@/app/api/push/subscribe/route"
    ));
    ({ AuthContextError } = await import("@/lib/errors"));
    ({ db } = await import("@/lib/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
  });

  after(async () => {
    for (const id of subscriptionIds) {
      await db
        .delete(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.id, id));
    }
    // Also clear by user in case upsert created untracked rows
    await db
      .delete(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, bypassUserId));
    for (const id of partnerUserIds) {
      await db
        .delete(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.userId, id));
    }
    for (const id of visitIds) {
      await db.delete(schema.visits).where(eq(schema.visits.id, id));
    }
    for (const id of restaurantIds) {
      await db
        .delete(schema.restaurants)
        .where(eq(schema.restaurants.id, id));
    }
    for (const id of partnerUserIds) {
      await db.delete(schema.users).where(eq(schema.users.id, id));
    }
    const { postgresClient } = await import("@/lib/db");
    await postgresClient.end({ timeout: 5 });
  });

  function stamp() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function validBody(endpoint = `https://push.example/${stamp()}`) {
    return {
      endpoint,
      keys: {
        p256dh: "p256dh-test-key",
        auth: "auth-test-key",
      },
    };
  }

  describe("POST/DELETE /api/push/subscribe", () => {
    it("POST happy path upserts and returns id", async () => {
      const body = validBody();
      const res = await pushPost(
        new Request("http://localhost/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(typeof json.id, "string");
      subscriptionIds.push(json.id);

      const [row] = await db
        .select()
        .from(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.id, json.id));
      assert.equal(row.userId, bypassUserId);
      assert.equal(row.endpoint, body.endpoint);
      assert.equal(row.p256dh, body.keys.p256dh);
      assert.equal(row.auth, body.keys.auth);

      // Upsert same endpoint
      const again = await pushPost(
        new Request("http://localhost/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...body,
            keys: { p256dh: "rotated-p256dh", auth: "rotated-auth" },
          }),
        }),
      );
      assert.equal(again.status, 200);
      const againJson = await again.json();
      assert.equal(againJson.id, json.id);
    });

    it("DELETE happy path returns 204 and removes row", async () => {
      const body = validBody();
      const created = await pushPost(
        new Request("http://localhost/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      const { id } = await created.json();
      subscriptionIds.push(id);

      const res = await pushDelete(
        new Request("http://localhost/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: body.endpoint }),
        }),
      );
      assert.equal(res.status, 204);

      const [row] = await db
        .select()
        .from(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.id, id));
      assert.equal(row, undefined);
    });

    it("returns 401 without session", async () => {
      const { pushRouteAuth } = await import("@/lib/push-route-auth");
      const original = pushRouteAuth.requireAuthContext;
      pushRouteAuth.requireAuthContext = async () => {
        throw new AuthContextError();
      };
      try {
        const res = await pushPost(
          new Request("http://localhost/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validBody()),
          }),
        );
        assert.equal(res.status, 401);
      } finally {
        pushRouteAuth.requireAuthContext = original;
      }
    });

    it("returns 400 on malformed subscription body", async () => {
      const res = await pushPost(
        new Request("http://localhost/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: "not-a-url", keys: {} }),
        }),
      );
      assert.equal(res.status, 400);
    });
  });

  describe("notifyPartnerRatingPending / deliverPartnerRatingPush", () => {
    it("sends to the partner subscription, not the caller's", async () => {
      const s = stamp();
      const restaurant = await createRestaurant({
        name: `Push Rest ${s}`,
        address: `${s} Push St`,
        forceCreate: true,
      });
      assert.equal(restaurant.success, true);
      if (!restaurant.success) return;
      restaurantIds.push(restaurant.data.id);

      const visit = await createVisit({
        restaurantId: restaurant.data.id,
        visitDate: new Date().toISOString(),
        status: "COMPLETED",
      });
      assert.equal(visit.success, true);
      if (!visit.success) return;
      visitIds.push(visit.data.id);

      const partnerId = createId();
      await db.insert(schema.users).values({
        id: partnerId,
        email: `partner-push-${s}@example.com`,
        name: "Partner Push",
        householdId: bypassHouseholdId,
      });
      partnerUserIds.push(partnerId);

      const callerEndpoint = `https://push.example/caller-${s}`;
      const partnerEndpoint = `https://push.example/partner-${s}`;

      const [callerSub] = await db
        .insert(schema.pushSubscriptions)
        .values({
          userId: bypassUserId,
          endpoint: callerEndpoint,
          p256dh: "caller-p256dh",
          auth: "caller-auth",
        })
        .returning({ id: schema.pushSubscriptions.id });
      subscriptionIds.push(callerSub.id);

      const [partnerSub] = await db
        .insert(schema.pushSubscriptions)
        .values({
          userId: partnerId,
          endpoint: partnerEndpoint,
          p256dh: "partner-p256dh",
          auth: "partner-auth",
        })
        .returning({ id: schema.pushSubscriptions.id });
      subscriptionIds.push(partnerSub.id);

      const sent: Array<{ endpoint: string }> = [];
      await deliverPartnerRatingPush(visit.data.id, partnerId, {
        sendNotification: async (subscription) => {
          sent.push({ endpoint: subscription.endpoint });
          return {};
        },
      });

      assert.equal(sent.length, 1);
      assert.equal(sent[0].endpoint, partnerEndpoint);
      assert.ok(!sent.some((x) => x.endpoint === callerEndpoint));
    });

    it("deletes the row when send reports an expired subscription (410)", async () => {
      const s = stamp();
      const restaurant = await createRestaurant({
        name: `Push Gone ${s}`,
        address: `${s} Gone St`,
        forceCreate: true,
      });
      assert.equal(restaurant.success, true);
      if (!restaurant.success) return;
      restaurantIds.push(restaurant.data.id);

      const visit = await createVisit({
        restaurantId: restaurant.data.id,
        visitDate: new Date().toISOString(),
        status: "COMPLETED",
      });
      assert.equal(visit.success, true);
      if (!visit.success) return;
      visitIds.push(visit.data.id);

      const partnerId = createId();
      await db.insert(schema.users).values({
        id: partnerId,
        email: `partner-gone-${s}@example.com`,
        name: "Partner Gone",
        householdId: bypassHouseholdId,
      });
      partnerUserIds.push(partnerId);

      const [sub] = await db
        .insert(schema.pushSubscriptions)
        .values({
          userId: partnerId,
          endpoint: `https://push.example/gone-${s}`,
          p256dh: "gone-p256dh",
          auth: "gone-auth",
        })
        .returning({ id: schema.pushSubscriptions.id });
      subscriptionIds.push(sub.id);

      await deliverPartnerRatingPush(visit.data.id, partnerId, {
        sendNotification: async () => {
          const err = new Error("Gone") as Error & { statusCode: number };
          err.statusCode = 410;
          throw err;
        },
      });

      const [row] = await db
        .select()
        .from(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.id, sub.id));
      assert.equal(row, undefined);
    });

    it("notifyPartnerRatingPending delegates to deliverPartnerRatingPush", async () => {
      // Smoke: wrapper does not throw with no partner subscriptions.
      await notifyPartnerRatingPending("nonexistent-visit-id", createId());
    });
  });
});
