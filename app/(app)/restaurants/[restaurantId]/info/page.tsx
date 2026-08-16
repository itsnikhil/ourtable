import { ComingSoon } from "@/components/layout/coming-soon";
import { Card } from "@/components/design/card";
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
      <Card className="rounded-[20px]">
        <ComingSoon
          title="Info"
          description="Address, hours, and contact details."
        />
      </Card>
    </div>
  );
}
