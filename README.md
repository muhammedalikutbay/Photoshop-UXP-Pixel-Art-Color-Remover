# Pixel Art Color Remover

An Adobe Photoshop UXP panel for selecting and removing colors from pixel-art layers.

## Features

- Add colors with HEX codes or Photoshop's Eyedropper tool.
- Manage colors with swatches, individual removal, and Clear All.
- Match exact colors or use tolerance from `0` to `255`.
- Select matching pixels or Select & Delete them.
- Responsive panel layout for docked and floating panels.

## Install

1. Download the `.ccx` file from the latest [GitHub Release](../../releases/latest).
2. Install it with the aescripts ZXP/UXP Installer or a compatible UXP installer.
3. Open Photoshop and launch **Pixel Art Color Remover** from the Plugins menu.

## Use

1. Enter a six-digit HEX color or use the Eyedropper.
2. Click **Add Color**.
3. Set the tolerance if needed. `0` means an exact color match.
4. Click **Select** to create a selection, or **Select & Delete** to remove matching pixels.

## Development

```bash
npm install
npm run check
```

Load the repository root through Adobe UXP Developer Tool. Run `npm run build` after source changes, then use **Reload** in the Developer Tool.

## Requirements

- Adobe Photoshop 23.3.0 or newer
- Node.js 20 or newer for development

## Documentation

- [Architecture](docs/architecture.md)
- [Development guide](docs/development.md)
- [Roadmap](docs/roadmap.md)
