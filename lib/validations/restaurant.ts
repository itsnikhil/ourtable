import { z } from "zod";

export const priceRangeSchema = z.enum(["LOW", "MID", "HIGH", "LUXE"]);
export const restaurantStatusSchema = z.enum(["WISHLIST", "VISITED", "PLANNED"]);
export const opinionTagSchema = z.enum([
  "FAVORITE",
  "LIKE_IT",
  "SOK",
  "HAVENT_TRIED",
  "DISLIKE",
]);
export const tagCategorySchema = z.enum(["VIBE", "FOOD_TYPE", "METHOD"]);

export const createRestaurantSchema = z.object({
  name: z.string().min(1).max(200),
  priceRange: priceRangeSchema.optional(),
  website: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  lat: z.string().optional(), // stringified decimal, from Nominatim lookup
  lng: z.string().optional(),
  neighborhood: z.string().max(100).optional(),
  area: z.string().max(100).optional(),
  supportsDelivery: z.boolean().default(false),
  supportsDineIn: z.boolean().default(false),
  supportsTakeout: z.boolean().default(false),
  menuUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
  tagIds: z.array(z.string()).max(30).default([]), // existing tags to attach on create
  newTagNames: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        category: tagCategorySchema,
      }),
    )
    .max(10)
    .default([]),
  // LLD §2.2 — not in §2.1 object literal, but required for duplicate override path
  forceCreate: z.boolean().optional(),
});

export const updateRestaurantSchema = createRestaurantSchema.partial().extend({
  id: z.string(),
  status: restaurantStatusSchema.optional(),
});

export const setRestaurantOpinionSchema = z.object({
  restaurantId: z.string(),
  tag: opinionTagSchema,
});
