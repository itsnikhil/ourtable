import { ChevronRight } from "lucide-react";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { R2Image } from "@/components/photos/r2-image";
import type { PhotoDto } from "@/lib/queries/photo-queries";

const VISIBLE = 4;

export function VisitDetailPhotos({
  photos,
  visitId,
}: {
  photos: PhotoDto[];
  visitId: string;
}) {
  const overflow = Math.max(0, photos.length - VISIBLE);
  const thumbs = photos.slice(0, VISIBLE);

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">
        Photos{photos.length ? ` (${photos.length})` : ""}
      </h2>
      {thumbs.length > 0 ? (
        <div className="flex items-center gap-2">
          <ul className="flex min-w-0 flex-1 gap-2 overflow-hidden">
            {thumbs.map((photo, i) => {
              const isOverflowThumb = overflow > 0 && i === thumbs.length - 1;
              return (
                <li
                  key={photo.id}
                  className="bg-muted relative aspect-square min-w-0 flex-1 overflow-hidden rounded-xl"
                >
                  <R2Image
                    src={photo.url}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                  {isOverflowThumb ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                      +{overflow}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <ChevronRight
            className="text-muted-foreground size-5 shrink-0"
            aria-hidden
          />
        </div>
      ) : null}
      <PhotoGallery photos={photos} target={{ visitId }} />
    </section>
  );
}
