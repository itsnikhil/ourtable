import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/visits", label: "Visits" },
  { href: "/menu", label: "Menu Highlights" },
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
    <nav className="-mx-1 flex gap-4 overflow-x-auto border-b border-border text-sm">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const isActive = tab.label === active;
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "shrink-0 border-b-2 -mb-px py-1.5 whitespace-nowrap",
              isActive
                ? "border-primary text-primary font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
