import { S3Client } from "@aws-sdk/client-s3";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

/** Cloudflare account id for R2 S3 endpoint (32-char hex). */
export function getR2AccountId(): string {
  const fromEnv = process.env.R2_ACCOUNT_ID?.trim();
  if (fromEnv && !fromEnv.startsWith("cfat_")) {
    return fromEnv;
  }
  const publicUrl = process.env.R2_PUBLIC_URL ?? "";
  const match = publicUrl.match(
    /https?:\/\/([a-f0-9]+)\.r2\.cloudflarestorage\.com/i,
  );
  if (match?.[1]) return match[1];
  throw new Error(
    "R2_ACCOUNT_ID must be the Cloudflare account id (not an API token).",
  );
}

export function getR2BucketName(): string {
  return requiredEnv("R2_BUCKET_NAME");
}

export function getR2PublicBaseUrl(): string {
  return requiredEnv("R2_PUBLIC_URL").replace(/\/$/, "");
}

export function createR2Client(): S3Client {
  const accountId = getR2AccountId();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
    // Presigned browser PUTs cannot compute CRC32; default WHEN_SUPPORTED
    // adds x-amz-checksum-crc32=AAAAAA== and breaks the upload.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/** Stable public/object URL recorded on Photo.url after a successful PUT. */
export function r2ObjectUrl(key: string): string {
  const base = getR2PublicBaseUrl();
  const bucket = getR2BucketName();
  // Path-style against the account endpoint (works for stored refs; CDN later).
  if (base.includes(".r2.cloudflarestorage.com")) {
    return `${base}/${bucket}/${key}`;
  }
  return `${base}/${key}`;
}

/**
 * Validates that an object URL belongs to the caller's household and matches
 * the configured R2 public domain / storage endpoints.
 */
export function isHouseholdPhotoUrl(
  objectUrl: string,
  householdId: string,
): boolean {
  if (!objectUrl || typeof objectUrl !== "string") return false;
  try {
    const url = new URL(objectUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;

    const expectedPrefix = `/households/${householdId}/`;
    let bucket = "";
    try {
      bucket = getR2BucketName();
    } catch {
      /* ignore if env var missing during some offline contexts */
    }
    const bucketPrefix = bucket ? `/${bucket}/households/${householdId}/` : "";

    const pathname = url.pathname;
    const validPrefix =
      pathname.startsWith(expectedPrefix) ||
      (bucketPrefix ? pathname.startsWith(bucketPrefix) : false);
    if (!validPrefix) return false;

    // Check for path traversal or malicious characters
    if (
      pathname.includes("..") ||
      pathname.includes("//") ||
      pathname.includes("\\")
    ) {
      return false;
    }

    const allowedHostnames = new Set<string>();
    try {
      const publicBase = getR2PublicBaseUrl();
      allowedHostnames.add(new URL(publicBase).hostname.toLowerCase());
    } catch {}

    const accountId = process.env.R2_ACCOUNT_ID?.trim();
    if (accountId && !accountId.startsWith("cfat_")) {
      allowedHostnames.add(
        `${accountId.toLowerCase()}.r2.cloudflarestorage.com`,
      );
    }

    const host = url.hostname.toLowerCase();
    const isAllowedHost =
      allowedHostnames.has(host) ||
      host.endsWith(".r2.cloudflarestorage.com") ||
      host.endsWith(".r2.dev") ||
      host === "localhost" ||
      host === "127.0.0.1";

    return isAllowedHost;
  } catch {
    return false;
  }
}

