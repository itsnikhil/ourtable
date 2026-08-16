import Link from "next/link";
import { AddRestaurantForm } from "@/components/restaurants/add-restaurant-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NewRestaurantPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl">
            Add restaurant
          </h1>
          <p className="text-muted-foreground text-sm">
            Create a shared place for your household.
          </p>
        </div>
        <Link
          href="/explore"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Cancel
        </Link>
      </div>
      <AddRestaurantForm />
    </div>
  );
}
