# Photoshop UXP — Pixel Art Color Remover

An Adobe Photoshop UXP panel for selecting pixels matching one or more configured colors and removing them from the active pixel layer.

## Project status

The initial scaffold is now in place. Photoshop selection/deletion integration is not implemented yet.

The first implementation target is:

- HEX color list
- Active pixel layer
- Tolerance from 0 to 255
- One combined selection for all colors
- Select
- Select & Delete

Presets, visible-layer targeting, color-picker integration, and UI polish follow the MVP.

## Technical direction

The planned implementation uses TypeScript and a small vanilla UXP panel. The selection pipeline will use Photoshop’s Imaging API to read pixels, create a combined grayscale selection mask, and write it back as a document selection. Deletion will use the Photoshop Layer API inside `executeAsModal`.

This is deliberately not an ExtendScript/JSX plugin.

## Documents

- [Architecture](docs/architecture.md)
- [Photoshop API research](docs/photoshop-api.md)
- [Development workflow](docs/development.md)
- [Roadmap](docs/roadmap.md)
- [Repository rules](AGENTS.md)

## Installation and build

Requirements:

- Adobe Photoshop 23.3.0 or newer
- UXP Developer Tool
- Node.js 20 or newer

Install dependencies and build the UXP bundle:

```bash
npm install
npm run check
```

Then load the repository root in the UXP Developer Tool. The generated `dist/main.js` is intentionally ignored by Git and must be rebuilt after source changes.

Available commands:

- `npm run typecheck` — strict TypeScript validation
- `npm test` — pure color/mask tests
- `npm run build` — bundle `src/main.ts` into `dist/main.js`
- `npm run check` — typecheck, tests, and build

## Known limitations at this stage

- Photoshop selection and deletion APIs are not connected yet.
- The supported Photoshop version must be fixed during scaffolding and verified in the UXP Developer Tool.
- The Color Range batchPlay action remains an experimental fallback, not the primary implementation.
- “All Visible Layers” is intentionally deferred until its behavior can be implemented and tested reliably.
