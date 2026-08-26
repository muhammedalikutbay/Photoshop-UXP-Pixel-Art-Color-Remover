import type { Preset } from "./Preset";
import { isRGBColor } from "../core/color/ColorValidator";

interface UxpFileSystem {
  readFile(path: string, options: { encoding: "utf-8" }): Promise<string | ArrayBuffer>;
  writeFile(path: string, data: string, options: { encoding: "utf-8" }): Promise<number>;
}

interface UxpModule {
  storage: { localFileSystem: UxpFileSystem };
}

declare const require: (moduleName: "uxp") => UxpModule;

const PRESETS_PATH = "plugin-data:/presets.json";

function fileSystem(): UxpFileSystem { return require("uxp").storage.localFileSystem; }

function isPreset(value: unknown): value is Preset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Partial<Preset>;
  const tolerance = preset.tolerance;
  return preset.schemaVersion === 1
    && typeof preset.name === "string"
    && preset.name.trim().length > 0
    && typeof tolerance === "number"
    && Number.isInteger(tolerance)
    && tolerance >= 0
    && tolerance <= 255
    && Array.isArray(preset.colors)
    && preset.colors.every(isRGBColor);
}

export function createPresetService(storage: UxpFileSystem) {
  async function readPresetMap(): Promise<Record<string, Preset>> {
    let raw: string | ArrayBuffer;
    try {
      raw = await storage.readFile(PRESETS_PATH, { encoding: "utf-8" });
    } catch {
      // The file is created lazily on the first save.
      return {};
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    } catch {
      throw new Error("Preset storage is corrupted.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Preset storage is corrupted.");
    const entries = Object.entries(parsed);
    if (!entries.every(([, value]) => isPreset(value))) throw new Error("Preset storage is corrupted.");
    return Object.fromEntries(entries) as Record<string, Preset>;
  }

  async function writePresetMap(presets: Record<string, Preset>): Promise<void> {
    await storage.writeFile(PRESETS_PATH, JSON.stringify(presets, null, 2), { encoding: "utf-8" });
  }

  return {
    async listPresets(): Promise<Preset[]> {
      const presets = await readPresetMap();
      return Object.values(presets).sort((a, b) => a.name.localeCompare(b.name));
    },
    async savePreset(preset: Preset): Promise<void> {
      const presets = await readPresetMap();
      presets[preset.name] = preset;
      await writePresetMap(presets);
    },
    async deletePreset(name: string): Promise<void> {
      const presets = await readPresetMap();
      delete presets[name];
      await writePresetMap(presets);
    },
    async renamePreset(oldName: string, newName: string): Promise<void> {
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

let defaultService: ReturnType<typeof createPresetService> | undefined;

function getDefaultService(): ReturnType<typeof createPresetService> {
  defaultService ??= createPresetService(fileSystem());
  return defaultService;
}

export async function listPresets(): Promise<Preset[]> { return getDefaultService().listPresets(); }
export async function savePreset(preset: Preset): Promise<void> { return getDefaultService().savePreset(preset); }
export async function deletePreset(name: string): Promise<void> { return getDefaultService().deletePreset(name); }
export async function renamePreset(oldName: string, newName: string): Promise<void> { return getDefaultService().renamePreset(oldName, newName); }
