import { colorKey, formatHex, type RGBColor } from "./core/color/Color";
import { parseHex } from "./core/color/ColorParser";
import { validateTolerance } from "./core/color/ColorValidator";

const colors: RGBColor[] = [];

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
  const toleranceInput = getElement<HTMLInputElement>("tolerance-input");

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

  renderColors();
}

initialize();
