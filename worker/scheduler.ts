/**
 * Worker scheduler (HLD §7 / LLD §9.4 / HLD §6.6).
 *
 * Single file on purpose — no relative .ts imports (Node ESM vs Next typecheck).
 *
 * Jobs:
 * 1. complete-planned-visits — hourly (M4)
 * 2. cleanup-orphan-photos — daily (M6)
 */
import cron from "node-cron";

const APP_URL = (process.env.APP_URL ?? "http://app:3000").replace(/\/$/, "");
const TOKEN = process.env.INTERNAL_CRON_TOKEN ?? "";
const CRON_PLANNED = process.env.CRON_COMPLETE_PLANNED ?? "0 * * * *";
const CRON_ORPHAN_PHOTOS = process.env.CRON_CLEANUP_ORPHAN_PHOTOS ?? "0 4 * * *";
const PLANNED_ENDPOINT = `${APP_URL}/api/cron/complete-planned-visits`;
const ORPHAN_ENDPOINT = `${APP_URL}/api/cron/cleanup-orphan-photos`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postCron(endpoint: string, label: string) {
  if (!TOKEN) {
    console.error("[worker] INTERNAL_CRON_TOKEN is missing — skipping", label);
    return;
  }

  const res = await fetch(endpoint, {
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
}

async function withBackoff(
  label: string,
  fn: () => Promise<void>,
  maxAttempts = 8,
) {
  let delayMs = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[worker] ${label} attempt ${attempt}/${maxAttempts} failed: ${msg}`,
      );
      if (attempt === maxAttempts) {
        console.error(`[worker] ${label} giving up until next schedule`);
        return;
      }
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 60_000);
    }
  }
}

console.log("[worker] scheduler starting", {
  planned: { endpoint: PLANNED_ENDPOINT, cron: CRON_PLANNED },
  orphanPhotos: { endpoint: ORPHAN_ENDPOINT, cron: CRON_ORPHAN_PHOTOS },
});

if (!cron.validate(CRON_PLANNED)) {
  console.error("[worker] invalid CRON_COMPLETE_PLANNED:", CRON_PLANNED);
  process.exit(1);
}
if (!cron.validate(CRON_ORPHAN_PHOTOS)) {
  console.error(
    "[worker] invalid CRON_CLEANUP_ORPHAN_PHOTOS:",
    CRON_ORPHAN_PHOTOS,
  );
  process.exit(1);
}

void withBackoff("startup-planned", () =>
  postCron(PLANNED_ENDPOINT, "startup-planned"),
);

cron.schedule(CRON_PLANNED, () => {
  void withBackoff("hourly-planned", () =>
    postCron(PLANNED_ENDPOINT, "hourly-planned"),
  );
});

cron.schedule(CRON_ORPHAN_PHOTOS, () => {
  void withBackoff("daily-orphan-photos", () =>
    postCron(ORPHAN_ENDPOINT, "daily-orphan-photos"),
  );
});
