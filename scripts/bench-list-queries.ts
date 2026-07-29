/**
 * Benchmarks listRestaurants / listRestaurantsForMap at NFR-1 scale.
 *
 * Usage:
 *   DATABASE_URL_HOST=postgresql://ourtable:ourtable@localhost:5433/ourtable \
 *     npx tsx scripts/bench-list-queries.ts
 */
process.env.AUTH_BYPASS = "true";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  process.env.DATABASE_URL ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";

import { config } from "dotenv";
config({ path: ".env", override: false });
process.env.DATABASE_URL =
  process.env.DATABASE_URL_HOST ??
  process.env.DATABASE_URL ??
  "postgresql://ourtable:ourtable@localhost:5433/ourtable";
process.env.AUTH_BYPASS = "true";

async function timeMs(fn: () => Promise<unknown>, runs = 5): Promise<number[]> {
  const samples: number[] = [];
  await fn();
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  return samples;
}

function fmt(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const max = sorted[sorted.length - 1]!;
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    medianMs: Math.round(median),
    avgMs: Math.round(avg),
    maxMs: Math.round(max),
    samples: samples.map((s) => Math.round(s)),
  };
}

async function main() {
  const { and, count, eq, isNull, sql } = await import("drizzle-orm");
  const { db, postgresClient } = await import("@/lib/db");
  const { restaurants, visits } = await import("@/db/schema");
  const { getBypassAuthContext } = await import("@/lib/auth-bypass");

  const { householdId } = await getBypassAuthContext();

  const [rRow] = await db
    .select({ n: count() })
    .from(restaurants)
    .where(
      and(
        eq(restaurants.householdId, householdId),
        isNull(restaurants.archivedAt),
      ),
    );
  const [vRow] = await db
    .select({ n: count() })
    .from(visits)
    .where(eq(visits.householdId, householdId));

  console.log(
    `Scale: restaurants=${rRow?.n ?? 0}, visits=${vRow?.n ?? 0} (household ${householdId})`,
  );

  const { listRestaurants, listRestaurantsForMap } = await import(
    "@/lib/queries/restaurant-queries"
  );

  const cases: Array<{ name: string; run: () => Promise<unknown> }> = [
    {
      name: "listRestaurants (recent, limit 20)",
      run: () => listRestaurants({ sort: "recent", limit: 20 }),
    },
    {
      name: "listRestaurants (name_asc, limit 20)",
      run: () => listRestaurants({ sort: "name_asc", limit: 20 }),
    },
    {
      name: "listRestaurants (rating_desc, limit 20)",
      run: () => listRestaurants({ sort: "rating_desc", limit: 20 }),
    },
    {
      name: "listRestaurantsForMap (no bounds)",
      run: () => listRestaurantsForMap(),
    },
    {
      name: "listRestaurantsForMap (SF bounds)",
      run: () =>
        listRestaurantsForMap({
          north: 37.82,
          south: 37.7,
          east: -122.35,
          west: -122.52,
        }),
    },
  ];

  console.log("\n--- Query timings (5 runs after 1 warmup) ---");
  for (const c of cases) {
    const samples = await timeMs(c.run);
    const stats = fmt(samples);
    const ok = stats.maxMs < 1000 ? "OK" : "SLOW";
    console.log(
      `${ok}  ${c.name}: median=${stats.medianMs}ms avg=${stats.avgMs}ms max=${stats.maxMs}ms samples=${JSON.stringify(stats.samples)}`,
    );
  }

  try {
    const listQ = await import("@/lib/queries/list");
    console.log(
      "\nSmart lists: list queries module exports:",
      Object.keys(listQ).join(", ") || "(none)",
    );
    if ("listQueriesStub" in listQ) {
      console.log(
        "Smart-list query functions: NOT IMPLEMENTED (listQueriesStub only) — skipped.",
      );
    }
  } catch {
    console.log("\nSmart-list queries: module missing — skipped.");
  }

  console.log("\n--- EXPLAIN ANALYZE (map restaurant fetch) ---");
  const explainMap = await db.execute(sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id, name, status, lat, lng
    FROM restaurants
    WHERE household_id = ${householdId}
      AND archived_at IS NULL
      AND lat IS NOT NULL
      AND lng IS NOT NULL
  `);
  const mapLines = Array.isArray(explainMap)
    ? explainMap
    : ((explainMap as { rows?: unknown[] }).rows ?? []);
  for (const row of mapLines as Array<Record<string, string>>) {
    console.log(Object.values(row)[0]);
  }

  console.log(
    "\n--- EXPLAIN ANALYZE (visit aggregates for all restaurants) ---",
  );
  const explainAgg = await db.execute(sql`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT restaurant_id, count(id), max(visit_date)
    FROM visits
    WHERE restaurant_id IN (
      SELECT id FROM restaurants
      WHERE household_id = ${householdId} AND archived_at IS NULL
    )
      AND status = 'COMPLETED'
    GROUP BY restaurant_id
  `);
  const aggLines = Array.isArray(explainAgg)
    ? explainAgg
    : ((explainAgg as { rows?: unknown[] }).rows ?? []);
  for (const row of aggLines as Array<Record<string, string>>) {
    console.log(Object.values(row)[0]);
  }

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
