import { buildPixelMask } from "../core/matching/PixelMaskBuilder";
import { PhotoshopOperationError } from "./PhotoshopErrors";
import type {
  PhotoshopDocument,
  PhotoshopExecutionContext,
  PhotoshopImageData,
  PhotoshopLayer,
  PhotoshopModule,
  RemovalRequest,
  RemovalResult
} from "./PhotoshopTypes";

declare const require: (moduleName: "photoshop") => PhotoshopModule;

const RGB_PROFILE = "sRGB IEC61966-2.1";
const GRAY_PROFILE = "Gray Gamma 2.2";

type Bounds = { left: number; top: number; right: number; bottom: number };

function getPhotoshop(): PhotoshopModule { return require("photoshop"); }

function validateTarget(ps: PhotoshopModule, document: PhotoshopDocument, request: RemovalRequest): void {
  if (request.colors.length === 0) throw new PhotoshopOperationError("Add at least one color before running the operation.", "EMPTY_COLORS");
  if (!Number.isInteger(request.tolerance) || request.tolerance < 0 || request.tolerance > 255) throw new PhotoshopOperationError("Tolerance must be an integer from 0 to 255.", "INVALID_TOLERANCE");
  if (document.mode !== ps.constants.DocumentMode.RGB || document.bitsPerChannel !== ps.constants.BitsPerChannelType.EIGHT) throw new PhotoshopOperationError("V1 supports RGB documents at 8 bits/channel only.", "UNSUPPORTED_DOCUMENT");
  if (request.target === "active-layer") {
    const layer = document.activeLayers[0];
    if (!layer) throw new PhotoshopOperationError("Select an active pixel layer first.", "NO_ACTIVE_LAYER");
    validatePixelLayer(ps, layer);
  }
}

function validatePixelLayer(ps: PhotoshopModule, layer: PhotoshopLayer): void {
  if (layer.kind !== ps.constants.LayerKind.NORMAL) throw new PhotoshopOperationError("The target must be a pixel layer.", "UNSUPPORTED_LAYER");
  if (layer.locked || layer.pixelsLocked) throw new PhotoshopOperationError("Unlock the target pixel layer before editing it.", "LOCKED_LAYER");
}

function collectVisiblePixelLayers(ps: PhotoshopModule, layers: readonly PhotoshopLayer[], parentVisible = true): { layers: PhotoshopLayer[]; skippedLayers: number } {
  const result: PhotoshopLayer[] = [];
  let skippedLayers = 0;

  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index];
    if (!layer) continue;
    const isVisible = parentVisible && layer.visible;
    if (!isVisible) continue;

    if (layer.kind === ps.constants.LayerKind.GROUP) {
      const children = collectVisiblePixelLayers(ps, layer.layers ?? [], isVisible);
      result.push(...children.layers);
      skippedLayers += children.skippedLayers;
    } else if (layer.kind === ps.constants.LayerKind.NORMAL) {
      validatePixelLayer(ps, layer);
      result.push(layer);
    } else {
      skippedLayers += 1;
    }
  }

  return { layers: result, skippedLayers };
}

function copyMaskIntoDocument(mask: Uint8Array, sourceWidth: number, sourceHeight: number, sourceBounds: Bounds, documentMask: Uint8Array, documentWidth: number, documentHeight: number): void {
  const sourceLeft = Math.floor(sourceBounds.left);
  const sourceTop = Math.floor(sourceBounds.top);
  for (let y = 0; y < sourceHeight; y += 1) {
    const documentY = sourceTop + y;
    if (documentY < 0 || documentY >= documentHeight) continue;
    for (let x = 0; x < sourceWidth; x += 1) {
      const documentX = sourceLeft + x;
      if (documentX < 0 || documentX >= documentWidth) continue;
      if (mask[y * sourceWidth + x] !== 0) documentMask[documentY * documentWidth + documentX] = 255;
    }
  }
}

async function createSelectionImage(ps: PhotoshopModule, mask: Uint8Array, width: number, height: number): Promise<PhotoshopImageData> {
  return ps.imaging.createImageDataFromBuffer(mask, {
    width,
    height,
    components: 1,
    chunky: true,
    colorSpace: "Grayscale",
    colorProfile: GRAY_PROFILE
  });
}

