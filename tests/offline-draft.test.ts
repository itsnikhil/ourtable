/**
 * Part B Step B4 — offline draft persistence tests.
 * Uses jsdom + fake-indexeddb (no real browser).
 */
import assert from "node:assert/strict";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { JSDOM } from "jsdom";

const DRAFT_KEY = "visit-wizard-test";

async function flush(ms = 250) {
  await new Promise((r) => setTimeout(r, ms));
}

describe("offline draft persistence (Step B4)", () => {
  let readDraft: typeof import("@/lib/hooks/use-draft-persist").readDraft;
  let writeDraft: typeof import("@/lib/hooks/use-draft-persist").writeDraft;
  let deleteDraft: typeof import("@/lib/hooks/use-draft-persist").deleteDraft;
  let resetDraftDbForTests: typeof import("@/lib/hooks/use-draft-persist").resetDraftDbForTests;
  let useDraftPersist: typeof import("@/lib/hooks/use-draft-persist").useDraftPersist;
  let withOfflineAwareness: typeof import("@/lib/offline").withOfflineAwareness;
  let renderHook: typeof import("@testing-library/react").renderHook;
  let act: typeof import("@testing-library/react").act;
  let cleanup: typeof import("@testing-library/react").cleanup;
  let React: typeof import("react");

  before(async () => {
    const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
      url: "http://localhost",
      pretendToBeVisual: true,
    });
    const { window } = dom;
    Object.defineProperty(globalThis, "window", {
      value: window,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "document", {
      value: window.document,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: window.navigator,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "HTMLElement", {
      value: window.HTMLElement,
      configurable: true,
    });
    Object.defineProperty(globalThis, "MutationObserver", {
      value: window.MutationObserver,
      configurable: true,
    });
    // React 19 + testing-library expect these
    // @ts-expect-error jsdom Event
    globalThis.Event = window.Event;
    // @ts-expect-error jsdom
    globalThis.Node = window.Node;

    await import("fake-indexeddb/auto");
    // fake-indexeddb/auto attaches to `window` when present; `idb` expects globals.
    for (const key of [
      "indexedDB",
      "IDBRequest",
      "IDBKeyRange",
      "IDBCursor",
      "IDBCursorWithValue",
      "IDBDatabase",
      "IDBFactory",
      "IDBIndex",
      "IDBObjectStore",
      "IDBOpenDBRequest",
      "IDBTransaction",
      "IDBVersionChangeEvent",
    ] as const) {
      const value = (window as unknown as Record<string, unknown>)[key];
      if (value != null) {
        Object.defineProperty(globalThis, key, {
          value,
          configurable: true,
          writable: true,
        });
      }
    }

    React = await import("react");
    ({ renderHook, act, cleanup } = await import("@testing-library/react"));
    ({
      readDraft,
      writeDraft,
      deleteDraft,
      resetDraftDbForTests,
      useDraftPersist,
    } = await import("@/lib/hooks/use-draft-persist"));
    ({ withOfflineAwareness } = await import("@/lib/offline"));
  });

  beforeEach(async () => {
    resetDraftDbForTests();
    await deleteDraft(DRAFT_KEY).catch(() => undefined);
    // Ensure online by default
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("useDraftPersist / IndexedDB round-trip", () => {
    it("writeDraft → readDraft returns the same state", async () => {
      const state = { step: 2, restaurant: "Lyla", items: ["pasta"] };
      await writeDraft(DRAFT_KEY, {
        draftId: "draft-1",
        state,
        updatedAt: Date.now(),
      });
      const loaded = await readDraft<typeof state>(DRAFT_KEY);
      assert.ok(loaded);
      assert.equal(loaded.draftId, "draft-1");
      assert.deepEqual(loaded.state, state);
    });

    it("useDraftPersist saves after debounce", async () => {
      const { waitFor } = await import("@testing-library/react");
      const { result } = renderHook(() =>
        useDraftPersist(DRAFT_KEY, { note: "hello" }),
      );

      await act(async () => {
        await flush(50);
      });
      assert.equal(result.current.isReady, true);
      assert.ok(result.current.draftId);

      await waitFor(
        async () => {
          const stored = await readDraft<{ note: string }>(DRAFT_KEY);
          assert.ok(stored);
          assert.equal(stored.state.note, "hello");
        },
        { timeout: 2000 },
      );
    });

    it("useDraftPersist offers restore on remount then clearDraft", async () => {
      await writeDraft(DRAFT_KEY, {
        draftId: "seed-draft",
        state: { note: "saved-at-table" },
        updatedAt: Date.now(),
      });
      resetDraftDbForTests();

      const { result } = renderHook(() =>
        useDraftPersist(DRAFT_KEY, { note: "" }),
      );

      await act(async () => {
        await flush(50);
      });

      assert.ok(result.current.restoreCandidate);
      assert.equal(result.current.restoreCandidate?.note, "saved-at-table");

      await act(async () => {
        result.current.restore();
      });
      assert.equal(result.current.restoreCandidate, null);

      await act(async () => {
        await result.current.clearDraft();
      });
      assert.equal(await readDraft(DRAFT_KEY), undefined);
    });
  });

  describe("offline submit → will-sync → reconnect", () => {
    it("withOfflineAwareness returns offline when navigator.onLine is false", async () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
      const outcome = await withOfflineAwareness(async () => "should-not-run");
      assert.equal(outcome.ok, false);
      if (!outcome.ok) assert.equal(outcome.offline, true);
    });

    it("withOfflineAwareness treats Failed to fetch as offline", async () => {
      const outcome = await withOfflineAwareness(async () => {
        throw new TypeError("Failed to fetch");
      });
      assert.equal(outcome.ok, false);
      if (!outcome.ok) assert.equal(outcome.offline, true);
    });

    it("queued submit shows will-sync, persists draft, retries on online, clears draft", async () => {
      let submitCalls = 0;
      let shouldFailNetwork = true;

      async function mockServerAction() {
        submitCalls += 1;
        if (shouldFailNetwork) {
          throw new TypeError("Failed to fetch");
        }
        return { success: true as const, data: { id: "visit-1" } };
      }

      function Probe() {
        const [formState, setFormState] = React.useState({
          step: 1,
          pendingSync: false,
          dish: "gnocchi",
        });
        const [willSync, setWillSync] = React.useState(false);
        const [synced, setSynced] = React.useState(false);
        const draft = useDraftPersist(DRAFT_KEY, formState);

        React.useEffect(() => {
          async function onOnline() {
            if (!formState.pendingSync) return;
            const outcome = await withOfflineAwareness(() => mockServerAction());
            if (!outcome.ok) {
              if (outcome.offline) {
                setWillSync(true);
                return;
              }
              return;
            }
            setWillSync(false);
            setFormState((s) => ({ ...s, pendingSync: false }));
            setSynced(true);
            await draft.clearDraft();
          }
          window.addEventListener("online", onOnline);
          return () => window.removeEventListener("online", onOnline);
        }, [formState.pendingSync, draft]);

        return React.createElement(
          "div",
          null,
          React.createElement(
            "button",
            {
              type: "button",
              onClick: () => {
                void (async () => {
                  const outcome = await withOfflineAwareness(() =>
                    mockServerAction(),
                  );
                  if (!outcome.ok && outcome.offline) {
                    setWillSync(true);
                    setFormState((s) => ({ ...s, pendingSync: true }));
                    return;
                  }
                  setSynced(true);
                  await draft.clearDraft();
                })();
              },
            },
            "Submit",
          ),
          willSync
            ? React.createElement("p", null, "Will sync when back online")
            : null,
          synced ? React.createElement("p", null, "Synced") : null,
        );
      }

      const { render, screen, fireEvent } = await import(
        "@testing-library/react"
      );
      render(React.createElement(Probe));

      await act(async () => {
        await flush(50);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Submit"));
        await flush(50);
      });

      assert.equal(submitCalls, 1);
      assert.ok(screen.getByText("Will sync when back online"));

      await act(async () => {
        await flush(300);
      });
      const mid = await readDraft<{ pendingSync: boolean; dish: string }>(
        DRAFT_KEY,
      );
      assert.ok(mid);
      assert.equal(mid.state.pendingSync, true);
      assert.equal(mid.state.dish, "gnocchi");

      shouldFailNetwork = false;
      await act(async () => {
        window.dispatchEvent(new window.Event("online"));
        await flush(100);
      });

      assert.ok(submitCalls >= 2);
      assert.ok(screen.getByText("Synced"));
      assert.equal(await readDraft(DRAFT_KEY), undefined);
    });
  });
});
