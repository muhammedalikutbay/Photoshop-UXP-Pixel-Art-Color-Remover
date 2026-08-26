# PixelArt Color Remover

PixelArt Color Remover is an Adobe Photoshop UXP panel for selecting and removing one or more exact or tolerance-based colors from pixel-art layers.

> Current status: release candidate. The code, build, and local package are ready, but the complete Photoshop host test matrix must still be recorded before a public release.

## Features

- Add colors through a six-digit HEX field or Photoshop’s Eyedropper tool.
- Display configured colors as removable swatches, with a Clear All action.
- Match one or more colors in one combined selection.
- Select matching pixels or select and delete them in a single action.
- Configure tolerance from `0` to `255`; `0` is exact RGB matching.
- Use a responsive, dark Photoshop-panel interface with persistent bottom actions.
- Target the selected editable pixel layer. The **All Layers** UI option remains experimental until its Photoshop semantics have completed host verification.

## Requirements

- Adobe Photoshop 23.3.0 or newer
- Adobe UXP Developer Tool
- Node.js 20 or newer

The first supported document target is an RGB, 8-bits/channel document with an editable raster (pixel) layer.

## Use during development

Install dependencies and verify the project:

```bash
npm install
npm run check
```

`npm run check` runs TypeScript validation, the pure-logic test suite, and the production build. The build writes `dist/main.js` and `dist/styles.css`; these generated files are intentionally not committed to Git.

Then open **UXP Developer Tool**:

1. Choose **Add Plugin** and select this repository’s root folder.
2. Load the plugin into Photoshop using **Load & Watch**.
3. After source changes, run `npm run build` and choose **Reload**. If `manifest.json` changes, unload and load the plugin again.
4. Use the Developer Tool’s **Debug** action to inspect console errors.

## Create and install a `.ccx` release package

Photoshop UXP plugins are distributed as `.ccx` files, not CEP `.zxp` files. The recommended packaging method is the UXP Developer Tool:

1. Run `npm run check`.
2. In UXP Developer Tool, open the plugin’s `...` menu and select **Package**.
3. Choose an output folder. The generated `.ccx` is the file to upload or install.

For this repository, the release build is also placed at:

```text
PixelArtColorRemover-0.1.0.ccx
```

Install the resulting `.ccx` with Creative Cloud Desktop or a compatible UXP installer such as the aescripts ZXP/UXP Installer. Test the installed package separately from the Developer Tool-loaded copy.

For Adobe Creative Cloud Marketplace distribution, use a valid plugin ID issued through Adobe’s Developer Distribution portal before publishing.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Strict TypeScript validation |
| `npm test` | Pure color, mask, Photoshop-service, and eyedropper tests |
| `npm run build` | Bundle TypeScript and copy the panel stylesheet to `dist/` |
| `npm run check` | Run typecheck, tests, and build |

## Matching behavior

Configured HEX values are normalized to uppercase RGB values and deduplicated. The tolerance metric is normalized Euclidean RGB distance:

```text
distance = sqrt((dr² + dg² + db²) / 3)
match when distance <= tolerance
```

The Select action creates one union selection for all configured colors. Select & Delete clears matching pixels only after that combined selection is made.

## Limitations and release checks

- Do not rely on **All Layers** for production work until it has been tested with pixel, group, adjustment, clipping, and transparent layers in the target Photoshop version.
- Locked, unsupported, or non-pixel layers produce a user-facing error or are skipped where applicable.
- Before public release, test no document, invalid HEX, multi-color matching, transparency, tolerance, selection, deletion, undo, and the installed `.ccx` package in Photoshop.

## Documentation

- [Architecture](docs/architecture.md)
- [Photoshop API research](docs/photoshop-api.md)
- [Development workflow](docs/development.md)
- [Roadmap](docs/roadmap.md)
- [Repository rules](AGENTS.md)
