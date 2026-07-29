import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createId } from "@paralleldrive/cuid2";
import { randomBytes } from "crypto";

process.env.AUTH_BYPASS = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";

describe("household invites", () => {
  const foreignHouseholdIds: string[] = [];
  const foreignUserIds: string[] = [];
  const inviteIds: string[] = [];

  let acceptHouseholdInvite: typeof import("@/lib/actions/household-actions").acceptHouseholdInvite;
  let ensureHouseholdForUser: typeof import("@/lib/household").ensureHouseholdForUser;
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

    ({ acceptHouseholdInvite } = await import(
      "@/lib/actions/household-actions"
    ));
    ({ ensureHouseholdForUser } = await import("@/lib/household"));
    ({ db } = await import("@/lib/db"));
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
  });

  after(async () => {
    await restoreBypassHousehold();

    for (const id of inviteIds) {
      await db
        .delete(schema.householdInvites)
        .where(eq(schema.householdInvites.id, id));
    }
    for (const id of foreignUserIds) {
      await db.delete(schema.users).where(eq(schema.users.id, id));
    }
    for (const id of foreignHouseholdIds) {
      await db
        .delete(schema.householdInvites)
        .where(eq(schema.householdInvites.householdId, id));
      await db
        .delete(schema.lists)
        .where(eq(schema.lists.householdId, id));
      await db.delete(schema.households).where(eq(schema.households.id, id));
    }

    const { postgresClient } = await import("@/lib/db");
    await postgresClient.end({ timeout: 5 });
  });

  async function restoreBypassHousehold() {
    const [existing] = await db
      .select({ id: schema.households.id })
      .from(schema.households)
      .where(eq(schema.households.id, bypassHouseholdId))
      .limit(1);

    if (existing) {
      await db
        .update(schema.users)
        .set({ householdId: bypassHouseholdId })
        .where(eq(schema.users.id, bypassUserId));
      return;
    }

    const householdId = await ensureHouseholdForUser({
      userId: bypassUserId,
      displayName: "Local Tester",
      email: process.env.AUTH_BYPASS_EMAIL ?? "local@ourtable.dev",
    });
    if (!householdId) {
      throw new Error("Failed to restore bypass household after invite tests");
    }
    bypassHouseholdId = householdId;
  }

  function stamp() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function seedInviteTarget() {
    const s = stamp();
    const [household] = await db
      .insert(schema.households)
      .values({ name: `Invite target ${s}` })
      .returning({ id: schema.households.id });
    foreignHouseholdIds.push(household.id);

    const partnerId = createId();
    await db.insert(schema.users).values({
      id: partnerId,
      email: `partner-${s}@example.com`,
      name: `Partner ${s}`,
      householdId: household.id,
      emailVerified: new Date(),
    });
    foreignUserIds.push(partnerId);

    const token = randomBytes(16).toString("hex");
    const [invite] = await db
      .insert(schema.householdInvites)
      .values({
        householdId: household.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .returning({ id: schema.householdInvites.id, token: schema.householdInvites.token });
    inviteIds.push(invite.id);

    return { householdId: household.id, token: invite.token };
  }

  it("lets a solo user leave their household and join an invite", async () => {
    const s = stamp();
    const [soloHousehold] = await db
      .insert(schema.households)
      .values({ name: `Solo abandon ${s}` })
      .returning({ id: schema.households.id });
    foreignHouseholdIds.push(soloHousehold.id);

    await db
      .update(schema.users)
      .set({ householdId: soloHousehold.id })
      .where(eq(schema.users.id, bypassUserId));

    const target = await seedInviteTarget();

    const result = await acceptHouseholdInvite({ token: target.token });
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(result.data.householdId, target.householdId);

    const [user] = await db
      .select({ householdId: schema.users.householdId })
      .from(schema.users)
      .where(eq(schema.users.id, bypassUserId))
      .limit(1);
    assert.equal(user?.householdId, target.householdId);

    const [invite] = await db
      .select({ id: schema.householdInvites.id })
      .from(schema.householdInvites)
      .where(eq(schema.householdInvites.token, target.token))
      .limit(1);
    assert.equal(invite, undefined);

    const [abandoned] = await db
      .select({ id: schema.households.id })
      .from(schema.households)
      .where(eq(schema.households.id, soloHousehold.id))
      .limit(1);
    assert.equal(abandoned, undefined);

    // Already deleted by orphan cleanup — drop from foreign cleanup list.
    const idx = foreignHouseholdIds.indexOf(soloHousehold.id);
    if (idx >= 0) foreignHouseholdIds.splice(idx, 1);

    await restoreBypassHousehold();
  });

  it("blocks accept when the user already has a household partner", async () => {
    await restoreBypassHousehold();

    const s = stamp();
    const partnerId = createId();
    await db.insert(schema.users).values({
      id: partnerId,
      email: `co-member-${s}@example.com`,
      name: `Co Member ${s}`,
      householdId: bypassHouseholdId,
      emailVerified: new Date(),
    });
    foreignUserIds.push(partnerId);

    const target = await seedInviteTarget();
    const result = await acceptHouseholdInvite({ token: target.token });

    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.error.code, "CONFLICT");
    assert.match(result.error.message, /another member/i);

    const [user] = await db
      .select({ householdId: schema.users.householdId })
      .from(schema.users)
      .where(eq(schema.users.id, bypassUserId))
      .limit(1);
    assert.equal(user?.householdId, bypassHouseholdId);

    await db.delete(schema.users).where(eq(schema.users.id, partnerId));
    foreignUserIds.splice(foreignUserIds.indexOf(partnerId), 1);
  });

  it("returns NOT_FOUND for an invalid invite token", async () => {
    const result = await acceptHouseholdInvite({
      token: "does-not-exist-" + stamp(),
    });
    assert.equal(result.success, false);
    if (result.success) return;
    assert.equal(result.error.code, "NOT_FOUND");
  });
});
