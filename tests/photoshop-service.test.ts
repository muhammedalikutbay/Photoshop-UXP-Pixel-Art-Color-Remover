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
    locked: false,
    pixelsLocked: false,
    boundsNoEffects: { left: 10, top: 20, right: 13, bottom: 21 },
    async clear() { calls.push("clear"); }
  };
  const document = {
    id: 3,
    mode: "rgb",
    bitsPerChannel: 8,
    activeLayers: [layer],
    selection: { async deselect() { calls.push("deselect"); } }
  };
  const ps = {
    app: { documents: [document], activeDocument: document },
    constants: { DocumentMode: { RGB: "rgb" }, BitsPerChannelType: { EIGHT: 8 }, LayerKind: { NORMAL: "normal" } },
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
      deletePixels: false
    });

    expect(result).toEqual({ matchedPixels: 2, deleted: false });
    expect(fixture.calls).toEqual(["suspendHistory", "putSelection", "resumeHistory:true"]);
    expect([...await fixture.selection.current!.getData()]).toEqual([255, 0, 255]);
    expect(fixture.source.disposed).toBe(true);
    expect(fixture.selection.current!.disposed).toBe(true);
  });

  it("clears and deselects in delete mode", async () => {
    const fixture = makePhotoshop(new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 0]));
    const result = await createColorRemovalService(fixture.ps)({ colors: [{ red: 255, green: 0, blue: 0 }], tolerance: 0, deletePixels: true });
    expect(result.deleted).toBe(true);
    expect(fixture.calls).toContain("clear");
    expect(fixture.calls).toContain("deselect");
  });

  it("rejects operations without an open document", async () => {
    const fixture = makePhotoshop(new Uint8Array([0, 0, 0]));
    (fixture.ps.app.documents as unknown[]).length = 0;
    await expect(createColorRemovalService(fixture.ps)({ colors: [{ red: 0, green: 0, blue: 0 }], tolerance: 0, deletePixels: false }))
      .rejects.toMatchObject({ code: "NO_DOCUMENT" } satisfies Partial<PhotoshopOperationError>);
  });
});
