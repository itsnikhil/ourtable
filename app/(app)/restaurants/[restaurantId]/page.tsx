import { notFound } from "next/navigation";
import { getRestaurantDetail } from "@/lib/queries/restaurant-queries";
import { RestaurantOverview } from "@/components/restaurants/restaurant-overview";
import { RestaurantTabs } from "@/components/restaurants/restaurant-tabs";

export default async function RestaurantOverviewPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await getRestaurantDetail(restaurantId);
  if (!restaurant) notFound();

  return (
    <RestaurantOverview
      restaurant={restaurant}
      tabs={
        <RestaurantTabs restaurantId={restaurant.id} active="Overview" />
      }
    />
  );
}
