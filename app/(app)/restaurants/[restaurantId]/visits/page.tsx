import { listVisitsForRestaurant } from "@/lib/queries/visit-queries";
import { RestaurantTabs } from "@/components/restaurants/restaurant-tabs";
import { VisitTimeline } from "@/components/visits/visit-timeline";

export default async function RestaurantVisitsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const page = await listVisitsForRestaurant(restaurantId, { limit: 50 });

  return (
    <div className="space-y-4">
      <RestaurantTabs restaurantId={restaurantId} active="Visits" />
      <VisitTimeline restaurantId={restaurantId} visits={page.items} />
    </div>
  );
}
