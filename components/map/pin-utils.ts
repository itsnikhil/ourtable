import type { RestaurantSummary } from "@/lib/queries/restaurant-queries";

export type MapPinRestaurant = Pick<
  RestaurantSummary,
  "id" | "name" | "status" | "averageRating"
> & {
  lat: string;
  lng: string;
};

export type PlacedPin = MapPinRestaurant & {
  x: number;
  y: number;
};

export const PIN_COLOR: Record<MapPinRestaurant["status"], string> = {
  WISHLIST: "#E55252",
  VISITED: "#4F805D",
  PLANNED: "#EB8D3D",
};

const INSET = 12;

export function placePins(pins: MapPinRestaurant[]): PlacedPin[] {
  const parsed = pins
    .map((pin) => ({
      ...pin,
      latN: Number(pin.lat),
      lngN: Number(pin.lng),
    }))
    .filter((pin) => Number.isFinite(pin.latN) && Number.isFinite(pin.lngN));

  if (parsed.length === 0) return [];

  let minLat = Math.min(...parsed.map((p) => p.latN));
  let maxLat = Math.max(...parsed.map((p) => p.latN));
  let minLng = Math.min(...parsed.map((p) => p.lngN));
  let maxLng = Math.max(...parsed.map((p) => p.lngN));

  const latSpan = maxLat - minLat || 0.02;
  const lngSpan = maxLng - minLng || 0.02;
  minLat -= latSpan * 0.18;
  maxLat += latSpan * 0.18;
  minLng -= lngSpan * 0.18;
  maxLng += lngSpan * 0.18;

  const usable = 100 - INSET * 2;

  return parsed.map((pin) => ({
    id: pin.id,
    name: pin.name,
    status: pin.status,
    averageRating: pin.averageRating,
    lat: pin.lat,
    lng: pin.lng,
    x: INSET + ((pin.lngN - minLng) / (maxLng - minLng)) * usable,
    y: INSET + ((maxLat - pin.latN) / (maxLat - minLat)) * usable,
  }));
}
