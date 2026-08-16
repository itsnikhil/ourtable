"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function RatingStars({
  value,
  scale = "stars",
  size = "md",
  interactive = false,
  onChange,
  label,
  className,
}: {
  /** Category 1–5, or overall 0–10 when `scale="overall"`. */
  value: number;
  scale?: "stars" | "overall";
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (next: number) => void;
  label?: string;
  className?: string;
}) {
  const starCount = 5;
  const numericMax = scale === "overall" ? 10 : 5;
  const filledStars =
    scale === "overall"
      ? (clamp(value, 0, numericMax) / numericMax) * starCount
      : clamp(value, 0, starCount);

  const px = size === "sm" ? "size-4" : size === "lg" ? "size-7" : "size-5";

  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      role={interactive ? "radiogroup" : "img"}
      aria-label={
        label ??
        `${value.toFixed(scale === "overall" ? 1 : 0)} out of ${numericMax}`
      }
    >
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: starCount }, (_, i) => {
          const starValue =
            scale === "overall"
              ? ((i + 1) / starCount) * numericMax
              : i + 1;
          const fill = clamp(filledStars - i, 0, 1);
          const checked =
            scale === "overall"
              ? value + 0.01 >= starValue
              : Math.round(value) === starValue;

          const star = (
            <span className="relative inline-flex text-gold">
              <Star className={cn(px, "text-border")} aria-hidden />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={cn(px, "fill-gold text-gold")} aria-hidden />
              </span>
            </span>
          );

          if (!interactive) {
            return <span key={i}>{star}</span>;
          }

          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${starValue}`}
              className="rounded-full focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => onChange?.(starValue)}
            >
              {star}
            </button>
          );
        })}
      </span>
      {scale === "overall" ? (
        <span className="text-foreground text-sm font-medium tabular-nums">
          {Number.isFinite(value) ? value.toFixed(1) : "—"}
        </span>
      ) : null}
    </div>
  );
}
