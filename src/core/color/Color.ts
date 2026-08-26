export interface RGBColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export function colorKey(color: RGBColor): string {
  return `${color.red},${color.green},${color.blue}`;
}

export function formatHex(color: RGBColor): string {
  return `#${[color.red, color.green, color.blue]
    .map((component) => component.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}
