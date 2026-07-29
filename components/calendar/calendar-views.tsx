"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { VisitListItem } from "@/lib/queries/visit-queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function isFutureOrToday(dateYmd: string) {
  const today = ymd(new Date());
  return dateYmd >= today;
}

export function CalendarViews({
  year,
  monthIndex,
  visits,
}: {
  year: number;
  monthIndex: number;
  visits: VisitListItem[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"month" | "timeline">("month");

  const byDay = useMemo(() => {
    const map = new Map<string, VisitListItem[]>();
    for (const v of visits) {
      const key = ymd(new Date(v.visitDate));
      const list = map.get(key) ?? [];
      list.push(v);
      map.set(key, list);
    }
    return map;
  }, [visits]);

  const monthLabel = startOfMonth(year, monthIndex).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const prev = new Date(year, monthIndex - 1, 1);
  const next = new Date(year, monthIndex + 1, 1);

  const firstDow = startOfMonth(year, monthIndex).getDay(); // 0 Sun
  const totalDays = daysInMonth(year, monthIndex);
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ day: null, key: `pad-${i}` });
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, key: `d-${d}` });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/calendar?year=${prev.getFullYear()}&month=${prev.getMonth() + 1}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          aria-label={`Previous month, ${prev.toLocaleString(undefined, { month: "long", year: "numeric" })}`}
        >
          ←
        </Link>
        <h2 className="text-sm font-semibold">{monthLabel}</h2>
        <Link
          href={`/calendar?year=${next.getFullYear()}&month=${next.getMonth() + 1}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          aria-label={`Next month, ${next.toLocaleString(undefined, { month: "long", year: "numeric" })}`}
        >
          →
        </Link>
      </div>

      <div className="flex gap-2">
        {(
          [
            ["month", "Month"],
            ["timeline", "Timeline"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              buttonVariants({
                variant: mode === id ? "default" : "outline",
                size: "sm",
              }),
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "month" ? (
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-muted-foreground py-1 font-medium">
              {d}
            </div>
          ))}
          {cells.map((cell) => {
            if (cell.day == null) {
              return <div key={cell.key} className="min-h-14" />;
            }
            const dateKey = ymd(new Date(year, monthIndex, cell.day));
            const dayVisits = byDay.get(dateKey) ?? [];
            const planned = dayVisits.find((v) => v.status === "PLANNED");
            const hasAny = dayVisits.length > 0;
            const dayLabel = new Date(year, monthIndex, cell.day).toLocaleDateString(
              undefined,
              { weekday: "long", month: "long", day: "numeric", year: "numeric" },
            );
            const visitSummary =
              dayVisits.length === 0
                ? "No visits"
                : dayVisits
                    .map(
                      (v) =>
                        `${v.restaurantName} (${v.status === "PLANNED" ? "planned" : "completed"})`,
                    )
                    .join(", ");

            return (
              <button
                key={cell.key}
                type="button"
                aria-label={`${dayLabel}. ${visitSummary}`}
                className={cn(
                  "border-border min-h-14 rounded-md border p-1 text-left",
                  hasAny && "bg-muted/40",
                )}
                onClick={() => {
                  if (planned) {
                    router.push(`/visits/${planned.id}`);
                    return;
                  }
                  if (hasAny) {
                    router.push(`/visits/${dayVisits[0]!.id}`);
                    return;
                  }
                  if (isFutureOrToday(dateKey)) {
                    router.push(
                      `/visits/new?mode=plan&date=${dateKey}`,
                    );
                  }
                }}
              >
                <div className="font-medium" aria-hidden>
                  {cell.day}
                </div>
                {dayVisits.slice(0, 2).map((v) => (
                  <div
                    key={v.id}
                    aria-hidden
                    className={cn(
                      "truncate text-[10px] leading-tight",
                      v.status === "PLANNED"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {v.status === "PLANNED" ? "○ " : "● "}
                    {v.restaurantName}
                  </div>
                ))}
                {dayVisits.length > 2 ? (
                  <div className="text-muted-foreground text-[10px]" aria-hidden>
                    +{dayVisits.length - 2}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="divide-border divide-y text-sm">
          {visits.length === 0 ? (
            <li className="text-muted-foreground py-4">
              No visits in this month.
            </li>
          ) : (
            visits.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/visits/${v.id}`}
                  className="hover:bg-muted/50 flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium">{v.restaurantName}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(v.visitDate).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                      {v.meal ? ` · ${v.meal}` : ""}
                      {` · ${v.status}`}
                    </p>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
