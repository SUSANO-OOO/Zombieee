import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  CRAWLER_AIRSTRIKE_SPRITE_PHASES,
  CRAWLER_BARRAGE_SPRITE_PHASES,
  V099_CRAWLER_RUNTIME_PROFILE,
} from "../app/crawlerEquipmentSprites.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const sourceRoot = path.join(publicRoot, "art", "v075", "crawler");
const provenancePath = path.join(root, "assets", "source", "v099", "crawler", "provenance.json");
const checkOnly = process.argv.includes("--check");

const SOURCE = Object.freeze({
  identity: {
    file: "crawler-command-base-identity-r1.png",
    assetId: "V075-CRAWLER-IDENTITY",
    revision: "r1",
    sha256: "7aa082adac522e3342f42cd9dcd3dc264004df83c83b1c003dea7e16f077850e",
  },
  closed: {
    file: "crawler-command-base-closed-v1.png",
    assetId: "V075-CRAWLER-CLOSED",
    revision: "v1",
    sha256: "d4ce35c5cdd09750fa8d4e2df0c926385b1ebceb04d0cb6dccd36e08928fd854",
  },
  open: {
    file: "crawler-command-base-open-v2.png",
    assetId: "V075-CRAWLER-OPEN",
    revision: "v2",
    sha256: "9e2ea0c4e5feb799a19a534859fad04f4323223cf147a6c6d715a65b3ecf408a",
  },
});

const BARRAGE_CROP = Object.freeze({ left: 918, top: 304, width: 256, height: 128 });
const AIRSTRIKE_CROP = Object.freeze({ left: 488, top: 70, width: 64, height: 288 });

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

function sourcePixelOffset(x, y, width, channels = 4) {
  return (y * width + x) * channels;
}

function isBarrageUpperModule(x, y, alpha) {
  return alpha > 0 && x >= 918 && x < 1174 && y >= 304 && y < 400;
}

function isAirstrikeUpperModule(x, y, alpha) {
  return alpha > 0 && x >= 500 && x < 530 && y >= 88 && y < 330;
}

function isDeploymentForeground(x, y, alpha) {
  if (alpha <= 0) return false;
  // This is a source-pixel partition, not a runtime clip. The silhouette follows
  // the authored door jamb, roof lip, lower ramp/rail, and forward hull. Pixels
  // in the amber interior remain on the base layer so an alpha-1 unit can stand
  // between real raster surfaces instead of being cut by a rectangle.
  const leftJamb = x >= 890 && x < 976 && y >= 470 && y < 735;
  const roofLip = x >= 930 && x < 1128 && y >= 465 && y < 522;
  const rightJamb = x >= 1088 && x < 1162 && y >= 470 && y < 735;
  const rampAndRails = x >= 890 && x < 1320 && y >= 690;
  const forwardHull = x >= 1110 && y >= 480;
  return leftJamb || roofLip || rightJamb || rampAndRails || forwardHull;
}

async function rgba(file) {
  const result = await sharp(file, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (result.info.width !== 1536 || result.info.height !== 1024 || result.info.channels !== 4) {
    throw new Error(`${file}: expected a 1536x1024 RGBA CRAWLER master`);
  }
  return result;
}

function clearModules(source) {
  const data = Buffer.from(source.data);
  for (let y = 0; y < source.info.height; y += 1) {
    for (let x = 0; x < source.info.width; x += 1) {
      const offset = sourcePixelOffset(x, y, source.info.width, source.info.channels);
      const alpha = data[offset + 3];
      if (isBarrageUpperModule(x, y, alpha) || isAirstrikeUpperModule(x, y, alpha)) {
        data.fill(0, offset, offset + 4);
      }
    }
  }
  return data;
}

function splitDeploymentHost(host, info) {
  const base = Buffer.from(host);
  const foreground = Buffer.alloc(host.length);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = sourcePixelOffset(x, y, info.width, info.channels);
      if (!isDeploymentForeground(x, y, host[offset + 3])) continue;
      host.copy(foreground, offset, offset, offset + 4);
      base.fill(0, offset, offset + 4);
    }
  }
  return { base, foreground };
}

function extractModule(source, crop, predicate) {
  const data = Buffer.alloc(crop.width * crop.height * 4);
  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const sourceX = crop.left + x;
      const sourceY = crop.top + y;
      const sourceOffset = sourcePixelOffset(sourceX, sourceY, source.info.width, source.info.channels);
      if (!predicate(sourceX, sourceY, source.data[sourceOffset + 3])) continue;
      const destinationOffset = sourcePixelOffset(x, y, crop.width);
      source.data.copy(data, destinationOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return data;
}

async function pngFromRaw(data, width, height) {
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
}

async function translateModule(module, width, height, { x = 0, y = 0, scaleY = 1 } = {}) {
  let input = await pngFromRaw(module, width, height);
  if (scaleY !== 1) {
    const scaledHeight = Math.max(1, Math.round(height * scaleY));
    input = await sharp(input).resize(width, scaledHeight, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    }).png().toBuffer();
    y += height - scaledHeight;
  }
  const metadata = await sharp(input).metadata();
  const left = Math.round(x);
  const top = Math.round(y);
  const extractLeft = Math.max(0, -left);
  const extractTop = Math.max(0, -top);
  const visibleWidth = Math.min(metadata.width - extractLeft, width - Math.max(0, left));
  const visibleHeight = Math.min(metadata.height - extractTop, height - Math.max(0, top));
  if (visibleWidth <= 0 || visibleHeight <= 0) return Buffer.alloc(width * height * 4);
  const clipped = await sharp(input).extract({
    left: extractLeft,
    top: extractTop,
    width: visibleWidth,
    height: visibleHeight,
  }).png().toBuffer();
  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: clipped, left: Math.max(0, left), top: Math.max(0, top) }])
    .raw()
    .toBuffer();
}

