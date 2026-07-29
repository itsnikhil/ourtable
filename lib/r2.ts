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
