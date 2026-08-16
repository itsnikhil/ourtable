import { hashString } from "@/lib/design/chip-colors";

export const PERSON_PALETTE = [
  { slot: 0, hex: "#2E7D32", cssVar: "var(--person-0)" },
  { slot: 1, hex: "#7E57C2", cssVar: "var(--person-1)" },
  { slot: 2, hex: "#B54A32", cssVar: "var(--person-2)" },
  { slot: 3, hex: "#C4843A", cssVar: "var(--person-3)" },
  { slot: 4, hex: "#4A7A8C", cssVar: "var(--person-4)" },
] as const;

export type PersonColor = (typeof PERSON_PALETTE)[number];

export function personColorForMember(input: {
  index?: number | null;
  id?: string | null;
}): PersonColor {
  if (typeof input.index === "number" && input.index >= 0) {
    return PERSON_PALETTE[input.index % PERSON_PALETTE.length]!;
  }
  if (input.id) {
    return PERSON_PALETTE[hashString(input.id) % PERSON_PALETTE.length]!;
  }
  return PERSON_PALETTE[0];
}
