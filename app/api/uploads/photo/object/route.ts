import { PutObjectCommand } from "@aws-sdk/client-s3";
import { AuthContextError } from "@/lib/errors";
import { createR2Client, getR2BucketName } from "@/lib/r2";
import { uploadPhotoAuth } from "@/lib/upload-photo-auth";
import { requestUploadSchema } from "@/lib/validations/photo";

const MAX_BYTES = 15 * 1024 * 1024;

function isHouseholdObjectKey(key: string, householdId: string): boolean {
  const prefix = `households/${householdId}/`;
  if (!key.startsWith(prefix) || key.length > 400) return false;
  if (key.includes("..") || key.includes("//") || key.includes("\\")) {
    return false;
  }
  return true;
}

/**
 * Same-origin PUT of photo bytes. Browser PUT to R2 is blocked without
 * bucket CORS (and this token cannot PutBucketCors).
 */
export async function PUT(request: Request) {
  try {
    const { householdId } = await uploadPhotoAuth.requireAuthContext();
    const key = request.headers.get("x-object-key")?.trim() ?? "";
    const contentType =
      request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!isHouseholdObjectKey(key, householdId)) {
      return Response.json({ error: "Invalid object key." }, { status: 400 });
    }
    const typeOk = requestUploadSchema.shape.contentType.safeParse(contentType);
    if (!typeOk.success) {
      return Response.json({ error: "Invalid content type." }, { status: 400 });
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return Response.json({ error: "Photo must be 15MB or smaller." }, { status: 400 });
    }

    // #region agent log
    fetch("http://127.0.0.1:7921/ingest/224b820e-5167-4961-bbc7-16ea1508300b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "373167",
      },
      body: JSON.stringify({
        sessionId: "373167",
        runId: "post-fix",
        hypothesisId: "E",
        location: "app/api/uploads/photo/object/route.ts:put",
        message: "same-origin R2 put start",
        data: { contentType, byteLength: bytes.byteLength, keyPrefix: key.slice(0, 24) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    await createR2Client().send(
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
        ContentType: contentType,
        Body: bytes,
      }),
    );

    // #region agent log
    fetch("http://127.0.0.1:7921/ingest/224b820e-5167-4961-bbc7-16ea1508300b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "373167",
      },
      body: JSON.stringify({
        sessionId: "373167",
        runId: "post-fix",
        hypothesisId: "E",
        location: "app/api/uploads/photo/object/route.ts:ok",
        message: "same-origin R2 put ok",
        data: { contentType, byteLength: bytes.byteLength },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthContextError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    // #region agent log
    fetch("http://127.0.0.1:7921/ingest/224b820e-5167-4961-bbc7-16ea1508300b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "373167",
      },
      body: JSON.stringify({
        sessionId: "373167",
        runId: "post-fix",
        hypothesisId: "E",
        location: "app/api/uploads/photo/object/route.ts:err",
        message: "same-origin R2 put threw",
        data: {
          name: error instanceof Error ? error.name : "unknown",
          errMessage:
            error instanceof Error
              ? error.message.slice(0, 200)
              : String(error).slice(0, 200),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    console.error("[api/uploads/photo/object]", error);
    return Response.json({ error: "Upload to storage failed." }, { status: 500 });
  }
}
