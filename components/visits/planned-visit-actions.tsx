"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelVisit,
  completeVisit,
  rescheduleVisit,
} from "@/lib/actions/visit-actions";
import { Button } from "@/components/ui/button";

const fieldClass =
  "border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-lg border px-3 py-1 text-sm outline-none focus-visible:ring-2";

function toDateInput(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PlannedVisitActions({
  visitId,
  visitDate,
  visitTime,
}: {
  visitId: string;
  visitDate: string;
  visitTime: string | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(toDateInput(visitDate));
  const [time, setTime] = useState(visitTime ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onReschedule() {
    setBusy(true);
    setError(null);
    const iso = time
      ? new Date(`${date}T${time}:00`).toISOString()
      : new Date(`${date}T12:00:00`).toISOString();
    const result = await rescheduleVisit({
      id: visitId,
      visitDate: iso,
      visitTime: time || undefined,
    });
    setBusy(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function onComplete() {
    setBusy(true);
    setError(null);
    const result = await completeVisit({ id: visitId, confirmed: true });
    setBusy(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  async function onCancel() {
    if (!window.confirm("Cancel this planned visit? It will be deleted.")) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await cancelVisit({ id: visitId });
    setBusy(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    router.push("/calendar");
    router.refresh();
  }

  return (
    <section className="space-y-3 border-t pt-4">
      <h2 className="text-sm font-semibold tracking-tight uppercase">
        Plan actions
      </h2>
      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs" htmlFor="reschedule-date">
            Date
          </label>
          <input
            id="reschedule-date"
            type="date"
            className={fieldClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs" htmlFor="reschedule-time">
            Time
          </label>
          <input
            id="reschedule-time"
            type="time"
            className={fieldClass}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => void onReschedule()}
        >
          Reschedule
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void onComplete()}
        >
          Mark completed
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void onCancel()}
        >
          Cancel plan
        </Button>
      </div>
    </section>
  );
}
