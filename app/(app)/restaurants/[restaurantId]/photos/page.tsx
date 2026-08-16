import { notFound } from "next/navigation";
import { getRestaurantDetail } from "@/lib/queries/restaurant-queries";
import { listPhotosForRestaurant } from "@/lib/queries/photo-queries";
import { RestaurantTabs } from "@/components/restaurants/restaurant-tabs";
import { PhotoGallery } from "@/components/photos/photo-gallery";

export default async function RestaurantPhotosPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await getRestaurantDetail(restaurantId);
  if (!restaurant) notFound();

  const photos = await listPhotosForRestaurant(restaurantId);

  return (
    <div className="space-y-4">
      <RestaurantTabs restaurantId={restaurantId} active="Photos" />
      <div className="space-y-3">
        <h1 className="font-heading text-2xl">Photos</h1>
        <p className="text-muted-foreground text-sm">
          Cover and restaurant shots. These also feed the Overview hero.
        </p>
        <PhotoGallery
          photos={photos}
          target={{ restaurantId: restaurant.id }}
        />
      </div>
    </div>
  );
}
