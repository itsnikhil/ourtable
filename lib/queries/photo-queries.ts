import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { photos, restaurants, users, visits } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";

export type PhotoDto = {
  id: string;
  url: string;
  visitId: string | null;
  restaurantId: string | null;
  uploadedById: string;
  /** Display name for NFR-11 auditability. */
  uploadedByName: string;
  createdAt: string;
};

function toIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toDto(row: {
  id: string;
  url: string;
  visitId: string | null;
  restaurantId: string | null;
  uploadedById: string;
  uploadedByName: string | null;
  createdAt: Date;
}): PhotoDto {
  return {
    id: row.id,
    url: row.url,
    visitId: row.visitId,
    restaurantId: row.restaurantId,
    uploadedById: row.uploadedById,
    uploadedByName: row.uploadedByName?.trim() || "Partner",
    createdAt: toIso(row.createdAt),
  };
}

/** Household-scoped photos for a visit (LLD VisitDetail.photos). */
export async function listPhotosForVisit(visitId: string): Promise<PhotoDto[]> {
  const { householdId } = await requireAuthContext();

  const [visit] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.householdId, householdId)))
    .limit(1);
  if (!visit) return [];

  const rows = await db
    .select({
      id: photos.id,
      url: photos.url,
      visitId: photos.visitId,
      restaurantId: photos.restaurantId,
      uploadedById: photos.uploadedById,
      uploadedByName: users.name,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .innerJoin(users, eq(photos.uploadedById, users.id))
    .where(eq(photos.visitId, visitId))
    .orderBy(asc(photos.createdAt));

  return rows.map(toDto);
}

/** Household-scoped photos attached directly to a restaurant. */
export async function listPhotosForRestaurant(
  restaurantId: string,
): Promise<PhotoDto[]> {
  const { householdId } = await requireAuthContext();

  const [restaurant] = await db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(
      and(
        eq(restaurants.id, restaurantId),
        eq(restaurants.householdId, householdId),
        isNull(restaurants.archivedAt),
      ),
    )
    .limit(1);
  if (!restaurant) return [];

  const rows = await db
    .select({
      id: photos.id,
      url: photos.url,
      visitId: photos.visitId,
      restaurantId: photos.restaurantId,
      uploadedById: photos.uploadedById,
      uploadedByName: users.name,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .innerJoin(users, eq(photos.uploadedById, users.id))
    .where(eq(photos.restaurantId, restaurantId))
    .orderBy(asc(photos.createdAt));

  return rows.map(toDto);
}
