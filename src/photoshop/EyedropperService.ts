import type { RGBColor } from "../core/color/Color";
import { PhotoshopOperationError } from "./PhotoshopErrors";
import type { PhotoshopModule } from "./PhotoshopTypes";

declare const require: (moduleName: "photoshop") => PhotoshopModule;

export type EyedropperActivation = "activated" | "captured";

function normalizeChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(Number(value))));
}

export function createEyedropperService(ps: PhotoshopModule) {
  let armed = false;
  let listenerRegistered = false;
  let sampleHandler: ((color: RGBColor) => void) | undefined;

  const readForegroundColor = (): RGBColor => {
    const rgb = ps.app.foregroundColor.rgb;
    return {
      red: normalizeChannel(rgb.red),
      green: normalizeChannel(rgb.green),
      blue: normalizeChannel(rgb.blue)
    };
  };

  const onPhotoshopSet = (eventName: string, descriptor: Record<string, unknown>): void => {
    if (!armed || eventName !== "set" || descriptor.source !== "eyeDropperSample") return;
    armed = false;
    sampleHandler?.(readForegroundColor());
  };

  const ensureListener = async (): Promise<void> => {
    if (listenerRegistered) return;
    await ps.action.addNotificationListener(["set"], onPhotoshopSet);
    listenerRegistered = true;
  };

  return {
    readForegroundColor,

    async activate(onSample: (color: RGBColor) => void): Promise<EyedropperActivation> {
      if (ps.app.documents.length === 0) {
        throw new PhotoshopOperationError("Open a Photoshop document before using the eyedropper.", "NO_DOCUMENT");
      }

      sampleHandler = onSample;
      await ensureListener();

      // A second click is a manual fallback for hosts that suppress the set
      // notification: import Photoshop's current foreground color directly.
      if (armed) {
        armed = false;
        onSample(readForegroundColor());
        return "captured";
      }

      armed = true;
      try {
        const results = await ps.core.executeAsModal(
          async () => ps.action.batchPlay([
            {
              _obj: "select",
              _target: [{ _ref: "eyedropperTool" }],
              _options: { dialogOptions: "dontDisplay" }
            }
          ], {}),
          { commandName: "Activate Eyedropper" }
        );
        const firstResult = results[0];
        if (firstResult?._obj === "error") {
          throw new Error(typeof firstResult.message === "string" ? firstResult.message : "Photoshop rejected the Eyedropper command.");
        }
      } catch (error) {
        armed = false;
        const detail = error instanceof Error ? ` ${error.message}` : "";
        throw new PhotoshopOperationError(`Could not activate the Photoshop Eyedropper.${detail}`, "EYEDROPPER_FAILED");
      }

      ps.app.bringToFront();
      return "activated";
    }
  };
}

export function createDefaultEyedropperService() {
  return createEyedropperService(require("photoshop"));
}
