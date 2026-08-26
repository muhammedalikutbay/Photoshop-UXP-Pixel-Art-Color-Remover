# Roadmap

## Phase 1 — Research and architecture — complete

- Verify official Adobe UXP and Photoshop API references.
- Choose the documented Imaging API mask pipeline for V1.
- Record API limitations and risks.

## Phase 2 — Scaffold — implementation complete, host verification pending

- [x] Add Manifest v5 with a Photoshop panel entrypoint.
- [x] Add TypeScript, build, and test configuration.
- [x] Add the panel shell.
- [ ] Confirm the plugin loads in the UXP Developer Tool.

## Phase 3 — MVP core — implementation complete, host verification pending

- [x] Implement HEX parsing, normalization, validation, and deduplication.
- [x] Implement tolerance validation and pure pixel-mask matching.
- [x] Read active-layer RGB pixels through Imaging API.
- [x] Build one combined selection for all configured colors.
- [x] Add Select and Select & Delete commands.
- [x] Add modal execution, history suspension, cancellation checks, disposal, and error handling.
- [ ] Verify the full pipeline in the UXP Developer Tool.

## Phase 4 — Target expansion — implementation complete, host verification pending

- [x] Add All Visible Layers targeting for visible editable raster layers.
- [x] Traverse visible groups and skip unsupported rendered-only layer kinds.
- [x] Use per-layer masks for deletion and a document-coordinate union mask for Select.
- [ ] Verify groups, clipping, masks, adjustment layers, and blend modes in Photoshop 26.11.2.

## Phase 5 — UI polish — implementation complete, host verification pending

- [x] Add a native UXP color picker opened by an eyedropper icon and synchronized with HEX.
- [x] Render selected colors as removable swatch tiles.
- [x] Combine Settings and Target into one container.
- [x] Remove the panel title, description, and preset workflow.
- [x] Keep actions visible with a fixed action/status area and scrolling content.
- [ ] Complete the manual Photoshop UI smoke test.

## Release gates

The release is not complete until the actual Photoshop host confirms multi-color union, tolerance 0, transparency, deletion, undo, color picker input, and visible pixel-layer targeting. Before distribution, package the built plugin as `.ccx` through UXP Developer Tool and test the installed package separately from the development-loaded plugin.