async function buildSheet(module, frameWidth, frameHeight, frameTransforms) {
  const frames = [];
  for (const transform of frameTransforms) {
    frames.push(await translateModule(module, frameWidth, frameHeight, transform));
  }
  const sheet = Buffer.alloc(frameWidth * frameTransforms.length * frameHeight * 4);
  const sheetWidth = frameWidth * frameTransforms.length;
  for (let frame = 0; frame < frames.length; frame += 1) {
    const data = frames[frame];
    for (let y = 0; y < frameHeight; y += 1) {
      const sourceOffset = y * frameWidth * 4;
      const destinationOffset = (y * sheetWidth + frame * frameWidth) * 4;
      data.copy(sheet, destinationOffset, sourceOffset, sourceOffset + frameWidth * 4);
    }
  }
  return pngFromRaw(sheet, sheetWidth, frameHeight);
}

function alphaEvidence(raw, width, height) {
  let transparent = 0;
  let translucent = 0;
  let opaque = 0;
  for (let offset = 3; offset < raw.length; offset += 4) {
    if (raw[offset] === 0) transparent += 1;
    else if (raw[offset] === 255) opaque += 1;
    else translucent += 1;
  }
  return { width, height, transparentPixels: transparent, translucentPixels: translucent, opaquePixels: opaque };
}

async function losslessWebpEvidence(png, webp) {
  const original = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const transport = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (original.info.width !== transport.info.width
    || original.info.height !== transport.info.height
    || original.info.channels !== transport.info.channels) {
    throw new Error("lossless WebP transport changed raster geometry");
  }
  let visiblePixelDifferences = 0;
  let alphaDifferences = 0;
  for (let offset = 0; offset < original.data.length; offset += original.info.channels) {
    const alphaOffset = original.info.channels - 1;
    if (original.data[offset + alphaOffset] !== transport.data[offset + alphaOffset]) alphaDifferences += 1;
    if (original.data[offset + alphaOffset] <= 0) continue;
    for (let channel = 0; channel < alphaOffset; channel += 1) {
      if (original.data[offset + channel] !== transport.data[offset + channel]) visiblePixelDifferences += 1;
    }
  }
  if (visiblePixelDifferences > 0 || alphaDifferences > 0) {
    throw new Error(`lossless WebP drifted: visible=${visiblePixelDifferences}, alpha=${alphaDifferences}`);
  }
  return { visiblePixelDifferences, alphaDifferences };
}

async function artifactRecord(id, logicalPath, buffer, transportBuffer) {
  const metadata = await sharp(buffer).metadata();
  const raw = await sharp(buffer).ensureAlpha().raw().toBuffer();
  const sourcePath = `/pwa-optimized${logicalPath.replace(/\.png$/u, ".webp")}`;
  return {
    id,
    logicalPath,
    file: `public${logicalPath}`,
    bytes: buffer.length,
    sha256: sha256(buffer),
    format: metadata.format,
    alpha: alphaEvidence(raw, metadata.width, metadata.height),
    pwaTransport: {
      sourcePath,
      format: "lossless-webp",
      generator: "scripts/build-pwa-raster-derivatives.mjs",
      bytes: transportBuffer.length,
      sha256: sha256(transportBuffer),
      ...(await losslessWebpEvidence(buffer, transportBuffer)),
    },
  };
}

async function assertOrWrite(file, buffer) {
  if (!checkOnly) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buffer);
    return;
  }
  const current = await readFile(file);
  if (!current.equals(buffer)) throw new Error(`${path.relative(root, file)} drifted from deterministic generation`);
}

const sources = {};
for (const [key, record] of Object.entries(SOURCE)) {
  const file = path.join(sourceRoot, record.file);
  const bytes = await readFile(file);
  if (sha256(bytes) !== record.sha256) throw new Error(`${record.file}: approved source hash drift`);
  const metadata = await sharp(bytes).metadata();
  sources[key] = {
    assetId: record.assetId,
    revision: record.revision,
    file: path.relative(root, file).replaceAll("\\", "/"),
    bytes: bytes.length,
    sha256: record.sha256,
    dimensions: [metadata.width, metadata.height],
  };
}

