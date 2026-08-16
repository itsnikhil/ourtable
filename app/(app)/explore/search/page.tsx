import { RestaurantRow } from "@/components/design/restaurant-row";
import { ExploreSearchForm } from "@/components/explore/explore-search-form";
import { searchRestaurants } from "@/lib/queries/restaurant-queries";
import type { RestaurantSummary } from "@/lib/queries/restaurant-queries";

function cuisineMeta(restaurant: RestaurantSummary) {
  const cuisine = restaurant.tags
    .filter((t) => t.category === "FOOD_TYPE")
    .map((t) => t.name)
    .join(", ");
  const parts = [cuisine || null, restaurant.neighborhood].filter(Boolean);
  return parts.join(" • ") || undefined;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchRestaurants(query, 30) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <ExploreSearchForm defaultQuery={query} />
      {query ? (
        results.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No restaurants match “{query}”.
          </p>
        ) : (
          <ul>
            {results.map((restaurant) => (
              <li key={restaurant.id}>
                <RestaurantRow
                  href={`/restaurants/${restaurant.id}`}
                  name={restaurant.name}
                  photoUrl={restaurant.primaryPhotoUrl}
                  meta={cuisineMeta(restaurant)}
                  rating={restaurant.averageRating}
                />
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-muted-foreground text-sm">
          Search by restaurant name, cuisine, or dish.
        </p>
      )}
    </div>
  );
}
