import { describe, expect, it } from "vitest";
import { createColorSamplingService } from "../src/photoshop/ColorSamplingService";
import type { PhotoshopImageData, PhotoshopModule } from "../src/photoshop/PhotoshopTypes";

function makeImage(): PhotoshopImageData & { disposed: boolean } {
  return {
    width: 2,
    height: 1,
    components: 3,
    disposed: false,
    async getData() { return new Uint8Array([0, 0, 0, 255, 255, 255]); },
    dispose() { this.disposed = true; }
  };
}

function makePhotoshop() {
  const image = makeImage();
  let sampledPosition: { x: number; y: number } | undefined;
  const document = {
    id: 4,
    width: 100,
    height: 50,
    async sampleColor(position: { x: number; y: number }) {
      sampledPosition = position;
      return { rgb: { red: 18, green: 52, blue: 86 } };
    }
  };
  const ps = {
    app: { documents: [document], activeDocument: document },
    imaging: {
      async getPixels(options: { sourceBounds: { left: number; top: number; right: number; bottom: number }; targetSize?: { width?: number } }) {
        expect(options.sourceBounds).toEqual({ left: 0, top: 0, right: 100, bottom: 50 });
        expect(options.targetSize).toEqual({ width: 80 });
        return { imageData: image, sourceBounds: { left: 0, top: 0, right: 100, bottom: 50 } };
      },
      async encodeImageData() { return "encoded-preview"; }
    }
  } as unknown as PhotoshopModule;
  return { ps, image, getSampledPosition: () => sampledPosition };
}

describe("Photoshop color sampling service", () => {
  it("creates and disposes a scaled document preview", async () => {
    const fixture = makePhotoshop();
    const preview = await createColorSamplingService(fixture.ps).createPreview(80);

    expect(preview.dataUrl).toBe("data:image/jpeg;base64,encoded-preview");
    expect(preview.width).toBe(2);
    expect(preview.sourceBounds).toEqual({ left: 0, top: 0, right: 100, bottom: 50 });
    expect(fixture.image.disposed).toBe(true);
  });

  it("maps a preview click to document coordinates and samples RGB", async () => {
    const fixture = makePhotoshop();
    const service = createColorSamplingService(fixture.ps);
    const preview = await service.createPreview(80);
    const color = await service.samplePreview(preview, 50, 10, 100, 50);

    expect(fixture.getSampledPosition()).toEqual({ x: 50, y: 10 });
    expect(color).toEqual({ red: 18, green: 52, blue: 86 });
  });
});
