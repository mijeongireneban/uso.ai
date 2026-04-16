# Icon sources

Keep the hand-authored SVGs and helper script here. Everything under
`src-tauri/icons/` outside this folder is generated.

## Files

- `logomark-app.svg` — 1024×1024 master for the macOS app icon (indigo
  squircle + white arc monogram).
- `logomark-tray.svg` — template mark for the menu bar tray (white on
  transparent; macOS auto-inverts for light/dark because we set
  `icon_as_template(true)` in `src-tauri/src/lib.rs`).
- `logomark-tray-warning.svg` / `logomark-tray-critical.svg` — amber and
  red tinted variants shown when any account approaches (≥60%) or is at
  (≥90%) its usage limit. Rendered as **non-template** icons so the tint
  is preserved on both light and dark menu bars.
- `app-icon-1024.png` — rasterized tile used as the input to
  `tauri icon`. Regenerate if the SVG changes.
- `tray-icon-18.png` / `tray-icon-36.png` — 1× and 2× raster of the
  tray mark for reference / future Retina support.
- `png-to-rgba.mjs` — converts a PNG to the raw RGBA byte buffer format
  Tauri's `tray.set_icon(..., IconRaw)` expects.

## Regenerating

Requires `librsvg` (for `rsvg-convert`) and Node. Run from this folder:

```bash
# App icon (1024 master → all platform sizes)
rsvg-convert -w 1024 -h 1024 logomark-app.svg -o app-icon-1024.png
cp app-icon-1024.png ../app-icon-1024.png
cd ../../.. && npx @tauri-apps/cli icon src-tauri/icons/app-icon-1024.png

# Tray icon (PNG + raw RGBA)
cd src-tauri/icons/_source
rsvg-convert -w 18 -h 18 logomark-tray.svg -o tray-icon-18.png
rsvg-convert -w 36 -h 36 logomark-tray.svg -o tray-icon-36.png
cp tray-icon-18.png ../tray-icon.png
npm install --no-save pngjs@7
node png-to-rgba.mjs tray-icon-18.png ../tray-icon.rgba

# Warning / critical tray variants (colour-tinted, non-template)
rsvg-convert -w 18 -h 18 logomark-tray-warning.svg -o tray-icon-warning-18.png
rsvg-convert -w 18 -h 18 logomark-tray-critical.svg -o tray-icon-critical-18.png
cp tray-icon-warning-18.png ../tray-icon-warning.png
cp tray-icon-critical-18.png ../tray-icon-critical.png
node png-to-rgba.mjs tray-icon-warning-18.png ../tray-icon-warning.rgba
node png-to-rgba.mjs tray-icon-critical-18.png ../tray-icon-critical.rgba
```
