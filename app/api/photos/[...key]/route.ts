import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AuthContextError } from "@/lib/errors";
import { createR2Client, getR2BucketName } from "@/lib/r2";
import { uploadPhotoAuth } from "@/lib/upload-photo-auth";

const PRESIGNED_GET_EXPIRES_SECONDS = 3600; // 1 hour

/**
 * Redirects authenticated household users to a short-lived presigned R2 GET URL.
 * Bypasses Next.js server egress bandwidth, downloading directly from R2 edge.
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ key: string[] }> },
) {
  try {
    const { householdId } = await uploadPhotoAuth.requireAuthContext();
    const { key: keySegments } = await props.params;

    if (!keySegments || keySegments.length === 0) {
      return new Response("Not Found", { status: 404 });
    }

    // Filter out empty segments and clean path
    const key = keySegments.filter(Boolean).join("/");

    // Security: Validate path traversal
    if (key.includes("..") || key.includes("//") || key.includes("\\")) {
      return new Response("Forbidden", { status: 403 });
    }

    // Security: Enforce household isolation
    const householdPrefix = `households/${householdId}/`;
    if (!key.startsWith(householdPrefix)) {
      return new Response("Forbidden", { status: 403 });
    }

    const client = createR2Client();
    const command = new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      ResponseContentDisposition: "inline",
    });

    const presignedUrl = await getSignedUrl(client, command, {
      expiresIn: PRESIGNED_GET_EXPIRES_SECONDS,
    });

    return Response.redirect(presignedUrl, 307);
  } catch (error) {
    if (error instanceof AuthContextError) {
      return new Response("Unauthorized", { status: 401 });
    }
    console.error("[api/photos/GET]", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
