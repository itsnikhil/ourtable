import assert from "node:assert/strict";
import { after, before, describe, it, mock } from "node:test";
import { createId } from "@paralleldrive/cuid2";
import { config } from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";

config({ path: ".env" });

process.env.AUTH_BYPASS = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";
process.env.INTERNAL_CRON_TOKEN =
  process.env.INTERNAL_CRON_TOKEN ?? "test-cron-token-m6";

describe("photo domain (Step 5)", () => {
  const restaurantIds: string[] = [];
  const visitIds: string[] = [];
  const photoIds: string[] = [];
  const foreignHouseholdIds: string[] = [];
  const foreignUserIds: string[] = [];
  const foreignRestaurantIds: string[] = [];
  const foreignVisitIds: string[] = [];

  let createRestaurant: typeof import("@/lib/actions/restaurant-actions").createRestaurant;
  let createVisit: typeof import("@/lib/actions/visit-actions").createVisit;
  let attachPhoto: typeof import("@/lib/actions/photo-actions").attachPhoto;
  let removePhoto: typeof import("@/lib/actions/photo-actions").removePhoto;
  let attachPhotoSchema: typeof import("@/lib/validations/photo").attachPhotoSchema;
  let cleanupOrphanPhotos: typeof import("@/lib/photo-cleanup").cleanupOrphanPhotos;
  let r2ObjectUrl: typeof import("@/lib/r2").r2ObjectUrl;
  let uploadPost: typeof import("@/app/api/uploads/photo/route").POST;
  let cleanupCronPost: typeof import("@/app/api/cron/cleanup-orphan-photos/route").POST;
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
    ({ attachPhoto, removePhoto } = await import("@/lib/actions/photo-actions"));
    ({ attachPhotoSchema } = await import("@/lib/validations/photo"));
    ({ cleanupOrphanPhotos } = await import("@/lib/photo-cleanup"));
    ({ r2ObjectUrl } = await import("@/lib/r2"));
    ({ POST: uploadPost } = await import("@/app/api/uploads/photo/route"));
    ({ POST: cleanupCronPost } = await import(
      "@/app/api/cron/cleanup-orphan-photos/route"
    ));
    ({ AuthContextError } = await import("@/lib/errors"));
    ({ db } = await import("@/lib/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
  });

  after(async () => {
    for (const id of photoIds) {
      await db.delete(schema.photos).where(eq(schema.photos.id, id));
    }
    for (const id of [...visitIds, ...foreignVisitIds]) {
      await db.delete(schema.photos).where(eq(schema.photos.visitId, id));
      await db.delete(schema.visits).where(eq(schema.visits.id, id));
    }
    for (const id of [...restaurantIds, ...foreignRestaurantIds]) {
      await db.delete(schema.photos).where(eq(schema.photos.restaurantId, id));
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

  function fakeObjectUrl(keySuffix: string) {
    return r2ObjectUrl(`households/${bypassHouseholdId}/test-${keySuffix}.jpg`);
  }

  async function seedRestaurant(label: string) {
    const s = stamp();
    const created = await createRestaurant({
      name: `${label} ${s}`,
      address: `${s} Photo St`,
      forceCreate: true,
    });
    assert.equal(created.success, true, JSON.stringify(created));
    if (!created.success) throw new Error("createRestaurant failed");
    restaurantIds.push(created.data.id);
    return created.data.id;
  }

  async function seedVisit(restaurantId: string) {
    const result = await createVisit({
      restaurantId,
      visitDate: new Date().toISOString(),
      status: "COMPLETED",
    });
    assert.equal(result.success, true, JSON.stringify(result));
    if (!result.success) throw new Error("createVisit failed");
    visitIds.push(result.data.id);
    return result.data.id;
  }

  async function seedForeignHousehold() {
    const hhId = createId();
    const userId = createId();
    const s = stamp();
    await db.insert(schema.households).values({
      id: hhId,
      name: `Foreign Photo HH ${s}`,
    });
    foreignHouseholdIds.push(hhId);
    await db.insert(schema.users).values({
      id: userId,
      email: `foreign-photo-${s}@example.com`,
      name: "Foreign Photo User",
      householdId: hhId,
    });
    foreignUserIds.push(userId);

    const restaurantId = createId();
    await db.insert(schema.restaurants).values({
      id: restaurantId,
      householdId: hhId,
      name: `Foreign Photo Rest ${s}`,
      address: `${s} Foreign Ave`,
    });
    foreignRestaurantIds.push(restaurantId);

    const visitId = createId();
    await db.insert(schema.visits).values({
      id: visitId,
      householdId: hhId,
      restaurantId,
      visitDate: new Date(),
      status: "COMPLETED",
      createdById: userId,
    });
    foreignVisitIds.push(visitId);

    return { householdId: hhId, userId, restaurantId, visitId };
  }

  describe("attachPhoto", () => {
    it("attaches to a visit (happy path)", async () => {
      const restaurantId = await seedRestaurant("VisitPhoto");
      const visitId = await seedVisit(restaurantId);
      const objectUrl = fakeObjectUrl(`visit-${stamp()}`);

      const result = await attachPhoto({ objectUrl, visitId });
      assert.equal(result.success, true, JSON.stringify(result));
      if (!result.success) return;
      photoIds.push(result.data.id);
      assert.equal(result.data.url, objectUrl);

      const [row] = await db
        .select()
        .from(schema.photos)
        .where(eq(schema.photos.id, result.data.id));
      assert.equal(row.visitId, visitId);
      assert.equal(row.restaurantId, null);
      assert.equal(row.uploadedById, bypassUserId);
    });

    it("attaches to a restaurant (happy path)", async () => {
      const restaurantId = await seedRestaurant("RestPhoto");
      const objectUrl = fakeObjectUrl(`rest-${stamp()}`);

      const result = await attachPhoto({ objectUrl, restaurantId });
      assert.equal(result.success, true, JSON.stringify(result));
      if (!result.success) return;
      photoIds.push(result.data.id);
      assert.equal(result.data.url, objectUrl);

      const [row] = await db
        .select()
        .from(schema.photos)
        .where(eq(schema.photos.id, result.data.id));
      assert.equal(row.restaurantId, restaurantId);
      assert.equal(row.visitId, null);
    });

    it("returns NOT_FOUND for another household's visit", async () => {
      const foreign = await seedForeignHousehold();
      const result = await attachPhoto({
        objectUrl: fakeObjectUrl(`foreign-visit-${stamp()}`),
        visitId: foreign.visitId,
      });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.code, "NOT_FOUND");
    });

    it("returns NOT_FOUND for another household's restaurant", async () => {
      const foreign = await seedForeignHousehold();
      const result = await attachPhoto({
        objectUrl: fakeObjectUrl(`foreign-rest-${stamp()}`),
        restaurantId: foreign.restaurantId,
      });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.code, "NOT_FOUND");
    });

    it("rejects both visitId and restaurantId via refine()", () => {
      assert.throws(
        () =>
          attachPhotoSchema.parse({
            objectUrl: "https://example.com/p.jpg",
            visitId: "v1",
            restaurantId: "r1",
          }),
        /Exactly one of visitId or restaurantId/,
      );
    });

    it("rejects neither visitId nor restaurantId via refine()", () => {
      assert.throws(
        () =>
          attachPhotoSchema.parse({
            objectUrl: "https://example.com/p.jpg",
          }),
        /Exactly one of visitId or restaurantId/,
      );
    });

    it("maps refine failures to VALIDATION_ERROR in the action", async () => {
      const both = await attachPhoto({
        objectUrl: "https://example.com/both.jpg",
        visitId: "v1",
        restaurantId: "r1",
      });
      assert.equal(both.success, false);
      if (!both.success) assert.equal(both.error.code, "VALIDATION_ERROR");

      const neither = await attachPhoto({
        objectUrl: "https://example.com/neither.jpg",
      });
      assert.equal(neither.success, false);
      if (!neither.success) assert.equal(neither.error.code, "VALIDATION_ERROR");
    });
  });

  describe("removePhoto", () => {
    it("deletes the DB row and does not call R2 send/delete", async () => {
      const restaurantId = await seedRestaurant("RemovePhoto");
      const visitId = await seedVisit(restaurantId);
      const attached = await attachPhoto({
        objectUrl: fakeObjectUrl(`remove-${stamp()}`),
        visitId,
      });
      assert.equal(attached.success, true);
      if (!attached.success) return;
      const photoId = attached.data.id;

      const sendSpy = mock.method(S3Client.prototype, "send", async () => ({
        $metadata: {},
      }));

      try {
        const result = await removePhoto({ id: photoId });
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(sendSpy.mock.callCount(), 0);

        const [row] = await db
          .select()
          .from(schema.photos)
          .where(eq(schema.photos.id, photoId));
        assert.equal(row, undefined);
      } finally {
        sendSpy.mock.restore();
      }
    });

    it("returns NOT_FOUND for another household's photo", async () => {
      const foreign = await seedForeignHousehold();
      const photoId = createId();
      await db.insert(schema.photos).values({
        id: photoId,
        url: "https://example.com/foreign.jpg",
        visitId: foreign.visitId,
        uploadedById: foreign.userId,
      });
      // Track for cleanup via foreign visit cascade in after()

      const result = await removePhoto({ id: photoId });
      assert.equal(result.success, false);
      if (result.success) return;
      assert.equal(result.error.code, "NOT_FOUND");

      // Still exists — not deleted across households
      const [row] = await db
        .select()
        .from(schema.photos)
        .where(eq(schema.photos.id, photoId));
      assert.ok(row);
      photoIds.push(photoId);
    });
  });

  describe("POST /api/uploads/photo", () => {
    it("returns 401 when unauthenticated", async () => {
      const { uploadPhotoAuth } = await import("@/lib/upload-photo-auth");
      const original = uploadPhotoAuth.requireAuthContext;
      uploadPhotoAuth.requireAuthContext = async () => {
        throw new AuthContextError();
      };

      try {
        const res = await uploadPost(
          new Request("http://localhost/api/uploads/photo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: "x.jpg",
              contentType: "image/jpeg",
              fileSizeBytes: 1024,
            }),
          }),
        );
        assert.equal(res.status, 401);
        const body = await res.json();
        assert.equal(body.error, "Unauthorized");
      } finally {
        uploadPhotoAuth.requireAuthContext = original;
      }
    });

    it("returns 400 for oversized file", async () => {
      const res = await uploadPost(
        new Request("http://localhost/api/uploads/photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "huge.jpg",
            contentType: "image/jpeg",
            fileSizeBytes: 16 * 1024 * 1024,
          }),
        }),
      );
      assert.equal(res.status, 400);
    });

    it("returns 400 for wrong content type", async () => {
      const res = await uploadPost(
        new Request("http://localhost/api/uploads/photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "doc.pdf",
            contentType: "application/pdf",
            fileSizeBytes: 1024,
          }),
        }),
      );
      assert.equal(res.status, 400);
    });

    it("returns uploadUrl, objectUrl, expiresInSeconds for valid request", async () => {
      assert.ok(process.env.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID required");
      assert.ok(process.env.R2_BUCKET_NAME, "R2_BUCKET_NAME required");

      const res = await uploadPost(
        new Request("http://localhost/api/uploads/photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: "dinner.jpg",
            contentType: "image/jpeg",
            fileSizeBytes: 2048,
          }),
        }),
      );
      assert.equal(res.status, 200, await res.clone().text());
      const body = await res.json();
      assert.equal(typeof body.uploadUrl, "string");
      assert.ok(body.uploadUrl.startsWith("http"));
      assert.equal(typeof body.objectUrl, "string");
      assert.ok(body.objectUrl.includes(`households/${bypassHouseholdId}/`));
      assert.equal(body.expiresInSeconds, 300);
    });
  });

  describe("cleanupOrphanPhotos", () => {
    it("deletes orphans older than 24h and leaves young objects alone", async () => {
      const now = new Date("2026-07-29T12:00:00.000Z");
      const oldKey = `households/${bypassHouseholdId}/orphan-old.jpg`;
      const youngKey = `households/${bypassHouseholdId}/orphan-young.jpg`;
      const attachedKey = `households/${bypassHouseholdId}/attached.jpg`;
      const attachedUrl = r2ObjectUrl(attachedKey);

      const deletedKeys: string[] = [];

      const result = await cleanupOrphanPhotos(now, {
        listObjects: async () => [
          {
            Key: oldKey,
            LastModified: new Date(now.getTime() - 25 * 60 * 60 * 1000),
          },
          {
            Key: youngKey,
            LastModified: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          },
          {
            Key: attachedKey,
            LastModified: new Date(now.getTime() - 48 * 60 * 60 * 1000),
          },
        ],
        listAttachedUrls: async () => [attachedUrl],
        deleteKeys: async (keys) => {
          deletedKeys.push(...keys);
          return keys.length;
        },
      });

      assert.deepEqual(deletedKeys, [oldKey]);
      assert.equal(result.scanned, 3);
      assert.equal(result.deleted, 1);
      assert.equal(result.skippedYoung, 1);
      assert.equal(result.skippedAttached, 1);
    });

    it("cron route rejects missing token", async () => {
      const res = await cleanupCronPost(
        new Request("http://localhost/api/cron/cleanup-orphan-photos", {
          method: "POST",
        }),
      );
      assert.equal(res.status, 401);
    });
  });
});
