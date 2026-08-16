import { MapView } from "@/components/map/map-view";
import {
  getRestaurantDetail,
  listRestaurantsForMap,
} from "@/lib/queries/restaurant-queries";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const pins = await listRestaurantsForMap();
  const { r } = await searchParams;
  const explicitNone = r === "none" || r === "";
  const selectedId = explicitNone
    ? null
    : r && pins.some((pin) => pin.id === r)
      ? r
      : (pins[0]?.id ?? null);
  const selectedDetail = selectedId
    ? await getRestaurantDetail(selectedId)
    : null;

  return (
    <MapView
      pins={pins}
      selectedId={selectedId}
      selectedDetail={selectedDetail}
    />
  );
}
