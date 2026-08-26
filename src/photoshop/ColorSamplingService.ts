import { PhotoshopOperationError } from "./PhotoshopErrors";
import type { RGBColor } from "../core/color/Color";
import type { PhotoshopModule } from "./PhotoshopTypes";

const RGB_PROFILE = "sRGB IEC61966-2.1";

declare const require: (moduleName: "photoshop") => PhotoshopModule;

export interface SamplingPreview {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly sourceBounds: { left: number; top: number; right: number; bottom: number };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeBounds(raw: { left: number; top: number; right: number; bottom: number }): SamplingPreview["sourceBounds"] {
  const bounds = {
    left: Number(raw.left),
    top: Number(raw.top),
    right: Number(raw.right),
    bottom: Number(raw.bottom)
  };
  if (!Object.values(bounds).every(Number.isFinite) || bounds.right <= bounds.left || bounds.bottom <= bounds.top) {
    throw new PhotoshopOperationError("Photoshop returned invalid preview bounds.", "UNSUPPORTED_DOCUMENT");
  }
  return bounds;
}

export function createColorSamplingService(ps: PhotoshopModule) {
  return {
    async createPreview(maxWidth = 320): Promise<SamplingPreview> {
      if (ps.app.documents.length === 0) throw new PhotoshopOperationError("Open a Photoshop document before using the eyedropper.", "NO_DOCUMENT");
      const document = ps.app.activeDocument;
      const documentWidth = Math.max(1, Math.floor(document.width));
      const documentHeight = Math.max(1, Math.floor(document.height));
      const previewWidth = Math.max(1, Math.min(maxWidth, documentWidth));
      const result = await ps.imaging.getPixels({
        documentID: document.id,
        sourceBounds: { left: 0, top: 0, right: documentWidth, bottom: documentHeight },
        colorSpace: "RGB",
        colorProfile: RGB_PROFILE,
        componentSize: 8,
        targetSize: { width: previewWidth },
        applyAlpha: true
      });

      try {
        const encoded = await ps.imaging.encodeImageData({ imageData: result.imageData, base64: true });
        const sourceBounds = normalizeBounds(result.sourceBounds);
        return {
          dataUrl: `data:image/jpeg;base64,${encoded}`,
          width: result.imageData.width,
          height: result.imageData.height,
          sourceBounds
        };
      } finally {
        result.imageData.dispose();
      }
    },

    async samplePreview(preview: SamplingPreview, offsetX: number, offsetY: number, displayWidth: number, displayHeight: number): Promise<RGBColor> {
      if (displayWidth <= 0 || displayHeight <= 0) throw new Error("The eyedropper preview is not ready.");
      const xRatio = clamp(offsetX / displayWidth, 0, 0.999999);
      const yRatio = clamp(offsetY / displayHeight, 0, 0.999999);
      const x = Math.floor(preview.sourceBounds.left + xRatio * (preview.sourceBounds.right - preview.sourceBounds.left));
      const y = Math.floor(preview.sourceBounds.top + yRatio * (preview.sourceBounds.bottom - preview.sourceBounds.top));
      const color = await ps.app.activeDocument.sampleColor({ x, y });
      return { red: color.rgb.red, green: color.rgb.green, blue: color.rgb.blue };
    }
  };
}

export function createDefaultColorSamplingService() {
  return createColorSamplingService(require("photoshop"));
}

export async function createSamplingPreview(ps: PhotoshopModule, maxWidth?: number): Promise<SamplingPreview> {
  return createColorSamplingService(ps).createPreview(maxWidth);
}
