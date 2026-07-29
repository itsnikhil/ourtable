import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type _Object,
} from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { photos } from "@/db/schema";
import {
  createR2Client,
  getR2BucketName,
  r2ObjectUrl,
} from "@/lib/r2";

const HOUSEHOLD_PREFIX = "households/";
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

export type OrphanCleanupResult = {
  scanned: number;
  deleted: number;
  skippedYoung: number;
  skippedAttached: number;
};

/** Injectable R2 surface for tests (prompt Step 5). */
export type OrphanCleanupDeps = {
  listObjects: () => Promise<_Object[]>;
  deleteKeys: (keys: string[]) => Promise<number>;
  listAttachedUrls: () => Promise<string[]>;
};

async function listAllHouseholdObjects(): Promise<_Object[]> {
  const client = createR2Client();
  const bucket = getR2BucketName();
  const objects: _Object[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: HOUSEHOLD_PREFIX,
        ContinuationToken: continuationToken,
      }),
    );
    if (page.Contents?.length) {
      objects.push(...page.Contents);
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}

async function deleteObjectKeys(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const client = createR2Client();
  const bucket = getR2BucketName();
  let deleted = 0;

  // DeleteObjects allows up to 1000 keys per request
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    deleted += chunk.length - (result.Errors?.length ?? 0);
    if (result.Errors?.length) {
      console.error("[cleanupOrphanPhotos] delete errors", result.Errors);
    }
  }

  return deleted;
}

async function listAttachedPhotoUrls(): Promise<string[]> {
  const photoRows = await db.select({ url: photos.url }).from(photos);
  return photoRows.map((r) => r.url);
}

function defaultDeps(): OrphanCleanupDeps {
  return {
    listObjects: listAllHouseholdObjects,
    deleteKeys: deleteObjectKeys,
    listAttachedUrls: listAttachedPhotoUrls,
  };
}

/**
 * Delete R2 objects under `households/` older than 24h with no matching Photo.url.
 * Handles abandoned uploads where attachPhoto never completed (HLD §6.6).
 */
export async function cleanupOrphanPhotos(
  now = new Date(),
  deps: OrphanCleanupDeps = defaultDeps(),
): Promise<OrphanCleanupResult> {
  const objects = await deps.listObjects();
  const attachedUrls = new Set(await deps.listAttachedUrls());

  const toDelete: string[] = [];
  let skippedYoung = 0;
  let skippedAttached = 0;

  for (const obj of objects) {
    if (!obj.Key) continue;
    const objectUrl = r2ObjectUrl(obj.Key);

    if (attachedUrls.has(objectUrl)) {
      skippedAttached += 1;
      continue;
    }

    const lastModified = obj.LastModified?.getTime() ?? 0;
    if (now.getTime() - lastModified < ORPHAN_AGE_MS) {
      skippedYoung += 1;
      continue;
    }

    toDelete.push(obj.Key);
  }

  const deleted = await deps.deleteKeys(toDelete);

  return {
    scanned: objects.length,
    deleted,
    skippedYoung,
    skippedAttached,
  };
}
