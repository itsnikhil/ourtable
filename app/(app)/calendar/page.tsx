import Link from "next/link";
import { listVisitsInRange } from "@/lib/queries/visit-queries";
import { CalendarViews } from "@/components/calendar/calendar-views";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function monthBounds(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;
  const monthIndex = Math.min(Math.max(month, 1), 12) - 1;
  const { start, end } = monthBounds(year, monthIndex);
  const visits = await listVisitsInRange(start, end);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl">Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Plans and logged visits — month grid or timeline.
          </p>
        </div>
        <Link
          href="/visits/new?mode=plan"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Plan visit
        </Link>
      </div>
      <CalendarViews year={year} monthIndex={monthIndex} visits={visits} />
    </div>
  );
}
