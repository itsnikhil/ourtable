"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { addOrderedItem } from "@/lib/actions/ordered-item-actions";
import { withOfflineAwareness } from "@/lib/offline";

const fieldClass =
  "bg-muted text-foreground placeholder:text-muted-foreground w-full rounded-lg px-3 py-2.5 text-sm outline-none";

export function OrderedAddItemForm({
  visitId,
  currentUserId,
}: {
  visitId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dishName, setDishName] = useState("");
  const [price, setPrice] = useState("");
  const [shared, setShared] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setDishName("");
    setPrice("");
    setShared(true);
    setError(null);
    setOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = dishName.trim();
    if (!name) {
      setError("Dish name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const outcome = await withOfflineAwareness(() =>
        addOrderedItem({
          visitId,
          dishName: name,
          price: price.trim() || undefined,
          shared,
          orderedById: shared ? undefined : currentUserId,
        }),
      );

      if (!outcome.ok) {
        setError(
          outcome.offline
            ? "You’re offline. Try again when you’re back online."
            : "Something went wrong.",
        );
        return;
      }
      if (!outcome.data.success) {
        setError(outcome.data.error.message);
        return;
      }

      reset();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-secondary text-secondary-foreground flex h-11 items-center justify-center gap-1.5 rounded-full px-6 text-sm font-medium"
        >
          <Plus className="size-4" />
          Add Item
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="ordered-dish-name" className="text-sm font-medium">
          Dish name
        </label>
        <input
          id="ordered-dish-name"
          className={fieldClass}
          value={dishName}
          onChange={(e) => setDishName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="ordered-price" className="text-sm font-medium">
          Price
        </label>
        <input
          id="ordered-price"
          className={fieldClass}
          inputMode="decimal"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={shared}
          onChange={(e) => setShared(e.target.checked)}
          className="size-4 accent-current"
        />
        Shared
      </label>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={reset}
          className="text-muted-foreground px-3 py-2 text-sm"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-secondary text-secondary-foreground rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}
