import { z } from "zod";

export const listTypeSchema = z.enum(["MANUAL", "SMART"]);

export const createListSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().max(10).optional(),
});

export const renameListSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
});

export const toggleListItemSchema = z.object({
  listId: z.string(),
  restaurantId: z.string(),
  add: z.boolean(),
});

export const deleteListSchema = z.object({
  id: z.string(),
});
