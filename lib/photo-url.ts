import type { ImageLoader } from "next/image";

/**
 * Transforms an object URL into a browser-fetchable URL.
 * If the URL points to a private S3 endpoint (*.r2.cloudflarestorage.com),
 * it routes through the authenticated /api/photos/[...key] endpoint.
 */
export function photoThumbnailUrl(objectUrl: string, width?: number): string {
  if (!objectUrl || typeof objectUrl !== "string") return "";

  let resolvedUrl = objectUrl;

  try {
    const parsed = new URL(objectUrl);
    if (parsed.hostname.endsWith(".r2.cloudflarestorage.com")) {
      const match = parsed.pathname.match(/\/(households\/.+)$/);
      if (match?.[1]) {
        const cleanPath = match[1].replace(/^\/+/, "").replace(/\/+/g, "/");
        resolvedUrl = `/api/photos/${cleanPath}`;
      }
    }
  } catch {
    if (objectUrl.includes(".r2.cloudflarestorage.com")) {
      const match = objectUrl.match(/\/(households\/.+?)(\?|$)/);
      if (match?.[1]) {
        const cleanPath = match[1].replace(/^\/+/, "").replace(/\/+/g, "/");
        resolvedUrl = `/api/photos/${cleanPath}`;
      }
    }
  }

  if (width !== undefined && width > 0) {
    const join = resolvedUrl.includes("?") ? "&" : "?";
    return `${resolvedUrl}${join}width=${width}`;
  }

  return resolvedUrl;
}

export const r2ImageLoader: ImageLoader = ({ src, width }) =>
  photoThumbnailUrl(src, width);
