/**
 * Offline detection helpers for visit logging (NFR-2 / HLD §6.2).
 * `navigator.onLine` alone is unreliable — also treat fetch/network throws as offline.
 */

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function looksLikeNetworkFailure(error: unknown): boolean {
  if (isBrowserOffline()) return true;
  if (error == null) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|network error/i.test(
    msg,
  );
}

export type OfflineAwareResult<T> =
  | { ok: true; data: T }
  | { ok: false; offline: true }
  | { ok: false; offline: false; error: unknown };

export async function withOfflineAwareness<T>(
  fn: () => Promise<T>,
): Promise<OfflineAwareResult<T>> {
  if (isBrowserOffline()) {
    return { ok: false, offline: true };
  }
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    if (looksLikeNetworkFailure(error)) {
      return { ok: false, offline: true };
    }
    return { ok: false, offline: false, error };
  }
}
