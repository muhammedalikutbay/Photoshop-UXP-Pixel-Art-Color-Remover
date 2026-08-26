import { describe, expect, it } from "vitest";
import { formatHex } from "../src/core/color/Color";
import { parseHex } from "../src/core/color/ColorParser";
import { buildPixelMask } from "../src/core/matching/PixelMaskBuilder";
import { createPreset } from "../src/presets/Preset";

describe("color parsing", () => {
  it("parses six-digit HEX with or without #", () => {
    expect(parseHex("#ff00AA")).toEqual({ red: 255, green: 0, blue: 170 });
    expect(formatHex(parseHex("00ff00")!)).toBe("#00FF00");
  });

  it("rejects malformed HEX values", () => {
    expect(parseHex("#fff")).toBeNull();
    expect(parseHex("#GG0000")).toBeNull();
    expect(parseHex("red")).toBeNull();
  });
});

describe("pixel mask builder", () => {
  it("combines multiple colors into one binary mask", () => {
    const result = buildPixelMask(
      {
        width: 3,
        height: 1,
        components: 3,
        data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255])
      },
      [{ red: 255, green: 0, blue: 0 }, { red: 0, green: 0, blue: 255 }],
      0
    );

    expect(result.mask).toEqual(new Uint8Array([255, 0, 255]));
    expect(result.matchedPixels).toBe(2);
  });

  it("ignores fully transparent pixels", () => {
    const result = buildPixelMask(
      { width: 1, height: 1, components: 4, data: new Uint8Array([255, 0, 0, 0]) },
      [{ red: 255, green: 0, blue: 0 }],
      0
    );

    expect(result.matchedPixels).toBe(0);
    expect(result.mask[0]).toBe(0);
  });

  it("matches near colors within tolerance", () => {
    const result = buildPixelMask(
      { width: 1, height: 1, components: 3, data: new Uint8Array([110, 100, 100]) },
      [{ red: 100, green: 100, blue: 100 }],
      5
    );

    expect(result.matchedPixels).toBe(0);
    expect(buildPixelMask(
      { width: 1, height: 1, components: 3, data: new Uint8Array([110, 100, 100]) },
      [{ red: 100, green: 100, blue: 100 }],
      6
    ).matchedPixels).toBe(1);
  });
});

describe("presets", () => {
  it("creates a versioned preset with a defensive color list", () => {
    const colors = [{ red: 255, green: 0, blue: 255 }];
    const preset = createPreset("  Pixel Art  ", colors, 0);
    colors.push({ red: 0, green: 0, blue: 0 });

    expect(preset).toEqual({
      schemaVersion: 1,
      name: "Pixel Art",
      colors: [{ red: 255, green: 0, blue: 255 }],
      tolerance: 0
    });
  });

  it("rejects invalid preset input", () => {
    expect(() => createPreset("", [], 0)).toThrow("Preset name cannot be empty");
    expect(() => createPreset("Bad", [], 256)).toThrow("Preset tolerance");
  });
});
