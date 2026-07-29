/**
 * Worker scheduler (HLD §7 / LLD §9.4 / HLD §6.6).
 *
 * Jobs:
 * 1. complete-planned-visits — hourly (M4)
 * 2. cleanup-orphan-photos — daily (M6)
 *
 * Startup: retry with exponential backoff if `app` isn't ready yet.
 */
import cron from "node-cron";
import { runOrphanPhotoCleanup } from "./cleanup-orphan-photos";

const APP_URL = (process.env.APP_URL ?? "http://app:3000").replace(/\/$/, "");
const TOKEN = process.env.INTERNAL_CRON_TOKEN ?? "";
const CRON_PLANNED = process.env.CRON_COMPLETE_PLANNED ?? "0 * * * *";
/** Daily at 04:00 UTC — cleanup is not urgent. */
const CRON_ORPHAN_PHOTOS = process.env.CRON_CLEANUP_ORPHAN_PHOTOS ?? "0 4 * * *";
const PLANNED_ENDPOINT = `${APP_URL}/api/cron/complete-planned-visits`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hitCompletePlannedVisits(label: string) {
  if (!TOKEN) {
    console.error("[worker] INTERNAL_CRON_TOKEN is missing — skipping", label);
    return;
  }

  const res = await fetch(PLANNED_ENDPOINT, {
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

/** Retry when app isn't accepting connections yet (startup race). */
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
  orphanPhotos: {
    endpoint: `${APP_URL}/api/cron/cleanup-orphan-photos`,
    cron: CRON_ORPHAN_PHOTOS,
  },
});

void withBackoff("startup-planned", () =>
  hitCompletePlannedVisits("startup-planned"),
);

cron.schedule(CRON_PLANNED, () => {
  void withBackoff("hourly-planned", () =>
    hitCompletePlannedVisits("hourly-planned"),
  );
});

cron.schedule(CRON_ORPHAN_PHOTOS, () => {
  void withBackoff("daily-orphan-photos", async () => {
    await runOrphanPhotoCleanup("daily-orphan-photos");
  });
});
