import { requireAuthContext } from "@/lib/auth";

/** Mutable auth seam for /api/push tests (same pattern as uploadPhotoAuth). */
export const pushRouteAuth = {
  requireAuthContext,
};
