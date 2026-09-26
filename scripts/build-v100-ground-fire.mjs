import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets/source/v100/vfx/ground-fire-r1");
const outputPath = path.join(root, "public/art/v100/combat-vfx/ground-fire-smoke-r1.webp");
const provenancePath = path.join(root, "outputs/completion/ground-fire-r1/provenance.json");
const sourceFiles = Array.from({ length: 30 }, (_, index) => `${String(index + 1).padStart(4, "0")}.png`);
const cellWidth = 128;
const cellHeight = 128;
const columns = 6;
const rows = 5;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sourceBytes = await Promise.all(sourceFiles.map((file) => readFile(path.join(sourceDir, file))));
const sourceMetadata = await Promise.all(sourceBytes.map((bytes) => sharp(bytes).metadata()));
for (const [index, metadata] of sourceMetadata.entries()) {
  if (metadata.width !== cellWidth || metadata.height !== cellHeight || metadata.hasAlpha !== true) {
    throw new Error(`Source frame ${sourceFiles[index]} must be 128x128 RGBA`);
  }
}
const sourceAlphaBboxes = [];
for (const bytes of sourceBytes) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * 4 + 3] <= 1) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  sourceAlphaBboxes.push(maxX < 0 ? null : [minX, minY, maxX + 1, maxY + 1]);
}

const composites = sourceBytes.map((bytes, index) => ({
  input: bytes,
  left: (index % columns) * cellWidth,
  top: Math.floor(index / columns) * cellHeight,
}));
const atlasBytes = await sharp({
  create: { width: cellWidth * columns, height: cellHeight * rows, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(composites)
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toBuffer();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, atlasBytes);
await mkdir(path.dirname(provenancePath), { recursive: true });
await writeFile(provenancePath, `${JSON.stringify({
  sourceArchive: "outputs/completion/rubberduck-volumetrics.zip",
  sourceArchiveSha256: "52fc2d3dca5621d1e2968365226021ded3de2ace43c7f09339405197066b0594",
  sourceLicense: "CC0-1.0",
  sourcePath: "effect-images/flame/fire+smoke/0001.png through 0030.png",
  sourceDirectory: "assets/source/v100/vfx/ground-fire-r1",
  sourceFrames: sourceFiles.map((file, index) => ({ file, bytes: sourceBytes[index].length, sha256: sha256(sourceBytes[index]), alphaGt1BBox: sourceAlphaBboxes[index] })),
  sourceUnionAlphaGt1BBox: sourceAlphaBboxes.reduce((union, bbox) => bbox ? [Math.min(union[0], bbox[0]), Math.min(union[1], bbox[1]), Math.max(union[2], bbox[2]), Math.max(union[3], bbox[3])] : union, [cellWidth, cellHeight, 0, 0]),
  outputPath: "public/art/v100/combat-vfx/ground-fire-smoke-r1.webp",
  outputBytes: atlasBytes.length,
  outputSha256: sha256(atlasBytes),
  outputDimensions: [cellWidth * columns, cellHeight * rows],
  layout: { columns, rows, cellWidth, cellHeight, order: "row-major" },
  encoding: { format: "webp", quality: 92, alphaQuality: 100, effort: 6 },
  processing: "Copied original RGBA frames unchanged; packed directly into a 6x5 transparent atlas; no trim, recolor, resampling, or alpha modification.",
}, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: outputPath, bytes: atlasBytes.length, sha256: sha256(atlasBytes) }));
