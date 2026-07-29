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

    const { fileName, contentType, fileSizeBytes } = parsed.data;

    const key = `households/${householdId}/${createId()}-${sanitizeFileName(fileName)}`;
    const client = createR2Client();
    const command = new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      ContentType: contentType,
      ContentLength: fileSizeBytes,
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
    console.error("[api/uploads/photo]", error);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
