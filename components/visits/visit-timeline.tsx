import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/design/card";
import { R2Image } from "@/components/photos/r2-image";
import type { VisitListItem } from "@/lib/queries/visit-queries";

function formatVisitDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatEnumLabel(value: string) {
  if (!/^[A-Z0-9_]+$/.test(value)) return value;
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatSpend(totalPaid: string) {
  const amount = Number(totalPaid);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function visitMeta(visit: VisitListItem) {
  const parts = [visit.meal, visit.occasion]
    .filter((value): value is string => Boolean(value))
    .map(formatEnumLabel);
  if (parts.length > 0) return parts.join(" · ");
  return formatEnumLabel(visit.status);
}

export function VisitTimeline({
  restaurantId,
  visits,
}: {
  restaurantId: string;
  visits: VisitListItem[];
}) {
  return (
    <Card className="px-5 py-4">
      {visits.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No visits logged yet.
        </p>
      ) : (
        <ol className="relative before:bg-border before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:content-['']">
          {visits.map((visit) => (
            <VisitTimelineItem key={visit.id} visit={visit} />
          ))}
        </ol>
      )}
      <Link
        href={`/visits/new?restaurantId=${restaurantId}`}
        className="bg-nav-plus text-primary mt-2 flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-medium"
      >
        <Plus className="size-4" strokeWidth={2.25} aria-hidden />
        Log a new visit
      </Link>
    </Card>
  );
}

function VisitTimelineItem({ visit }: { visit: VisitListItem }) {
  const spend =
    visit.totalPaid != null ? formatSpend(visit.totalPaid) : null;
  const thumbs = visit.photoThumbnails;

  return (
    <li className="relative pb-8 last:pb-4">
      <span
        aria-hidden
        className="bg-primary ring-card absolute top-1.5 left-0 size-3 rounded-full ring-[3px]"
      />
      <Link href={`/visits/${visit.id}`} className="block pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-foreground font-semibold">
              {formatVisitDate(visit.visitDate)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {visitMeta(visit)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {visit.coupleAverageRating != null ? (
              <p className="text-success text-lg font-semibold tabular-nums">
                {visit.coupleAverageRating.toFixed(1)}
              </p>
            ) : null}
            {spend ? (
              <p className="text-foreground mt-0.5 text-sm tabular-nums">
                {spend}
              </p>
            ) : null}
          </div>
        </div>
        {thumbs.length > 0 ? (
          <ul className="mt-3 flex gap-2 overflow-x-auto">
            {thumbs.map((src) => (
              <li key={src} className="size-14 shrink-0 overflow-hidden rounded-lg">
                <R2Image
                  src={src}
                  alt=""
                  width={56}
                  height={56}
                  className="size-full object-cover"
                />
              </li>
            ))}
          </ul>
        ) : null}
      </Link>
    </li>
  );
}
