import { cn } from "@/lib/utils";

export function RatingBadge({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) {
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex min-w-10 items-center justify-center rounded-lg border border-border px-1.5 py-1 text-sm tabular-nums",
          className,
        )}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-success inline-flex min-w-10 items-center justify-center rounded-lg border border-success/30 bg-success/5 px-1.5 py-1 text-sm font-semibold tabular-nums",
        className,
      )}
    >
      {value.toFixed(1)}
    </span>
  );
}
