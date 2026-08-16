"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { attachPhoto, removePhoto } from "@/lib/actions/photo-actions";
import { r2ImageLoader } from "@/lib/photo-url";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const EXT_TO_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
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

async function requestAndPut(file: File): Promise<string> {
  const contentType = resolveContentType(file);
  if (!contentType) {
    throw new Error("Use JPEG, PNG, WebP, or HEIC.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Photo must be 15MB or smaller.");
  }

  const signed = await fetch("/api/uploads/photo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      fileName: file.name || "photo.jpg",
      contentType,
      fileSizeBytes: file.size,
    }),
  });

  if (!signed.ok) {
    const body = await signed.json().catch(() => ({}));
    throw new Error(
      typeof body.error === "string" ? body.error : "Could not get upload URL.",
    );
  }

  const { uploadUrl, objectUrl } = (await signed.json()) as {
    uploadUrl: string;
    objectUrl: string;
  };

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) {
    throw new Error("Upload to storage failed.");
  }

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

  const busy = pending || uploading;

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    setError(null);
    setUploading(true);
    try {
      const objectUrl = await requestAndPut(file);
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
          {photos.map((photo) => (
            <li key={photo.id} className="group relative aspect-square">
              <Image
                src={photo.url}
                alt={
                  photo.uploadedByName
                    ? `Photo uploaded by ${photo.uploadedByName}`
                    : ""
                }
                fill
                sizes="(max-width: 640px) 33vw, 160px"
                loader={r2ImageLoader}
                className="rounded-2xl object-cover"
                unoptimized
              />
              {photo.uploadedByName ? (
                <span
                  title={`Uploaded by ${photo.uploadedByName}`}
                  aria-label={`Uploaded by ${photo.uploadedByName}`}
                  className="absolute bottom-1 left-1 inline-flex size-6 items-center justify-center rounded-full bg-surface-inverse/80 text-[10px] font-medium text-surface-inverse-foreground"
                >
                  {photo.uploadedByName.slice(0, 1).toUpperCase()}
                </span>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(photo.id)}
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
          accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic"
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
          {uploading ? "Uploading…" : "Add photo"}
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
    </div>
  );
}
