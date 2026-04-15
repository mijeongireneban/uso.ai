// Converts a PNG to a raw RGBA byte buffer (width*height*4 bytes).
// Usage: node png-to-rgba.mjs <in.png> <out.rgba>
// Used to regenerate src-tauri/icons/tray-icon.rgba from the source SVG
// whenever the tray mark changes.
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("usage: png-to-rgba.mjs <in.png> <out.rgba>");
  process.exit(1);
}

const buf = readFileSync(inputPath);
const png = PNG.sync.read(buf);
writeFileSync(outputPath, png.data);
console.log(`wrote ${png.data.length} bytes (${png.width}x${png.height})`);
