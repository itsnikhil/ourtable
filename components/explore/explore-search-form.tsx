import { Search } from "lucide-react";

export function ExploreSearchForm({ defaultQuery = "" }: { defaultQuery?: string }) {
  return (
    <form action="/explore/search" method="get">
      <label className="border-border bg-card flex h-11 items-center gap-2 rounded-xl border px-3 text-sm">
        <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="sr-only">Search restaurants</span>
        <input
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="Search cuisines, locations, dishes…"
          className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
    </form>
  );
}