async function runRemoval(ps: PhotoshopModule, context: PhotoshopExecutionContext, request: RemovalRequest): Promise<RemovalResult> {
  if (context.isCancelled) throw new PhotoshopOperationError("Operation cancelled.", "CANCELLED");
  const document = ps.app.activeDocument;
  validateTarget(ps, document, request);

  const isVisibleLayers = request.target === "visible-layers";
  const targetInfo = isVisibleLayers
    ? collectVisiblePixelLayers(ps, document.layers)
    : { layers: [document.activeLayers[0]!], skippedLayers: 0 };
  if (targetInfo.layers.length === 0) {
    const suffix = targetInfo.skippedLayers > 0 ? ` ${targetInfo.skippedLayers} visible non-pixel layer${targetInfo.skippedLayers === 1 ? " was" : "s were"} skipped.` : "";
    throw new PhotoshopOperationError(`No visible pixel layers are available.${suffix}`, "NO_VISIBLE_PIXEL_LAYERS");
  }

  const documentWidth = Math.floor(document.width);
  const documentHeight = Math.floor(document.height);
  if (!Number.isInteger(documentWidth) || !Number.isInteger(documentHeight) || documentWidth <= 0 || documentHeight <= 0) {
    throw new PhotoshopOperationError("The document dimensions are not supported.", "UNSUPPORTED_DOCUMENT");
  }

  let selectionMask: Uint8Array | undefined;
  let selectionWidth = 0;
  let selectionHeight = 0;
  let selectionBounds: Bounds | undefined;
  let matchedPixels = 0;
  let processedLayers = 0;

  if (isVisibleLayers) {
    selectionWidth = documentWidth;
    selectionHeight = documentHeight;
    selectionBounds = { left: 0, top: 0, right: documentWidth, bottom: documentHeight };
    selectionMask = new Uint8Array(documentWidth * documentHeight);
  }

  for (const layer of targetInfo.layers) {
    if (context.isCancelled) throw new PhotoshopOperationError("Operation cancelled.", "CANCELLED");
    const pixelData = await ps.imaging.getPixels({
      documentID: document.id,
      layerID: layer.id,
      sourceBounds: layer.boundsNoEffects,
      colorSpace: "RGB",
      colorProfile: RGB_PROFILE,
      componentSize: 8
    });

    let sourceImage: PhotoshopImageData | undefined = pixelData.imageData;
    let layerSelection: PhotoshopImageData | undefined;
    try {
      const data = await sourceImage.getData({ chunky: true });
      const sourceWidth = sourceImage.width;
      const sourceHeight = sourceImage.height;
      const maskResult = buildPixelMask({ data, width: sourceWidth, height: sourceHeight, components: sourceImage.components === 4 ? 4 : 3 }, request.colors, request.tolerance);
      if (maskResult.matchedPixels === 0) continue;

      matchedPixels += maskResult.matchedPixels;
      processedLayers += 1;
      const actualBounds = pixelData.sourceBounds;

      if (!isVisibleLayers) {
        selectionMask = maskResult.mask;
        selectionWidth = sourceWidth;
        selectionHeight = sourceHeight;
        selectionBounds = actualBounds;
      } else {
        copyMaskIntoDocument(maskResult.mask, sourceWidth, sourceHeight, actualBounds, selectionMask!, documentWidth, documentHeight);
      }

      if (request.deletePixels && isVisibleLayers) {
        layerSelection = await createSelectionImage(ps, maskResult.mask, sourceWidth, sourceHeight);
        await ps.imaging.putSelection({
          documentID: document.id,
          imageData: layerSelection,
          replace: true,
          targetBounds: { left: actualBounds.left, top: actualBounds.top },
          commandName: "Delete Matching Colors from Visible Layers"
        });
        await layer.clear();
      }
    } finally {
      layerSelection?.dispose();
      sourceImage?.dispose();
      sourceImage = undefined;
    }
  }

  if (matchedPixels === 0 || !selectionMask || !selectionBounds) {
    await document.selection.deselect();
    const suffix = targetInfo.skippedLayers > 0 ? ` ${targetInfo.skippedLayers} visible non-pixel layer${targetInfo.skippedLayers === 1 ? " was" : "s were"} skipped.` : "";
    throw new PhotoshopOperationError(`No matching pixels were found.${suffix}`, "EMPTY_SELECTION");
  }

  if (!isVisibleLayers || !request.deletePixels) {
    const finalSelection = await createSelectionImage(ps, selectionMask, selectionWidth, selectionHeight);
    try {
      await ps.imaging.putSelection({
        documentID: document.id,
        imageData: finalSelection,
        replace: true,
        targetBounds: { left: selectionBounds.left, top: selectionBounds.top },
        commandName: request.deletePixels ? "Select and Delete Matching Colors" : "Select Matching Colors"
      });
    } finally {
      finalSelection.dispose();
    }
  }

  if (request.deletePixels) {
    if (!isVisibleLayers) await targetInfo.layers[0]!.clear();
    await document.selection.deselect();
  }

  return { matchedPixels, deleted: request.deletePixels, processedLayers, skippedLayers: targetInfo.skippedLayers };
}

export function createColorRemovalService(ps: PhotoshopModule): (request: RemovalRequest) => Promise<RemovalResult> {
  return async (request) => ps.core.executeAsModal(async (context) => {
    if (ps.app.documents.length === 0) throw new PhotoshopOperationError("Open a Photoshop document first.", "NO_DOCUMENT");
    const document = ps.app.activeDocument;
    const suspension = await context.hostControl.suspendHistory({ documentID: document.id, name: request.deletePixels ? "Select and Delete Matching Colors" : "Select Matching Colors" });
    try {
      const result = await runRemoval(ps, context, request);
      await context.hostControl.resumeHistory(suspension, true);
      return result;
    } catch (error) {
      await context.hostControl.resumeHistory(suspension, false);
      throw error;
    }
  }, { commandName: request.deletePixels ? "Select and Delete Matching Colors" : "Select Matching Colors" });
}

export async function removeMatchingColors(request: RemovalRequest): Promise<RemovalResult> {
  return createColorRemovalService(getPhotoshop())(request);
}
