# Roadmap

## Phase 1 — Research and architecture — complete

- Inspect the empty repository.
- Verify current official Adobe UXP and Photoshop API references.
- Compare public Selection DOM, Imaging API, Layer API, and batchPlay options.
- Choose the documented Imaging API mask pipeline for V1.
- Record API limitations and risks.

## Phase 2 — Scaffold — implementation complete, host verification pending

- [x] Add Manifest v5 with a Photoshop panel entrypoint.
- [x] Add TypeScript, build, and test configuration.
- [x] Add a minimal panel shell.
- [ ] Confirm the plugin loads in the UXP Developer Tool.

## Phase 3 — MVP core — implementation complete, host verification pending

- [x] Implement HEX parsing, normalization, validation, and deduplication.
- [x] Implement tolerance validation and pure pixel-mask matching.
- [x] Read active-layer RGB pixels through Imaging API.
- [x] Build one combined selection for all configured colors.
- [x] Add Select and Select & Delete commands.
- [x] Add modal execution, history suspension, cancellation checks, disposal, and error handling.
- [ ] Verify the full pipeline in the UXP Developer Tool.
- Validate active document and active pixel layer.
- Read full-resolution layer pixels through Imaging API.
- Build and apply one combined selection.
- Add Select and Select & Delete commands.
- Add modal execution, history behavior, cancellation, disposal, and error handling.

## Phase 4 — MVP verification and documentation — in progress

- [x] Run the pure unit tests.
- [ ] Run the Photoshop manual test matrix in `docs/development.md`.
- [ ] Measure memory and runtime on representative large images.
- [ ] Confirm unsupported modes and layers fail safely in the host.
- [x] Update README with setup/build/load instructions.

## Phase 5 — Presets — implementation complete, host verification pending

- [x] Add versioned preset model.
- [x] Store presets in the UXP plugin data folder.
- [x] Implement Save, Load, Delete, and Rename.
- [ ] Verify corrupted or missing storage data gracefully in the host.

## Phase 6 — Target expansion — implementation complete, host verification pending

- [x] Add All Visible Layers target mode for visible editable raster layers.
- [x] Traverse visible groups and skip unsupported rendered-only layer kinds with a user-facing count.
- [x] Use per-layer masks for deletion and a document-coordinate union mask for Select.
- [ ] Verify groups, clipping, masks, adjustment layers, and blend modes in Photoshop 26.11.2.

## Phase 7 — UI polish and optional integrations — implementation complete, host verification pending

- Add compact keyboard-friendly layout and theme-aware styling.
- [x] Add a native UXP HTML color picker synchronized with the HEX field.
- Add status details such as matched-pixel count only if it does not add unsafe or expensive processing.

## Release gates

The release is not complete until the actual Photoshop host confirms multi-color union, tolerance 0, transparency, deletion, undo, color picker input, and visible pixel-layer targeting. Before distribution, package the built plugin as `.ccx` through UXP Developer Tool and test the installed package separately from the development-loaded plugin.
