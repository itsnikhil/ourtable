import { z } from "zod";

export const requestUploadSchema = z.object({
  fileName: z.string().max(200),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  fileSizeBytes: z.number().max(15 * 1024 * 1024), // 15MB cap
});

export const attachPhotoSchema = z
  .object({
    objectUrl: z.string().url(),
    visitId: z.string().optional(),
    restaurantId: z.string().optional(),
  })
  .refine((v) => !!v.visitId !== !!v.restaurantId, {
    message: "Exactly one of visitId or restaurantId is required",
  });
