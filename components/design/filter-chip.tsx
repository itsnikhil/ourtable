import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function FilterChip({
  children,
  active = false,
  className,
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 rounded-lg border px-3 py-1.5 text-sm",
        active
          ? "border-success text-success bg-card"
          : "border-border bg-card text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
