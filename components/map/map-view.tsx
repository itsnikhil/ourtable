"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crosshair } from "lucide-react";
import { FilterChip } from "@/components/design/filter-chip";
import { MapPin } from "@/components/map/map-pin";
import { placePins, type MapPinRestaurant } from "@/components/map/pin-utils";
import { SelectedRestaurantCard } from "@/components/map/selected-restaurant-card";
import type { RestaurantDetail } from "@/lib/queries/restaurant-queries";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "WISHLIST", label: "Wishlist" },
  { id: "VISITED", label: "Visited" },
  { id: "PLANNED", label: "Planned" },
] as const;

type StatusFilter = (typeof FILTERS)[number]["id"];

export function MapView({
  pins,
  selectedId,
  selectedDetail,
}: {
  pins: MapPinRestaurant[];
  selectedId: string | null;
  selectedDetail: RestaurantDetail | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [localSelectedId, setLocalSelectedId] = useState(selectedId);

  useEffect(() => {
    setLocalSelectedId(selectedId);
  }, [selectedId]);

  const placed = useMemo(() => placePins(pins), [pins]);
  const visible = useMemo(
    () =>
      filter === "ALL"
        ? placed
        : placed.filter((pin) => pin.status === filter),
    [filter, placed],
  );

  const selectedPin =
    visible.find((pin) => pin.id === localSelectedId) ?? null;

  function selectPin(id: string) {
    setLocalSelectedId(id);
    router.replace(`/map?r=${id}`, { scroll: false });
  }

  function recenter() {
    setLocalSelectedId(null);
    router.replace("/map?r=none", { scroll: false });
  }

  return (
    <div className="relative -mx-4 -mt-6 h-[calc(100dvh-6rem)] overflow-hidden">
      <h1 className="sr-only">Map</h1>

      <div
        className="absolute inset-0 bg-[#E6E4E0]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.55) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.55) 1px, transparent 1px),
            linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px, 48px 48px, 12px 12px, 12px 12px",
        }}
      />

      {pins.length === 0 ? (
        <p className="text-muted-foreground absolute inset-0 z-10 flex items-center justify-center px-8 text-center text-sm">
          No restaurants with a location yet. Add a place with an address to
          see it here.
        </p>
      ) : (
        visible.map((pin) => (
          <MapPin
            key={pin.id}
            pin={pin}
            selected={pin.id === localSelectedId}
            onSelect={selectPin}
          />
        ))
      )}

      <div className="absolute inset-x-0 top-0 z-20 flex gap-2 overflow-x-auto px-4 pt-4 pb-2">
        {FILTERS.map((chip) => (
          <FilterChip
            key={chip.id}
            active={filter === chip.id}
            onClick={() => setFilter(chip.id)}
          >
            {chip.label}
          </FilterChip>
        ))}
      </div>

      <button
        type="button"
        aria-label="Recenter map"
        onClick={recenter}
        className={cn(
          "bg-card absolute right-4 z-20 flex size-11 items-center justify-center rounded-full shadow-card",
          selectedPin ? "bottom-36" : "bottom-6",
        )}
      >
        <Crosshair className="size-5" strokeWidth={1.75} aria-hidden />
      </button>

      {selectedPin ? (
        <div className="absolute inset-x-4 bottom-3 z-30">
          <SelectedRestaurantCard
            pin={selectedPin}
            detail={selectedDetail}
          />
        </div>
      ) : null}
    </div>
  );
}
