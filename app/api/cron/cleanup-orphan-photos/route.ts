import { cleanupOrphanPhotos } from "@/lib/photo-cleanup";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Internal cron — garbage-collect R2 objects with no Photo row after 24h.
 * Auth: X-Internal-Token (same as planned-visit cron).
 */
export async function POST(request: Request) {
  const expected = process.env.INTERNAL_CRON_TOKEN;
  const provided = request.headers.get("x-internal-token");

  if (!expected || !provided || provided !== expected) {
    return unauthorized();
  }

  try {
    const result = await cleanupOrphanPhotos();
    return Response.json(result);
  } catch (error) {
    console.error("[cron/cleanup-orphan-photos]", error);
    return Response.json({ error: "Cleanup failed." }, { status: 500 });
  }
}
