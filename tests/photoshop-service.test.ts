import { describe, expect, it } from "vitest";
import { createColorRemovalService } from "../src/photoshop/ColorRemovalService";
import type { PhotoshopImageData, PhotoshopModule } from "../src/photoshop/PhotoshopTypes";
import { PhotoshopOperationError } from "../src/photoshop/PhotoshopErrors";

function makeImage(data: Uint8Array, width: number, height: number, components: number): PhotoshopImageData & { disposed: boolean } {
  return {
    width,
    height,
    components,
    disposed: false,
    async getData() { return data; },
    dispose() { this.disposed = true; }
  };
}

function makePhotoshop(data: Uint8Array, components = 3): {
  ps: PhotoshopModule;
  source: PhotoshopImageData & { disposed: boolean };
  selection: { current?: PhotoshopImageData & { disposed: boolean } };
  calls: string[];
} {
  const calls: string[] = [];
  const source = makeImage(data, 3, 1, components);
  const selection: { current?: PhotoshopImageData & { disposed: boolean } } = {};
  const layer = {
    id: 7,
    kind: "normal",
    visible: true,
    locked: false,
    pixelsLocked: false,
    boundsNoEffects: { left: 10, top: 20, right: 13, bottom: 21 },
    async clear() { calls.push("clear"); }
  };
  const document = {
    id: 3,
    mode: "rgb",
    bitsPerChannel: 8,
    width: 3,
    height: 1,
    layers: [layer],
    activeLayers: [layer],
    selection: { async deselect() { calls.push("deselect"); } }
  };
  const ps = {
    app: { documents: [document], activeDocument: document },
    constants: { DocumentMode: { RGB: "rgb" }, BitsPerChannelType: { EIGHT: 8 }, LayerKind: { NORMAL: "normal", GROUP: "group" } },
    imaging: {
      async getPixels() { return { imageData: source, sourceBounds: document.activeLayers[0]!.boundsNoEffects }; },
      async createImageDataFromBuffer(mask: Uint8Array) {
        const image = makeImage(mask, 3, 1, 1);
        selection.current = image;
        return image;
      },
      async putSelection() { calls.push("putSelection"); }
    },
    core: {
      async executeAsModal(target: (context: any) => Promise<unknown>) {
        return target({ isCancelled: false, hostControl: {
          async suspendHistory() { calls.push("suspendHistory"); return "suspension"; },
          async resumeHistory(_id: unknown, commit = true) { calls.push(`resumeHistory:${commit}`); }
        }});
      }
    }
  } as unknown as PhotoshopModule;
  return { ps, source, selection, calls };
}

