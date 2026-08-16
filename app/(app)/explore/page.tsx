import Link from "next/link";
import { Bell } from "lucide-react";
import { SearchField } from "@/components/design/search-field";
import { RestaurantRow } from "@/components/design/restaurant-row";
import { CuisineCard } from "@/components/explore/cuisine-card";
import { ExploreFilters } from "@/components/explore/explore-filters";
import { listRestaurants } from "@/lib/queries/restaurant-queries";
import type { RestaurantSummary } from "@/lib/queries/restaurant-queries";

function cuisineMeta(restaurant: RestaurantSummary) {
  const cuisine = restaurant.tags
    .filter((t) => t.category === "FOOD_TYPE")
    .map((t) => t.name)
    .join(", ");
  const parts = [cuisine || null, restaurant.neighborhood].filter(Boolean);
  return parts.join(" • ") || undefined;
}

function groupByCuisine(items: RestaurantSummary[]) {
  const groups = new Map<
    string,
    { name: string; count: number; photoUrl: string | null }
  >();

  for (const item of items) {
    const names = item.tags
      .filter((t) => t.category === "FOOD_TYPE")
      .map((t) => t.name);
    for (const name of names) {
      const existing = groups.get(name);
      if (existing) {
        existing.count += 1;
        if (!existing.photoUrl && item.primaryPhotoUrl) {
          existing.photoUrl = item.primaryPhotoUrl;
        }
      } else {
        groups.set(name, {
          name,
          count: 1,
          photoUrl: item.primaryPhotoUrl,
        });
      }
    }
  }

  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    cuisine?: string;
    neighborhood?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const cuisine = params.cuisine?.trim() || undefined;
  const neighborhood = params.neighborhood?.trim() || undefined;

  const [browse, topRated] = await Promise.all([
    listRestaurants({ cuisine, neighborhood, limit: 100 }),
    listRestaurants({
      cuisine,
      neighborhood,
      sort: "rating_desc",
      limit: 10,
    }),
  ]);

  const cuisines = groupByCuisine(browse.items);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
        <Link
          href="/profile"
          className="text-foreground inline-flex size-10 items-center justify-center"
          aria-label="Notifications and profile"
        >
          <Bell className="size-5" aria-hidden />
        </Link>
      </div>

      <SearchField
        href="/explore/search"
        placeholder="Search cuisines, locations, dishes…"
      />

      <ExploreFilters />

      <section className="space-y-3" id="browse-by-cuisine">
        <h2 className="text-lg font-semibold">Browse by cuisine</h2>
        {cuisines.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No cuisine tags yet. Add restaurants to browse by food type.
          </p>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cuisines.map((c) => (
              <CuisineCard
                key={c.name}
                name={c.name}
                count={c.count}
                photoUrl={c.photoUrl}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Top rated</h2>
        {topRated.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Ratings will show here once visits are scored.
          </p>
        ) : (
          <ul>
            {topRated.items.map((restaurant, index) => (
              <li key={restaurant.id}>
                <RestaurantRow
                  href={`/restaurants/${restaurant.id}`}
                  name={restaurant.name}
                  photoUrl={restaurant.primaryPhotoUrl}
                  meta={cuisineMeta(restaurant)}
                  rating={restaurant.averageRating}
                  rank={index + 1}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
