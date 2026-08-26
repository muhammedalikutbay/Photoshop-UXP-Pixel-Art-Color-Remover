import { describe, expect, it } from "vitest";
import { createEyedropperService } from "../src/photoshop/EyedropperService";
import type { RGBColor } from "../src/core/color/Color";
import type { PhotoshopModule } from "../src/photoshop/PhotoshopTypes";

function makePhotoshop() {
  const calls: string[] = [];
  let listener: ((eventName: string, descriptor: Record<string, unknown>) => void) | undefined;
  const foreground = { rgb: { red: 18.2, green: 51.7, blue: 86.1 } };
  const app = {
    documents: [{}],
    foregroundColor: foreground,
    currentTool: { id: "moveTool" },
    bringToFront() { calls.push("bringToFront"); }
  };
  const ps = {
    app,
    action: {
      async addNotificationListener(events: readonly string[], callback: typeof listener) {
        calls.push(`listen:${events.join(",")}`);
        listener = callback;
      },
      async batchPlay(commands: readonly Record<string, unknown>[]) {
        calls.push("batchPlay");
        expect(commands[0]).toMatchObject({ _obj: "select", _target: [{ _ref: "eyedropperTool" }] });
        return [{}];
      }
    },
    core: {
      async executeAsModal(target: (context: unknown) => Promise<unknown>) {
        calls.push("executeAsModal");
        return target({});
      }
    }
  } as unknown as PhotoshopModule;
  return { ps, calls, foreground, notify: (eventName: string, descriptor: Record<string, unknown>) => listener?.(eventName, descriptor) };
}

describe("Photoshop Eyedropper service", () => {
  it("activates Photoshop's Eyedropper and captures its foreground color event once", async () => {
    const fixture = makePhotoshop();
    const samples: RGBColor[] = [];
    const service = createEyedropperService(fixture.ps);

    await expect(service.activate((color) => samples.push(color))).resolves.toBe("activated");
    expect(fixture.calls).toEqual(["listen:set", "executeAsModal", "batchPlay", "bringToFront"]);

    fixture.notify("set", { source: "unrelated" });
    fixture.notify("set", { source: "eyeDropperSample" });
    fixture.notify("set", { source: "eyeDropperSample" });
    expect(samples).toEqual([{ red: 18, green: 52, blue: 86 }]);
  });

  it("imports the current foreground color on a second click as a notification fallback", async () => {
    const fixture = makePhotoshop();
    const samples: RGBColor[] = [];
    const service = createEyedropperService(fixture.ps);

    await service.activate((color) => samples.push(color));
    fixture.foreground.rgb.red = 255;
    await expect(service.activate((color) => samples.push(color))).resolves.toBe("captured");
    expect(samples[0]).toEqual({ red: 255, green: 52, blue: 86 });
    expect(fixture.calls.filter((call) => call === "batchPlay")).toHaveLength(1);
  });

  it("rejects activation without an open document", async () => {
    const fixture = makePhotoshop();
    (fixture.ps.app.documents as unknown[]).length = 0;
    await expect(createEyedropperService(fixture.ps).activate(() => undefined)).rejects.toMatchObject({ code: "NO_DOCUMENT" });
  });
});
