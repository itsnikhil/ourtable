import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/design/card";
import { r2ImageLoader } from "@/lib/photo-url";
import type { VisitListItem } from "@/lib/queries/visit-queries";

function formatUpcomingWhen(iso: string) {
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (d.getHours() === 0 && d.getMinutes() === 0) return datePart;
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${datePart} • ${timePart}`;
  } catch {
    return iso;
  }
}

export function UpcomingReservationCard({ visit }: { visit: VisitListItem }) {
  const thumb = visit.photoThumbnails[0];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Upcoming Reservation</h2>
        <Link
          href="/calendar"
          className="text-muted-foreground inline-flex size-8 items-center justify-center"
          aria-label="Open calendar"
        >
          <ChevronDown className="size-5" aria-hidden />
        </Link>
      </div>
      <Link href={`/visits/${visit.id}`} className="block">
        <Card className="flex items-start gap-3">
          <span className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-xl">
            {thumb ? (
              <Image
                src={thumb}
                alt=""
                fill
                sizes="80px"
                loader={r2ImageLoader}
                className="object-cover"
                unoptimized
              />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {visit.restaurantName}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-sm">
              {formatUpcomingWhen(visit.visitDate)}
              {visit.meal
                ? ` • ${visit.meal.charAt(0)}${visit.meal.slice(1).toLowerCase()}`
                : ""}
            </span>
            {visit.status === "PLANNED" ? (
              <span className="bg-success/10 text-success mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium">
                Reservation confirmed
              </span>
            ) : null}
          </span>
        </Card>
      </Link>
    </section>
  );
}
