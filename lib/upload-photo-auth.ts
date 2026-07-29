import { requireAuthContext } from "@/lib/auth";

/**
 * Mutable indirection for the upload route — lets tests force UNAUTHENTICATED
 * without mocking ESM module namespaces (tsx + node:test mock.method limitation).
 */
export const uploadPhotoAuth = {
  requireAuthContext,
};
