import {
  Bike,
  CalendarCheck,
  CircleCheck,
  House,
  ShoppingBag,
  Users,
  Utensils,
} from "lucide-react";

const DINE_LABEL: Record<string, string> = {
  DINE_IN: "Dine-in",
  DELIVERY: "Delivery",
  TAKEOUT: "Takeout",
};

export function VisitDetailIconStrip({
  dineType,
  partySize,
  status,
  seating,
}: {
  dineType: string | null;
  partySize: number | null;
  status: string;
  seating: string | null;
}) {
  const items: { icon: typeof Utensils; label: string }[] = [];

  if (dineType === "DELIVERY") {
    items.push({ icon: Bike, label: DINE_LABEL.DELIVERY });
  } else if (dineType === "TAKEOUT") {
    items.push({ icon: ShoppingBag, label: DINE_LABEL.TAKEOUT });
  } else if (dineType === "DINE_IN") {
    items.push({ icon: Utensils, label: DINE_LABEL.DINE_IN });
  }

  if (partySize != null) {
    items.push({
      icon: Users,
      label: `${partySize} ${partySize === 1 ? "Person" : "People"}`,
    });
  }

  if (status === "PLANNED") {
    items.push({ icon: CalendarCheck, label: "Reservation" });
  } else if (status === "COMPLETED") {
    items.push({ icon: CircleCheck, label: "Completed" });
  }

  if (seating) {
    items.push({ icon: House, label: seating });
  }

  if (items.length === 0) return null;

  return (
    <ul className="border-border flex justify-around gap-2 border-y py-4">
      {items.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center"
        >
          <Icon className="text-muted-foreground size-5" aria-hidden />
          <span className="text-muted-foreground truncate text-xs">{label}</span>
        </li>
      ))}
    </ul>
  );
}
