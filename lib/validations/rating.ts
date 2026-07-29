import { z } from "zod";

export const wouldReturnSchema = z.enum(["YES", "MAYBE", "NO"]);
const starScore = z.number().int().min(1).max(5).optional();

export const submitRatingSchema = z.object({
  visitId: z.string(),
  overallRating: z.number().min(0).max(10).multipleOf(0.5),
  food: starScore,
  service: starScore,
  atmosphere: starScore,
  value: starScore,
  drinks: starScore,
  presentation: starScore,
  waitingTime: starScore,
  cleanliness: starScore,
  wouldReturn: wouldReturnSchema.optional(),
  favoriteDishId: z.string().optional(),
  reviewText: z.string().max(2000).optional(),
});
