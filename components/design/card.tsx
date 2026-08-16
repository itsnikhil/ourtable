import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  inverse = false,
  children,
  ...props
}: ComponentProps<"div"> & { inverse?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4 shadow-card",
        inverse
          ? "bg-surface-inverse text-surface-inverse-foreground"
          : "bg-card text-card-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