describe("Photoshop color removal service", () => {
  it("creates one combined selection and disposes image data", async () => {
    const fixture = makePhotoshop(new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]));
    const result = await createColorRemovalService(fixture.ps)({
      colors: [{ red: 255, green: 0, blue: 0 }, { red: 0, green: 0, blue: 255 }],
      tolerance: 0,
      deletePixels: false,
      target: "active-layer"
    });

    expect(result).toEqual({ matchedPixels: 2, deleted: false, processedLayers: 1, skippedLayers: 0 });
    expect(fixture.calls).toEqual(["suspendHistory", "putSelection", "resumeHistory:true"]);
    expect([...await fixture.selection.current!.getData()]).toEqual([255, 0, 255]);
    expect(fixture.source.disposed).toBe(true);
    expect(fixture.selection.current!.disposed).toBe(true);
  });

  it("clears and deselects in delete mode", async () => {
    const fixture = makePhotoshop(new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 0]));
    const result = await createColorRemovalService(fixture.ps)({ colors: [{ red: 255, green: 0, blue: 0 }], tolerance: 0, deletePixels: true, target: "active-layer" });
    expect(result.deleted).toBe(true);
    expect(fixture.calls).toContain("clear");
    expect(fixture.calls).toContain("deselect");
  });

  it("rejects operations without an open document", async () => {
    const fixture = makePhotoshop(new Uint8Array([0, 0, 0]));
    (fixture.ps.app.documents as unknown[]).length = 0;
    await expect(createColorRemovalService(fixture.ps)({ colors: [{ red: 0, green: 0, blue: 0 }], tolerance: 0, deletePixels: false, target: "active-layer" }))
      .rejects.toMatchObject({ code: "NO_DOCUMENT" } satisfies Partial<PhotoshopOperationError>);
  });

  it("rejects locked and unsupported targets before reading pixels", async () => {
    const locked = makePhotoshop(new Uint8Array([0, 0, 0]));
    (locked.ps.app.activeDocument.activeLayers[0] as { locked: boolean }).locked = true;
    await expect(createColorRemovalService(locked.ps)({ colors: [{ red: 0, green: 0, blue: 0 }], tolerance: 0, deletePixels: true, target: "active-layer" }))
      .rejects.toMatchObject({ code: "LOCKED_LAYER" } satisfies Partial<PhotoshopOperationError>);

    const unsupported = makePhotoshop(new Uint8Array([0, 0, 0]));
    (unsupported.ps.app.activeDocument.activeLayers[0] as { kind: unknown }).kind = "text";
    await expect(createColorRemovalService(unsupported.ps)({ colors: [{ red: 0, green: 0, blue: 0 }], tolerance: 0, deletePixels: true, target: "active-layer" }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_LAYER" } satisfies Partial<PhotoshopOperationError>);
  });

  it("creates one document-wide selection across visible pixel layers", async () => {
    const fixture = makePhotoshop(new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]));
    const firstLayer = fixture.ps.app.activeDocument.layers[0]!;
    (firstLayer as { boundsNoEffects: { left: number; top: number; right: number; bottom: number } }).boundsNoEffects = { left: 0, top: 0, right: 3, bottom: 1 };
    const secondLayer = { ...firstLayer, id: 8 };
    (fixture.ps.app.activeDocument as unknown as { layers: unknown[] }).layers = [firstLayer, secondLayer];

    const result = await createColorRemovalService(fixture.ps)({
      colors: [{ red: 255, green: 0, blue: 0 }, { red: 0, green: 0, blue: 255 }],
      tolerance: 0,
      deletePixels: false,
      target: "visible-layers"
    });

    expect(result).toEqual({ matchedPixels: 4, deleted: false, processedLayers: 2, skippedLayers: 0 });
    expect(fixture.calls).toEqual(["suspendHistory", "putSelection", "resumeHistory:true"]);
    expect([...await fixture.selection.current!.getData()]).toEqual([255, 0, 255]);
  });

  it("clears each visible pixel layer with its own mask", async () => {
    const fixture = makePhotoshop(new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 255]));
    const firstLayer = fixture.ps.app.activeDocument.layers[0]!;
    (firstLayer as { boundsNoEffects: { left: number; top: number; right: number; bottom: number } }).boundsNoEffects = { left: 0, top: 0, right: 3, bottom: 1 };
    const secondLayer = { ...firstLayer, id: 8 };
    (fixture.ps.app.activeDocument as unknown as { layers: unknown[] }).layers = [firstLayer, secondLayer];

    const result = await createColorRemovalService(fixture.ps)({
      colors: [{ red: 255, green: 0, blue: 0 }],
      tolerance: 0,
      deletePixels: true,
      target: "visible-layers"
    });

    expect(result.deleted).toBe(true);
    expect(fixture.calls.filter((call) => call === "putSelection")).toHaveLength(2);
    expect(fixture.calls.filter((call) => call === "clear")).toHaveLength(2);
    expect(fixture.calls).toContain("deselect");
  });

  it("traverses visible groups and reports unsupported visible layers", async () => {
    const fixture = makePhotoshop(new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 0]));
    const pixelLayer = fixture.ps.app.activeDocument.layers[0]!;
    (pixelLayer as { boundsNoEffects: { left: number; top: number; right: number; bottom: number } }).boundsNoEffects = { left: 0, top: 0, right: 3, bottom: 1 };
    const group = { id: 20, kind: "group", visible: true, layers: [pixelLayer], locked: false, pixelsLocked: false, boundsNoEffects: pixelLayer.boundsNoEffects, async clear() {} };
    const textLayer = { ...pixelLayer, id: 21, kind: "text" };
    (fixture.ps.app.activeDocument as unknown as { layers: unknown[] }).layers = [group, textLayer];

    const result = await createColorRemovalService(fixture.ps)({
      colors: [{ red: 255, green: 0, blue: 0 }],
      tolerance: 0,
      deletePixels: false,
      target: "visible-layers"
    });

    expect(result.processedLayers).toBe(1);
    expect(result.skippedLayers).toBe(1);
  });
});
