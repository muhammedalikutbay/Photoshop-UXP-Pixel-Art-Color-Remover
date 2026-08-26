import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  sourcemap: true,
  outfile: "dist/main.js",
  external: ["photoshop", "uxp"]
});

await copyFile("src/ui/styles.css", "dist/styles.css");
