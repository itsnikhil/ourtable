export const CHIP_HUES = [
  "peach",
  "sage",
  "lavender",
  "rose",
  "sand",
] as const;

export type ChipHue = (typeof CHIP_HUES)[number];

export type ChipColor = {
  hue: ChipHue;
  background: string;
  foreground: string;
};

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function chipColorForTag(input: {
  name?: string | null;
  category?: string | null;
}): ChipColor {
  const key = (input.name ?? input.category ?? "").trim().toLowerCase();
  const index = key ? hashString(key) % CHIP_HUES.length : 0;
  const hue = CHIP_HUES[index]!;
  return {
    hue,
    background: `var(--chip-${hue}-bg)`,
    foreground: `var(--chip-${hue}-fg)`,
  };
}
