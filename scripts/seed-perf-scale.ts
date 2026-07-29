/**
 * Seeds ~1,000 restaurants + ~5,000 visits for NFR-1 perf checks.
 * Idempotent for the AUTH_BYPASS household (skips if PerfSeed data already present).
 *
 * Usage (from host):
 *   DATABASE_URL_HOST=postgresql://ourtable:ourtable@localhost:5433/ourtable \
 *     npx tsx scripts/seed-perf-scale.ts
 */
process.env.AUTH_BYPASS = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  process.env.DATABASE_URL ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";

import { config } from "dotenv";
config({ path: ".env", override: false });
// Host URL must win over compose-internal `db` hostname from .env
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  process.env.DATABASE_URL ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";
process.env.AUTH_BYPASS = "true";

const RESTAURANT_COUNT = 1000;
const VISIT_COUNT = 5000;
const PREFIX = "PerfSeed ";

const NEIGHBORHOODS = [
  "Mission",
  "Hayes Valley",
  "North Beach",
  "Soma",
  "Richmond",
  "Castro",
  "Marina",
  "Sunset",
];
const STATUSES = ["WISHLIST", "VISITED", "PLANNED"] as const;
const PRICE = ["LOW", "MID", "HIGH", "LUXE"] as const;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const { createId } = await import("@paralleldrive/cuid2");
  const { and, count, eq, like, sql } = await import("drizzle-orm");
  const { db, postgresClient } = await import("@/lib/db");
  const { restaurants, visitRatings, visits } = await import("@/db/schema");
  const { getBypassAuthContext } = await import("@/lib/auth-bypass");

  const { userId, householdId } = await getBypassAuthContext();

  const [existing] = await db
    .select({ n: count() })
    .from(restaurants)
    .where(
      and(
        eq(restaurants.householdId, householdId),
        like(restaurants.name, `${PREFIX}%`),
      ),
    );

  if (Number(existing?.n ?? 0) >= RESTAURANT_COUNT) {
    console.log(
      `Already seeded (${existing?.n} PerfSeed restaurants). Skipping insert.`,
    );
    console.log(`householdId=${householdId}`);
    await postgresClient.end({ timeout: 5 });
    return;
  }

  console.log(
    `Seeding ${RESTAURANT_COUNT} restaurants + ${VISIT_COUNT} visits for household ${householdId}…`,
  );

  const restaurantRows = Array.from({ length: RESTAURANT_COUNT }, (_, i) => {
    const lat = 37.75 + (i % 100) * 0.001;
    const lng = -122.45 + Math.floor(i / 100) * 0.001;
    return {
      id: createId(),
      householdId,
      name: `${PREFIX}${i + 1}`,
      priceRange: PRICE[i % PRICE.length]!,
      address: `${100 + i} Fake St`,
      lat: String(lat.toFixed(6)),
      lng: String(lng.toFixed(6)),
      neighborhood: NEIGHBORHOODS[i % NEIGHBORHOODS.length]!,
      status: STATUSES[i % STATUSES.length]!,
      supportsDineIn: true,
      supportsTakeout: i % 2 === 0,
      supportsDelivery: i % 3 === 0,
      toRevisit: i % 17 === 0,
      createdAt: new Date(Date.UTC(2024, 0, 1) + i * 60_000),
    };
  });

  for (const batch of chunk(restaurantRows, 200)) {
    await db.insert(restaurants).values(batch);
  }
  console.log(`Inserted ${restaurantRows.length} restaurants`);

  const visitRows = Array.from({ length: VISIT_COUNT }, (_, i) => {
    const restaurant = restaurantRows[i % restaurantRows.length]!;
    const dayOffset = i % 900;
    return {
      id: createId(),
      restaurantId: restaurant.id,
      householdId,
      visitDate: new Date(Date.UTC(2023, 0, 1) + dayOffset * 86_400_000),
      meal: (["BREAKFAST", "LUNCH", "DINNER"] as const)[i % 3]!,
      dineType: "DINE_IN" as const,
      status: (i % 11 === 0 ? "PLANNED" : "COMPLETED") as
        | "PLANNED"
        | "COMPLETED",
      totalPaid: i % 11 === 0 ? null : String((25 + (i % 80)).toFixed(2)),
      createdById: userId,
      createdAt: new Date(),
    };
  });

  for (const batch of chunk(visitRows, 250)) {
    await db.insert(visits).values(batch);
  }
  console.log(`Inserted ${visitRows.length} visits`);

  const ratingRows = visitRows
    .filter((v) => v.status === "COMPLETED" && Math.random() < 0.4)
    .map((v, i) => ({
      id: createId(),
      visitId: v.id,
      userId,
      overallRating: String((6 + (i % 40) / 10).toFixed(1)),
      food: 3 + (i % 3),
      wouldReturn: "YES" as const,
    }));

  for (const batch of chunk(ratingRows, 250)) {
    await db.insert(visitRatings).values(batch);
  }
  console.log(`Inserted ${ratingRows.length} ratings`);

  const [{ restaurants: rCount }] = await db.execute<{ restaurants: string }>(
    sql`SELECT count(*)::text AS restaurants FROM restaurants WHERE household_id = ${householdId} AND archived_at IS NULL`,
  );
  const [{ visits: vCount }] = await db.execute<{ visits: string }>(
    sql`SELECT count(*)::text AS visits FROM visits WHERE household_id = ${householdId}`,
  );

  console.log(
    `Done. Household totals: restaurants=${rCount}, visits=${vCount}`,
  );
  await postgresClient.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error(err);
  try {
    const { postgresClient } = await import("@/lib/db");
    await postgresClient.end({ timeout: 5 });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
