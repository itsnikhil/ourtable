import { personColorForMember } from "@/lib/design/person-colors";
import { cn } from "@/lib/utils";

export type ComparisonFigure = {
  label: string;
  score: number | null;
  index?: number | null;
  id?: string | null;
};

export function ratingComparisonGridCols(columnCount: number) {
  const n = Math.max(columnCount, 1);
  return `minmax(0,1fr) repeat(${n}, minmax(4.5rem, 5.5rem))`;
}

export function RatingComparisonRow({
  label,
  figures,
  max = 10,
  showBars = false,
  className,
}: {
  label: string;
  figures: ComparisonFigure[];
  max?: number;
  showBars?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("grid items-center gap-x-3 py-2.5", className)}
      style={{ gridTemplateColumns: ratingComparisonGridCols(figures.length) }}
    >
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm font-semibold">{label}</p>
        {showBars ? (
          <div className="flex gap-1.5">
            {figures.map((figure, i) => {
              const color = personColorForMember({
                index: figure.index ?? i,
                id: figure.id,
              });
              const pct =
                figure.score == null ? 0 : Math.min(100, (figure.score / max) * 100);
              return (
                <div
                  key={`${figure.label}-${i}`}
                  className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color.cssVar }}
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      {figures.map((figure, i) => {
        const color = personColorForMember({
          index: figure.index ?? i,
          id: figure.id,
        });
        return (
          <span
            key={`${figure.label}-score-${i}`}
            className="text-center text-lg font-semibold tabular-nums"
            style={{ color: color.cssVar }}
            title={figure.label}
          >
            {figure.score == null ? "—" : figure.score.toFixed(1)}
          </span>
        );
      })}
    </div>
  );
}
