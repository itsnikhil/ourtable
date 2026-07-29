import { z } from "zod";

const orderedItemObjectSchema = z.object({
  visitId: z.string(),
  dishName: z.string().min(1).max(150),
  price: z.string().optional(),
  shared: z.boolean().default(true),
  orderedById: z.string().optional(), // required if shared=false; validated server-side
  wouldOrderAgain: z.boolean().optional(),
});

export const orderedItemSchema = orderedItemObjectSchema.refine(
  (v) => v.shared || !!v.orderedById,
  {
    message: "orderedById is required when shared=false",
    path: ["orderedById"],
  },
);

// LLD writes `orderedItemSchema.partial()` — ZodEffects has no .partial(), so partial the object.
export const updateOrderedItemSchema = orderedItemObjectSchema.partial().extend({
  id: z.string(),
});
