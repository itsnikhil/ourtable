import { ComingSoon } from "@/components/layout/coming-soon";
import { RestaurantTabs } from "@/components/restaurants/restaurant-tabs";

export default async function Page({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return (
    <div className="space-y-4">
      <RestaurantTabs restaurantId={restaurantId} active="Info" />
      <ComingSoon title="Info" description="Address, hours, and contact details." />
    </div>
  );
}
