import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchField({
  href = "/explore/search",
  placeholder = "Search restaurants, cuisines, or dishes…",
  className,
}: {
  href?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "border-border bg-card text-muted-foreground flex h-11 items-center gap-2 rounded-xl border px-3 text-sm",
        className,
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{placeholder}</span>
    </Link>
  );
}
