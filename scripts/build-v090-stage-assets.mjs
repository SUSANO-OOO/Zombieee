import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "assets", "source", "v090", "stages");
const objectSourceRoot = path.join(root, "assets", "source", "v090", "objects");
const outputRoot = path.join(root, "public", "art", "v090", "stages");
const OUTPUT_SIZE = Object.freeze({ width: 1600, height: 900 });
const OBJECT_OUTPUT_SIZE = Object.freeze({ width: 640, height: 320 });

const stages = Object.freeze([
  {
    id: "bay-tower-service",
    source: "stage17-bay-tower-service-r1.png",
    position: "centre",
  },
  {
    id: "civic-archive-route",
    source: "stage18-civic-archive-route-r1.png",
    position: "centre",
  },
  {
    id: "coastal-link-bridge",
    source: "stage19-coastal-link-bridge-r1.png",
    position: "centre",
  },
  {
    id: "estuary-floodgate",
    source: "stage20-estuary-floodgate-r1.png",
    position: "centre",
  },
]);

async function evidenceFor(file) {
  const bytes = await readFile(file);
  const metadata = await sharp(bytes).metadata();
  return Object.freeze({
    path: path.relative(root, file).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
    dimensions: [metadata.width, metadata.height],
  });
}

function keyedAlpha(r, g, b) {
  const nonGreen = Math.max(r, b);
  const greenDominance = g - nonGreen;
  const greenRatio = (g + 8) / (nonGreen + 8);
  if (greenDominance <= 7 || greenRatio < 1.2) return 255;
  const dominanceAlpha = 1 - Math.max(0, Math.min(1, (greenDominance - 7) / 32));
  const ratioAlpha = 1 - Math.max(0, Math.min(1, (greenRatio - 1.2) / .42));
  return Math.round(Math.min(dominanceAlpha, ratioAlpha) * 255);
}

async function buildCoastalPowerRig() {
  const source = path.join(objectSourceRoot, "stage19-coastal-power-rig-key-r1.png");
  const output = path.join(outputRoot, "coastal-power-rig-v1.png");
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alpha = keyedAlpha(data[offset], data[offset + 1], data[offset + 2]);
    if (alpha < 255) {
      data[offset + 1] = Math.min(
        data[offset + 1],
        Math.round(Math.max(data[offset], data[offset + 2]) * 1.08),
      );
    }
    data[offset + 3] = Math.min(data[offset + 3], alpha);
  }

  await sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
    .resize(OBJECT_OUTPUT_SIZE.width - 24, OBJECT_OUTPUT_SIZE.height - 24, {
      fit: "contain",
      position: "south",
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: true,
    })
    .extend({
      top: 12,
      bottom: 12,
      left: 12,
      right: 12,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(output);

  return Object.freeze({
    id: "coastal-power-rig",
    source: await evidenceFor(source),
    output: await evidenceFor(output),
  });
}

await mkdir(outputRoot, { recursive: true });
const outputs = [];
for (const stage of stages) {
  const source = path.join(sourceRoot, stage.source);
  const output = path.join(outputRoot, `${stage.id}-background-v1.webp`);
  await sharp(source)
    .resize(OUTPUT_SIZE.width, OUTPUT_SIZE.height, {
      fit: "cover",
      position: stage.position,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: 88, effort: 6, smartSubsample: true })
    .toFile(output);
  outputs.push(Object.freeze({
    id: stage.id,
    source: await evidenceFor(source),
    output: await evidenceFor(output),
  }));
}
const missionObjects = [await buildCoastalPowerRig()];

console.log(JSON.stringify({
  message: `Built ${outputs.length} Version 0.9.0 stage backgrounds and ${missionObjects.length} mission object.`,
  outputs,
  missionObjects,
}, null, 2));
