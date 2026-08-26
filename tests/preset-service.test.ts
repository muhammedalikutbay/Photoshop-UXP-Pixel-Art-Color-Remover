import { describe, expect, it } from "vitest";
import { createPreset } from "../src/presets/Preset";
import { createPresetService } from "../src/presets/PresetService";

function storageFixture(initial = "") {
  let contents = initial;
  return {
    async readFile() {
      if (!contents) throw new Error("missing file");
      return contents;
    },
    async writeFile(_path: string, data: string) {
      contents = data;
      return data.length;
    },
    read() { return contents; }
  };
}

describe("preset storage service", () => {
  it("saves, lists, renames, and deletes presets", async () => {
    const storage = storageFixture();
    const service = createPresetService(storage);
    await service.savePreset(createPreset("Basic", [{ red: 255, green: 0, blue: 255 }], 0));
    expect((await service.listPresets()).map((preset) => preset.name)).toEqual(["Basic"]);
    await service.renamePreset("Basic", "Renamed");
    expect((await service.listPresets())[0]!.name).toBe("Renamed");
    await service.deletePreset("Renamed");
    expect(await service.listPresets()).toEqual([]);
  });

  it("rejects corrupted preset data", async () => {
    const service = createPresetService(storageFixture("{\"bad\":true}"));
    await expect(service.listPresets()).rejects.toThrow("corrupted");
  });
});
