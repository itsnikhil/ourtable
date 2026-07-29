import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function r2RemotePatterns(): NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> {
  const patterns: NonNullable<
    NonNullable<NextConfig["images"]>["remotePatterns"]
  > = [
    {
      protocol: "https",
      hostname: "*.r2.cloudflarestorage.com",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "*.r2.dev",
      pathname: "/**",
    },
  ];

  const publicUrl = process.env.R2_PUBLIC_URL?.trim();
  if (publicUrl) {
    try {
      const { protocol, hostname } = new URL(publicUrl);
      if (protocol === "https:" || protocol === "http:") {
        patterns.unshift({
          protocol: protocol.replace(":", "") as "http" | "https",
          hostname,
          pathname: "/**",
        });
      }
    } catch {
      /* ignore invalid R2_PUBLIC_URL */
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  turbopack: {
    // Parent dirs may have other lockfiles; pin this app as the Turbopack root.
    root: projectRoot,
  },
  images: {
    remotePatterns: r2RemotePatterns(),
  },
};

export default nextConfig;
