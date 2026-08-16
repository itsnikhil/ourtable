import Link from "next/link";
import { notFound } from "next/navigation";
import { AddRestaurantForm } from "@/components/restaurants/add-restaurant-form";
import { buttonVariants } from "@/components/ui/button";
import { getRestaurantDetail } from "@/lib/queries/restaurant-queries";
import { cn } from "@/lib/utils";

export default async function EditRestaurantPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await getRestaurantDetail(restaurantId);
  if (!restaurant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl">Edit restaurant</h1>
          <p className="text-muted-foreground text-sm">
            Update shared details for this place.
          </p>
        </div>
        <Link
          href={`/restaurants/${restaurant.id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Cancel
        </Link>
      </div>
      <AddRestaurantForm restaurant={restaurant} />
    </div>
  );
}
