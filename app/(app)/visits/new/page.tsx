import Link from "next/link";
import { getRestaurantLabelForVisit } from "@/lib/actions/visit-picker-actions";
import { AddVisitWizard } from "@/components/visits/add-visit-wizard";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{
    restaurantId?: string;
    mode?: string;
    date?: string;
  }>;
}) {
  const { restaurantId, mode, date } = await searchParams;
  const initialMode = mode === "plan" ? "plan" : "log";
  const preselected = restaurantId
    ? await getRestaurantLabelForVisit(restaurantId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {initialMode === "plan" ? "Plan a visit" : "Log a visit"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {initialMode === "plan"
              ? "Pick a restaurant and a future date. You can reschedule or cancel anytime."
              : "Record what happened — restaurant, dishes, bill, then your review."}
          </p>
        </div>
        <Link
          href={preselected ? `/restaurants/${preselected.id}` : "/calendar"}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Cancel
        </Link>
      </div>
      <AddVisitWizard
        preselectedRestaurant={preselected}
        initialMode={initialMode}
        initialDate={date}
      />
    </div>
  );
}
