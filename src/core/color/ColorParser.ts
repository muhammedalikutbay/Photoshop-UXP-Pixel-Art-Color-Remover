import type { RGBColor } from "./Color";

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

export function parseHex(value: string): RGBColor | null {
  const match = HEX_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const hex = match[1]!;
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16)
  };
}
