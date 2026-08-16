import Link from "next/link";
import { auth } from "@/lib/auth";
import { getHouseholdMembers } from "@/lib/queries/household";
import {
  listUpcomingVisits,
  listVisitsInRange,
  listVisitsMissingMyRating,
} from "@/lib/queries/visit-queries";
import { EnableNotificationsPrompt } from "@/components/push/enable-notifications-prompt";
import { Card } from "@/components/design/card";
import { PersonAvatar } from "@/components/design/person-avatar";
import { RestaurantRow } from "@/components/design/restaurant-row";
import { SearchField } from "@/components/design/search-field";
import { QuickActions } from "@/components/home/quick-actions";
import { UpcomingReservationCard } from "@/components/home/upcoming-reservation-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function firstName(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? name;
}

function greetingPrefix() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatRecentMeta(iso: string, meal: string | null) {
  let datePart = iso;
  try {
    datePart = new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    /* keep iso */
  }
  const mealPart = meal
    ? meal.charAt(0) + meal.slice(1).toLowerCase()
    : null;
  return mealPart ? `${datePart} • ${mealPart}` : datePart;
}

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

function rangeLastDays(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function HomePage() {
  const session = await auth();
  const { start, end } = rangeLastDays(90);
  const [members, missing, upcoming, ranged] = await Promise.all([
    getHouseholdMembers(),
    listVisitsMissingMyRating(10),
    listUpcomingVisits(5),
    listVisitsInRange(start, end),
  ]);

  const featured = upcoming[0];
  const recent = ranged
    .filter((visit) => visit.status === "COMPLETED")
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
    .slice(0, 5);

  const names = members.map((m) => firstName(m.displayName)).filter(Boolean);
  const fallback = session?.user?.name ? firstName(session.user.name) : null;
  const greetingNames =
    names.length >= 2
      ? `${names[0]} & ${names[1]}`
      : names[0] ?? fallback ?? "there";

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-2xl leading-tight font-semibold">
          {greetingPrefix()}, {greetingNames}
        </h1>
        {members.length > 0 ? (
          <div className="flex shrink-0 items-center">
            {members.slice(0, 2).map((member, index) => (
              <PersonAvatar
                key={member.id}
                name={member.displayName}
                imageUrl={member.avatarUrl}
                index={index}
                className={index > 0 ? "relative z-0 -ml-2.5" : "relative z-10"}
              />
            ))}
          </div>
        ) : null}
      </header>

      <SearchField href="/explore/search" />

      <EnableNotificationsPrompt />

      {featured ? <UpcomingReservationCard visit={featured} /> : null}

      <QuickActions />

      {recent.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recently Visited</h2>
            <Link
              href="/calendar"
              className="text-muted-foreground text-sm hover:underline"
            >
              View all
            </Link>
          </div>
          <ul>
            {recent.map((visit) => (
              <li key={visit.id}>
                <RestaurantRow
                  href={`/visits/${visit.id}`}
                  name={visit.restaurantName}
                  photoUrl={visit.photoThumbnails[0]}
                  meta={formatRecentMeta(visit.visitDate, visit.meal)}
                  rating={visit.coupleAverageRating}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {missing.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Needs your rating</h2>
            <span
              className="bg-primary text-primary-foreground inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums"
              aria-label={`${missing.length} visit${missing.length === 1 ? "" : "s"} need your rating`}
            >
              {missing.length}
            </span>
          </div>
          <ul className="space-y-3">
            {missing.map((visit) => (
              <li key={visit.id}>
                <Link href={`/visits/${visit.id}/rate`}>
                  <Card className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {visit.restaurantName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDate(visit.visitDate)}
                        {visit.meal
                          ? ` · ${visit.meal.charAt(0)}${visit.meal.slice(1).toLowerCase()}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={cn(buttonVariants({ size: "xs" }), "shrink-0")}
                    >
                      Rate
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
