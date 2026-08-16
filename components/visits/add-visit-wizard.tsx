"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  createVisit,
  setBill,
} from "@/lib/actions/visit-actions";
import {
  addOrderedItem,
  removeOrderedItem,
} from "@/lib/actions/ordered-item-actions";
import { searchRestaurantsForVisitPicker } from "@/lib/actions/visit-picker-actions";
import {
  dineTypeSchema,
  mealSchema,
  paymentSplitSchema,
} from "@/lib/validations/visit";
import { Calendar, ChevronDown, ChevronLeft, Clock, Minus, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDraftPersist } from "@/lib/hooks/use-draft-persist";
import { withOfflineAwareness } from "@/lib/offline";
import { RateVisitForm } from "@/components/visits/rate-visit-form";

const fieldClass =
  "bg-muted text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-11 w-full rounded-lg border-0 px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass = "text-sm font-semibold";

const OCCASIONS = [
  "Anniversary",
  "Birthday",
  "Date night",
  "Casual",
  "Celebration",
  "Business",
  "Holiday",
] as const;

function chipClass(selected: boolean) {
  return cn(
    "rounded-full px-4 py-2.5 text-sm font-medium",
    selected
      ? "bg-success text-success-foreground"
      : "bg-muted text-foreground",
  );
}

function emptyToUndef(v: unknown) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

