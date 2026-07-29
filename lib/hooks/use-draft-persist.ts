import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { createId } from "@paralleldrive/cuid2";
import { useEffect, useRef, useState } from "react";

const DB_NAME = "ourtable-drafts";
const DB_VERSION = 1;
const STORE = "drafts";

type DraftRecord<T> = {
  draftKey: string;
  draftId: string;
  state: T;
  updatedAt: number;
};

interface DraftDb extends DBSchema {
  drafts: {
    key: string;
    value: DraftRecord<unknown>;
  };
}

let dbPromise: Promise<IDBPDatabase<DraftDb>> | null = null;

/** Clears the cached IDB open promise — tests only. */
export function resetDraftDbForTests() {
  dbPromise = null;
}

function resolveIndexedDB(): IDBFactory | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as typeof globalThis & {
    indexedDB?: IDBFactory;
    window?: { indexedDB?: IDBFactory };
  };
  return g.indexedDB ?? g.window?.indexedDB ?? null;
}

function getDb() {
  if (!resolveIndexedDB()) {
    return null;
  }
  // Ensure Node/jsdom can see the same factory `idb` will use.
  const g = globalThis as typeof globalThis & { indexedDB?: IDBFactory };
  if (!g.indexedDB && g.window?.indexedDB) {
    g.indexedDB = g.window.indexedDB;
  }
  if (!dbPromise) {
    dbPromise = openDB<DraftDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "draftKey" });
        }
      },
    });
  }
  return dbPromise;
}

/** Test / tooling helpers — direct IndexedDB access. */
export async function readDraft<T>(
  draftKey: string,
): Promise<DraftRecord<T> | undefined> {
  const db = getDb();
  if (!db) return undefined;
  const row = await (await db).get(STORE, draftKey);
  return row as DraftRecord<T> | undefined;
}

export async function writeDraft<T>(
  draftKey: string,
  record: Omit<DraftRecord<T>, "draftKey">,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await (
    await db
  ).put(STORE, {
    draftKey,
    draftId: record.draftId,
    state: record.state,
    updatedAt: record.updatedAt,
  });
}

export async function deleteDraft(draftKey: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await (await db).delete(STORE, draftKey);
}

export type UseDraftPersistResult<T> = {
  /** False until IndexedDB has been checked for an existing draft. */
  isReady: boolean;
  draftId: string | null;
  /**
   * Prior draft found on mount. Saving is paused until `restore()` or `discard()`.
   * Parent should apply this into form state, then call `restore()`.
   */
  restoreCandidate: T | null;
  restore: () => void;
  discard: () => Promise<void>;
  /** Call after a successful submit so the next visit starts clean. */
  clearDraft: () => Promise<void>;
};

/**
 * Mirrors `formState` into IndexedDB under `draftKey` (NFR-2 / HLD §6.2).
 * Generates a `draftId` when the form session starts (or reuses one from a restored draft).
 */
export function useDraftPersist<T>(
  draftKey: string,
  formState: T,
): UseDraftPersistResult<T> {
  const [isReady, setIsReady] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<T | null>(null);
  const skipSaveRef = useRef(false);
  const formStateRef = useRef(formState);
  formStateRef.current = formState;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const existing = await readDraft<T>(draftKey);
      if (cancelled) return;

      if (existing) {
        setDraftId(existing.draftId);
        setRestoreCandidate(existing.state);
      } else {
        setDraftId(createId());
      }
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!isReady || !draftId || restoreCandidate != null) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }

    const handle = globalThis.setTimeout(() => {
      void writeDraft(draftKey, {
        draftId,
        state: formStateRef.current,
        updatedAt: Date.now(),
      });
    }, 200);

    return () => globalThis.clearTimeout(handle);
  }, [draftKey, draftId, formState, isReady, restoreCandidate]);

  function restore() {
    skipSaveRef.current = true;
    setRestoreCandidate(null);
  }

  async function discard() {
    await deleteDraft(draftKey);
    setRestoreCandidate(null);
    setDraftId(createId());
  }

  async function clearDraft() {
    await deleteDraft(draftKey);
  }

  return {
    isReady,
    draftId,
    restoreCandidate,
    restore,
    discard,
    clearDraft,
  };
}
