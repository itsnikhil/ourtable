import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/design/card";
import { RatingBadge } from "@/components/design/rating-badge";
import type { MapPinRestaurant } from "@/components/map/pin-utils";
import { R2Image } from "@/components/photos/r2-image";
import type { RestaurantDetail } from "@/lib/queries/restaurant-queries";

const PRICE_LABEL: Record<string, string> = {
  LOW: "$",
  MID: "$$",
  HIGH: "$$$",
  LUXE: "$$$$",
};

export function SelectedRestaurantCard({
  pin,
  detail,
}: {
  pin: MapPinRestaurant;
  detail: RestaurantDetail | null;
}) {
  const matched = detail?.id === pin.id ? detail : null;
  const cuisine =
    matched?.tags.find((t) => t.category === "FOOD_TYPE")?.name ?? null;
  const neighborhood = matched?.neighborhood ?? null;
  const placeLine = [cuisine, neighborhood].filter(Boolean).join(" • ");
  const price = matched?.priceRange
    ? (PRICE_LABEL[matched.priceRange] ?? matched.priceRange)
    : null;
  const photoUrl = matched?.primaryPhotoUrl ?? null;
  const rating = matched?.averageRating ?? pin.averageRating;

  return (
    <Card className="rounded-3xl p-3 shadow-card">
      <Link
        href={`/restaurants/${pin.id}`}
        className="flex items-center gap-3"
      >
        <span className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-xl">
          {photoUrl ? (
            <R2Image
              src={photoUrl}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{pin.name}</span>
          {placeLine ? (
            <span className="text-muted-foreground block truncate text-sm">
              {placeLine}
            </span>
          ) : null}
          {price ? (
            <span className="text-muted-foreground block truncate text-sm">
              {price}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <RatingBadge value={rating} />
          <ChevronRight
            className="text-muted-foreground size-5"
            aria-hidden
          />
        </span>
      </Link>
    </Card>
  );
}
