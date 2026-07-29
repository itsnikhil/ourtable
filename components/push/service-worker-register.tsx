"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` on mount. Does not request notification permission —
 * that waits for an explicit user action (Enable notifications).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[sw] registration failed", error);
    });
  }, []);

  return null;
}
