"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FilterChip } from "@/components/design/filter-chip";

export function ExploreFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const cuisine = params.get("cuisine");
  const neighborhood = params.get("neighborhood");
  const sort = params.get("sort");

  function push(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `/explore?${qs}` : "/explore");
  }

  function copy() {
    return new URLSearchParams(params.toString());
  }

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <FilterChip
        active={Boolean(cuisine)}
        onClick={() => {
          if (!cuisine) return;
          const next = copy();
          next.delete("cuisine");
          push(next);
        }}
      >
        Cuisine
      </FilterChip>
      <FilterChip
        active={Boolean(neighborhood)}
        onClick={() => {
          if (!neighborhood) return;
          const next = copy();
          next.delete("neighborhood");
          push(next);
        }}
      >
        Location
      </FilterChip>
      <FilterChip
        active={sort === "rating_desc"}
        onClick={() => {
          const next = copy();
          if (sort === "rating_desc") next.delete("sort");
          else next.set("sort", "rating_desc");
          push(next);
        }}
      >
        Top Rated
      </FilterChip>
      <FilterChip onClick={() => router.push("/map")}>Nearby</FilterChip>
    </div>
  );
}
