// Generates lossless WebP transport copies for runtime PNG art.
//
// Runtime URLs stay PNG for compatibility with the renderer and CSS. The PWA
// manifest records the corresponding WebP as sourcePath, so the first full
// install transfers fewer bytes without changing a pixel or requiring a
// quality trade-off. The original PNGs remain available to ordinary browser
// requests and authoring tools.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "public");
const manifestPath = path.join(publicDir, "asset-manifest.json");
const checkOnly = process.argv.includes("--check");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pngAssets = (manifest.assets ?? []).filter((asset) => (
  asset.path.endsWith(".png") && !asset.path.startsWith("/icons/")
));

let generated = 0;
let bytesBefore = 0;
let bytesAfter = 0;
let visiblePixelDifferences = 0;
let alphaDifferences = 0;
const changed = [];

for (const asset of pngAssets) {
  const sourcePath = path.join(publicDir, asset.path.replace(/^\//, ""));
  const outputPath = path.join(publicDir, "pwa-optimized", asset.path.replace(/\.png$/i, ".webp").replace(/^\//, ""));
  const source = await readFile(sourcePath);
  const output = await sharp(source).webp({ lossless: true, effort: 6 }).toBuffer();
  const originalRaw = await sharp(source).raw().toBuffer({ resolveWithObject: true });
  const outputRaw = await sharp(output).raw().toBuffer({ resolveWithObject: true });
  if (originalRaw.info.width !== outputRaw.info.width
    || originalRaw.info.height !== outputRaw.info.height
    || originalRaw.info.channels !== outputRaw.info.channels) {
    throw new Error(`Raster geometry changed for ${asset.path}`);
  }
  for (let offset = 0; offset < originalRaw.data.length; offset += originalRaw.info.channels) {
    const alphaOffset = originalRaw.info.channels - 1;
    if (originalRaw.data[offset + alphaOffset] !== outputRaw.data[offset + alphaOffset]) alphaDifferences += 1;
    if (originalRaw.data[offset + alphaOffset] > 0) {
      for (let channel = 0; channel < alphaOffset; channel += 1) {
        if (originalRaw.data[offset + channel] !== outputRaw.data[offset + channel]) visiblePixelDifferences += 1;
      }
    }
  }
  bytesBefore += source.byteLength;
  bytesAfter += output.byteLength;
  let current = null;
  try { current = await readFile(outputPath); } catch { /* generated below */ }
  if (!current || !current.equals(output)) {
    changed.push(`/pwa-optimized${asset.path.replace(/\.png$/i, ".webp")}`);
    if (!checkOnly) {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, output);
    }
  }
  generated += 1;
}

if (checkOnly && changed.length > 0) {
  throw new Error(`Out-of-date PWA raster derivatives: ${changed.slice(0, 20).join(", ")}`);
}
if (visiblePixelDifferences > 0 || alphaDifferences > 0) {
  throw new Error(`Lossless raster validation failed: visible=${visiblePixelDifferences}, alpha=${alphaDifferences}`);
}

for (const asset of pngAssets) {
  const outputPath = path.join(publicDir, "pwa-optimized", asset.path.replace(/\.png$/i, ".webp").replace(/^\//, ""));
  await stat(outputPath);
}

console.log(JSON.stringify({
  checkOnly,
  generated,
  bytesBefore,
  bytesAfter,
  savedBytes: bytesBefore - bytesAfter,
  changedCount: changed.length,
  visiblePixelDifferences,
  alphaDifferences,
}, null, 2));
