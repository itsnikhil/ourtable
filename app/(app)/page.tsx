import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  listUpcomingVisits,
  listVisitsMissingMyRating,
} from "@/lib/queries/visit-queries";
import { EnableNotificationsPrompt } from "@/components/push/enable-notifications-prompt";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function HomePage() {
  const session = await auth();
  const name = session?.user?.name?.split(" ")[0] ?? "there";
  const [missing, upcoming] = await Promise.all([
    listVisitsMissingMyRating(10),
    listUpcomingVisits(5),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="text-muted-foreground text-sm">Welcome, {name}.</p>
      </div>

      <EnableNotificationsPrompt />

      <div className="flex flex-wrap gap-2">
        <Link href="/visits/new" className={cn(buttonVariants())}>
          Log a visit
        </Link>
        <Link
          href="/visits/new?mode=plan"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Plan a visit
        </Link>
        <Link
          href="/restaurants/new"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Add restaurant
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight uppercase">
            Upcoming plans
          </h2>
          <Link
            href="/calendar"
            className="text-muted-foreground text-xs hover:underline"
          >
            Calendar
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No upcoming plans.{" "}
            <Link href="/visits/new?mode=plan" className="underline">
              Plan one
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {upcoming.map((visit) => (
              <li key={visit.id}>
                <Link
                  href={`/visits/${visit.id}`}
                  className="hover:bg-muted/50 flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">{visit.restaurantName}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(visit.visitDate)}
                      {visit.occasion ? ` · ${visit.occasion}` : ""}
                      {visit.meal ? ` · ${visit.meal}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium">View</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight uppercase">
            Needs your rating
          </h2>
          {missing.length > 0 ? (
            <span
              className="bg-primary text-primary-foreground inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums"
              aria-label={`${missing.length} visit${missing.length === 1 ? "" : "s"} need your rating`}
            >
              {missing.length}
            </span>
          ) : null}
        </div>

        {missing.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            You&apos;re caught up — no visits waiting for your review.
          </p>
        ) : (
          <ul className="divide-border divide-y text-sm">
            {missing.map((visit) => (
              <li key={visit.id}>
                <Link
                  href={`/visits/${visit.id}/rate`}
                  className="hover:bg-muted/50 flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">{visit.restaurantName}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(visit.visitDate)}
                      {visit.meal ? ` · ${visit.meal}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium">Rate</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
