"use client";

import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { r2ImageLoader } from "@/lib/photo-url";
import { cn } from "@/lib/utils";
import type { RestaurantDetail } from "@/lib/queries/restaurant-queries";

const PRICE_LABEL: Record<string, string> = {
  LOW: "$",
  MID: "$$",
  HIGH: "$$$",
  LUXE: "$$$$",
};

function mapsHref(restaurant: RestaurantDetail): string | null {
  if (restaurant.lat && restaurant.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${restaurant.lat},${restaurant.lng}`,
    )}`;
  }
  if (restaurant.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      restaurant.address,
    )}`;
  }
  return null;
}

export function RestaurantOverview({
  restaurant,
}: {
  restaurant: RestaurantDetail;
}) {
  const cuisineTags = restaurant.tags.filter((t) => t.category === "FOOD_TYPE");
  const vibeTags = restaurant.tags.filter((t) => t.category === "VIBE");
  const directions = mapsHref(restaurant);
  const ratingLabel =
    restaurant.averageRating != null
      ? restaurant.averageRating.toFixed(1)
      : "—";

  async function onShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: restaurant.name, url });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }

  const features = [
    restaurant.supportsDineIn && "Dine-in",
    restaurant.supportsTakeout && "Takeout",
    restaurant.supportsDelivery && "Delivery",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <div className="bg-muted relative aspect-[16/10] w-full overflow-hidden rounded-xl">
        {restaurant.primaryPhotoUrl ? (
          <Image
            src={restaurant.primaryPhotoUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            loader={r2ImageLoader}
            className="object-cover"
            priority
            unoptimized
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center text-sm">
            No photo yet
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {restaurant.name}
        </h1>
        {cuisineTags.length > 0 ? (
          <p className="text-muted-foreground text-sm">
            {cuisineTags.map((t) => t.name).join(" · ")}
          </p>
        ) : null}
        <p className="text-sm">
          <span className="font-medium">
            {restaurant.averageRating != null
              ? `${ratingLabel} / 10`
              : "No rating yet"}
          </span>
          <span className="text-muted-foreground">
            {" "}
            avg · {restaurant.visitCount} visit
            {restaurant.visitCount === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {restaurant.website ? (
          <a
            href={restaurant.website}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Website
          </a>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none opacity-40",
            )}
          >
            Website
          </span>
        )}
        {directions ? (
          <a
            href={directions}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Directions
          </a>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none opacity-40",
            )}
          >
            Directions
          </span>
        )}
        {restaurant.phone ? (
          <a
            href={`tel:${restaurant.phone}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Call
          </a>
        ) : (
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "pointer-events-none opacity-40",
            )}
          >
            Call
          </span>
        )}
        <button
          type="button"
          onClick={onShare}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Share
        </button>
        <span
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "pointer-events-none opacity-40",
          )}
          title="Save / to-revisit wiring comes with a later pass"
        >
          Save
        </span>
      </div>

      <section className="space-y-3 border-t pt-4">
        <h2 className="text-sm font-semibold tracking-tight uppercase">
          At a glance
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Cuisine</dt>
          <dd>
            {cuisineTags.length
              ? cuisineTags.map((t) => t.name).join(", ")
              : "—"}
          </dd>
          <dt className="text-muted-foreground">Price</dt>
          <dd>
            {restaurant.priceRange
              ? PRICE_LABEL[restaurant.priceRange] ?? restaurant.priceRange
              : "—"}
          </dd>
          <dt className="text-muted-foreground">Neighborhood</dt>
          <dd>{restaurant.neighborhood ?? "—"}</dd>
          <dt className="text-muted-foreground">Best for</dt>
          <dd>
            {vibeTags.length ? vibeTags.map((t) => t.name).join(", ") : "—"}
          </dd>
          <dt className="text-muted-foreground">Features</dt>
          <dd>{features.length ? features.join(" · ") : "—"}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{restaurant.status}</dd>
        </dl>
        {restaurant.notes ? (
          <p className="text-muted-foreground text-sm">{restaurant.notes}</p>
        ) : null}
        <Link
          href={`/visits/new?restaurantId=${restaurant.id}`}
          className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
        >
          Log a visit
        </Link>
      </section>
    </div>
  );
}
