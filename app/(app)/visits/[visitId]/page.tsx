import Link from "next/link";
import { notFound } from "next/navigation";
import { getVisitDetail } from "@/lib/queries/visit-queries";
import { PlannedVisitActions } from "@/components/visits/planned-visit-actions";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function money(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : value;
}

function formatVisitDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const visit = await getVisitDetail(visitId);
  if (!visit) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href={`/restaurants/${visit.restaurantId}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← {visit.restaurantName}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {formatVisitDate(visit.visitDate)}
        </h1>
        <p className="text-muted-foreground text-sm">
          {[visit.meal, visit.dineType, visit.occasion]
            .filter(Boolean)
            .join(" · ") ||
            (visit.status === "PLANNED" ? "Planned visit" : "Completed visit")}
          {visit.visitTime ? ` · ${visit.visitTime}` : ""}
        </p>
      </div>

      {visit.status === "PLANNED" ? (
        <PlannedVisitActions
          visitId={visit.id}
          visitDate={visit.visitDate}
          visitTime={visit.visitTime}
        />
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight uppercase">
          Visit info
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd>{visit.status}</dd>
          <dt className="text-muted-foreground">Logged by</dt>
          <dd>{visit.createdByName}</dd>
          <dt className="text-muted-foreground">Party size</dt>
          <dd>{visit.partySize ?? "—"}</dd>
          <dt className="text-muted-foreground">Seating</dt>
          <dd>{visit.seating ?? "—"}</dd>
          <dt className="text-muted-foreground">Couple avg</dt>
          <dd>
            {visit.coupleAverageRating != null
              ? visit.coupleAverageRating.toFixed(1)
              : "—"}
          </dd>
        </dl>
      </section>

      {visit.status === "COMPLETED" ? (
        <>
          <section className="space-y-2 border-t pt-4">
            <h2 className="text-sm font-semibold tracking-tight uppercase">
              Bill
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{money(visit.subtotal)}</dd>
              <dt className="text-muted-foreground">Tip</dt>
              <dd>{money(visit.tip)}</dd>
              <dt className="text-muted-foreground">Total</dt>
              <dd>{money(visit.totalPaid)}</dd>
              <dt className="text-muted-foreground">Split</dt>
              <dd>{visit.paymentSplit ?? "—"}</dd>
              <dt className="text-muted-foreground">Method</dt>
              <dd>{visit.paymentMethod ?? "—"}</dd>
            </dl>
          </section>

          <section className="space-y-3 border-t pt-4">
            <h2 className="text-sm font-semibold tracking-tight uppercase">
              Ordered items
            </h2>
            {visit.orderedItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">No dishes logged.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {visit.orderedItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium">{item.dishName}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.shared ? "Shared" : "Individual"}
                        {item.wouldOrderAgain ? " · would order again" : ""}
                      </p>
                    </div>
                    <span className="tabular-nums">{money(item.price)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 border-t pt-4">
            <h2 className="text-sm font-semibold tracking-tight uppercase">
              Photos
            </h2>
            <PhotoGallery photos={visit.photos} target={{ visitId: visit.id }} />
          </section>

          <section className="space-y-2 border-t pt-4">
            <h2 className="text-sm font-semibold tracking-tight uppercase">
              Ratings
            </h2>
            {visit.ratings.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No ratings yet for this visit.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {visit.ratings.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span className="text-muted-foreground truncate text-xs">
                      {r.userId.slice(0, 8)}…
                      {r.wouldReturn ? ` · ${r.wouldReturn}` : ""}
                    </span>
                    <span className="font-medium tabular-nums">
                      {r.overallRating.toFixed(1)} / 10
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/visits/${visit.id}/rate`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {visit.ratings.length ? "Edit your rating" : "Rate this visit"}
            </Link>
          </section>
        </>
      ) : null}
    </div>
  );
}
