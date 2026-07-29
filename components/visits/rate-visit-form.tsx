"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { submitVisitRating } from "@/lib/actions/rating-actions";
import { withOfflineAwareness } from "@/lib/offline";
import {
  submitRatingSchema,
  wouldReturnSchema,
} from "@/lib/validations/rating";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fieldClass =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-lg border px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass = "text-sm font-medium";

const CATEGORIES = [
  ["food", "Food"],
  ["service", "Service"],
  ["atmosphere", "Atmosphere"],
  ["value", "Value"],
  ["drinks", "Drinks"],
  ["presentation", "Presentation"],
  ["waitingTime", "Waiting time"],
  ["cleanliness", "Cleanliness"],
] as const;

function emptyToUndef(v: unknown) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function optionalStar(v: unknown) {
  if (v === "" || v == null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** UI coercion around LLD submitRatingSchema. */
const rateFormSchema = z.object({
  overallRating: z.preprocess((v) => {
    if (v === "" || v == null) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().min(0).max(10).multipleOf(0.5)),
  food: z.preprocess(optionalStar, z.number().int().min(1).max(5).optional()),
  service: z.preprocess(
    optionalStar,
    z.number().int().min(1).max(5).optional(),
  ),
  atmosphere: z.preprocess(
    optionalStar,
    z.number().int().min(1).max(5).optional(),
  ),
  value: z.preprocess(optionalStar, z.number().int().min(1).max(5).optional()),
  drinks: z.preprocess(optionalStar, z.number().int().min(1).max(5).optional()),
  presentation: z.preprocess(
    optionalStar,
    z.number().int().min(1).max(5).optional(),
  ),
  waitingTime: z.preprocess(
    optionalStar,
    z.number().int().min(1).max(5).optional(),
  ),
  cleanliness: z.preprocess(
    optionalStar,
    z.number().int().min(1).max(5).optional(),
  ),
  wouldReturn: z.preprocess(emptyToUndef, wouldReturnSchema.optional()),
  favoriteDishId: z.preprocess(emptyToUndef, z.string().optional()),
  reviewText: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
});

type RateFormValues = z.input<typeof rateFormSchema>;

export type RateDishOption = { id: string; dishName: string };

export function RateVisitForm({
  visitId,
  dishes,
  redirectTo,
  onSkip,
  onSuccess,
  onOfflineQueued,
  submitLabel = "Save review",
}: {
  visitId: string;
  dishes: RateDishOption[];
  redirectTo?: string;
  onSkip?: () => void;
  /** Fired after a successful submit, before navigate (e.g. clear offline draft). */
  onSuccess?: () => void;
  /** Fired when submit is deferred because we appear offline. */
  onOfflineQueued?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [willSync, setWillSync] = useState(false);
  const pendingPayloadRef = useRef<ReturnType<typeof submitRatingSchema.parse> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RateFormValues>({
    resolver: zodResolver(rateFormSchema),
    defaultValues: {
      overallRating: 8,
      food: "",
      service: "",
      atmosphere: "",
      value: "",
      drinks: "",
      presentation: "",
      waitingTime: "",
      cleanliness: "",
      wouldReturn: "",
      favoriteDishId: "",
      reviewText: "",
    },
  });

  async function submitPayload(
    payload: ReturnType<typeof submitRatingSchema.parse>,
  ) {
    const outcome = await withOfflineAwareness(() => submitVisitRating(payload));
    if (!outcome.ok) {
      if (outcome.offline) {
        pendingPayloadRef.current = payload;
        setWillSync(true);
        setServerError(null);
        onOfflineQueued?.();
        return false;
      }
      setServerError("Something went wrong.");
      return false;
    }
    if (!outcome.data.success) {
      setServerError(outcome.data.error.message);
      return false;
    }
    setWillSync(false);
    pendingPayloadRef.current = null;
    onSuccess?.();
    const dest = redirectTo ?? `/visits/${visitId}`;
    router.push(dest);
    router.refresh();
    return true;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const parsed = rateFormSchema.parse(values);
    const payload = submitRatingSchema.parse({
      visitId,
      ...parsed,
    });
    await submitPayload(payload);
  });

  useEffect(() => {
    function onOnline() {
      const pending = pendingPayloadRef.current;
      if (!pending) return;
      void submitPayload(pending);
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [visitId]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {willSync ? (
        <p className="border-border bg-muted/40 rounded-lg border p-3 text-sm">
          Saved on this device — will sync when you&apos;re back online.
        </p>
      ) : null}
      {serverError ? (
        <p className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
          {serverError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label className={labelClass} htmlFor="overallRating">
          Overall (0–10) <span className="text-destructive">*</span>
        </label>
        <input
          id="overallRating"
          type="number"
          min={0}
          max={10}
          step={0.5}
          className={fieldClass}
          {...register("overallRating")}
        />
        {errors.overallRating ? (
          <p className="text-destructive text-xs">
            {errors.overallRating.message}
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Categories (1–5, optional)</legend>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map(([name, label]) => (
            <div key={name} className="space-y-1">
              <label className="text-muted-foreground text-xs" htmlFor={name}>
                {label}
              </label>
              <input
                id={name}
                type="number"
                min={1}
                max={5}
                step={1}
                className={fieldClass}
                {...register(name)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label className={labelClass} htmlFor="wouldReturn">
          Would you return?
        </label>
        <select
          id="wouldReturn"
          className={fieldClass}
          {...register("wouldReturn")}
        >
          <option value="">—</option>
          {wouldReturnSchema.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {dishes.length > 0 ? (
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor="favoriteDishId">
            Favorite dish
          </label>
          <select
            id="favoriteDishId"
            className={fieldClass}
            {...register("favoriteDishId")}
          >
            <option value="">—</option>
            {dishes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.dishName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className={labelClass} htmlFor="reviewText">
          Review
        </label>
        <textarea
          id="reviewText"
          rows={3}
          className={cn(fieldClass, "h-auto py-2")}
          {...register("reviewText")}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
      {onSkip ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onSkip}
        >
          Skip for now
        </Button>
      ) : null}
    </form>
  );
}
