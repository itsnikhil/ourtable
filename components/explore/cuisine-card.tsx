import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/design/card";
import { r2ImageLoader } from "@/lib/photo-url";

export function CuisineCard({
  name,
  count,
  photoUrl,
}: {
  name: string;
  count: number;
  photoUrl?: string | null;
}) {
  const places = count === 1 ? "1 place" : `${count} places`;

  return (
    <Link
      href={`/explore?cuisine=${encodeURIComponent(name)}`}
      className="shrink-0"
    >
      <Card className="relative h-44 w-32 overflow-hidden p-0">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt=""
            fill
            sizes="128px"
            loader={r2ImageLoader}
            className="object-cover"
            unoptimized
          />
        ) : (
          <span className="bg-muted absolute inset-0" aria-hidden />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-10 pb-3">
          <span className="block truncate text-sm font-semibold text-white">
            {name}
          </span>
          <span className="block text-xs text-white/80">{places}</span>
        </span>
      </Card>
    </Link>
  );
}
