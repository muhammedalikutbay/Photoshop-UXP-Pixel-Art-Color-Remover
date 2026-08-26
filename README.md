# Photoshop UXP — Pixel Art Color Remover

An Adobe Photoshop UXP panel for selecting pixels matching one or more configured colors and removing them from the active pixel layer.

## Project status

This repository is currently in the research and architecture phase. The MVP has not been scaffolded or implemented yet.

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

Not available yet. These instructions will be added when the scaffold and build configuration are created.

## Known limitations at this stage

- No plugin manifest or executable code exists yet.
- The supported Photoshop version must be fixed during scaffolding and verified in the UXP Developer Tool.
- The Color Range batchPlay action remains an experimental fallback, not the primary implementation.
- “All Visible Layers” is intentionally deferred until its behavior can be implemented and tested reliably.
