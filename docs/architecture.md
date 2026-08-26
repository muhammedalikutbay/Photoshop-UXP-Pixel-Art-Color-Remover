# Architecture

## Status

The plugin is a small vanilla TypeScript UXP panel. V1 focuses on deterministic color matching, safe Photoshop mutations, and a compact responsive interface.

## Runtime boundaries

```text
UXP panel UI
    |
    v
Application state + command handlers
    |
    +--> Color parser / validator       (pure TypeScript)
    +--> Pixel mask builder             (pure TypeScript)
    +--> Color removal service
              |
              +--> Photoshop document/layer validation
              +--> Imaging API pixel read and selection write
              +--> Layer API clear
              +--> executeAsModal/history/cancellation
```

## Source tree

```text
src/
├── main.ts
├── core/
│   ├── color/
│   │   ├── Color.ts
│   │   ├── ColorParser.ts
│   │   └── ColorValidator.ts
│   └── matching/
│       └── PixelMaskBuilder.ts
├── photoshop/
│   ├── ColorRemovalService.ts
│   ├── PhotoshopErrors.ts
│   └── PhotoshopTypes.ts
└── ui/
    └── styles.css
```

## Core operation

1. Read and validate the UI state.
2. Resolve either the active pixel layer or every visible editable pixel layer, recursively traversing visible groups.
3. Read each target layer’s pixels at full resolution with the Imaging API using RGB/8-bit data.
4. Build one binary grayscale mask per layer. A pixel is selected if it matches any configured color.
5. For Select, OR the per-layer masks into one document-sized mask and write one document selection.
6. For Select & Delete, write the mask, clear the matching layer pixels, and deselect.
7. Dispose all image-data objects, report skipped non-pixel layers, and handle cancellation/errors.

## UI behavior

Selected colors are shown as removable swatch tiles. The HEX input, native UXP color chooser opened by the eyedropper icon, and Add color action share one container. Settings and Target share one container. The main content scrolls independently while the action buttons and status remain visible.

## Color and tolerance semantics

HEX input is normalized to uppercase `#RRGGBB` and deduplicated. Tolerance uses normalized Euclidean RGB distance:

```text
distance = sqrt((dr² + dg² + db²) / 3)
match when distance <= tolerance
```

Tolerance `0` means exact RGB equality. This is application-defined behavior and is not a claim that it exactly reproduces Photoshop Color Range fuzziness.

## Target-layer decision

All Visible Layers reads each visible `LayerKind.NORMAL` layer independently, unions masks in document coordinates for Select, and uses per-layer masks for deletion. Groups are traversed without being edited. Non-pixel layers are skipped and reported.

## Undo and state

Delete commands run inside one `executeAsModal` scope and use history suspension where supported. The original selection is deliberately cleared after a successful delete; Select replaces it with the generated selection.