const closed = await rgba(path.join(sourceRoot, SOURCE.closed.file));
const open = await rgba(path.join(sourceRoot, SOURCE.open.file));
const closedHostRaw = clearModules(closed);
const openHostRaw = clearModules(open);
const deployment = splitDeploymentHost(openHostRaw, open.info);

const barrageModule = extractModule(closed, BARRAGE_CROP, isBarrageUpperModule);
const airstrikeModule = extractModule(closed, AIRSTRIKE_CROP, isAirstrikeUpperModule);

const barrageSheet = await buildSheet(barrageModule, BARRAGE_CROP.width, BARRAGE_CROP.height, [
  { x: 0, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: -4 },
  { x: 4, y: -4 },
  { x: 8, y: -4 },
  { x: -7, y: -4 },
  { x: 0, y: -2 },
]);
const airstrikeSheet = await buildSheet(airstrikeModule, AIRSTRIKE_CROP.width, AIRSTRIKE_CROP.height, [
  { x: 0, y: 0, scaleY: .48 },
  { x: 0, y: 0, scaleY: .66 },
  { x: 0, y: 0, scaleY: .86 },
  { x: 0, y: 0, scaleY: 1 },
  { x: 1, y: -4, scaleY: 1 },
  { x: -1, y: -7, scaleY: 1 },
  { x: 0, y: 0, scaleY: .64 },
]);

const outputs = [
  ["crawler-closed-equipment-host", V099_CRAWLER_RUNTIME_PROFILE.equipmentHost.closed.path, await pngFromRaw(closedHostRaw, closed.info.width, closed.info.height)],
  ["crawler-deployment-base-interior", V099_CRAWLER_RUNTIME_PROFILE.deployment.baseInterior.path, await pngFromRaw(deployment.base, open.info.width, open.info.height)],
  ["crawler-deployment-foreground-mask", V099_CRAWLER_RUNTIME_PROFILE.deployment.foregroundMask.path, await pngFromRaw(deployment.foreground, open.info.width, open.info.height)],
  ["crawler-barrage-module-sheet", V099_CRAWLER_RUNTIME_PROFILE.equipment.barrage.sheet.path, barrageSheet],
  ["crawler-airstrike-module-sheet", V099_CRAWLER_RUNTIME_PROFILE.equipment.airstrike.sheet.path, airstrikeSheet],
];

const artifacts = [];
for (const [id, logicalPath, buffer] of outputs) {
  await assertOrWrite(path.join(publicRoot, logicalPath.slice(1)), buffer);
  const transportBuffer = await sharp(buffer).webp({ lossless: true, effort: 6 }).toBuffer();
  const transportPath = `/pwa-optimized${logicalPath.replace(/\.png$/u, ".webp")}`;
  await assertOrWrite(path.join(publicRoot, transportPath.slice(1)), transportBuffer);
  artifacts.push(await artifactRecord(id, logicalPath, buffer, transportBuffer));
}

const provenance = {
  version: "0.9.9.0",
  schemaVersion: 1,
  generator: "scripts/build-v099-crawler-assets.mjs",
  generatorRevision: 1,
  source: "project-original approved CRAWLER identity and runtime masters",
  creator: "SUSANO-OOO/Zombieee project; deterministic derivative build by OpenAI Codex Sol Lead",
  license: "Approved for project repository and game distribution under docs/ASSET_APPROVALS_0.7.5.json; no third-party stock or downloaded artwork; not declared CC0.",
  commercialUse: true,
  modification: true,
  redistribution: true,
  approvalLedger: "docs/ASSET_APPROVALS_0.7.5.json",
  sources,
  generation: {
    rasterOnly: true,
    runtimeCanvasGeometry: false,
    deploymentLayerMethod: "Binary RGBA partition of the approved open CRAWLER raster into base/interior and foreground hull/door-frame pixels.",
    equipmentMethod: "Approved closed-master turret and antenna pixels are isolated once, then pre-rendered into seven deterministic RGBA frames; runtime draws the sheets only.",
    frameSequences: {
      barrage: CRAWLER_BARRAGE_SPRITE_PHASES,
      airstrike: CRAWLER_AIRSTRIKE_SPRITE_PHASES,
    },
    rollback: {
      previousClosed: "/art/v075/crawler/crawler-command-base-closed-v1.png",
      previousOpen: "/art/v075/crawler/crawler-command-base-open-v2.png",
      previousAssetsModified: false,
    },
  },
  artifacts,
};
const provenanceBuffer = Buffer.from(`${JSON.stringify(provenance, null, 2)}\n`);
await assertOrWrite(provenancePath, provenanceBuffer);

console.log(JSON.stringify({
  mode: checkOnly ? "check" : "write",
  generated: artifacts.map(({ logicalPath, bytes, sha256: hash, pwaTransport }) => ({
    logicalPath,
    bytes,
    sha256: hash,
    pwaTransport: {
      sourcePath: pwaTransport.sourcePath,
      bytes: pwaTransport.bytes,
      sha256: pwaTransport.sha256,
    },
  })),
  provenance: path.relative(root, provenancePath).replaceAll("\\", "/"),
}, null, 2));
