"use strict";
(() => {
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });

  // src/core/color/Color.ts
  function colorKey(color) {
    return `${color.red},${color.green},${color.blue}`;
  }
  function formatHex(color) {
    return `#${[color.red, color.green, color.blue].map((component) => component.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }

  // src/core/color/ColorParser.ts
  var HEX_PATTERN = /^#?([0-9a-f]{6})$/i;
  function parseHex(value) {
    const match = HEX_PATTERN.exec(value.trim());
    if (!match) {
      return null;
    }
    const hex = match[1];
    return {
      red: Number.parseInt(hex.slice(0, 2), 16),
      green: Number.parseInt(hex.slice(2, 4), 16),
      blue: Number.parseInt(hex.slice(4, 6), 16)
    };
  }

  // src/core/color/ColorValidator.ts
  function validateTolerance(value) {
    return Number.isInteger(value) && value >= 0 && value <= 255;
  }

  // src/core/matching/PixelMaskBuilder.ts
  function normalizedDistance(red, green, blue, color) {
    const redDelta = red - color.red;
    const greenDelta = green - color.green;
    const blueDelta = blue - color.blue;
    return Math.sqrt((redDelta ** 2 + greenDelta ** 2 + blueDelta ** 2) / 3);
  }
  function buildPixelMask(pixels, colors2, tolerance) {
    if (pixels.width < 0 || pixels.height < 0 || !Number.isInteger(pixels.width) || !Number.isInteger(pixels.height)) {
      throw new RangeError("Pixel dimensions must be non-negative integers.");
    }
    const pixelCount = pixels.width * pixels.height;
    if (pixels.data.length !== pixelCount * pixels.components) {
      throw new RangeError("Pixel buffer length does not match its dimensions.");
    }
    const mask = new Uint8Array(pixelCount);
    if (colors2.length === 0) {
      return { mask, matchedPixels: 0 };
    }
    let matchedPixels = 0;
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      const offset = pixelIndex * pixels.components;
      const alpha = pixels.components === 4 ? pixels.data[offset + 3] : 255;
      if (alpha === 0) {
        continue;
      }
      const red = pixels.data[offset];
      const green = pixels.data[offset + 1];
      const blue = pixels.data[offset + 2];
      const matches = colors2.some((color) => normalizedDistance(red, green, blue, color) <= tolerance);
      if (matches) {
        mask[pixelIndex] = 255;
        matchedPixels += 1;
      }
    }
    return { mask, matchedPixels };
  }

  // src/photoshop/PhotoshopErrors.ts
  var PhotoshopOperationError = class extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
      this.name = "PhotoshopOperationError";
    }
  };
  function userMessage(error) {
    if (error instanceof PhotoshopOperationError) return error.message;
    const possibleMessage = error instanceof Error ? error.message : error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : void 0;
    if (possibleMessage) {
      const detail = possibleMessage.replace(/\s+/g, " ").trim().slice(0, 180);
      return `Photoshop operation failed: ${detail}`;
    }
    return "Photoshop operation failed. Check the developer console for details.";
  }

  // src/photoshop/ColorRemovalService.ts
  var RGB_PROFILE = "sRGB IEC61966-2.1";
  var GRAY_PROFILE = "Gray Gamma 2.2";
  function normalizeBounds(raw) {
    const bounds = {
      left: Number(raw.left),
      top: Number(raw.top),
      right: Number(raw.right),
      bottom: Number(raw.bottom)
    };
    if (!Object.values(bounds).every(Number.isFinite) || bounds.right < bounds.left || bounds.bottom < bounds.top) {
      throw new PhotoshopOperationError("Photoshop returned invalid pixel bounds.", "UNSUPPORTED_LAYER");
    }
    return bounds;
  }
  function getPhotoshop() {
    return __require("photoshop");
  }
  function validateTarget(ps, document2, request) {
    if (request.colors.length === 0) throw new PhotoshopOperationError("Add at least one color before running the operation.", "EMPTY_COLORS");
    if (!Number.isInteger(request.tolerance) || request.tolerance < 0 || request.tolerance > 255) throw new PhotoshopOperationError("Tolerance must be an integer from 0 to 255.", "INVALID_TOLERANCE");
    if (document2.mode !== ps.constants.DocumentMode.RGB || document2.bitsPerChannel !== ps.constants.BitsPerChannelType.EIGHT) throw new PhotoshopOperationError("V1 supports RGB documents at 8 bits/channel only.", "UNSUPPORTED_DOCUMENT");
    if (request.target === "active-layer") {
      const layer = document2.activeLayers[0];
      if (!layer) throw new PhotoshopOperationError("Select an active pixel layer first.", "NO_ACTIVE_LAYER");
      validatePixelLayer(ps, layer);
    }
  }
  function validatePixelLayer(ps, layer) {
    if (layer.kind !== ps.constants.LayerKind.NORMAL) throw new PhotoshopOperationError("The target must be a pixel layer.", "UNSUPPORTED_LAYER");
    if (layer.locked || layer.pixelsLocked) throw new PhotoshopOperationError("Unlock the target pixel layer before editing it.", "LOCKED_LAYER");
  }
  function collectVisiblePixelLayers(ps, layers, parentVisible = true) {
    const result = [];
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
  function copyMaskIntoDocument(mask, sourceWidth, sourceHeight, sourceBounds, documentMask, documentWidth, documentHeight) {
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
  async function createSelectionImage(ps, mask, width, height) {
    return ps.imaging.createImageDataFromBuffer(mask, {
      width,
      height,
      components: 1,
      chunky: false,
      colorSpace: "Grayscale",
      colorProfile: GRAY_PROFILE
    });
  }
  async function runRemoval(ps, context, request) {
    if (context.isCancelled) throw new PhotoshopOperationError("Operation cancelled.", "CANCELLED");
    const document2 = ps.app.activeDocument;
    validateTarget(ps, document2, request);
    const isVisibleLayers = request.target === "visible-layers";
    const targetInfo = isVisibleLayers ? collectVisiblePixelLayers(ps, document2.layers) : { layers: [document2.activeLayers[0]], skippedLayers: 0 };
    if (targetInfo.layers.length === 0) {
      const suffix = targetInfo.skippedLayers > 0 ? ` ${targetInfo.skippedLayers} visible non-pixel layer${targetInfo.skippedLayers === 1 ? " was" : "s were"} skipped.` : "";
      throw new PhotoshopOperationError(`No visible pixel layers are available.${suffix}`, "NO_VISIBLE_PIXEL_LAYERS");
    }
    const documentWidth = Math.floor(document2.width);
    const documentHeight = Math.floor(document2.height);
    if (!Number.isInteger(documentWidth) || !Number.isInteger(documentHeight) || documentWidth <= 0 || documentHeight <= 0) {
      throw new PhotoshopOperationError("The document dimensions are not supported.", "UNSUPPORTED_DOCUMENT");
    }
    let selectionMask;
    let selectionWidth = 0;
    let selectionHeight = 0;
    let selectionBounds;
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
      const requestedBounds = normalizeBounds(layer.boundsNoEffects);
      const pixelData = await ps.imaging.getPixels({
        documentID: document2.id,
        layerID: layer.id,
        sourceBounds: requestedBounds,
        colorSpace: "RGB",
        colorProfile: RGB_PROFILE,
        componentSize: 8
      });
      let sourceImage = pixelData.imageData;
      let layerSelection;
      try {
        const data = await sourceImage.getData({ chunky: true });
        const sourceWidth = sourceImage.width;
        const sourceHeight = sourceImage.height;
        const maskResult = buildPixelMask({ data, width: sourceWidth, height: sourceHeight, components: sourceImage.components === 4 ? 4 : 3 }, request.colors, request.tolerance);
        if (maskResult.matchedPixels === 0) continue;
        matchedPixels += maskResult.matchedPixels;
        processedLayers += 1;
        const actualBounds = normalizeBounds(pixelData.sourceBounds);
        if (!isVisibleLayers) {
          selectionMask = maskResult.mask;
          selectionWidth = sourceWidth;
          selectionHeight = sourceHeight;
          selectionBounds = actualBounds;
        } else {
          copyMaskIntoDocument(maskResult.mask, sourceWidth, sourceHeight, actualBounds, selectionMask, documentWidth, documentHeight);
        }
        if (request.deletePixels && isVisibleLayers) {
          layerSelection = await createSelectionImage(ps, maskResult.mask, sourceWidth, sourceHeight);
          await ps.imaging.putSelection({
            documentID: document2.id,
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
        sourceImage = void 0;
      }
    }
    if (matchedPixels === 0 || !selectionMask || !selectionBounds) {
      await document2.selection.deselect();
      const suffix = targetInfo.skippedLayers > 0 ? ` ${targetInfo.skippedLayers} visible non-pixel layer${targetInfo.skippedLayers === 1 ? " was" : "s were"} skipped.` : "";
      throw new PhotoshopOperationError(`No matching pixels were found.${suffix}`, "EMPTY_SELECTION");
    }
    if (!isVisibleLayers || !request.deletePixels) {
      const finalSelection = await createSelectionImage(ps, selectionMask, selectionWidth, selectionHeight);
      try {
        await ps.imaging.putSelection({
          documentID: document2.id,
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
      if (!isVisibleLayers) await targetInfo.layers[0].clear();
      await document2.selection.deselect();
    }
    return { matchedPixels, deleted: request.deletePixels, processedLayers, skippedLayers: targetInfo.skippedLayers };
  }
  function createColorRemovalService(ps) {
    return async (request) => ps.core.executeAsModal(async (context) => {
      if (ps.app.documents.length === 0) throw new PhotoshopOperationError("Open a Photoshop document first.", "NO_DOCUMENT");
      const document2 = ps.app.activeDocument;
      const suspension = await context.hostControl.suspendHistory({ documentID: document2.id, name: request.deletePixels ? "Select and Delete Matching Colors" : "Select Matching Colors" });
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
  async function removeMatchingColors(request) {
    return createColorRemovalService(getPhotoshop())(request);
  }

  // src/photoshop/EyedropperService.ts
  function normalizeChannel(value) {
    return Math.max(0, Math.min(255, Math.round(Number(value))));
  }
  function createEyedropperService(ps) {
    let armed = false;
    let listenerRegistered = false;
    let sampleHandler;
    const readForegroundColor = () => {
      const rgb = ps.app.foregroundColor.rgb;
      return {
        red: normalizeChannel(rgb.red),
        green: normalizeChannel(rgb.green),
        blue: normalizeChannel(rgb.blue)
      };
    };
    const onPhotoshopSet = (eventName, descriptor) => {
      if (!armed || eventName !== "set" || descriptor.source !== "eyeDropperSample") return;
      armed = false;
      sampleHandler?.(readForegroundColor());
    };
    const ensureListener = async () => {
      if (listenerRegistered) return;
      await ps.action.addNotificationListener(["set"], onPhotoshopSet);
      listenerRegistered = true;
    };
    return {
      readForegroundColor,
      async activate(onSample) {
        if (ps.app.documents.length === 0) {
          throw new PhotoshopOperationError("Open a Photoshop document before using the eyedropper.", "NO_DOCUMENT");
        }
        sampleHandler = onSample;
        await ensureListener();
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
  function createDefaultEyedropperService() {
    return createEyedropperService(__require("photoshop"));
  }

  // src/main.ts
  var colors = [];
  var updateActionState = () => void 0;
  function getElement(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing UI element: ${id}`);
    return element;
  }
  function setStatus(message, kind = "info") {
    const status = getElement("status");
    status.textContent = message;
    status.dataset.kind = kind;
  }
  function isLightColor(color) {
    return (color.red * 299 + color.green * 587 + color.blue * 114) / 1e3 > 160;
  }
  function renderColors() {
    const list = getElement("color-list");
    const count = getElement("color-count");
    while (list.firstChild) list.removeChild(list.firstChild);
    count.textContent = String(colors.length);
    if (colors.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-colors";
      empty.textContent = "No colors added yet.";
      list.appendChild(empty);
      return;
    }
    for (const color of colors) {
      const chip = document.createElement("div");
      chip.className = `color-chip${isLightColor(color) ? " light" : ""}`;
      chip.style.backgroundColor = formatHex(color);
      chip.title = formatHex(color);
      const remove = document.createElement("button");
      remove.className = "color-chip-remove";
      remove.type = "button";
      remove.textContent = "\xD7";
      remove.setAttribute("aria-label", `Remove ${formatHex(color)}`);
      remove.addEventListener("click", () => {
        const index = colors.findIndex((item) => colorKey(item) === colorKey(color));
        if (index < 0) return;
        colors.splice(index, 1);
        renderColors();
        updateActionState();
        setStatus(`${formatHex(color)} removed.`);
      });
      chip.appendChild(remove);
      list.appendChild(chip);
    }
  }
  function initialize() {
    const colorForm = getElement("color-form");
    const hexInput = getElement("hex-input");
    const eyedropperButton = getElement("eyedropper-button");
    const clearColorsButton = getElement("clear-colors-button");
    const toleranceInput = getElement("tolerance-input");
    const selectButton = getElement("select-button");
    const deleteButton = getElement("delete-button");
    const targetInputs = Array.from(document.querySelectorAll('input[name="target"]'));
    const eyedropper = createDefaultEyedropperService();
    updateActionState = () => {
      const enabled = colors.length > 0;
      selectButton.disabled = !enabled;
      deleteButton.disabled = !enabled;
      clearColorsButton.disabled = !enabled;
    };
    hexInput.addEventListener("input", () => {
      const normalized = hexInput.value.replace(/^#/, "").replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase();
      if (hexInput.value !== normalized) hexInput.value = normalized;
    });
    colorForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const parsed = parseHex(hexInput.value);
      if (!parsed) {
        setStatus("Enter a valid HEX color such as 1A7F8B.", "error");
        hexInput.focus();
        return;
      }
      if (colors.some((color) => colorKey(color) === colorKey(parsed))) {
        setStatus(`${formatHex(parsed)} is already in the list.`);
      } else {
        colors.push(parsed);
        renderColors();
        updateActionState();
        setStatus(`${formatHex(parsed)} added.`);
      }
      hexInput.value = "";
      hexInput.focus();
    });
    eyedropperButton.addEventListener("click", async () => {
      eyedropperButton.disabled = true;
      try {
        const activation = await eyedropper.activate((sampledColor) => {
          const sampledHex = formatHex(sampledColor);
          hexInput.value = sampledHex.slice(1);
          eyedropperButton.classList.remove("active");
          setStatus(`${sampledHex} sampled. Click Add color to add it.`);
        });
        if (activation === "activated") {
          eyedropperButton.classList.add("active");
          setStatus("Eyedropper active. Click a pixel on the Photoshop canvas. Click the icon again to sync manually.");
        }
      } catch (error) {
        eyedropperButton.classList.remove("active");
        console.error("Eyedropper activation failed", error);
        setStatus(userMessage(error), "error");
      } finally {
        eyedropperButton.disabled = false;
      }
    });
    clearColorsButton.addEventListener("click", () => {
      if (colors.length === 0) return;
      colors.splice(0, colors.length);
      renderColors();
      updateActionState();
      setStatus("All colors cleared.");
    });
    toleranceInput.addEventListener("change", () => {
      const tolerance = Number(toleranceInput.value);
      if (!validateTolerance(tolerance)) {
        toleranceInput.value = "0";
        setStatus("Tolerance must be an integer from 0 to 255.", "error");
        return;
      }
      setStatus(`Tolerance set to ${tolerance}.`);
    });
    const runAction = async (deletePixels) => {
      const tolerance = Number(toleranceInput.value);
      if (!validateTolerance(tolerance)) {
        setStatus("Tolerance must be an integer from 0 to 255.", "error");
        return;
      }
      selectButton.disabled = true;
      deleteButton.disabled = true;
      setStatus(deletePixels ? "Selecting and deleting matching pixels..." : "Selecting matching pixels...");
      try {
        const target = targetInputs.find((input) => input.checked)?.value === "visible-layers" ? "visible-layers" : "active-layer";
        const result = await removeMatchingColors({ colors: [...colors], tolerance, deletePixels, target });
        const layerSummary = target === "visible-layers" ? ` across ${result.processedLayers} visible pixel layer${result.processedLayers === 1 ? "" : "s"}` : "";
        const skippedSummary = result.skippedLayers > 0 ? ` ${result.skippedLayers} unsupported visible layer${result.skippedLayers === 1 ? " was" : "s were"} skipped.` : ".";
        setStatus(`${result.matchedPixels.toLocaleString()} matching pixel${result.matchedPixels === 1 ? "" : "s"} ${deletePixels ? "deleted" : "selected"}${layerSummary}${skippedSummary}`);
      } catch (error) {
        console.error("Color removal failed", error);
        setStatus(userMessage(error), "error");
      } finally {
        updateActionState();
      }
    };
    selectButton.addEventListener("click", () => void runAction(false));
    deleteButton.addEventListener("click", () => void runAction(true));
    renderColors();
    updateActionState();
  }
  initialize();
})();
//# sourceMappingURL=main.js.map
