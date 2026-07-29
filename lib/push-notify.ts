import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, restaurants, visits } from "@/db/schema";

export type PushSendNotification = (
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  payload: string,
) => Promise<unknown>;

function configureVapid() {
  const subject = process.env.VAPID_SUBJECT?.trim();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function isGoneSubscription(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status =
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : null;
  // 404 / 410 = expired or unsubscribed (Web Push / FCM / Mozilla)
  return status === 404 || status === 410;
}

/**
 * Deliver "partner rated — add yours" via Web Push (HLD §6.3).
 * `sendNotification` is injectable for tests (mock web-push).
 */
export async function deliverPartnerRatingPush(
  visitId: string,
  partnerUserId: string,
  deps: { sendNotification?: PushSendNotification } = {},
): Promise<void> {
  const send =
    deps.sendNotification ??
    ((subscription, payload) =>
      webpush.sendNotification(subscription, payload));

  const [visit] = await db
    .select({
      restaurantName: restaurants.name,
    })
    .from(visits)
    .innerJoin(restaurants, eq(visits.restaurantId, restaurants.id))
    .where(eq(visits.id, visitId))
    .limit(1);

  const restaurantName = visit?.restaurantName ?? "a restaurant";
  const payload = JSON.stringify({
    title: "Our Table",
    body: `Your partner rated ${restaurantName} — add your rating.`,
    url: `/visits/${visitId}/rate`,
  });

  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, partnerUserId));

  if (subs.length === 0) return;

  if (!deps.sendNotification) {
    try {
      configureVapid();
    } catch (error) {
      console.warn("[push] VAPID not configured — skipping send", error);
      return;
    }
  }

  for (const sub of subs) {
    try {
      await send(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
    } catch (error) {
      if (isGoneSubscription(error)) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
        console.info("[push] removed expired subscription", sub.id);
        continue;
      }
      console.error("[push] sendNotification failed", sub.id, error);
    }
  }
}
