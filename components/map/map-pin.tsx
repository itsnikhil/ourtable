import { PIN_COLOR, type PlacedPin } from "@/components/map/pin-utils";
import { cn } from "@/lib/utils";

export function MapPin({
  pin,
  selected,
  onSelect,
}: {
  pin: PlacedPin;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const fill = PIN_COLOR[pin.status];

  return (
    <button
      type="button"
      aria-label={pin.name}
      aria-pressed={selected}
      onClick={() => onSelect(pin.id)}
      className={cn(
        "absolute z-10 -translate-x-1/2 -translate-y-[92%] transition-transform",
        selected ? "z-20 scale-125" : "hover:scale-110",
      )}
      style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
    >
      <svg
        width="28"
        height="36"
        viewBox="0 0 28 36"
        aria-hidden
        className="drop-shadow-md"
      >
        <path
          d="M14 1.5C7.1 1.5 1.5 7.1 1.5 14c0 9.4 12.5 20 12.5 20s12.5-10.6 12.5-20C26.5 7.1 20.9 1.5 14 1.5z"
          fill={fill}
        />
        <circle cx="14" cy="13.5" r="5.25" fill="white" />
      </svg>
    </button>
  );
}
