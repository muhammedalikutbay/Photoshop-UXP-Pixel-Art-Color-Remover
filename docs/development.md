# Development Guide

## Current phase

The initial manifest, source tree, package configuration, panel shell, and pure logic tests now exist. Photoshop host loading and document mutation are still pending.

## Planned local setup

1. Install a supported Photoshop version and the UXP Developer Tool through Adobe Creative Cloud.
2. Run `npm install`.
3. Run `npm run check`.
4. Load the repository root through the UXP Developer Tool.
5. Keep the developer console open while testing Photoshop operations.

The current manifest uses Manifest v5, Photoshop minimum version 23.3.0, and Photoshop API version 2. The manifest and host version must be rechecked before release.

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

For each test, record Photoshop version, document mode/bit depth, expected result, actual result, and any console error.

## Debugging rules

- Use the UXP Developer Tool to load/unload the plugin and inspect the panel.
- Use Photoshop’s developer console for API results and errors.
- When testing a new batchPlay descriptor, capture the exact descriptor and host version in `docs/photoshop-api.md`.
- Never treat a successful call on one Photoshop build as proof of cross-version support.
