import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getVisitDetail } from "@/lib/queries/visit-queries";
import { PlannedVisitActions } from "@/components/visits/planned-visit-actions";
import { VisitDetailIconStrip } from "@/components/visits/visit-detail-icon-strip";
import { VisitDetailPhotos } from "@/components/visits/visit-detail-photos";
import { Card } from "@/components/design/card";
import { personColorForMember } from "@/lib/design/person-colors";

const MEAL_LABEL: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
};

const SPLIT_LABEL: Record<string, string> = {
  EQUAL: "Split equally",
  INDIVIDUAL: "Individual",
  ONE_PAID: "One paid",
};

function hasMoney(value: string | null | undefined) {
  return value != null && value !== "";
}

function money(value: string | null | undefined) {
  if (!hasMoney(value)) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : value;
}

function formatVisitDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatVisitTime(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const visit = await getVisitDetail(visitId);
  if (!visit) notFound();

  const dateTime = [
    formatVisitDate(visit.visitDate),
    visit.visitTime ? formatVisitTime(visit.visitTime) : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const mealOccasion = [visit.meal ? (MEAL_LABEL[visit.meal] ?? visit.meal) : null, visit.occasion]
    .filter(Boolean)
    .join(" • ");

  const showBill =
    hasMoney(visit.subtotal) || hasMoney(visit.tip) || hasMoney(visit.totalPaid);

  return (
    <div className="space-y-4">
      <Link
        href={`/restaurants/${visit.restaurantId}`}
        className="text-muted-foreground text-sm hover:underline"
      >
        ← {visit.restaurantName}
      </Link>

      <Card className="rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-sm">{dateTime}</p>
            <h1 className="text-xl font-semibold leading-tight">
              {mealOccasion ||
                (visit.status === "PLANNED" ? "Planned visit" : "Completed visit")}
            </h1>
          </div>
          {visit.status === "COMPLETED" ? (
            <Link
              href={`/visits/${visit.id}/rate`}
              className="text-success shrink-0 text-sm font-medium"
            >
              Rate
            </Link>
          ) : null}
        </div>

        <div className="mt-4">
          <VisitDetailIconStrip
            dineType={visit.dineType}
            partySize={visit.partySize}
            status={visit.status}
            seating={visit.seating}
          />
        </div>

        {visit.status === "PLANNED" ? (
          <div className="mt-5">
            <PlannedVisitActions
              visitId={visit.id}
              visitDate={visit.visitDate}
              visitTime={visit.visitTime}
            />
          </div>
        ) : null}

        {showBill ? (
          <section className="mt-5 space-y-3">
            <h2 className="text-base font-semibold">Bill</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{money(visit.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tip</dt>
                <dd className="tabular-nums">{money(visit.tip)}</dd>
              </div>
              <div className="flex justify-between gap-3 font-semibold">
                <dt>Total Paid</dt>
                <dd className="tabular-nums">{money(visit.totalPaid)}</dd>
              </div>
            </dl>
            {visit.paymentSplit || visit.paymentMethod ? (
              <div className="flex items-center justify-between gap-3">
                {visit.paymentSplit === "EQUAL" ? (
                  <span className="bg-success/10 text-success rounded-full px-2.5 py-0.5 text-xs font-medium">
                    Split equally
                  </span>
                ) : visit.paymentSplit ? (
                  <span className="text-muted-foreground text-xs">
                    {SPLIT_LABEL[visit.paymentSplit] ?? visit.paymentSplit}
                  </span>
                ) : (
                  <span />
                )}
                {visit.paymentMethod ? (
                  <span className="text-muted-foreground text-sm">
                    {visit.paymentMethod}
                  </span>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="mt-5">
          <VisitDetailPhotos photos={visit.photos} visitId={visit.id} />
        </div>

        <Link
          href={`/visits/${visit.id}/items`}
          className="mt-5 flex items-center justify-between gap-3"
        >
          <span className="text-base font-semibold">Ordered items</span>
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            {visit.orderedItems.length
              ? `${visit.orderedItems.length}`
              : null}
            <ChevronRight className="size-5" aria-hidden />
          </span>
        </Link>

        {visit.status === "COMPLETED" ? (
          <section className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Ratings</h2>
              <Link
                href={`/visits/${visit.id}/rate`}
                className="text-success text-sm font-medium"
              >
                Rate
              </Link>
            </div>
            {visit.ratings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No ratings yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-4">
                {visit.ratings.map((r) => {
                  const color = personColorForMember({ id: r.userId });
                  return (
                    <li key={r.id}>
                      <span
                        className="text-lg font-semibold tabular-nums"
                        style={{ color: color.cssVar }}
                      >
                        {r.overallRating.toFixed(1)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}
      </Card>
    </div>
  );
}
