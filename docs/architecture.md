# Architecture

## Status

This is the initial architecture decision for the research phase. It is intentionally small enough for a UXP panel and leaves room for presets and additional target modes.

## Runtime boundaries

```text
UXP panel UI
    |
    v
Application state + command handlers
    |
    +--> Color parser / validator       (pure TypeScript)
    +--> Pixel mask builder             (pure TypeScript)
    +--> Color removal orchestrator
              |
              +--> Photoshop adapter
              |       +--> document/layer validation
              |       +--> Imaging API pixel read
              |       +--> Imaging API selection write
              |       +--> Layer API clear
              |       +--> executeAsModal/history/cancellation
              |
              +--> Preset storage adapter (UXP plugin data folder)
```

## Proposed source tree

```text
src/
├── main.ts
├── app/
│   ├── AppController.ts
│   └── AppState.ts
├── core/
│   ├── color/
│   │   ├── Color.ts
│   │   ├── ColorParser.ts
│   │   └── ColorValidator.ts
│   ├── matching/
│   │   └── PixelMaskBuilder.ts
│   └── removal/
│       ├── ColorRemovalService.ts
│       └── RemovalTypes.ts
├── photoshop/
│   ├── PhotoshopAdapter.ts
│   ├── DocumentService.ts
│   ├── LayerService.ts
│   ├── ImagingSelectionService.ts
│   └── PhotoshopErrors.ts
├── presets/
│   ├── Preset.ts
│   └── PresetService.ts
├── ui/
│   ├── ColorListView.ts
│   ├── SettingsView.ts
│   └── StatusMessage.ts
└── infrastructure/
    └── Logger.ts
```

The exact file split can be reduced during implementation if a module remains trivial. The important boundaries are the pure matching code and the Photoshop adapter.

The color sampling path is separate from destructive Photoshop operations: the panel asks the Imaging API for a temporary scaled document preview, then maps a preview click to `Document.sampleColor`. This keeps the eyedropper deterministic without relying on an undocumented batchPlay descriptor or a canvas pointer event that UXP does not expose to panel HTML.

## Core operation

1. Read and validate the UI state.
2. Resolve either the active pixel layer or every visible editable pixel layer, recursively traversing visible groups.
3. Read each target layer’s pixels at full resolution with Imaging API, requesting RGB/8-bit data in a known profile.
4. Build one binary grayscale mask per layer. A pixel is selected if it matches any configured color.
5. For Select, OR the per-layer masks into one document-sized mask and write one document selection with `imaging.putSelection({ replace: true })`.
6. For Select & Delete on the active layer, write its mask, clear that layer, and deselect.
7. For Select & Delete on visible layers, write and clear each layer with its own mask so a match on one layer cannot erase an unrelated pixel on another; then deselect.
8. Dispose all returned and created image-data objects, report skipped non-pixel layers, and handle cancellation/errors.

## Color and tolerance semantics

HEX input is normalized to uppercase `#RRGGBB` and deduplicated. The initial planned matcher is normalized Euclidean RGB distance:

```text
distance = sqrt((dr² + dg² + db²) / 3)
match when distance <= tolerance
```

This gives the requested range a predictable meaning: `0` means exact RGB equality and `255` is the maximum possible normalized RGB distance. The implementation must compare pixels and targets in the same requested color space/profile. This is an application-defined tolerance, not a claim that it exactly reproduces Photoshop Color Range fuzziness.

## Target-layer decision

The shipped target modes are Active Layer and All Visible Layers. All Visible Layers does not read a composite image: it reads each visible `LayerKind.NORMAL` layer independently, unions the masks in document coordinates, and skips non-pixel layers with a user-facing count. Groups are traversed without being edited. This keeps adjustment, text, smart-object, clipping, and blend-mode semantics explicit instead of flattening or rasterizing them.

## Undo and state

The delete command should run in one `executeAsModal` scope and use Photoshop’s history suspension mechanism where supported. The implementation must verify whether selection creation, clearing, and deselection appear as one useful undo state in the target Photoshop version. The user’s pre-existing selection must either be restored or the behavior must be explicitly documented; it must not be silently lost.

## Presets

Presets are not part of the MVP. They will store a versioned JSON model through the UXP plugin data folder, for example:

```json
{
  "schemaVersion": 1,
  "name": "Pixel Art Basic",
  "colors": ["#FF00FF", "#00FF00"],
  "tolerance": 0
}
```

The storage layer will be replaceable and will not leak UXP `File`/`Folder` objects into core logic.
