import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/visits", label: "Visits" },
  { href: "/menu", label: "Menu" },
  { href: "/photos", label: "Photos" },
  { href: "/reviews", label: "Reviews" },
  { href: "/info", label: "Info" },
] as const;

export function RestaurantTabs({
  restaurantId,
  active,
}: {
  restaurantId: string;
  active: (typeof TABS)[number]["label"];
}) {
  const base = `/restaurants/${restaurantId}`;

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 text-sm">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const isActive = tab.label === active;
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "shrink-0 rounded-lg px-2.5 py-1.5 whitespace-nowrap",
              isActive
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
