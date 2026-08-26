import { colorKey, formatHex, type RGBColor } from "./core/color/Color";
import { parseHex } from "./core/color/ColorParser";
import { validateTolerance } from "./core/color/ColorValidator";
import { removeMatchingColors } from "./photoshop/ColorRemovalService";
import { userMessage } from "./photoshop/PhotoshopErrors";
import { createPreset } from "./presets/Preset";
import { deletePreset, listPresets, renamePreset, savePreset } from "./presets/PresetService";

const colors: RGBColor[] = [];
let updateActionState: () => void = () => undefined;

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing UI element: ${id}`);
  }
  return element as T;
}

function setStatus(message: string, kind: "info" | "error" = "info"): void {
  const status = getElement<HTMLParagraphElement>("status");
  status.textContent = message;
  status.dataset.kind = kind;
}

function addSelectOption(select: HTMLSelectElement, label: string, value: string): void {
  const option = document.createElement("option");
  option.textContent = label;
  option.value = value;
  select.add(option);
}

function renderColors(): void {
  const list = getElement<HTMLDivElement>("color-list");
  const count = getElement<HTMLSpanElement>("color-count");
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
    remove.textContent = "×";
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

function initialize(): void {
  const colorForm = getElement<HTMLFormElement>("color-form");
  const hexInput = getElement<HTMLInputElement>("hex-input");
  const colorPicker = getElement<HTMLInputElement>("color-picker");
  const toleranceInput = getElement<HTMLInputElement>("tolerance-input");
  const selectButton = getElement<HTMLButtonElement>("select-button");
  const deleteButton = getElement<HTMLButtonElement>("delete-button");
  const presetSelect = getElement<HTMLSelectElement>("preset-select");
  const presetName = getElement<HTMLInputElement>("preset-name");
  const presetStatus = getElement<HTMLSpanElement>("preset-status");
  const presetSave = getElement<HTMLButtonElement>("preset-save");
  const presetLoad = getElement<HTMLButtonElement>("preset-load");
  const presetRename = getElement<HTMLButtonElement>("preset-rename");
  const presetDelete = getElement<HTMLButtonElement>("preset-delete");
  const targetInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="target"]'));

  const refreshPresets = async (): Promise<void> => {
    try {
      const presets = await listPresets();
      presetSelect.replaceChildren();
      if (presets.length === 0) {
        addSelectOption(presetSelect, "No saved presets", "");
      } else {
        for (const preset of presets) addSelectOption(presetSelect, preset.name, preset.name);
      }
      presetStatus.textContent = presets.length ? `${presets.length} saved` : "";
    } catch (error) {
      console.error("Preset load failed", error);
      presetStatus.textContent = "Storage unavailable";
      setStatus("Presets could not be loaded. The color removal tools are still available.", "error");
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

  updateActionState = (): void => {
    const enabled = colors.length > 0;
    selectButton.disabled = !enabled;
    deleteButton.disabled = !enabled;
  };

  const runAction = async (deletePixels: boolean): Promise<void> => {
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

  const syncHexFromPicker = (): void => {
    hexInput.value = colorPicker.value.toUpperCase();
  };
  colorPicker.addEventListener("input", syncHexFromPicker);
  colorPicker.addEventListener("change", syncHexFromPicker);

  hexInput.addEventListener("input", () => {
    const parsed = parseHex(hexInput.value);
    if (parsed) colorPicker.value = formatHex(parsed);
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
