/**
 * Worker-side entry for R2 orphan photo cleanup (HLD §6.6).
 * Hits the app's internal cron route so R2 + DB stay in the app container.
 */
const APP_URL = (process.env.APP_URL ?? "http://app:3000").replace(/\/$/, "");
const TOKEN = process.env.INTERNAL_CRON_TOKEN ?? "";
const ENDPOINT = `${APP_URL}/api/cron/cleanup-orphan-photos`;

export async function runOrphanPhotoCleanup(label = "orphan-photos") {
  if (!TOKEN) {
    throw new Error("INTERNAL_CRON_TOKEN is missing");
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-Internal-Token": TOKEN,
      Accept: "application/json",
    },
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  console.log(`[worker] ${label} ok`, body);
  return body;
}
