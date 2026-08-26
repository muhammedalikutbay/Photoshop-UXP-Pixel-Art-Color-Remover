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

## Phase 3 — MVP core — started

- [x] Implement HEX parsing, normalization, validation, and deduplication.
- [x] Implement tolerance validation and pure pixel-mask matching.
- Validate active document and active pixel layer.
- Read full-resolution layer pixels through Imaging API.
- Build and apply one combined selection.
- Add Select and Select & Delete commands.
- Add modal execution, history behavior, cancellation, disposal, and error handling.

## Phase 4 — MVP verification and documentation

- Run the pure unit tests.
- Run the Photoshop manual test matrix in `docs/development.md`.
- Measure memory and runtime on representative large images.
- Confirm unsupported modes and layers fail safely.
- Update README with real setup/build/load instructions.

## Phase 5 — Presets

- Add versioned preset model.
- Store presets in the UXP plugin data folder.
- Implement Save, Load, Delete, and Rename.
- Handle corrupted or missing storage data gracefully.

## Phase 6 — Target expansion

- Prototype “All Visible Layers” with explicit handling for pixel layers, groups, masks, and adjustment layers.
- Decide whether the operation is a composite selection plus per-layer clearing or a different native workflow.
- Ship only after behavior is reliable and documented.

## Phase 7 — UI polish and optional integrations

- Add compact keyboard-friendly layout and theme-aware styling.
- Evaluate native Photoshop color picker integration through verified batchPlay or a safe fallback HEX-only flow.
- Add status details such as matched-pixel count only if it does not add unsafe or expensive processing.

## Release gates

The MVP is not complete until the actual Photoshop host confirms multi-color union, tolerance 0, transparency, deletion, and undo. Presets and visible-layer targeting must not delay or obscure that core validation.
