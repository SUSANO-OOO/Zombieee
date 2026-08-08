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
const authoringRoot = path.join(root, "assets", "source", "v099", "crawler");
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

const AUTHORING = Object.freeze({
  barrage: {
    assetId: "V099-CRAWLER-BARRAGE-SEMANTIC-AUTHORING-V2",
    chromaFile: "crawler-barrage-semantic-authoring-v2-chroma.png",
    chromaSha256: "58d3a847896addbe9c03f8c85adc9dd8e44cc7a638042b75e7e3441da7f8c625",
    rgbaFile: "crawler-barrage-semantic-authoring-v2-rgba.png",
    rgbaSha256: "29f6a2c375a9393e5352fe8aaf95d4e33d9046dc68592f5f1c5d1dee63fbc9b0",
    frame: { width: 256, height: 192, contactY: 184, paddingX: 8, paddingTop: 6 },
  },
  airstrike: {
    assetId: "V099-CRAWLER-AIRSTRIKE-SEMANTIC-AUTHORING-V2",
    chromaFile: "crawler-airstrike-semantic-authoring-v2-chroma.png",
    chromaSha256: "ebc145790b454a29159dfc9141116c967502f0a82c657bceee792248c32d95fe",
    rgbaFile: "crawler-airstrike-semantic-authoring-v2-rgba.png",
    rgbaSha256: "5b568b90d3c338083fa8157433d40255b92f2ad367734231c5f8431795d725e2",
    frame: { width: 192, height: 288, contactY: 280, paddingX: 8, paddingTop: 4 },
  },
});

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

async function pngFromRaw(data, width, height) {
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
}

function visibleBounds(data, info, alphaThreshold = 8) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  let visible = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[sourcePixelOffset(x, y, info.width, info.channels) + 3];
      if (alpha <= alphaThreshold) continue;
      visible += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (visible === 0) throw new Error("semantic authoring cell contains no visible hardware");
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, visible };
}

