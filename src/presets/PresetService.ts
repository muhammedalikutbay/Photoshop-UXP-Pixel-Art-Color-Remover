import type { Preset } from "./Preset";

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

async function readPresetMap(): Promise<Record<string, Preset>> {
  try {
    const raw = await fileSystem().readFile(PRESETS_PATH, { encoding: "utf-8" });
    const parsed: unknown = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid preset data.");
    return parsed as Record<string, Preset>;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Preset storage is corrupted.");
    return {};
  }
}

async function writePresetMap(presets: Record<string, Preset>): Promise<void> {
  await fileSystem().writeFile(PRESETS_PATH, JSON.stringify(presets, null, 2), { encoding: "utf-8" });
}

export async function listPresets(): Promise<Preset[]> {
  const presets = await readPresetMap();
  return Object.values(presets).sort((a, b) => a.name.localeCompare(b.name));
}

export async function savePreset(preset: Preset): Promise<void> {
  const presets = await readPresetMap();
  presets[preset.name] = preset;
  await writePresetMap(presets);
}

export async function deletePreset(name: string): Promise<void> {
  const presets = await readPresetMap();
  delete presets[name];
  await writePresetMap(presets);
}

export async function renamePreset(oldName: string, newName: string): Promise<void> {
  const presets = await readPresetMap();
  const preset = presets[oldName];
  if (!preset) throw new Error("Preset not found.");
  if (presets[newName]) throw new Error("A preset with that name already exists.");
  delete presets[oldName];
  presets[newName] = { ...preset, name: newName };
  await writePresetMap(presets);
}
