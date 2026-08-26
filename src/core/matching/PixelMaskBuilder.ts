import type { RGBColor } from "../color/Color";

export interface PixelBuffer {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly components: 3 | 4;
}

export interface PixelMaskResult {
  readonly mask: Uint8Array;
  readonly matchedPixels: number;
}

function normalizedDistance(red: number, green: number, blue: number, color: RGBColor): number {
  const redDelta = red - color.red;
  const greenDelta = green - color.green;
  const blueDelta = blue - color.blue;
  return Math.sqrt((redDelta ** 2 + greenDelta ** 2 + blueDelta ** 2) / 3);
}

export function buildPixelMask(
  pixels: PixelBuffer,
  colors: readonly RGBColor[],
  tolerance: number
): PixelMaskResult {
  if (pixels.width < 0 || pixels.height < 0 || !Number.isInteger(pixels.width) || !Number.isInteger(pixels.height)) {
    throw new RangeError("Pixel dimensions must be non-negative integers.");
  }

  const pixelCount = pixels.width * pixels.height;
  if (pixels.data.length !== pixelCount * pixels.components) {
    throw new RangeError("Pixel buffer length does not match its dimensions.");
  }

  const mask = new Uint8Array(pixelCount);
  if (colors.length === 0) {
    return { mask, matchedPixels: 0 };
  }

  let matchedPixels = 0;
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * pixels.components;
    const alpha = pixels.components === 4 ? pixels.data[offset + 3]! : 255;
    if (alpha === 0) {
      continue;
    }

    const red = pixels.data[offset]!;
    const green = pixels.data[offset + 1]!;
    const blue = pixels.data[offset + 2]!;
    const matches = colors.some((color) => normalizedDistance(red, green, blue, color) <= tolerance);
    if (matches) {
      mask[pixelIndex] = 255;
      matchedPixels += 1;
    }
  }

  return { mask, matchedPixels };
}
