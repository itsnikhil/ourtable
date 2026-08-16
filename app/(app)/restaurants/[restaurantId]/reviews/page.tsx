import Link from "next/link";
import { getRestaurantRatingComparison } from "@/lib/queries/rating-queries";
import { RestaurantTabs } from "@/components/restaurants/restaurant-tabs";
import { Card } from "@/components/design/card";
import { PersonAvatar } from "@/components/design/person-avatar";
import {
  RatingComparisonRow,
  ratingComparisonGridCols,
} from "@/components/design/rating-comparison-row";
import { RatingStars } from "@/components/design/rating-stars";
import { personColorForMember } from "@/lib/design/person-colors";

const CATEGORIES = [
  ["food", "Food"],
  ["service", "Service"],
  ["atmosphere", "Atmosphere"],
  ["value", "Value"],
  ["drinks", "Drinks"],
  ["presentation", "Presentation"],
  ["waitingTime", "Waiting Time"],
  ["cleanliness", "Cleanliness"],
] as const;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function figuresFor(
  users: { userId: string; displayName: string; score: number | null }[],
) {
  return users.map((u, index) => ({
    label: u.displayName,
    score: u.score,
    index,
    id: u.userId,
  }));
}

export default async function RestaurantReviewsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const comparison = await getRestaurantRatingComparison(restaurantId);
  const users = comparison.perUserAverages;
  const overalls = users
    .map((u) => u.avgOverall)
    .filter((n): n is number => n != null && Number.isFinite(n));
  const coupleAverage =
    overalls.length === 0
      ? null
      : overalls.reduce((sum, n) => sum + n, 0) / overalls.length;

  return (
    <div className="space-y-4">
      <RestaurantTabs restaurantId={restaurantId} active="Reviews" />

      {users.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No ratings yet. Log a visit and leave a review.
        </p>
      ) : (
        <Card className="space-y-3 p-4">
          <div
            className="grid items-end gap-x-3"
            style={{
              gridTemplateColumns: ratingComparisonGridCols(users.length),
            }}
          >
            <p className="text-muted-foreground text-xs">
              Averages across visits
            </p>
            {users.map((u, index) => {
              const color = personColorForMember({ index, id: u.userId });
              return (
                <div
                  key={u.userId}
                  className="flex flex-col items-center gap-1 text-center"
                >
                  <PersonAvatar
                    name={u.displayName}
                    index={index}
                    id={u.userId}
                    size="sm"
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: color.cssVar }}
                  >
                    {u.displayName}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="divide-border divide-y">
            <RatingComparisonRow
              label="Overall"
              showBars={false}
              figures={figuresFor(
                users.map((u) => ({
                  userId: u.userId,
                  displayName: u.displayName,
                  score: u.avgOverall,
                })),
              )}
              max={10}
            />
            {CATEGORIES.map(([key, label]) => (
              <RatingComparisonRow
                key={key}
                label={label}
                showBars={false}
                max={5}
                figures={figuresFor(
                  users.map((u) => ({
                    userId: u.userId,
                    displayName: u.displayName,
                    score: u.avgByCategory[key],
                  })),
                )}
              />
            ))}
          </div>

          <div className="bg-muted flex items-center justify-between gap-3 rounded-xl px-4 py-3">
            <p className="text-sm font-medium">Average Couple Rating</p>
            <div className="flex flex-col items-end">
              <p className="text-success text-3xl font-semibold tabular-nums">
                {coupleAverage == null ? "—" : coupleAverage.toFixed(1)}
              </p>
              {coupleAverage != null ? (
                <RatingStars
                  value={coupleAverage}
                  scale="overall"
                  size="sm"
                  className="gap-0 [&>span:last-child]:hidden"
                />
              ) : null}
            </div>
          </div>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Recent reviews
        </h2>
        {comparison.recentReviews.length === 0 ? (
          <p className="text-muted-foreground text-sm">No review text yet.</p>
        ) : (
          <ul className="space-y-3">
            {comparison.recentReviews.map((r) => {
              const authorIndex = users.findIndex((u) => u.userId === r.userId);
              const author =
                users.find((u) => u.userId === r.userId)?.displayName ??
                "Partner";
              const color = personColorForMember({
                index: authorIndex >= 0 ? authorIndex : 0,
                id: r.userId,
              });
              return (
                <li key={`${r.visitId}-${r.userId}`} className="space-y-1">
                  <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                    <span style={{ color: color.cssVar }}>{author}</span>
                    <span>·</span>
                    <span>{formatDate(r.visitDate)}</span>
                    <Link
                      href={`/visits/${r.visitId}`}
                      className="hover:underline"
                    >
                      View visit
                    </Link>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {r.reviewText?.trim() || "(no text)"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
