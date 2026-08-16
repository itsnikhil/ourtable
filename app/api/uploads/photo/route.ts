import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { AuthContextError } from "@/lib/errors";
import { requestUploadSchema } from "@/lib/validations/photo";
import {
  createR2Client,
  getR2BucketName,
  r2ObjectUrl,
} from "@/lib/r2";
import { uploadPhotoAuth } from "@/lib/upload-photo-auth";

const EXPIRES_IN_SECONDS = 300;
const MAX_BYTES = 15 * 1024 * 1024; // 15MB cap

function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "photo";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "photo";
}

/**
 * LLD §9.3 — request a presigned R2 PUT URL (session required).
 */
export async function POST(request: Request) {
  try {
    const { householdId } = await uploadPhotoAuth.requireAuthContext();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = requestUploadSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid input.",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { fileName, contentType } = parsed.data;

    const key = `households/${householdId}/${createId()}-${sanitizeFileName(fileName)}`;
    const client = createR2Client();
    const command = new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: EXPIRES_IN_SECONDS,
    });
    const objectUrl = r2ObjectUrl(key);

    return Response.json({
      uploadUrl,
      objectUrl,
      expiresInSeconds: EXPIRES_IN_SECONDS,
    });
  } catch (error) {
    if (error instanceof AuthContextError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid input." }, { status: 400 });
    }
    console.error("[api/uploads/photo:POST]", error);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}

/**
 * Direct same-origin upload endpoint for browser clients where direct R2
 * CORS preflight is blocked. Authenticates session, validates payload,
 * securely generates a server-side key, and uploads bytes to R2.
 */
export async function PUT(request: Request) {
  try {
    const { householdId } = await uploadPhotoAuth.requireAuthContext();

    const contentType =
      request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const typeValidation =
      requestUploadSchema.shape.contentType.safeParse(contentType);
    if (!typeValidation.success) {
      return Response.json(
        { error: "Invalid content type. Use JPEG, PNG, or WebP." },
        { status: 400 },
      );
    }

    const rawFileName = request.headers.get("x-file-name");
    const fileName = rawFileName
      ? decodeURIComponent(rawFileName)
      : "photo.jpg";

    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return Response.json(
        { error: "Photo must be 15MB or smaller." },
        { status: 400 },
      );
    }

    const key = `households/${householdId}/${createId()}-${sanitizeFileName(fileName)}`;
    const client = createR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
        ContentType: contentType,
        Body: bytes,
      }),
    );

    const objectUrl = r2ObjectUrl(key);
    return Response.json({ objectUrl });
  } catch (error) {
    if (error instanceof AuthContextError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/uploads/photo:PUT]", error);
    return Response.json(
      { error: "Upload to storage failed." },
      { status: 500 },
    );
  }
}
