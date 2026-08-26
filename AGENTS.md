# Pixel Art Color Remover — Development Rules

## Scope

This repository is an Adobe Photoshop UXP panel plugin. It is not an ExtendScript/JSX project.

The product priority is:

1. Stability
2. Simplicity
3. Performance
4. Visual polish

## API rules

- Verify Photoshop and UXP APIs against the current official Adobe documentation before implementation.
- Do not invent DOM methods or assume that an undocumented batchPlay descriptor is stable.
- Prefer Photoshop DOM and Imaging APIs. Use batchPlay only when the DOM does not expose the required operation.
- Document every batchPlay descriptor, its source, host-version assumptions, and a fallback or failure mode.
- Document the minimum Photoshop/UXP version for every API that has a version requirement.
- All Photoshop document mutations must run inside `core.executeAsModal`.
- Long-running modal work must check cancellation and release `PhotoshopImageData` objects with `dispose()`.

## Product boundaries

- V1 targets one active pixel layer.
- V1 supports RGB documents at 8 bits/channel first. Unsupported document modes, layer kinds, locked layers, and unsupported bit depths must produce a user-facing message.
- “All Visible Layers” is not a V1 promise until its semantics are proven for pixel, group, adjustment, clipping, and transparent layers.
- Selection creation must produce one union selection for all configured colors; do not delete once per color.
- The default tolerance is `0`. The exact meaning and distance metric must remain documented and tested.
- The original selection should be restored or deliberately cleared according to the final product decision; this must never happen accidentally.
- The complete operation should be one understandable undo step where Photoshop’s history APIs allow it.

## Code and architecture

- Keep color parsing/validation, pixel matching, Photoshop integration, deletion, storage, state, and UI responsibilities separate.
- Keep pure color and mask logic independent from Photoshop so it can be unit tested without Photoshop.
- Avoid a framework unless it provides a concrete benefit in UXP. Prefer TypeScript with a small build setup.
- Use explicit typed errors or error categories and convert them to concise UI messages at the boundary.
- Do not log raw stack traces to the production panel. Use a small debug logger and preserve details for the developer console.

## Verification

Before considering a feature complete:

- Run the automated tests for pure logic.
- Manually test it in the supported Photoshop version with an actual UXP Developer Tool load.
- Test no-document, invalid-input, locked/unsupported-layer, transparency, tolerance, multi-color, selection, delete, and undo cases.
- Update `README.md` and the relevant files in `docs/` when behavior or API assumptions change.

## Documentation

The authoritative planning documents are:

- `docs/architecture.md`
- `docs/photoshop-api.md`
- `docs/development.md`
- `docs/roadmap.md`

The repository’s implementation must follow these documents unless a later decision is recorded there.
