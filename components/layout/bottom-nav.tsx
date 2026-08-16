"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Compass, Home, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";

const sideItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/calendar", label: "Timeline", icon: Calendar },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-card/95 fixed inset-x-0 bottom-0 z-40 shadow-card backdrop-blur">
      <ul className="relative mx-auto flex max-w-lg items-end justify-between px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {sideItems.slice(0, 2).map((item) => (
          <SideItem key={item.href} item={item} pathname={pathname} />
        ))}

        <li className="flex w-16 shrink-0 justify-center">
          <Link
            href="/visits/new"
            aria-label="Add a visit"
            className="bg-nav-plus text-nav-plus-foreground shadow-card -mt-7 flex size-14 items-center justify-center rounded-full"
          >
            <Plus className="size-7" strokeWidth={2.25} aria-hidden />
          </Link>
        </li>

        {sideItems.slice(2).map((item) => (
          <SideItem key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}

function SideItem({
  item,
  pathname,
}: {
  item: (typeof sideItems)[number];
  pathname: string;
}) {
  const active =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <li className="flex flex-1 justify-center">
      <Link
        href={item.href}
        className={cn(
          "flex min-w-14 flex-col items-center gap-1 py-1 text-[10px] font-medium",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <item.icon
          className="size-5"
          aria-hidden
          strokeWidth={active ? 2.4 : 1.75}
        />
        <span className={cn(active && "underline decoration-2 underline-offset-4")}>
          {item.label}
        </span>
      </Link>
    </li>
  );
}
