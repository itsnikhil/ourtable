import { z } from "zod";

export const mealSchema = z.enum(["BREAKFAST", "LUNCH", "DINNER"]);
export const dineTypeSchema = z.enum(["DINE_IN", "DELIVERY", "TAKEOUT"]);
export const visitStatusSchema = z.enum(["PLANNED", "COMPLETED"]);
export const paymentSplitSchema = z.enum(["EQUAL", "INDIVIDUAL", "ONE_PAID"]);

const createVisitObjectSchema = z.object({
  restaurantId: z.string(),
  visitDate: z.string().datetime(), // ISO date; time-of-day may be midnight if visitTime is separate
  visitTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  meal: mealSchema.optional(),
  dineType: dineTypeSchema.optional(),
  occasion: z.string().max(100).optional(),
  partySize: z.number().int().min(1).max(50).optional(),
  seating: z.string().max(50).optional(),
  status: visitStatusSchema, // caller decides: "log a visit that happened" vs "plan a future one"
});

export const createVisitSchema = createVisitObjectSchema.refine(
  (v) => v.status !== "PLANNED" || new Date(v.visitDate) >= new Date(),
  {
    message: "Planned visits must be dated today or later",
    path: ["visitDate"],
  },
);

// LLD writes `createVisitSchema.partial()` — ZodEffects (from .refine) has no .partial(),
// so partial is applied to the object shape, then id is added.
export const updateVisitSchema = createVisitObjectSchema.partial().extend({
  id: z.string(),
});

export const billSchema = z.object({
  visitId: z.string(),
  subtotal: z.string().optional(),
  tip: z.string().optional(),
  totalPaid: z.string().optional(),
  paymentSplit: paymentSplitSchema.optional(),
  paymentMethod: z.string().max(100).optional(),
});

export const rescheduleVisitSchema = z.object({
  id: z.string(),
  visitDate: z.string().datetime(),
  visitTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});
