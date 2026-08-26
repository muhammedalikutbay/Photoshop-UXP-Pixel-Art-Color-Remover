import type { RGBColor } from "./Color";

export function isRGBColor(value: RGBColor): boolean {
  return [value.red, value.green, value.blue].every(
    (component) => Number.isInteger(component) && component >= 0 && component <= 255
  );
}

export function validateTolerance(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}
