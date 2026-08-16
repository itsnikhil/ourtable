import { getRestaurantLabelForVisit } from "@/lib/actions/visit-picker-actions";
import { AddVisitWizard } from "@/components/visits/add-visit-wizard";

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
    <AddVisitWizard
      preselectedRestaurant={preselected}
      initialMode={initialMode}
      initialDate={date}
      backHref={preselected ? `/restaurants/${preselected.id}` : "/calendar"}
    />
  );
}
