import type { ImageLoader } from "next/image";

/**
 * Thumbnail convention for R2 object URLs (HLD §6.6 follow-up).
 * Appends `?width=` so a future Cloudflare Images / Worker transform can
 * honor it. R2 itself does not resize today — full object is still fetched.
 */
export function photoThumbnailUrl(objectUrl: string, width: number): string {
  try {
    const url = new URL(objectUrl);
    url.searchParams.set("width", String(width));
    return url.toString();
  } catch {
    const join = objectUrl.includes("?") ? "&" : "?";
    return `${objectUrl}${join}width=${width}`;
  }
}

export const r2ImageLoader: ImageLoader = ({ src, width }) =>
  photoThumbnailUrl(src, width);
