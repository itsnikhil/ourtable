"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { attachPhoto, removePhoto } from "@/lib/actions/photo-actions";
import { PhotoCarouselModal } from "@/components/photos/photo-carousel-modal";
import { R2Image } from "@/components/photos/r2-image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const EXT_TO_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export type GalleryPhoto = {
  id: string;
  url: string;
  /** When present, shown as a small uploader mark (NFR-11). */
  uploadedByName?: string;
};

type Target =
  | { visitId: string; restaurantId?: never }
  | { restaurantId: string; visitId?: never };

function resolveContentType(file: File): string | null {
  if (ALLOWED_TYPES.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? (EXT_TO_TYPE[ext] ?? null) : null;
}

/**
 * Automatically converts HEIC/HEIF files to standard JPEG using heic2any
 * on the client before upload so images render universally on all platforms.
 */
async function prepareFileForUpload(
  file: File,
  onStatusChange?: (msg: string) => void,
): Promise<File> {
  const isHeic =
    file.type.toLowerCase().includes("heic") ||
    file.type.toLowerCase().includes("heif") ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  if (!isHeic) return file;

  try {
    onStatusChange?.("Converting HEIC…");
    const heic2anyModule = await import("heic2any");
    const heic2any = heic2anyModule.default ?? heic2anyModule;
    const conversionResult = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });

    const blob = Array.isArray(conversionResult)
      ? conversionResult[0]
      : conversionResult;

    if (blob) {
      const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
      return new File([blob], newName, { type: "image/jpeg" });
    }
  } catch (err) {
    console.error("[heic2any conversion error]", err);
  }

  return file;
}

async function requestAndPut(file: File): Promise<string> {
  const contentType = resolveContentType(file) ?? "image/jpeg";
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Photo must be 15MB or smaller.");
  }

  const res = await fetch("/api/uploads/photo", {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-file-name": encodeURIComponent(file.name || "photo.jpg"),
    },
    body: file,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : "Upload to storage failed.",
    );
  }

  const { objectUrl } = (await res.json()) as { objectUrl: string };
  return objectUrl;
}

export function PhotoGallery({
  photos,
  target,
}: {
  photos: GalleryPhoto[];
  target: Target;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState("Uploading…");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(
    null,
  );

  const busy = pending || uploading;

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    setError(null);
    setUploading(true);
    setStatusText("Uploading…");
    try {
      const processedFile = await prepareFileForUpload(file, setStatusText);
      setStatusText("Saving to cloud…");
      const objectUrl = await requestAndPut(processedFile);
      const result = await attachPhoto({
        objectUrl,
        ...target,
      });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onRemove(id: string) {
    if (!window.confirm("Remove this photo?")) return;
    setError(null);
    startTransition(async () => {
      const result = await removePhoto({ id });
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {photos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No photos yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="group relative aspect-square">
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex(index)}
                aria-label={`View photo ${index + 1} in full`}
                className="relative block size-full cursor-zoom-in overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <R2Image
                  src={photo.url}
                  alt={
                    photo.uploadedByName
                      ? `Photo uploaded by ${photo.uploadedByName}`
                      : ""
                  }
                  fill
                  sizes="(max-width: 640px) 33vw, 160px"
                  className="rounded-2xl object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </button>

              {photo.uploadedByName ? (
                <span
                  title={`Uploaded by ${photo.uploadedByName}`}
                  aria-label={`Uploaded by ${photo.uploadedByName}`}
                  className="pointer-events-none absolute bottom-1 left-1 inline-flex size-6 items-center justify-center rounded-full bg-surface-inverse/80 text-[10px] font-medium text-surface-inverse-foreground"
                >
                  {photo.uploadedByName.slice(0, 1).toUpperCase()}
                </span>
              ) : null}

              <button
                type="button"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(photo.id);
                }}
                className={cn(
                  "absolute top-1 right-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                  "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                  "disabled:opacity-40",
                )}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
          capture="environment"
          className="sr-only"
          disabled={busy}
          onChange={(e) => void onPick(e.target.files)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          {uploading ? statusText : "Add photo"}
        </button>
        {busy && !uploading ? (
          <span className="text-muted-foreground text-xs">Saving…</span>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {selectedPhotoIndex !== null ? (
        <PhotoCarouselModal
          photos={photos}
          initialIndex={selectedPhotoIndex}
          onClose={() => setSelectedPhotoIndex(null)}
        />
      ) : null}
    </div>
  );
}
