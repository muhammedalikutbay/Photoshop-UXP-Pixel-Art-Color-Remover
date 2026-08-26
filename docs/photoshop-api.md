# Photoshop / UXP API Research

Research date: 2026-08-26

Sources were checked against Adobe’s official developer documentation. The official version matrix currently lists Photoshop 26.1 with UXP 8.1 at its latest listed combination.

## Decisions

The initial implementation now uses the documented APIs described below. The implementation is host-ready but still requires manual execution in Photoshop because this repository environment does not provide the UXP runtime.

### Manifest

Use Manifest v5 during scaffolding. Adobe documents v5 as the current manifest feature set, with the permissions model and support from Photoshop 23.3. The manifest should target a concrete minimum version selected during scaffolding rather than leaving the host range implicit. The plugin needs only plugin-scoped storage permission for presets; it does not need network or unrestricted filesystem access.

Relevant references:

- [Manifest v5](https://developer.adobe.com/photoshop/uxp/2022/guides/uxp_guide/uxp-misc/manifest-v5/)
- [Photoshop-specific manifest properties](https://developer.adobe.com/photoshop/uxp/2022/guides/uxp-guide/uxp-misc/manifest-v4/photoshop-manifest/)
- [UXP version matrix](https://developer.adobe.com/photoshop/uxp/2022/uxp-api/versions3-p)

### Modal execution

Any command that changes Photoshop state must run inside `require("photoshop").core.executeAsModal`. The delete pipeline must use a command name, support cancellation for long work, and preserve thrown cancellation/API errors. Adobe’s execution context exposes `isCancelled`, `onCancel`, progress reporting, and history suspension/resumption.

References:

- [Modal execution](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/executeasmodal)
- [ExecutionContext](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/objects/options/executioncontext)

### Selection API

The public Selection DOM exposes rectangle, ellipse, polygon and column operations, selection modifiers, loading from channels/layers, deselection, and related selection editing. It does not expose a public `selectColor()` method. Therefore a call such as `doc.selection.selectColor(...)` must not be assumed or implemented.

References:

- [Selection class](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/classes/selection)
- [Imaging API](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/imaging)

### Imaging API — selected approach

The Imaging API provides the primitives needed for a deterministic multi-color selection:

- `imaging.getPixels({ documentID, layerID, colorSpace, colorProfile, componentSize })` reads a layer’s pixels.
- `PhotoshopImageData.getData()` returns a typed array; 8-bit data is a `Uint8Array`.
- `imaging.createImageDataFromBuffer(...)` accepts custom data.
- Selection masks use one grayscale component.
- `imaging.putSelection({ imageData, replace: true })` writes the mask as the document selection.
- Image data must be disposed when no longer needed.

The first implementation should request full-resolution, RGB, 8-bit data using a documented profile, then compare the normalized HEX colors against those returned pixels. It should avoid `targetSize`, because scaling would change pixel matching. The source bounds and layer origin must be respected when building the mask.

References:

- [Imaging API](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/imaging)

### Deletion

The Layer API exposes `layer.clear()`. Adobe documents that it clears layer pixels without copying to the clipboard and, when no pixel selection exists, clears all pixels. The service must therefore prove that the generated selection is non-empty before calling it. It must also reject non-pixel, locked, or otherwise unsupported layers before the destructive step.

Reference:

- [Layer class](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/classes/layer)

### Document and layer validation

The Document API exposes `app.activeDocument`, document `mode`, dimensions, IDs, active layers, and layer collections. The Layer API exposes `kind`, `visible`, `locked`, `pixelsLocked`, `isBackgroundLayer`, and bounds-related information. These properties are sufficient for the V1 validation boundary, but exact supported `LayerKind` values and document modes must be confirmed against the installed Photoshop typings during scaffolding.

References:

- [Document class](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/classes/document)
- [Layer class](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/classes/layer)

### Visible-layer targeting

The `LayerKind` reference identifies `NORMAL` as a raster/pixel layer and `GROUP` as a container whose child layers are available through `layer.layers`. The implementation recursively visits visible groups, reads each visible `NORMAL` layer with `imaging.getPixels({ layerID })`, and ignores hidden descendants. Visible adjustment, text, smart-object, fill, and other non-pixel layers are skipped and reported because a composite read cannot safely identify which source layer pixels should be deleted.

For Select, the per-layer masks are OR-ed into a document-coordinate mask and written once with `imaging.putSelection`. For Select & Delete, each layer receives its own mask before `layer.clear()` so a match on one layer does not clear an unrelated pixel at the same document coordinate on another layer. This uses documented Layer properties (`visible`, `kind`, `layers`, `locked`, `pixelsLocked`, `boundsNoEffects`) available from Photoshop 22.5/23.0 as noted in the official references.

References:

- [Layer constants](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/modules/constants)
- [Layer class](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/classes/layer)
- [Layers collection](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/classes/layers)
- [Imaging API](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/imaging)

### Storage

Presets should use the plugin data folder, not arbitrary filesystem paths. UXP documents `localFileSystem.getDataFolder()` as persistent across host-app version upgrades, and plugin-scoped storage is available without requesting unrestricted access. A simple JSON file can be read/written through the UXP storage APIs. Storage errors must be converted to user-facing messages.

References:

- [UXP persistent file storage](https://developer.adobe.com/photoshop/uxp/2022/uxp-api/reference-js/modules/uxp/persistent-file-storage/storage)
- [UXP file and folder guidance](https://developer.adobe.com/photoshop/uxp/guides/how-to/)

### UI

The panel is non-blocking UI, which is appropriate for a tool users operate alongside the Photoshop canvas. Plain HTML with compact CSS or built-in Spectrum UXP widgets is sufficient for the MVP. Spectrum Web Components are a future option, but adding their dependency is not necessary for the first scaffold.

References:

- [Designing for Photoshop](https://developer.adobe.com/photoshop/uxp/2022/design/ux-patterns/designingforphotoshop)
- [Spectrum UXP reference](https://developer.adobe.com/photoshop/uxp/2022/uxp-api/reference-spectrum/)

## Alternatives evaluated

| Approach | Benefit | Problem | Decision |
| --- | --- | --- | --- |
| Public Selection DOM | Stable API and no pixel buffer | No public color-selection method | Insufficient alone |
| `colorRange` through batchPlay | Photoshop-native color-range operation and potentially fast | Action descriptor is internal/undocumented; exact RGB/Lab conversion, fuzziness, and multi-color add semantics require live host verification | Experimental fallback |
| Imaging `getPixels` + JS mask + `putSelection` | Deterministic union for any number of colors; uses documented Imaging APIs; exact tolerance can be defined and tested | Reads/processes every pixel in JS; memory and performance must be managed | Chosen V1 approach |
| Edit pixels directly with `putPixels` | Could remove pixels without a selection | Harder to preserve layer semantics and user-visible selection; more destructive and complex | Not chosen |
| Temporary layer/channel workflow | Can use native Photoshop operations | Creates extra document state and cleanup/undo complexity | Not chosen for MVP |

## BatchPlay status

Adobe documents `batchPlay` as an advanced escape hatch for functionality not exposed by the DOM and recommends trying DOM APIs first. Adobe’s event-code list includes the Color Range event, but the public docs do not define a supported high-level `colorRange` descriptor for this product’s exact requirements. A later proof-of-concept may record and verify the descriptor in the target Photoshop version. Until then, it is not the reliability baseline.

References:

- [BatchPlay](https://developer.adobe.com/photoshop/uxp/ps_reference/media/batchplay/)
- [Event codes](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/eventcodes)

## Main API risks

- Pixel data may be 8-, 16-, or 32-bit and may use different color profiles. V1 should constrain and validate this rather than silently comparing incompatible values.
- Layer pixel bounds may not start at document coordinate `(0, 0)`.
- Fully transparent pixels can contain color data that is not visually meaningful; transparency behavior needs an explicit test and policy.
- Large documents can exceed the plugin memory budget. Imaging data must be requested at the smallest full-resolution region needed and disposed promptly.
- A composite image cannot be safely mapped back to all visible source layers in the general case.
- Selection/history behavior varies by Photoshop version and must be verified in a real host.
