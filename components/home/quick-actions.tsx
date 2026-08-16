import Link from "next/link";
import { CalendarPlus, ClipboardList, List, UtensilsCrossed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTIONS = [
  {
    href: "/restaurants/new",
    label: "Add Restaurant",
    Icon: UtensilsCrossed,
  },
  {
    href: "/visits/new?mode=plan",
    label: "Plan a Visit",
    Icon: CalendarPlus,
  },
  {
    href: "/visits/new",
    label: "Log a Visit",
    Icon: ClipboardList,
  },
  {
    href: "/lists",
    label: "Lists",
    Icon: List,
  },
] as const;

export function QuickActions() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Quick Actions</h2>
      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-auto min-h-[5.5rem] w-full flex-col gap-2 rounded-xl px-1.5 py-3 whitespace-normal text-center text-xs leading-tight font-medium",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
