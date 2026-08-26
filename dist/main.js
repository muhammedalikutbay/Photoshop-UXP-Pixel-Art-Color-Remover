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
  function isRGBColor(value) {
    return [value.red, value.green, value.blue].every(
      (component) => Number.isInteger(component) && component >= 0 && component <= 255
    );
  }
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
    return "Photoshop operation failed. Check the developer console for details.";
  }

  // src/photoshop/ColorRemovalService.ts
  var RGB_PROFILE = "sRGB IEC61966-2.1";
  var GRAY_PROFILE = "Gray Gamma 2.2";
  function getPhotoshop() {
    return __require("photoshop");
  }
  function validateTarget(ps, document2, request) {
    if (request.colors.length === 0) throw new PhotoshopOperationError("Add at least one color before running the operation.", "EMPTY_COLORS");
    if (!Number.isInteger(request.tolerance) || request.tolerance < 0 || request.tolerance > 255) throw new PhotoshopOperationError("Tolerance must be an integer from 0 to 255.", "INVALID_TOLERANCE");
    if (document2.mode !== ps.constants.DocumentMode.RGB || document2.bitsPerChannel !== ps.constants.BitsPerChannelType.EIGHT) throw new PhotoshopOperationError("V1 supports RGB documents at 8 bits/channel only.", "UNSUPPORTED_DOCUMENT");
    const layer = document2.activeLayers[0];
    if (!layer) throw new PhotoshopOperationError("Select an active pixel layer first.", "NO_ACTIVE_LAYER");
    if (layer.kind !== ps.constants.LayerKind.NORMAL) throw new PhotoshopOperationError("The active layer must be a pixel layer.", "UNSUPPORTED_LAYER");
    if (layer.locked || layer.pixelsLocked) throw new PhotoshopOperationError("Unlock the active layer before editing it.", "LOCKED_LAYER");
  }
  async function runRemoval(ps, context, request) {
    if (context.isCancelled) throw new PhotoshopOperationError("Operation cancelled.", "CANCELLED");
    const document2 = ps.app.activeDocument;
    validateTarget(ps, document2, request);
    const layer = document2.activeLayers[0];
    const pixelData = await ps.imaging.getPixels({
      documentID: document2.id,
      layerID: layer.id,
      sourceBounds: layer.boundsNoEffects,
      colorSpace: "RGB",
      colorProfile: RGB_PROFILE,
      componentSize: 8
    });
    let sourceImage = pixelData.imageData;
    let selectionImage;
    try {
      const data = await sourceImage.getData({ chunky: true });
      const maskResult = buildPixelMask({ data, width: sourceImage.width, height: sourceImage.height, components: sourceImage.components === 4 ? 4 : 3 }, request.colors, request.tolerance);
      if (maskResult.matchedPixels === 0) {
        await document2.selection.deselect();
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
        documentID: document2.id,
        imageData: selectionImage,
        replace: true,
        targetBounds: { left: pixelData.sourceBounds.left, top: pixelData.sourceBounds.top },
        commandName: request.deletePixels ? "Select and Delete Matching Colors" : "Select Matching Colors"
      });
      if (context.isCancelled) throw new PhotoshopOperationError("Operation cancelled.", "CANCELLED");
      if (request.deletePixels) {
        await layer.clear();
        await document2.selection.deselect();
      }
      return { matchedPixels: maskResult.matchedPixels, deleted: request.deletePixels };
    } finally {
      selectionImage?.dispose();
      sourceImage?.dispose();
      sourceImage = void 0;
    }
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

  // src/presets/Preset.ts
  function createPreset(name, colors2, tolerance) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Preset name cannot be empty.");
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) throw new Error("Preset tolerance must be an integer from 0 to 255.");
    return { schemaVersion: 1, name: trimmedName, colors: [...colors2], tolerance };
  }

  // src/presets/PresetService.ts
  var PRESETS_PATH = "plugin-data:/presets.json";
  function fileSystem() {
    return __require("uxp").storage.localFileSystem;
  }
  function isPreset(value) {
    if (!value || typeof value !== "object") return false;
    const preset = value;
    const tolerance = preset.tolerance;
    return preset.schemaVersion === 1 && typeof preset.name === "string" && preset.name.trim().length > 0 && typeof tolerance === "number" && Number.isInteger(tolerance) && tolerance >= 0 && tolerance <= 255 && Array.isArray(preset.colors) && preset.colors.every(isRGBColor);
  }
  function createPresetService(storage) {
    async function readPresetMap() {
      let raw;
      try {
        raw = await storage.readFile(PRESETS_PATH, { encoding: "utf-8" });
      } catch {
        return {};
      }
      let parsed;
      try {
        parsed = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
      } catch {
        throw new Error("Preset storage is corrupted.");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Preset storage is corrupted.");
      const entries = Object.entries(parsed);
      if (!entries.every(([, value]) => isPreset(value))) throw new Error("Preset storage is corrupted.");
      return Object.fromEntries(entries);
    }
    async function writePresetMap(presets) {
      await storage.writeFile(PRESETS_PATH, JSON.stringify(presets, null, 2), { encoding: "utf-8" });
    }
    return {
      async listPresets() {
        const presets = await readPresetMap();
        return Object.values(presets).sort((a, b) => a.name.localeCompare(b.name));
      },
      async savePreset(preset) {
        const presets = await readPresetMap();
        presets[preset.name] = preset;
        await writePresetMap(presets);
      },
      async deletePreset(name) {
        const presets = await readPresetMap();
        delete presets[name];
        await writePresetMap(presets);
      },
      async renamePreset(oldName, newName) {
        const presets = await readPresetMap();
        const preset = presets[oldName];
        if (!preset) throw new Error("Preset not found.");
        if (presets[newName]) throw new Error("A preset with that name already exists.");
        delete presets[oldName];
        presets[newName] = { ...preset, name: newName };
        await writePresetMap(presets);
      }
    };
  }
  var defaultService;
  function getDefaultService() {
    defaultService ?? (defaultService = createPresetService(fileSystem()));
    return defaultService;
  }
  async function listPresets() {
    return getDefaultService().listPresets();
  }
  async function savePreset(preset) {
    return getDefaultService().savePreset(preset);
  }
  async function deletePreset(name) {
    return getDefaultService().deletePreset(name);
  }
  async function renamePreset(oldName, newName) {
    return getDefaultService().renamePreset(oldName, newName);
  }

  // src/main.ts
  var colors = [];
  var updateActionState = () => void 0;
  function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing UI element: ${id}`);
    }
    return element;
  }
  function setStatus(message, kind = "info") {
    const status = getElement("status");
    status.textContent = message;
    status.dataset.kind = kind;
  }
  function renderColors() {
    const list = getElement("color-list");
    const count = getElement("color-count");
    list.replaceChildren();
    count.textContent = String(colors.length);
    for (const color of colors) {
      const row = document.createElement("div");
      row.className = "color-row";
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.backgroundColor = formatHex(color);
      swatch.setAttribute("aria-label", `${formatHex(color)} preview`);
      const label = document.createElement("span");
      label.className = "color-value";
      label.textContent = formatHex(color);
      const remove = document.createElement("button");
      remove.className = "icon-button";
      remove.type = "button";
      remove.textContent = "\xD7";
      remove.setAttribute("aria-label", `Remove ${formatHex(color)}`);
      remove.addEventListener("click", () => {
        const index = colors.findIndex((item) => colorKey(item) === colorKey(color));
        if (index >= 0) {
          colors.splice(index, 1);
          renderColors();
          updateActionState();
          setStatus(`${formatHex(color)} removed.`);
        }
      });
      row.append(swatch, label, remove);
      list.append(row);
    }
  }
  function initialize() {
    const colorForm = getElement("color-form");
    const hexInput = getElement("hex-input");
    const toleranceInput = getElement("tolerance-input");
    const selectButton = getElement("select-button");
    const deleteButton = getElement("delete-button");
    const presetSelect = getElement("preset-select");
    const presetName = getElement("preset-name");
    const presetStatus = getElement("preset-status");
    const presetSave = getElement("preset-save");
    const presetLoad = getElement("preset-load");
    const presetRename = getElement("preset-rename");
    const presetDelete = getElement("preset-delete");
    const refreshPresets = async () => {
      try {
        const presets = await listPresets();
        presetSelect.replaceChildren();
        if (presets.length === 0) {
          presetSelect.add(new Option("No saved presets", ""));
        } else {
          for (const preset of presets) presetSelect.add(new Option(preset.name, preset.name));
        }
        presetStatus.textContent = presets.length ? `${presets.length} saved` : "";
      } catch (error) {
        console.error("Preset load failed", error);
        presetStatus.textContent = "Storage error";
      }
    };
    presetSave.addEventListener("click", async () => {
      try {
        const preset = createPreset(presetName.value, colors, Number(toleranceInput.value));
        await savePreset(preset);
        presetName.value = "";
        await refreshPresets();
        setStatus(`${preset.name} saved.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not save preset.", "error");
      }
    });
    presetLoad.addEventListener("click", async () => {
      const selected = presetSelect.value;
      if (!selected) return;
      try {
        const preset = (await listPresets()).find((item) => item.name === selected);
        if (!preset) return;
        colors.splice(0, colors.length, ...preset.colors);
        toleranceInput.value = String(preset.tolerance);
        renderColors();
        updateActionState();
        setStatus(`${preset.name} loaded.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not load preset.", "error");
      }
    });
    presetRename.addEventListener("click", async () => {
      const oldName = presetSelect.value;
      const newName = presetName.value.trim();
      if (!oldName || !newName) {
        setStatus("Select a preset and enter its new name.", "error");
        return;
      }
      try {
        await renamePreset(oldName, newName);
        presetName.value = "";
        await refreshPresets();
        setStatus(`${oldName} renamed to ${newName}.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not rename preset.", "error");
      }
    });
    presetDelete.addEventListener("click", async () => {
      const selected = presetSelect.value;
      if (!selected) return;
      try {
        await deletePreset(selected);
        await refreshPresets();
        setStatus(`${selected} deleted.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not delete preset.", "error");
      }
    });
    updateActionState = () => {
      const enabled = colors.length > 0;
      selectButton.disabled = !enabled;
      deleteButton.disabled = !enabled;
    };
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
        const result = await removeMatchingColors({ colors: [...colors], tolerance, deletePixels });
        setStatus(`${result.matchedPixels.toLocaleString()} matching pixel${result.matchedPixels === 1 ? "" : "s"} ${deletePixels ? "deleted" : "selected"}.`);
      } catch (error) {
        console.error("Color removal failed", error);
        setStatus(userMessage(error), "error");
      } finally {
        updateActionState();
      }
    };
    colorForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const parsed = parseHex(hexInput.value);
      if (!parsed) {
        setStatus("Enter a valid HEX color such as #FF00FF.", "error");
        hexInput.focus();
        return;
      }
      if (!colors.some((color) => colorKey(color) === colorKey(parsed))) {
        colors.push(parsed);
        renderColors();
        updateActionState();
        setStatus(`${formatHex(parsed)} added.`);
      } else {
        setStatus(`${formatHex(parsed)} is already in the list.`);
      }
      hexInput.value = "";
      hexInput.focus();
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
    selectButton.addEventListener("click", () => void runAction(false));
    deleteButton.addEventListener("click", () => void runAction(true));
    renderColors();
    updateActionState();
    void refreshPresets();
  }
  initialize();
})();
//# sourceMappingURL=main.js.map
