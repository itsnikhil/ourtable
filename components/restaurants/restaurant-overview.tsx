"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  Globe,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  Share,
  UtensilsCrossed,
} from "lucide-react";
import { Card } from "@/components/design/card";
import { RatingBadge } from "@/components/design/rating-badge";
import { RatingStars } from "@/components/design/rating-stars";
import { TagChip } from "@/components/design/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { r2ImageLoader } from "@/lib/photo-url";
import type { RestaurantDetail } from "@/lib/queries/restaurant-queries";
import { cn } from "@/lib/utils";

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

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function osmEmbedSrc(lat: number, lng: number): string {
  const delta = 0.008;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
}

function HeroAction({
  href,
  label,
  icon,
  disabled,
  onClick,
}: {
  href?: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "h-9 w-full gap-1 border-white/80 bg-white/10 px-1.5 text-[0.7rem] text-white hover:bg-white/20 hover:text-white",
    disabled && "pointer-events-none opacity-40",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {icon}
        {label}
      </button>
    );
  }

  if (href && !disabled) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={className}
      >
        {icon}
        {label}
      </a>
    );
  }

  return (
    <span className={className}>
      {icon}
      {label}
    </span>
  );
}

export function RestaurantOverview({
  restaurant,
  tabs,
}: {
  restaurant: RestaurantDetail;
  tabs?: ReactNode;
}) {
  const cuisineTags = restaurant.tags.filter((t) => t.category === "FOOD_TYPE");
  const cuisineLine = (
    cuisineTags.length > 0 ? cuisineTags : restaurant.tags
  )
    .map((t) => t.name)
    .join(" • ");
  const directions = mapsHref(restaurant);
  const lat = parseCoord(restaurant.lat);
  const lng = parseCoord(restaurant.lng);
  const hasCoords = lat != null && lng != null;

  const features = [
    restaurant.supportsDineIn && "Dine-in",
    restaurant.supportsTakeout && "Takeout",
    restaurant.supportsDelivery && "Delivery",
  ].filter(Boolean) as string[];

  const priceLabel = restaurant.priceRange
    ? (PRICE_LABEL[restaurant.priceRange] ?? restaurant.priceRange)
    : null;
  const featureLine = [priceLabel, ...features].filter(Boolean).join(" • ");

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

  return (
    <div className="-mx-4 -mt-6">
      <div className="bg-surface-inverse relative min-h-[26rem] overflow-hidden">
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
        ) : null}
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 flex min-h-[26rem] flex-col">
          <div className="flex items-center justify-between px-2 pt-2">
            <Link
              href="/explore"
              className="text-surface-inverse-foreground inline-flex size-10 items-center justify-center"
              aria-label="Back"
            >
              <ChevronLeft className="size-6" />
            </Link>
            <div className="flex items-center">
              <Link
                href={`/restaurants/${restaurant.id}/edit`}
                className="text-surface-inverse-foreground inline-flex size-10 items-center justify-center"
                aria-label="Edit restaurant"
              >
                <Pencil className="size-5" />
              </Link>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <h1 className="text-surface-inverse-foreground text-3xl font-semibold tracking-tight">
              {restaurant.name}
            </h1>
            {cuisineLine ? (
              <p className="text-surface-inverse-foreground/80 mt-1.5 text-sm">
                {cuisineLine}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-3 px-4 pb-20">
            <HeroAction
              href={restaurant.website ?? undefined}
              label="Website"
              icon={<Globe className="size-3.5" />}
              disabled={!restaurant.website}
            />
            <HeroAction
              href={directions ?? undefined}
              label="Directions"
              icon={<Navigation className="size-3.5" />}
              disabled={!directions}
            />
            <HeroAction
              href={restaurant.phone ? `tel:${restaurant.phone}` : undefined}
              label="Call"
              icon={<Phone className="size-3.5" />}
              disabled={!restaurant.phone}
            />
            <HeroAction
              label="Share"
              icon={<Share className="size-3.5" />}
              onClick={onShare}
            />
          </div>
        </div>
      </div>

      <div className="relative -mt-6 rounded-t-[32px] bg-card px-4 pt-16 pb-8">
        <Card className="absolute inset-x-4 -top-12 flex items-center gap-4 py-4">
          <RatingBadge
            value={restaurant.averageRating}
            className="min-w-0 border-0 bg-transparent px-0 py-0 text-4xl font-bold"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">Average Couple Rating</p>
            <RatingStars
              value={restaurant.averageRating ?? 0}
              scale="overall"
              size="sm"
              className="mt-0.5 [&>span:last-child]:hidden"
            />
            <p className="text-muted-foreground mt-0.5 text-xs">
              {restaurant.visitCount} visit
              {restaurant.visitCount === 1 ? "" : "s"}
            </p>
          </div>
        </Card>

        {tabs}

        <div className="mt-4 space-y-5">
          {restaurant.address ? (
            <div className="flex items-start gap-4 text-sm">
              <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <p>{restaurant.address}</p>
                {restaurant.neighborhood ? (
                  <p className="text-muted-foreground text-xs">
                    {restaurant.neighborhood}
                  </p>
                ) : null}
              </div>
            </div>
          ) : restaurant.neighborhood ? (
            <div className="flex items-start gap-4 text-sm">
              <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <p>{restaurant.neighborhood}</p>
            </div>
          ) : null}

          {featureLine ? (
            <div className="flex items-start gap-4 text-sm">
              <UtensilsCrossed className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <p>{featureLine}</p>
            </div>
          ) : null}

          {restaurant.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {restaurant.tags.map((tag) => (
                <TagChip
                  key={tag.id}
                  name={tag.name}
                  category={tag.category}
                />
              ))}
            </div>
          ) : null}

          {restaurant.notes ? (
            <p className="text-muted-foreground text-sm">{restaurant.notes}</p>
          ) : null}

          {hasCoords ? (
            <div className="bg-muted relative mt-2 overflow-hidden rounded-2xl">
              <iframe
                title={`Map of ${restaurant.name}`}
                src={osmEmbedSrc(lat, lng)}
                className="h-40 w-full border-0"
                loading="lazy"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
