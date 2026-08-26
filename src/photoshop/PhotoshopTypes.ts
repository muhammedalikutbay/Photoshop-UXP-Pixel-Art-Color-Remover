import type { RGBColor } from "../core/color/Color";

export interface PhotoshopExecutionContext {
  readonly isCancelled: boolean;
  readonly hostControl: {
    suspendHistory(options: { documentID: number; name: string }): Promise<unknown>;
    resumeHistory(suspension: unknown, commit?: boolean): Promise<void>;
  };
}

export interface PhotoshopDocument {
  readonly id: number;
  readonly mode: unknown;
  readonly bitsPerChannel: unknown;
  readonly activeLayers: readonly PhotoshopLayer[];
  readonly selection: { deselect(): Promise<void> };
}

export interface PhotoshopLayer {
  readonly id: number;
  readonly kind: unknown;
  readonly locked: boolean;
  readonly pixelsLocked: boolean;
  readonly boundsNoEffects: { left: number; top: number; right: number; bottom: number };
  clear(): Promise<void>;
}

export interface PhotoshopImageData {
  readonly width: number;
  readonly height: number;
  readonly components: number;
  getData(options?: { chunky?: boolean }): Promise<Uint8Array>;
  dispose(): void;
}

export interface PhotoshopImaging {
  getPixels(options: {
    documentID: number;
    layerID: number;
    sourceBounds: { left: number; top: number; right: number; bottom: number };
    colorSpace: "RGB";
    colorProfile: string;
    componentSize: 8;
  }): Promise<{ imageData: PhotoshopImageData; sourceBounds: { left: number; top: number; right: number; bottom: number } }>;
  createImageDataFromBuffer(data: Uint8Array, options: {
    width: number;
    height: number;
    components: 1;
    chunky: boolean;
    colorSpace: "Grayscale";
    colorProfile: string;
  }): Promise<PhotoshopImageData>;
  putSelection(options: {
    documentID: number;
    imageData: PhotoshopImageData;
    replace: boolean;
    targetBounds: { left: number; top: number };
    commandName: string;
  }): Promise<void>;
}

export interface PhotoshopConstants {
  readonly DocumentMode: { readonly RGB: unknown };
  readonly BitsPerChannelType: { readonly EIGHT: unknown };
  readonly LayerKind: { readonly NORMAL: unknown };
}

export interface PhotoshopModule {
  readonly app: {
    readonly activeDocument: PhotoshopDocument;
  };
  readonly constants: PhotoshopConstants;
  readonly imaging: PhotoshopImaging;
  readonly core: {
    executeAsModal<T>(target: (context: PhotoshopExecutionContext) => Promise<T>, options: { commandName: string }): Promise<T>;
  };
}

export interface RemovalRequest {
  readonly colors: readonly RGBColor[];
  readonly tolerance: number;
  readonly deletePixels: boolean;
}

export interface RemovalResult {
  readonly matchedPixels: number;
  readonly deleted: boolean;
}
