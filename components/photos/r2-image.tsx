"use client";

import Image, { type ImageProps } from "next/image";
import { photoThumbnailUrl } from "@/lib/photo-url";

/**
 * Image component for R2 assets that resolves private storage endpoints
 * to authenticated /api/photos/ stream paths.
 */
export function R2Image({ src, ...props }: ImageProps) {
  const resolvedSrc =
    typeof src === "string" ? photoThumbnailUrl(src) : src;
  return <Image {...props} src={resolvedSrc} unoptimized />;
}
