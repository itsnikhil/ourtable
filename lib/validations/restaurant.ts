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

const nullableUrl = z.union([z.string().url(), z.null()]);
const nullableText = (max: number) => z.union([z.string().max(max), z.null()]);

export const updateRestaurantSchema = createRestaurantSchema.partial().extend({
  id: z.string(),
  status: restaurantStatusSchema.optional(),
  priceRange: priceRangeSchema.nullable().optional(),
  website: nullableUrl.optional(),
  phone: nullableText(30).optional(),
  address: nullableText(300).optional(),
  lat: z.union([z.string(), z.null()]).optional(),
  lng: z.union([z.string(), z.null()]).optional(),
  neighborhood: nullableText(100).optional(),
  area: nullableText(100).optional(),
  menuUrl: nullableUrl.optional(),
  notes: nullableText(2000).optional(),
  tagIds: z.array(z.string()).max(30).optional(),
  newTagNames: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        category: tagCategorySchema,
      }),
    )
    .max(10)
    .optional(),
});

export const setRestaurantOpinionSchema = z.object({
  restaurantId: z.string(),
  tag: opinionTagSchema,
});
