import Link from "next/link";
import { RatingBadge } from "@/components/design/rating-badge";
import { R2Image } from "@/components/photos/r2-image";
import { cn } from "@/lib/utils";

export function RestaurantRow({
  href,
  name,
  photoUrl,
  meta,
  rating,
  rank,
  className,
}: {
  href: string;
  name: string;
  photoUrl?: string | null;
  meta?: string;
  rating?: number | null;
  rank?: number;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-3 py-2", className)}>
      {rank != null ? (
        <span className="w-5 shrink-0 text-sm font-semibold tabular-nums">
          {rank}
        </span>
      ) : null}
      <span className="bg-muted relative size-14 shrink-0 overflow-hidden rounded-xl">
        {photoUrl ? (
          <R2Image
            src={photoUrl}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name}</span>
        {meta ? (
          <span className="text-muted-foreground block truncate text-sm">
            {meta}
          </span>
        ) : null}
      </span>
      <RatingBadge value={rating} />
    </Link>
  );
}
