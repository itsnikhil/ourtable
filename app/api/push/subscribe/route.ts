import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/db/schema";
import { AuthContextError } from "@/lib/errors";
import { pushRouteAuth } from "@/lib/push-route-auth";
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from "@/lib/validations/push";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * LLD §9.2 — upsert a Web Push subscription for the current user.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await pushRouteAuth.requireAuthContext();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = pushSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid subscription object.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { endpoint, keys } = parsed.data;

    const [existing] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(pushSubscriptions)
        .set({
          userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
        })
        .where(eq(pushSubscriptions.id, existing.id))
        .returning({ id: pushSubscriptions.id });
      return Response.json({ id: updated.id });
    }

    const [created] = await db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      })
      .returning({ id: pushSubscriptions.id });

    return Response.json({ id: created.id });
  } catch (error) {
    if (error instanceof AuthContextError) {
      return unauthorized();
    }
    console.error("[api/push/subscribe POST]", error);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/**
 * LLD §9.2 — remove a subscription by endpoint for the current user.
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await pushRouteAuth.requireAuthContext();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = pushUnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid subscription object.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, parsed.data.endpoint),
          eq(pushSubscriptions.userId, userId),
        ),
      );

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthContextError) {
      return unauthorized();
    }
    console.error("[api/push/subscribe DELETE]", error);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