async function buildAuthoredSheet(authoring, {
  columns = 7,
  width: frameWidth,
  height: frameHeight,
  contactY,
  paddingX,
  paddingTop,
}) {
  const cells = [];
  let maximumWidth = 0;
  let maximumHeight = 0;
  for (let index = 0; index < columns; index += 1) {
    const cellLeft = Math.floor(index * authoring.info.width / columns);
    const cellRight = Math.floor((index + 1) * authoring.info.width / columns);
    const cellWidth = cellRight - cellLeft;
    const cell = await sharp(authoring.data, { raw: authoring.info })
      .extract({ left: cellLeft, top: 0, width: cellWidth, height: authoring.info.height })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const bounds = visibleBounds(cell.data, cell.info);
    const cropped = await sharp(cell.data, { raw: cell.info })
      .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer();
    maximumWidth = Math.max(maximumWidth, bounds.width);
    maximumHeight = Math.max(maximumHeight, bounds.height);
    cells.push({ index, bounds, cropped });
  }

  const uniformScale = Math.min(
    (frameWidth - paddingX * 2) / maximumWidth,
    (contactY - paddingTop) / maximumHeight,
  );
  if (!(uniformScale > 0)) throw new Error("semantic authoring master cannot fit the runtime frame");

  const frames = [];
  const frameEvidence = [];
  for (const cell of cells) {
    const resizedWidth = Math.max(1, Math.round(cell.bounds.width * uniformScale));
    const resizedHeight = Math.max(1, Math.round(cell.bounds.height * uniformScale));
    const resized = await sharp(cell.cropped)
      .resize(resizedWidth, resizedHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer();
    const left = Math.round((frameWidth - resizedWidth) / 2);
    const top = contactY - resizedHeight;
    const frame = await sharp({
      create: { width: frameWidth, height: frameHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: resized, left, top }]).raw().toBuffer();
    const normalizedBounds = visibleBounds(frame, {
      width: frameWidth,
      height: frameHeight,
      channels: 4,
    });
    frames.push(frame);
    frameEvidence.push({
      frame: cell.index,
      authoringBounds: cell.bounds,
      normalizedBounds,
      placement: { left, top, width: resizedWidth, height: resizedHeight },
    });
  }

  const sheetWidth = frameWidth * columns;
  const sheet = Buffer.alloc(sheetWidth * frameHeight * 4);
  for (let frame = 0; frame < frames.length; frame += 1) {
    for (let y = 0; y < frameHeight; y += 1) {
      const sourceOffset = y * frameWidth * 4;
      const destinationOffset = (y * sheetWidth + frame * frameWidth) * 4;
      frames[frame].copy(sheet, destinationOffset, sourceOffset, sourceOffset + frameWidth * 4);
    }
  }
  return {
    png: await pngFromRaw(sheet, sheetWidth, frameHeight),
    evidence: {
      authoringDimensions: [authoring.info.width, authoring.info.height],
      frameDimensions: [frameWidth, frameHeight],
      contactY,
      uniformScale,
      frames: frameEvidence,
    },
  };
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

const authoringSources = {};
for (const [kind, record] of Object.entries(AUTHORING)) {
  const chromaFile = path.join(authoringRoot, record.chromaFile);
  const rgbaFile = path.join(authoringRoot, record.rgbaFile);
  const chromaBytes = await readFile(chromaFile);
  const rgbaBytes = await readFile(rgbaFile);
  if (sha256(chromaBytes) !== record.chromaSha256) throw new Error(`${record.chromaFile}: ImageGen chroma master hash drift`);
  if (sha256(rgbaBytes) !== record.rgbaSha256) throw new Error(`${record.rgbaFile}: RGBA authoring master hash drift`);
  const authoring = await sharp(rgbaBytes, { failOn: "error" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const chromaMetadata = await sharp(chromaBytes).metadata();
  authoringSources[kind] = {
    record,
    authoring,
    provenance: {
      assetId: record.assetId,
      creator: "OpenAI ImageGen built-in; directed and accepted as project-original by OpenAI Codex Sol Lead",
      role: "seven-state semantic equipment authoring contact sheet; authoring-only and excluded from public runtime",
      promptContract: "Existing approved CRAWLER identity and equipment references; exactly seven mechanically distinct states; uniform #ff00ff chroma; no external VFX or HUD.",
      chromaSource: {
        file: path.relative(root, chromaFile).replaceAll("\\", "/"),
        bytes: chromaBytes.length,
        sha256: record.chromaSha256,
        dimensions: [chromaMetadata.width, chromaMetadata.height],
      },
      rgbaMaster: {
        file: path.relative(root, rgbaFile).replaceAll("\\", "/"),
        bytes: rgbaBytes.length,
        sha256: record.rgbaSha256,
        dimensions: [authoring.info.width, authoring.info.height],
        chromaRemoval: {
          helper: "C:/Users/okait/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py",
          mode: "auto-key border, soft matte, despill, edge-contract 1",
        },
      },
    },
  };
}

const barrageBuild = await buildAuthoredSheet(authoringSources.barrage.authoring, AUTHORING.barrage.frame);
const airstrikeBuild = await buildAuthoredSheet(authoringSources.airstrike.authoring, AUTHORING.airstrike.frame);
const barrageSheet = barrageBuild.png;
const airstrikeSheet = airstrikeBuild.png;

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
  generatorRevision: 2,
  source: "project-original approved CRAWLER identity plus project-original semantic equipment authoring masters",
  creator: "SUSANO-OOO/Zombieee project; semantic equipment authored with OpenAI ImageGen and deterministic derivative build by OpenAI Codex Sol Lead",
  license: "Approved project-original work for repository and game distribution; vehicle identity remains governed by docs/ASSET_APPROVALS_0.7.5.json; no third-party stock or downloaded artwork; not declared CC0.",
  commercialUse: true,
  modification: true,
  redistribution: true,
  approvalLedger: "docs/ASSET_APPROVALS_0.7.5.json",
  sources,
  equipmentAuthoring: Object.fromEntries(
    Object.entries(authoringSources).map(([kind, { provenance: record }]) => [kind, record]),
  ),
  generation: {
    rasterOnly: true,
    runtimeCanvasGeometry: false,
    deploymentLayerMethod: "Binary RGBA partition of the approved open CRAWLER raster into base/interior and foreground hull/door-frame pixels.",
    equipmentMethod: "Seven-state ImageGen authoring masters are chroma-removed outside runtime, split into semantic cells, uniformly scaled without flattening relative state geometry, bottom-center anchored, and pre-rendered into deterministic RGBA sheets; runtime draws the sheets only.",
    equipmentNormalization: {
      barrage: barrageBuild.evidence,
      airstrike: airstrikeBuild.evidence,
    },
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
