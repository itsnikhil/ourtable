import Link from "next/link";
import { listVisitsForRestaurant } from "@/lib/queries/visit-queries";
import { RestaurantTabs } from "@/components/restaurants/restaurant-tabs";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatVisitDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function RestaurantVisitsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const page = await listVisitsForRestaurant(restaurantId, { limit: 50 });

  return (
    <div className="space-y-4">
      <RestaurantTabs restaurantId={restaurantId} active="Visits" />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Visits</h1>
        <Link
          href={`/visits/new?restaurantId=${restaurantId}`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Log a visit
        </Link>
      </div>
      {page.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No visits logged yet.</p>
      ) : (
        <ul className="divide-border divide-y text-sm">
          {page.items.map((visit) => (
            <li key={visit.id}>
              <Link
                href={`/visits/${visit.id}`}
                className="hover:bg-muted/50 flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{formatVisitDate(visit.visitDate)}</p>
                  <p className="text-muted-foreground text-xs">
                    {[visit.meal, visit.occasion].filter(Boolean).join(" · ") ||
                      visit.status}
                  </p>
                </div>
                <span className="text-muted-foreground tabular-nums text-xs">
                  {visit.totalPaid != null
                    ? `$${Number(visit.totalPaid).toFixed(2)}`
                    : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
