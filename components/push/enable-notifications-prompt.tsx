"use client";

import { useEffect, useState } from "react";
import { subscribeUserToPush } from "@/lib/push-client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "ourtable.pushPromptDismissed";

/**
 * First-Home prompt: permission + pushManager.subscribe + POST /api/push/subscribe
 * only after Enable. Denied → dismiss quietly (in-app badge remains).
 */
export function EnableNotificationsPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (Notification.permission === "denied") return;

    let cancelled = false;

    void (async () => {
      if (Notification.permission === "granted") {
        try {
          const reg = await navigator.serviceWorker.ready;
          const existing = await reg.pushManager.getSubscription();
          if (existing) return; // already subscribed — no prompt
        } catch {
          /* show prompt and let Enable retry */
        }
      }
      if (!cancelled) setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function onEnable() {
    setBusy(true);
    try {
      const ok = await subscribeUserToPush();
      // Denied or unavailable → silent fallback to M3 badge (no error UI).
      dismiss();
      if (!ok && Notification.permission === "granted") {
        // Granted but subscribe/POST failed — allow retry next visit.
        localStorage.removeItem(DISMISS_KEY);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="border-border bg-card space-y-3 rounded-2xl p-4 shadow-card">
      <div className="space-y-1">
        <p className="text-sm font-medium">Enable notifications?</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Get a nudge when your partner rates a visit. You can keep using the
          in-app badge either way.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onEnable()}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          {busy ? "Working…" : "Enable notifications"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={dismiss}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