const visitStepSchema = z.object({
  restaurantId: z.string().min(1, "Pick a restaurant"),
  visitDate: z.string().min(1, "Date is required"),
  visitTime: z.preprocess(
    emptyToUndef,
    z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  ),
  meal: z.preprocess(emptyToUndef, mealSchema.optional()),
  dineType: z.preprocess(emptyToUndef, dineTypeSchema.optional()),
  occasion: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  partySize: z.preprocess((v) => {
    if (v === "" || v == null) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().min(1).max(50).optional()),
  seating: z.preprocess(emptyToUndef, z.string().max(50).optional()),
});

type VisitStepValues = z.input<typeof visitStepSchema>;

function parsePartySize(value: VisitStepValues["partySize"]) {
  if (value === "" || value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const billStepSchema = z.object({
  subtotal: z.preprocess(emptyToUndef, z.string().optional()),
  tip: z.preprocess(emptyToUndef, z.string().optional()),
  totalPaid: z.preprocess(emptyToUndef, z.string().optional()),
  paymentSplit: z.preprocess(emptyToUndef, paymentSplitSchema.optional()),
  paymentMethod: z.preprocess(emptyToUndef, z.string().max(100).optional()),
});

type BillStepValues = z.input<typeof billStepSchema>;

type RestaurantOption = { id: string; name: string };

type DraftItem = {
  key: string;
  dishName: string;
  price: string;
  shared: boolean;
  wouldOrderAgain: boolean;
  savedId?: string;
};

/** Persisted Add-Visit wizard snapshot (all steps through rating). */
type WizardDraft = {
  mode: "log" | "plan";
  step: 1 | 2 | 3 | 4;
  visitId: string | null;
  selectedRestaurant: RestaurantOption | null;
  query: string;
  visit: VisitStepValues;
  bill: BillStepValues;
  items: DraftItem[];
  /** True when a submit was deferred until reconnect. */
  pendingSync?: boolean;
};

const DRAFT_KEY = "visit-wizard";

function dateInputValue(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toIsoDateTime(dateYmd: string, timeHHmm?: string) {
  if (timeHHmm) {
    return new Date(`${dateYmd}T${timeHHmm}:00`).toISOString();
  }
  return new Date(`${dateYmd}T12:00:00`).toISOString();
}

export function AddVisitWizard({
  preselectedRestaurant,
  initialMode = "log",
  initialDate,
  backHref = "/calendar",
}: {
  preselectedRestaurant: RestaurantOption | null;
  initialMode?: "log" | "plan";
  initialDate?: string;
  backHref?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"log" | "plan">(initialMode);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<RestaurantOption | null>(preselectedRestaurant);
  const [query, setQuery] = useState(preselectedRestaurant?.name ?? "");
  const [results, setResults] = useState<RestaurantOption[]>([]);
  const [searchPending, startSearch] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([
    {
      key: crypto.randomUUID(),
      dishName: "",
      price: "",
      shared: true,
      wouldOrderAgain: false,
    },
  ]);
  const [itemsSaving, setItemsSaving] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const visitForm = useForm<VisitStepValues>({
    resolver: zodResolver(visitStepSchema),
    defaultValues: {
      restaurantId: preselectedRestaurant?.id ?? "",
      visitDate: initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
        ? initialDate
        : dateInputValue(),
      visitTime: "",
      meal: "",
      dineType: "",
      occasion: "",
      partySize: "",
      seating: "",
    },
  });

  const billForm = useForm<BillStepValues>({
    resolver: zodResolver(billStepSchema),
    defaultValues: {
      subtotal: "",
      tip: "",
      totalPaid: "",
      paymentSplit: "",
      paymentMethod: "",
    },
  });

  const visitValues = visitForm.watch();
  const billValues = billForm.watch();
  const occasionCurrent =
    typeof visitValues.occasion === "string" ? visitValues.occasion.trim() : "";
  const occasionOptions = (OCCASIONS as readonly string[]).includes(
    occasionCurrent,
  )
    ? [...OCCASIONS]
    : occasionCurrent
      ? [...OCCASIONS, occasionCurrent]
      : [...OCCASIONS];
  const partySize = parsePartySize(visitValues.partySize) ?? 1;

  const draftState: WizardDraft = useMemo(
    () => ({
      mode,
      step,
      visitId,
      selectedRestaurant,
      query,
      visit: visitValues,
      bill: billValues,
      items,
      pendingSync,
    }),
    [
      mode,
      step,
      visitId,
      selectedRestaurant,
      query,
      visitValues,
      billValues,
      items,
      pendingSync,
    ],
  );

  const {
    restoreCandidate,
    restore,
    discard,
    clearDraft,
  } = useDraftPersist<WizardDraft>(DRAFT_KEY, draftState);

  function applyDraft(candidate: WizardDraft) {
    setMode(candidate.mode);
    setStep(candidate.step);
    setVisitId(candidate.visitId);
    setSelectedRestaurant(candidate.selectedRestaurant);
    setQuery(candidate.query);
    setPendingSync(Boolean(candidate.pendingSync));
    setItems(
      candidate.items?.length
        ? candidate.items
        : [
            {
              key: crypto.randomUUID(),
              dishName: "",
              price: "",
              shared: true,
              wouldOrderAgain: false,
            },
          ],
    );
    visitForm.reset(candidate.visit);
    billForm.reset(candidate.bill);
    restore();
  }

  useEffect(() => {
    if (selectedRestaurant) {
      visitForm.setValue("restaurantId", selectedRestaurant.id, {
        shouldValidate: true,
      });
    }
  }, [selectedRestaurant, visitForm]);

  useEffect(() => {
    if (selectedRestaurant && query === selectedRestaurant.name) {
      setResults([]);
      return;
    }
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      startSearch(async () => {
        const found = await searchRestaurantsForVisitPicker(query);
        setResults(found);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selectedRestaurant]);

  async function syncVisitStep(values: VisitStepValues) {
    const parsed = visitStepSchema.parse(values);
    const outcome = await withOfflineAwareness(() =>
      createVisit({
        restaurantId: parsed.restaurantId,
        visitDate: toIsoDateTime(parsed.visitDate, parsed.visitTime),
        visitTime: parsed.visitTime,
        meal: parsed.meal,
        dineType: parsed.dineType,
        occasion: parsed.occasion,
        partySize: parsed.partySize,
        seating: parsed.seating,
        status: mode === "plan" ? "PLANNED" : "COMPLETED",
      }),
    );

    if (!outcome.ok) {
      if (outcome.offline) {
        setPendingSync(true);
        setServerError(null);
        return false;
      }
      setServerError("Something went wrong.");
      return false;
    }

    const result = outcome.data;
    if (!result.success) {
      setServerError(result.error.message);
      return false;
    }

    setPendingSync(false);

    if (mode === "plan") {
      await clearDraft();
      router.push(`/visits/${result.data.id}`);
      router.refresh();
      return true;
    }

    setVisitId(result.data.id);
    setStep(2);
    return true;
  }

  const onVisitSubmit = visitForm.handleSubmit(async (values) => {
    setServerError(null);
    await syncVisitStep(values);
  });

  async function syncItemsStep() {
    if (!visitId) return false;
    setServerError(null);
    setItemsSaving(true);

    try {
      const nextItems = [...items];
      const toSave = nextItems.filter((i) => i.dishName.trim().length > 0);
      for (const item of toSave) {
        if (item.savedId) continue;
        const outcome = await withOfflineAwareness(() =>
          addOrderedItem({
            visitId,
            dishName: item.dishName.trim(),
            price: item.price.trim() || undefined,
            shared: item.shared,
            wouldOrderAgain: item.wouldOrderAgain || undefined,
          }),
        );
        if (!outcome.ok) {
          if (outcome.offline) {
            setPendingSync(true);
            setServerError(null);
            return false;
          }
          setServerError("Something went wrong.");
          return false;
        }
        if (!outcome.data.success) {
          setServerError(outcome.data.error.message);
          return false;
        }
        item.savedId = outcome.data.data.id;
      }
      setItems(nextItems);
      setPendingSync(false);
      setStep(3);
      return true;
    } finally {
      setItemsSaving(false);
    }
  }

  async function onItemsContinue() {
    await syncItemsStep();
  }

  async function syncBillStep(values: BillStepValues) {
    if (!visitId) return false;
    setServerError(null);
    const parsed = billStepSchema.parse(values);

    const hasBill =
      parsed.subtotal ||
      parsed.tip ||
      parsed.totalPaid ||
      parsed.paymentSplit ||
      parsed.paymentMethod;

    if (hasBill) {
      const outcome = await withOfflineAwareness(() =>
        setBill({
          visitId,
          subtotal: parsed.subtotal,
          tip: parsed.tip,
          totalPaid: parsed.totalPaid,
          paymentSplit: parsed.paymentSplit,
          paymentMethod: parsed.paymentMethod,
        }),
      );
      if (!outcome.ok) {
        if (outcome.offline) {
          setPendingSync(true);
          setServerError(null);
          return false;
        }
        setServerError("Something went wrong.");
        return false;
      }
      if (!outcome.data.success) {
        setServerError(outcome.data.error.message);
        return false;
      }
    }

    setPendingSync(false);
    setStep(4);
    return true;
  }

  const onBillSubmit = billForm.handleSubmit(async (values) => {
    await syncBillStep(values);
  });

  function skipBill() {
    setStep(4);
  }

  function finishWithoutRating() {
    if (!visitId) return;
    void clearDraft().then(() => {
      router.push(`/visits/${visitId}`);
      router.refresh();
    });
  }

  async function retryPendingSync() {
    if (!pendingSync || syncing) return;
    setSyncing(true);
    try {
      if (step === 1) {
        await syncVisitStep(visitForm.getValues());
      } else if (step === 2) {
        await syncItemsStep();
      } else if (step === 3) {
        await syncBillStep(billForm.getValues());
      }
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    function onOnline() {
      void (async () => {
        // Re-read pendingSync via closure — effect rebinds when it changes.
        if (step === 4) return;
        // Only auto-retry when we previously queued an offline submit.
        // pendingSync checked inside retryPendingSync.
        await retryPendingSync();
      })();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retry uses latest step handlers
  }, [pendingSync, step, visitId, mode]);

  const runningTotal = items.reduce((sum, item) => {

    const n = Number(item.price);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  return (
    <div className="space-y-5">
      <header className="relative flex items-center justify-between">
        <Link
          href={backHref}
          aria-label="Back"
          className="text-foreground -ml-2 flex size-10 items-center justify-center"
        >
          <ChevronLeft className="size-6" />
        </Link>
        <h1 className="pointer-events-none absolute inset-x-10 text-center text-lg font-semibold">
          New Visit
        </h1>
        {step === 1 ? (
          <button
            type="submit"
            form="new-visit-step-1"
            className="text-success px-2 text-sm font-bold"
          >
            Save
          </button>
        ) : (
          <span className="w-10" aria-hidden />
        )}
      </header>

      {restoreCandidate ? (
        <div className="bg-card space-y-3 rounded-2xl p-4 shadow-card">
          <div className="space-y-1">
            <p className="text-sm font-medium">Resume unfinished visit?</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              We saved a draft from last time (step {restoreCandidate.step}
              {restoreCandidate.selectedRestaurant
                ? ` · ${restoreCandidate.selectedRestaurant.name}`
                : ""}
              ).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => applyDraft(restoreCandidate)}
            >
              Restore draft
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void discard()}
            >
              Start fresh
            </Button>
          </div>
        </div>
      ) : null}

      {pendingSync ? (
        <div className="bg-card space-y-2 rounded-2xl p-4 shadow-card">
          <p className="text-sm font-medium">Will sync when back online</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your draft is saved on this device. We&apos;ll retry automatically
            when the connection returns
            {syncing ? " — syncing now…" : ""}.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={syncing || step === 4}
            onClick={() => void retryPendingSync()}
          >
            Retry now
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["log", "Log a visit"],
              ["plan", "Plan a visit"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={chipClass(mode === id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {mode === "log" ? (
        <ol className="text-muted-foreground flex gap-2 text-xs">
          {(
            [
              [1, "Visit"],
              [2, "Ordered"],
              [3, "Bill"],
              [4, "Review"],
            ] as const
          ).map(([n, label]) => (
            <li
              key={n}
              className={cn(
                "rounded-full px-2 py-1",
                step === n && "bg-muted text-foreground font-medium",
              )}
            >
              {n}. {label}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">
          Planning a future visit — dishes, bill, and ratings unlock after it
          happens.
        </p>
      )}

      {serverError ? (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
          {serverError}
        </p>
      ) : null}

      {step === 1 ? (
        <form
          id="new-visit-step-1"
          onSubmit={onVisitSubmit}
          className="space-y-5"
        >
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="restaurant-search">
              Restaurant
            </label>
            <input
              id="restaurant-search"
              className={fieldClass}
              placeholder="Search restaurants…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedRestaurant(null);
                visitForm.setValue("restaurantId", "");
              }}
              autoComplete="off"
            />
            <input type="hidden" {...visitForm.register("restaurantId")} />
            {searchPending ? (
              <p className="text-muted-foreground text-xs">Searching…</p>
            ) : null}
            {results.length > 0 ? (
              <ul className="bg-muted divide-border/60 divide-y overflow-hidden rounded-lg text-sm">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="hover:bg-secondary w-full px-3 py-2.5 text-left"
                      onClick={() => {
                        setSelectedRestaurant(r);
                        setQuery(r.name);
                        setResults([]);
                      }}
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {visitForm.formState.errors.restaurantId ? (
              <p className="text-destructive text-xs">
                {visitForm.formState.errors.restaurantId.message}
              </p>
            ) : null}
            <Link
              href="/restaurants/new"
              className={cn(
                buttonVariants({ variant: "link", size: "sm" }),
                "text-muted-foreground h-auto px-0",
              )}
            >
              Add a new restaurant
            </Link>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="visitDate">
              Visit Date
            </label>
            <div className="relative">
              <input
                id="visitDate"
                type="date"
                className={cn(
                  fieldClass,
                  "pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:opacity-0",
                )}
                {...visitForm.register("visitDate")}
              />
              <Calendar
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="visitTime">
              Time
            </label>
            <div className="relative">
              <input
                id="visitTime"
                type="time"
                className={cn(
                  fieldClass,
                  "pr-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:opacity-0",
                )}
                {...visitForm.register("visitTime")}
              />
              <Clock
                aria-hidden
                className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Meal</p>
            <div className="grid grid-cols-3 gap-2">
              {mealSchema.options.map((o) => {
                const selected = visitValues.meal === o;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => visitForm.setValue("meal", o)}
                    className={chipClass(selected)}
                  >
                    {o.charAt(0) + o.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className={labelClass}>Type</p>
            <div className="grid grid-cols-3 gap-2">
              {dineTypeSchema.options.map((o) => {
                const selected = visitValues.dineType === o;
                const label =
                  o === "DINE_IN"
                    ? "Dine-in"
                    : o === "TAKEOUT"
                      ? "Takeaway"
                      : "Delivery";
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => visitForm.setValue("dineType", o)}
                    className={chipClass(selected)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="occasion">
                Occasion
              </label>
              <div className="relative">
                <select
                  id="occasion"
                  className={cn(fieldClass, "appearance-none pr-9")}
                  {...visitForm.register("occasion")}
                >
                  <option value="">Select</option>
                  {occasionOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden
                  className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className={labelClass} id="people-label">
                People
              </p>
              <div
                className="bg-muted flex h-11 items-stretch overflow-hidden rounded-lg"
                role="group"
                aria-labelledby="people-label"
              >
                <button
                  type="button"
                  aria-label="Decrease people"
                  className="flex w-11 items-center justify-center disabled:opacity-40"
                  disabled={partySize <= 1}
                  onClick={() =>
                    visitForm.setValue("partySize", Math.max(1, partySize - 1))
                  }
                >
                  <Minus className="size-4" />
                </button>
                <span className="flex flex-1 items-center justify-center text-sm font-medium">
                  {partySize}
                </span>
                <button
                  type="button"
                  aria-label="Increase people"
                  className="flex w-11 items-center justify-center disabled:opacity-40"
                  disabled={partySize >= 50}
                  onClick={() =>
                    visitForm.setValue("partySize", Math.min(50, partySize + 1))
                  }
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <details className="text-sm">
            <summary className="text-muted-foreground cursor-pointer select-none">
              More details
            </summary>
            <div className="mt-3 space-y-1.5">
              <label className={labelClass} htmlFor="seating">
                Seating
              </label>
              <input
                id="seating"
                className={fieldClass}
                placeholder="Patio, bar, …"
                {...visitForm.register("seating")}
              />
            </div>
          </details>

          <Button
            type="submit"
            className="w-full"
            disabled={visitForm.formState.isSubmitting}
          >
            {visitForm.formState.isSubmitting
              ? "Saving…"
              : mode === "plan"
                ? "Save plan"
                : "Continue"}
          </Button>
        </form>
      ) : null}

      {mode === "log" && step === 2 ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            What did you order? Add dishes, then continue. You can skip with no
            items.
          </p>
          {items.map((item, index) => (
            <div
              key={item.key}
              className="bg-card space-y-2 rounded-2xl p-4 shadow-card"
            >
              <div className="space-y-1.5">
                <label className={labelClass}>Dish name</label>
                <input
                  className={fieldClass}
                  value={item.dishName}
                  onChange={(e) => {
                    const next = [...items];
                    next[index] = { ...item, dishName: e.target.value };
                    setItems(next);
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Price</label>
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={item.price}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...item, price: e.target.value };
                      setItems(next);
                    }}
                  />
                </div>
                <div className="flex items-end gap-4 pb-1 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.shared}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...item, shared: e.target.checked };
                        setItems(next);
                      }}
                    />
                    Shared
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.wouldOrderAgain}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = {
                          ...item,
                          wouldOrderAgain: e.target.checked,
                        };
                        setItems(next);
                      }}
                      className="accent-success size-4"
                    />
                    <span
                      className={
                        item.wouldOrderAgain ? "text-success font-medium" : ""
                      }
                    >
                      Order again
                    </span>
                  </label>
                </div>
              </div>
              {items.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (item.savedId) {
                      await removeOrderedItem({ id: item.savedId });
                    }
                    setItems(items.filter((i) => i.key !== item.key));
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}

          <p className="text-sm">
            Running total:{" "}
            <span className="font-medium">${runningTotal.toFixed(2)}</span>
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() =>
              setItems([
                ...items,
                {
                  key: crypto.randomUUID(),
                  dishName: "",
                  price: "",
                  shared: true,
                  wouldOrderAgain: false,
                },
              ])
            }
          >
            Add another dish
          </Button>

          <Button
            type="button"
            className="w-full"
            disabled={itemsSaving}
            onClick={() => void onItemsContinue()}
          >
            {itemsSaving ? "Saving…" : "Continue to bill"}
          </Button>
        </div>
      ) : null}

      {mode === "log" && step === 3 ? (
        <form onSubmit={onBillSubmit} className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Optional bill breakdown. Skip if you don’t have it.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="subtotal">
                Subtotal
              </label>
              <input
                id="subtotal"
                className={fieldClass}
                inputMode="decimal"
                {...billForm.register("subtotal")}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="tip">
                Tip
              </label>
              <input
                id="tip"
                className={fieldClass}
                inputMode="decimal"
                {...billForm.register("tip")}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="totalPaid">
                Total
              </label>
              <input
                id="totalPaid"
                className={fieldClass}
                inputMode="decimal"
                {...billForm.register("totalPaid")}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="paymentSplit">
                Split
              </label>
              <select
                id="paymentSplit"
                className={fieldClass}
                {...billForm.register("paymentSplit")}
              >
                <option value="">—</option>
                {paymentSplitSchema.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="paymentMethod">
                Method
              </label>
              <input
                id="paymentMethod"
                className={fieldClass}
                {...billForm.register("paymentMethod")}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={billForm.formState.isSubmitting}
          >
            {billForm.formState.isSubmitting
              ? "Saving…"
              : "Continue to review"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => skipBill()}
          >
            Skip bill
          </Button>
        </form>
      ) : null}

      {mode === "log" && step === 4 && visitId ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Your review — independent from your partner&apos;s.
          </p>
          <RateVisitForm
            visitId={visitId}
            dishes={items
              .filter((i) => i.savedId && i.dishName.trim())
              .map((i) => ({
                id: i.savedId!,
                dishName: i.dishName.trim(),
              }))}
            onSkip={finishWithoutRating}
            onSuccess={() => {
              setPendingSync(false);
              void clearDraft();
            }}
            onOfflineQueued={() => setPendingSync(true)}
            submitLabel="Save review"
          />
        </div>
      ) : null}
    </div>
  );
}
