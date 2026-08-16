"use client";

import Image, { type ImageProps } from "next/image";
import { r2ImageLoader } from "@/lib/photo-url";

/** next/image is a Client Component; loaders cannot be passed from the server. */
export function R2Image(props: Omit<ImageProps, "loader">) {
  return <Image {...props} loader={r2ImageLoader} />;
}
