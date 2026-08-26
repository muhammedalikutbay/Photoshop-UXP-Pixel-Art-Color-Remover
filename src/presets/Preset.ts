import type { RGBColor } from "../core/color/Color";

export interface Preset {
  readonly schemaVersion: 1;
  readonly name: string;
  readonly colors: readonly RGBColor[];
  readonly tolerance: number;
}

export function createPreset(name: string, colors: readonly RGBColor[], tolerance: number): Preset {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Preset name cannot be empty.");
  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) throw new Error("Preset tolerance must be an integer from 0 to 255.");
  return { schemaVersion: 1, name: trimmedName, colors: [...colors], tolerance };
}
