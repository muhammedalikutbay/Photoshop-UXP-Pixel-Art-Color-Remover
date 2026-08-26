# Development Guide

## Current phase

The initial manifest, source tree, package configuration, panel shell, pure logic tests, Photoshop operation service, and preset service now exist. Photoshop host loading and document mutation still require manual verification in the UXP Developer Tool.

## Planned local setup

1. Install a supported Photoshop version and the UXP Developer Tool through Adobe Creative Cloud.
2. Run `npm install`.
3. Run `npm run check`.
4. Load the repository root through the UXP Developer Tool.
5. Keep the developer console open while testing Photoshop operations.

The current implementation exposes `Select` and `Select & Delete` only after at least one color has been added. The HEX field is synchronized with the native color picker. Target mode can be Active Layer or All Visible Layers; the latter processes visible raster layers recursively inside visible groups and reports skipped non-pixel layers. Preset controls use the plugin-scoped `plugin-data:/presets.json` storage path.

The main content has its own scroll area, while the Select actions and status remain fixed at the bottom of the panel. Adding many colors uses a bounded list scroll area and does not push the action buttons out of view. Target options use a full-row click area with a larger custom radio indicator; the controls remain keyboard-focusable through their underlying radio inputs. Preset option nodes use `appendChild`, which is supported by UXP instead of the browser-only `HTMLSelectElement.add()` helper.

The HEX row includes a native color input and a **Pick from canvas** action. The action creates a scaled document preview through the Imaging API; clicking the preview maps the click to document coordinates and calls the documented `Document.sampleColor` API. UXP does not expose a direct panel-to-Photoshop-canvas pointer event, so the preview is the supported, deterministic eyedropper interaction.

The current manifest uses Manifest v5, Photoshop minimum version 24.0.0, and Photoshop API version 2. The manifest and host version must be rechecked before release.

## Development load and `.ccx` packaging

For development, use UXP Developer Tool:

1. Run `npm run build`.
2. Use **Add Plugin** and select the repository root.
3. Use **Load & Watch** to load the panel into Photoshop.
4. Use **Reload** after source changes. If `manifest.json` changes, use **Unload**, then **Load**.

For an installable package, use the plugin’s `... → Package` action in UXP Developer Tool after building. Photoshop UXP plugins are distributed as `.ccx` files. The generated `.ccx` can be installed locally with a compatible installer such as the aescripts ZXP/UXP Installer. `.zxp` is the CEP format and is not the package format for this repository.

## Implementation workflow

For each feature:

```text
ANALYZE → PLAN → IMPLEMENT → TEST → VERIFY → DOCUMENT
```

Pure color parsing and mask generation should be testable in a normal JavaScript test runner. Photoshop integration must be tested in the actual host because UXP and Photoshop APIs are not fully reproducible in Node.

## Error categories

The UI boundary should present concise messages for:

- no open document
- no active layer
- no configured colors
- invalid HEX
- invalid tolerance
- unsupported document mode or bit depth
- unsupported layer kind
- locked layer
- empty selection
- selection creation failure
- delete failure
- storage failure
- modal cancellation or Photoshop API error

Developer diagnostics should include the operation, document/layer IDs where safe, host/API version, and the original error in the developer console.

## Manual test matrix

The first host test pass must cover:

1. One exact color with tolerance 0.
2. Three colors combined into one selection.
3. Repeated occurrences of a color.
4. Transparent and partially transparent pixel art.
5. Tolerance 10.
6. Invalid HEX input.
7. Empty color list.
8. No open document.
9. Multiple layers with active-layer targeting.
10. Undo behavior.
11. A large image and cancellation.
12. Indexed, Bitmap, Lab, CMYK, grayscale, and unsupported bit-depth documents.
13. Background and locked pixel layers.
14. Existing selection before Select and Select & Delete.
15. Color picker and HEX synchronization.
16. All Visible Layers with two visible pixel layers at different positions.
17. Visible groups, hidden layers, locked visible layers, and visible non-pixel layers.

For each test, record Photoshop version, document mode/bit depth, expected result, actual result, and any console error.

## Debugging rules

- Use the UXP Developer Tool to load/unload the plugin and inspect the panel.
- Use Photoshop’s developer console for API results and errors.
- When testing a new batchPlay descriptor, capture the exact descriptor and host version in `docs/photoshop-api.md`.
- Never treat a successful call on one Photoshop build as proof of cross-version support.
