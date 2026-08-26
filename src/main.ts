import { colorKey, formatHex, type RGBColor } from "./core/color/Color";
import { parseHex } from "./core/color/ColorParser";
import { validateTolerance } from "./core/color/ColorValidator";
import { removeMatchingColors } from "./photoshop/ColorRemovalService";
import { createDefaultEyedropperService } from "./photoshop/EyedropperService";
import { userMessage } from "./photoshop/PhotoshopErrors";

const colors: RGBColor[] = [];
let updateActionState: () => void = () => undefined;

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element: ${id}`);
  return element as T;
}

function setStatus(message: string, kind: "info" | "error" = "info"): void {
  const status = getElement<HTMLParagraphElement>("status");
  status.textContent = message;
  status.dataset.kind = kind;
}

function isLightColor(color: RGBColor): boolean {
  return (color.red * 299 + color.green * 587 + color.blue * 114) / 1000 > 160;
}

function renderColors(): void {
  const list = getElement<HTMLDivElement>("color-list");
  const count = getElement<HTMLSpanElement>("color-count");
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
    remove.textContent = "\u00D7";
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

function initialize(): void {
  const colorForm = getElement<HTMLFormElement>("color-form");
  const hexInput = getElement<HTMLInputElement>("hex-input");
  const eyedropperButton = getElement<HTMLButtonElement>("eyedropper-button");
  const clearColorsButton = getElement<HTMLButtonElement>("clear-colors-button");
  const toleranceInput = getElement<HTMLInputElement>("tolerance-input");
  const selectButton = getElement<HTMLButtonElement>("select-button");
  const deleteButton = getElement<HTMLButtonElement>("delete-button");
  const targetInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="target"]'));
  const eyedropper = createDefaultEyedropperService();

  updateActionState = (): void => {
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

  selectButton.addEventListener("click", () => void runAction(false));
  deleteButton.addEventListener("click", () => void runAction(true));

  renderColors();
  updateActionState();
}

initialize();
