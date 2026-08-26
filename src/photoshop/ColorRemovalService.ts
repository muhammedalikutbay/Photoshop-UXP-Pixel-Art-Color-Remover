import { buildPixelMask } from "../core/matching/PixelMaskBuilder";
import { PhotoshopOperationError } from "./PhotoshopErrors";
import type { PhotoshopDocument, PhotoshopExecutionContext, PhotoshopImageData, PhotoshopModule, RemovalRequest, RemovalResult } from "./PhotoshopTypes";

declare const require: (moduleName: "photoshop") => PhotoshopModule;

const RGB_PROFILE = "sRGB IEC61966-2.1";
const GRAY_PROFILE = "Gray Gamma 2.2";

function getPhotoshop(): PhotoshopModule { return require("photoshop"); }

function validateTarget(document: PhotoshopDocument, request: RemovalRequest): void {
  const ps = getPhotoshop();
  if (request.colors.length === 0) throw new PhotoshopOperationError("Add at least one color before running the operation.", "EMPTY_COLORS");
  if (!Number.isInteger(request.tolerance) || request.tolerance < 0 || request.tolerance > 255) throw new PhotoshopOperationError("Tolerance must be an integer from 0 to 255.", "INVALID_TOLERANCE");
  if (document.mode !== ps.constants.DocumentMode.RGB || document.bitsPerChannel !== ps.constants.BitsPerChannelType.EIGHT) throw new PhotoshopOperationError("V1 supports RGB documents at 8 bits/channel only.", "UNSUPPORTED_DOCUMENT");
  const layer = document.activeLayers[0];
  if (!layer) throw new PhotoshopOperationError("Select an active pixel layer first.", "NO_ACTIVE_LAYER");
  if (layer.kind !== ps.constants.LayerKind.NORMAL) throw new PhotoshopOperationError("The active layer must be a pixel layer.", "UNSUPPORTED_LAYER");
  if (layer.locked || layer.pixelsLocked) throw new PhotoshopOperationError("Unlock the active layer before editing it.", "LOCKED_LAYER");
}

async function runRemoval(context: PhotoshopExecutionContext, request: RemovalRequest): Promise<RemovalResult> {
  if (context.isCancelled) throw new PhotoshopOperationError("Operation cancelled.", "CANCELLED");
  const ps = getPhotoshop();
  const document = ps.app.activeDocument;
  validateTarget(document, request);
  const layer = document.activeLayers[0]!;
  const pixelData = await ps.imaging.getPixels({
    documentID: document.id,
    layerID: layer.id,
    sourceBounds: layer.boundsNoEffects,
    colorSpace: "RGB",
    colorProfile: RGB_PROFILE,
    componentSize: 8
  });

  let sourceImage: PhotoshopImageData | undefined = pixelData.imageData;
  let selectionImage: PhotoshopImageData | undefined;
  try {
    const data = await sourceImage.getData({ chunky: true });
    const maskResult = buildPixelMask({ data, width: sourceImage.width, height: sourceImage.height, components: sourceImage.components === 4 ? 4 : 3 }, request.colors, request.tolerance);
    if (maskResult.matchedPixels === 0) {
      await document.selection.deselect();
      throw new PhotoshopOperationError("No matching pixels were found.", "EMPTY_SELECTION");
    }
    selectionImage = await ps.imaging.createImageDataFromBuffer(maskResult.mask, {
      width: sourceImage.width,
      height: sourceImage.height,
      components: 1,
      chunky: true,
      colorSpace: "Grayscale",
      colorProfile: GRAY_PROFILE
    });
    await ps.imaging.putSelection({
      documentID: document.id,
      imageData: selectionImage,
      replace: true,
      targetBounds: { left: pixelData.sourceBounds.left, top: pixelData.sourceBounds.top },
      commandName: request.deletePixels ? "Select and Delete Matching Colors" : "Select Matching Colors"
    });
    if (context.isCancelled) throw new PhotoshopOperationError("Operation cancelled.", "CANCELLED");
    if (request.deletePixels) {
      await layer.clear();
      await document.selection.deselect();
    }
    return { matchedPixels: maskResult.matchedPixels, deleted: request.deletePixels };
  } finally {
    selectionImage?.dispose();
    sourceImage?.dispose();
    sourceImage = undefined;
  }
}

export async function removeMatchingColors(request: RemovalRequest): Promise<RemovalResult> {
  const ps = getPhotoshop();
  return ps.core.executeAsModal(async (context) => {
    const document = ps.app.activeDocument;
    const suspension = await context.hostControl.suspendHistory({ documentID: document.id, name: request.deletePixels ? "Select and Delete Matching Colors" : "Select Matching Colors" });
    try {
      const result = await runRemoval(context, request);
      await context.hostControl.resumeHistory(suspension, true);
      return result;
    } catch (error) {
      await context.hostControl.resumeHistory(suspension, false);
      throw error;
    }
  }, { commandName: request.deletePixels ? "Select and Delete Matching Colors" : "Select Matching Colors" });
}
