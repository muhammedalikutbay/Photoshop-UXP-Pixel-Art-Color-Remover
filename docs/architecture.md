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

## Core operation

1. Read and validate the UI state.
2. Check that an active document exists.
3. Check that the active target is an editable pixel layer.
4. Read the target layer pixels at full resolution with Imaging API, requesting RGB/8-bit data in a known profile.
5. Build one binary grayscale mask. A pixel is selected if it matches any configured color.
6. Write the mask as the document selection with `imaging.putSelection({ replace: true })`.
7. For Select, report the selection result and leave the selection active.
8. For Select & Delete, clear the active layer pixels while the combined selection is active.
9. Deselect after deletion, unless the final UX decision explicitly preserves the selection.
10. Dispose all returned and created image-data objects, report the result, and handle cancellation/errors.

## Color and tolerance semantics

HEX input is normalized to uppercase `#RRGGBB` and deduplicated. The initial planned matcher is normalized Euclidean RGB distance:

```text
distance = sqrt((dr² + dg² + db²) / 3)
match when distance <= tolerance
```

This gives the requested range a predictable meaning: `0` means exact RGB equality and `255` is the maximum possible normalized RGB distance. The implementation must compare pixels and targets in the same requested color space/profile. This is an application-defined tolerance, not a claim that it exactly reproduces Photoshop Color Range fuzziness.

## Target-layer decision

V1 uses the active layer only. “All Visible Layers” is a later capability because reading a composite image does not identify which source layer should be cleared, while clearing each visible layer has non-trivial semantics for adjustment layers, groups, clipping, masks, and blend modes.

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
