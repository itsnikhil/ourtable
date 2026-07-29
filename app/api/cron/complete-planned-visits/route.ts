import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { visits } from "@/db/schema";
import { completeVisit } from "@/lib/actions/visit-actions";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * LLD §9.4 — internal cron: auto-complete planned visits 24h past due.
 * Auth: X-Internal-Token (not session).
 */
export async function POST(request: Request) {
  const expected = process.env.INTERNAL_CRON_TOKEN;
  const provided = request.headers.get("x-internal-token");

  if (!expected || !provided || provided !== expected) {
    return unauthorized();
  }

  const overdue = await db
    .select({ id: visits.id })
    .from(visits)
    .where(
      and(
        eq(visits.status, "PLANNED"),
        lt(visits.visitDate, sql`now() - interval '24 hours'`),
      ),
    );

  let transitioned = 0;
  for (const row of overdue) {
    const result = await completeVisit(
      { id: row.id, confirmed: false },
      { asSystem: true },
    );
    if (result.success) {
      transitioned += 1;
    } else {
      console.error("[cron/complete-planned-visits] failed", row.id, result);
    }
  }

  return Response.json({ transitioned });
}
