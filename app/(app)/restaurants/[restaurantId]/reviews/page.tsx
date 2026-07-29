import Link from "next/link";
import { getRestaurantRatingComparison } from "@/lib/queries/rating-queries";
import { RestaurantTabs } from "@/components/restaurants/restaurant-tabs";

const CATEGORIES = [
  ["food", "Food"],
  ["service", "Service"],
  ["atmosphere", "Atmosphere"],
  ["value", "Value"],
  ["drinks", "Drinks"],
  ["presentation", "Presentation"],
  ["waitingTime", "Waiting"],
  ["cleanliness", "Cleanliness"],
] as const;

function formatScore(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toFixed(1);
}

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

export default async function RestaurantReviewsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const comparison = await getRestaurantRatingComparison(restaurantId);
  const users = comparison.perUserAverages;

  return (
    <div className="space-y-4">
      <RestaurantTabs restaurantId={restaurantId} active="Reviews" />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Reviews (side by side)
        </h1>
        <p className="text-muted-foreground text-sm">
          Averages across every visit at this restaurant.
        </p>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No ratings yet. Log a visit and leave a review.
        </p>
      ) : (
        <div className="space-y-4">
          <div
            className={
              users.length === 1
                ? "grid grid-cols-1 gap-4"
                : "grid grid-cols-2 gap-3"
            }
          >
            {users.map((u) => (
              <div key={u.userId} className="space-y-2">
                <h2 className="text-sm font-semibold">{u.displayName}</h2>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatScore(u.avgOverall)}
                  <span className="text-muted-foreground text-sm font-normal">
                    {" "}
                    / 10
                  </span>
                </p>
                <dl className="space-y-1 text-sm">
                  {CATEGORIES.map(([key, label]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2"
                    >
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="tabular-nums">
                        {formatScore(u.avgByCategory[key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="space-y-3 border-t pt-4">
        <h2 className="text-sm font-semibold tracking-tight uppercase">
          Recent reviews
        </h2>
        {comparison.recentReviews.length === 0 ? (
          <p className="text-muted-foreground text-sm">No review text yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {comparison.recentReviews.map((r) => {
              const author =
                users.find((u) => u.userId === r.userId)?.displayName ??
                "Partner";
              return (
                <li key={`${r.visitId}-${r.userId}`} className="space-y-1">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                    <span>{author}</span>
                    <span>·</span>
                    <span>{formatDate(r.visitDate)}</span>
                    <Link
                      href={`/visits/${r.visitId}`}
                      className="hover:underline"
                    >
                      View visit
                    </Link>
                  </div>
                  <p>{r.reviewText?.trim() || "(no text)"}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
