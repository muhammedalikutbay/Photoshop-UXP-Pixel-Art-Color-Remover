# Photoshop UXP — Pixel Art Color Remover

An Adobe Photoshop UXP panel for selecting pixels matching one or more configured colors and removing them from one pixel layer or all visible pixel layers.

## Project status

The panel, Photoshop selection/deletion pipeline, persistent presets, native color picker, canvas color sampling preview, and visible pixel-layer targeting are implemented. The remaining release gate is manual validation in the UXP Developer Tool with a real Photoshop document.

The first implementation target is:

- HEX color list
- Active pixel layer or all visible pixel layers
- Tolerance from 0 to 255
- One combined selection for all colors
- Select
- Select & Delete
- Native color picker beside the HEX field
- Canvas eyedropper preview beside the HEX field
- Responsive scrolling content with always-visible actions

Visible-layer mode traverses visible groups and processes only editable raster (`LayerKind.NORMAL`) layers. Visible adjustment, text, smart-object, and fill layers are reported as skipped because the Imaging API cannot safely map their rendered pixels back to editable source pixels.

## Technical direction

The planned implementation uses TypeScript and a small vanilla UXP panel. The selection pipeline will use Photoshop’s Imaging API to read pixels, create a combined grayscale selection mask, and write it back as a document selection. Deletion will use the Photoshop Layer API inside `executeAsModal`.

This is deliberately not an ExtendScript/JSX plugin.

## Documents

- [Architecture](docs/architecture.md)
- [Photoshop API research](docs/photoshop-api.md)
- [Development workflow](docs/development.md)
- [Roadmap](docs/roadmap.md)
- [Repository rules](AGENTS.md)

## Installation and build

Requirements:

- Adobe Photoshop 24.0.0 or newer (the eyedropper uses `Document.sampleColor`)
- UXP Developer Tool
- Node.js 20 or newer

Install dependencies and build the UXP bundle:

```bash
npm install
npm run check
```

Then load the repository root in the UXP Developer Tool. The generated `dist/main.js` is part of the distributable plugin and must be rebuilt after source changes.

Available commands:

- `npm run typecheck` — strict TypeScript validation
- `npm test` — pure color/mask tests
- `npm run build` — bundle `src/main.ts` into `dist/main.js`
- `npm run check` — typecheck, tests, and build

## Package for installation

This is a UXP plugin, so the distributable format is `.ccx`, not `.zxp`. After running `npm run build`, add the project to the UXP Developer Tool and choose `... → Package`. Select an output folder; the tool creates a `.ccx` package.

The aescripts [ZXP/UXP Installer](https://aescripts.com/learn/post/zxp-installer) can install that `.ccx` file on Windows. Do not rename the project folder or manually rename a `.zip` file to `.ccx`. For local development, UXP Developer Tool’s `Load & Watch` is preferred; use the packaged `.ccx` to test the installable build.

## Known limitations at this stage

- The supported Photoshop version must still be manually verified in the UXP Developer Tool.
- The UXP host must be tested with RGB 8-bit pixel layers, locked layers, transparency, existing selections, and undo.
- The Color Range batchPlay action remains an experimental fallback, not the primary implementation.
- “All Visible Layers” processes visible editable raster layers. Non-pixel visible layers are skipped and reported; they are not destructively flattened or rasterized.
