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
      // #region agent log
      {
        const rec =
          body && typeof body === "object" ? (body as Record<string, unknown>) : null;
        fetch("http://127.0.0.1:7921/ingest/224b820e-5167-4961-bbc7-16ea1508300b", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "373167",
          },
          body: JSON.stringify({
            sessionId: "373167",
            hypothesisId: "B",
            location: "app/api/uploads/photo/route.ts:parse",
            message: "upload schema rejected",
            data: {
              fieldErrors: parsed.error.flatten().fieldErrors,
              bodyKeys: rec ? Object.keys(rec) : [],
              contentType: rec?.contentType,
              fileSizeBytes: rec?.fileSizeBytes,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion
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
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: EXPIRES_IN_SECONDS,
    });
    const objectUrl = r2ObjectUrl(key);

    // #region agent log
    {
      const signed = new URL(uploadUrl);
      let objectHost = "invalid";
      try {
        objectHost = new URL(objectUrl).host;
      } catch {
        objectHost = "invalid";
      }
      const signedHeaders = signed.searchParams.get("X-Amz-SignedHeaders");
      const hasChecksum = [...signed.searchParams.keys()].some((k) =>
        k.toLowerCase().includes("checksum"),
      );
      const algo =
        signed.searchParams.get("x-amz-sdk-checksum-algorithm") ??
        signed.searchParams.get("X-Amz-Sdk-Checksum-Algorithm");
      fetch("http://127.0.0.1:7921/ingest/224b820e-5167-4961-bbc7-16ea1508300b", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "373167",
        },
        body: JSON.stringify({
            sessionId: "373167",
            runId: "post-fix",
            hypothesisId: "D",
          location: "app/api/uploads/photo/route.ts:signed",
          message: "presign ok",
          data: {
            contentType,
            fileSizeBytes,
            host: signed.host,
            signedHeaders,
            hasChecksum,
            algo,
            objectHost,
            householdIdLen: householdId.length,
            runId: "post-fix",
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion

    return Response.json({
      uploadUrl,
      objectUrl,
      key,
      expiresInSeconds: EXPIRES_IN_SECONDS,
    });
  } catch (error) {
    if (error instanceof AuthContextError) {
      // #region agent log
      fetch("http://127.0.0.1:7921/ingest/224b820e-5167-4961-bbc7-16ea1508300b", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "373167",
        },
        body: JSON.stringify({
          sessionId: "373167",
          hypothesisId: "A",
          location: "app/api/uploads/photo/route.ts:auth",
          message: "AuthContextError",
          data: {},
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid input." }, { status: 400 });
    }
    // #region agent log
    {
      const name = error instanceof Error ? error.name : "unknown";
      const errMessage =
        error instanceof Error
          ? error.message.slice(0, 200)
          : String(error).slice(0, 200);
      fetch("http://127.0.0.1:7921/ingest/224b820e-5167-4961-bbc7-16ea1508300b", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "373167",
        },
        body: JSON.stringify({
          sessionId: "373167",
          hypothesisId: "C",
          location: "app/api/uploads/photo/route.ts:catch",
          message: "upload route threw",
          data: { name, errMessage },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    console.error("[api/uploads/photo]", error);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}
