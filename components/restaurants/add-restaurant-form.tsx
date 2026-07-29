"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createRestaurant } from "@/lib/actions/restaurant-actions";
import { priceRangeSchema } from "@/lib/validations/restaurant";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function emptyToUndef(v: unknown) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

/** UI form schema: Step 1 create fields + empty coercion + cuisine helper. */
const addRestaurantFormSchema = z.object({
  name: z.string().min(1).max(200),
  priceRange: z.preprocess(
    emptyToUndef,
    priceRangeSchema.optional(),
  ),
  website: z.preprocess(
    emptyToUndef,
    z.string().url().optional(),
  ),
  phone: z.preprocess(emptyToUndef, z.string().max(30).optional()),
  address: z.preprocess(emptyToUndef, z.string().max(300).optional()),
  lat: z.preprocess(emptyToUndef, z.string().optional()),
  lng: z.preprocess(emptyToUndef, z.string().optional()),
  neighborhood: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  area: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  supportsDelivery: z.boolean().default(false),
  supportsDineIn: z.boolean().default(false),
  supportsTakeout: z.boolean().default(false),
  menuUrl: z.preprocess(emptyToUndef, z.string().url().optional()),
  notes: z.preprocess(emptyToUndef, z.string().max(2000).optional()),
  cuisine: z.string().optional(),
  forceCreate: z.boolean().optional(),
});

type FormValues = z.input<typeof addRestaurantFormSchema>;

const PRICE_OPTIONS = priceRangeSchema.options;

function parseCuisine(cuisine: string | undefined) {
  if (!cuisine?.trim()) return [];
  return cuisine
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((name) => ({ name: name.slice(0, 50), category: "FOOD_TYPE" as const }));
}

function extractMatchedId(message: string): string | null {
  const match = message.match(/\(([a-z0-9]+)\)/i);
  return match?.[1] ?? null;
}

const fieldClass =
  "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-lg border px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass = "text-sm font-medium";

export function AddRestaurantForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [matchedId, setMatchedId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(addRestaurantFormSchema),
    defaultValues: {
      name: "",
      address: "",
      neighborhood: "",
      phone: "",
      website: "",
      menuUrl: "",
      notes: "",
      cuisine: "",
      supportsDelivery: false,
      supportsDineIn: true,
      supportsTakeout: false,
      forceCreate: false,
    },
  });

  async function submitValues(values: FormValues, force = false) {
    setServerError(null);
    setMatchedId(null);

    const parsed = addRestaurantFormSchema.parse({
      ...values,
      forceCreate: force || values.forceCreate,
    });
    const result = await createRestaurant({
      name: parsed.name,
      priceRange: parsed.priceRange,
      website: parsed.website,
      phone: parsed.phone || undefined,
      address: parsed.address || undefined,
      neighborhood: parsed.neighborhood || undefined,
      area: parsed.area || undefined,
      lat: parsed.lat || undefined,
      lng: parsed.lng || undefined,
      supportsDelivery: parsed.supportsDelivery,
      supportsDineIn: parsed.supportsDineIn,
      supportsTakeout: parsed.supportsTakeout,
      menuUrl: parsed.menuUrl,
      notes: parsed.notes || undefined,
      newTagNames: parseCuisine(parsed.cuisine),
      forceCreate: parsed.forceCreate,
    });

    if (!result.success) {
      setServerError(result.error.message);
      if (result.error.code === "CONFLICT") {
        setMatchedId(extractMatchedId(result.error.message));
        setValue("forceCreate", false);
      }
      return;
    }

    router.push(`/restaurants/${result.data.id}`);
    router.refresh();
  }

  const onSubmit = handleSubmit((values) => submitValues(values));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className={labelClass}>
          Name <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          className={fieldClass}
          autoComplete="organization"
          {...register("name")}
        />
        {errors.name ? (
          <p className="text-destructive text-xs">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="cuisine" className={labelClass}>
          Cuisine tags
        </label>
        <input
          id="cuisine"
          className={fieldClass}
          placeholder="Italian, Mexican (comma-separated)"
          {...register("cuisine")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="priceRange" className={labelClass}>
            Price
          </label>
          <select
            id="priceRange"
            className={fieldClass}
            {...register("priceRange")}
            defaultValue=""
          >
            <option value="">—</option>
            {PRICE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="neighborhood" className={labelClass}>
            Neighborhood
          </label>
          <input
            id="neighborhood"
            className={fieldClass}
            {...register("neighborhood")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="address" className={labelClass}>
          Address
        </label>
        <input id="address" className={fieldClass} {...register("address")} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="phone" className={labelClass}>
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          className={fieldClass}
          {...register("phone")}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="website" className={labelClass}>
          Website
        </label>
        <input
          id="website"
          type="url"
          placeholder="https://"
          className={fieldClass}
          {...register("website")}
        />
        {errors.website ? (
          <p className="text-destructive text-xs">{errors.website.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="menuUrl" className={labelClass}>
          Menu URL
        </label>
        <input
          id="menuUrl"
          type="url"
          placeholder="https://"
          className={fieldClass}
          {...register("menuUrl")}
        />
        {errors.menuUrl ? (
          <p className="text-destructive text-xs">{errors.menuUrl.message}</p>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Features</legend>
        {(
          [
            ["supportsDineIn", "Dine-in"],
            ["supportsTakeout", "Takeout"],
            ["supportsDelivery", "Delivery"],
          ] as const
        ).map(([name, label]) => (
          <label key={name} className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register(name)} />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="notes" className={labelClass}>
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          className={cn(fieldClass, "h-auto py-2")}
          {...register("notes")}
        />
      </div>

      {serverError ? (
        <div className="border-destructive/40 bg-destructive/10 space-y-2 rounded-lg border p-3 text-sm">
          <p className="text-destructive">{serverError}</p>
          {matchedId ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/restaurants/${matchedId}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Open existing
              </Link>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => {
                  void handleSubmit((values) => submitValues(values, true))();
                }}
              >
                Create anyway
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Add restaurant"}
      </Button>
    </form>
  );
}
