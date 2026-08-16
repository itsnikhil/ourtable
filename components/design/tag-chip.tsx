import { chipColorForTag } from "@/lib/design/chip-colors";
import { cn } from "@/lib/utils";

export function TagChip({
  name,
  category,
  className,
}: {
  name: string;
  category?: string | null;
  className?: string;
}) {
  const color = chipColorForTag({ name, category });

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        className,
      )}
      style={{ backgroundColor: color.background, color: color.foreground }}
    >
      {name}
    </span>
  );
}
