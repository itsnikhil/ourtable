"use server";

import { searchRestaurants } from "@/lib/queries/restaurant-queries";
import { getRestaurantDetail } from "@/lib/queries/restaurant-queries";

/** Thin picker helper for the Add Visit form (client → server). */
export async function searchRestaurantsForVisitPicker(query: string) {
  const q = query.trim();
  if (!q) return [];
  const results = await searchRestaurants(q, 8);
  return results.map((r) => ({ id: r.id, name: r.name }));
}

export async function getRestaurantLabelForVisit(restaurantId: string) {
  const detail = await getRestaurantDetail(restaurantId);
  if (!detail) return null;
  return { id: detail.id, name: detail.name };
}
