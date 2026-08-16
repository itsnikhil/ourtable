import { personColorForMember } from "@/lib/design/person-colors";
import { cn } from "@/lib/utils";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function PersonAvatar({
  name,
  imageUrl,
  index,
  id,
  size = "md",
  className,
}: {
  name: string;
  imageUrl?: string | null;
  index?: number | null;
  id?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const color = personColorForMember({ index, id });
  const dim =
    size === "sm" ? "size-8 text-[10px]" : size === "lg" ? "size-14 text-lg" : "size-10 text-xs";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-card",
        dim,
        className,
      )}
      style={{ boxShadow: `0 0 0 2px ${color.cssVar}` }}
      title={name}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- design primitive, URL may be remote or data
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <span style={{ color: color.cssVar }}>{initialsFromName(name)}</span>
      )}
    </span>
  );
}

export function PersonBadge({
  name,
  imageUrl,
  index,
  id,
  size = "md",
  className,
}: {
  name: string;
  imageUrl?: string | null;
  index?: number | null;
  id?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const color = personColorForMember({ index, id });

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PersonAvatar
        name={name}
        imageUrl={imageUrl}
        index={index}
        id={id}
        size={size}
      />
      <span
        className="text-sm font-medium"
        style={{ color: color.cssVar }}
      >
        {name}
      </span>
    </span>
  );
}
