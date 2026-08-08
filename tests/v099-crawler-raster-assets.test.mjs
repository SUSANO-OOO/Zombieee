import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

import {
  CRAWLER_AIRSTRIKE_SPRITE_PHASES,
  CRAWLER_BARRAGE_SPRITE_PHASES,
  V099_CRAWLER_RUNTIME_PROFILE,
  crawlerAirstrikeSpritePhase,
  crawlerBarrageSpritePhase,
  resolveCrawlerEquipmentFrame,
} from "../app/crawlerEquipmentSprites.js";
import { WORLD_GEOMETRY } from "../app/gameRules.js";

const publicUrl = (assetPath) => new URL(`../public${assetPath}`, import.meta.url);
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function raw(assetPath) {
  return sharp(await readFile(publicUrl(assetPath))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function alphaBounds(data, info) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  let visible = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha === 0) continue;
      visible += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, right, bottom, visible };
}

function croppedBinaryAlpha(frame, threshold = 24) {
  const bounds = alphaBounds(frame.data, frame.info);
  const width = bounds.right - bounds.left + 1;
  const height = bounds.bottom - bounds.top + 1;
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = ((bounds.top + y) * frame.info.width + bounds.left + x) * frame.info.channels + 3;
      mask[y * width + x] = frame.data[source] > threshold ? 1 : 0;
    }
  }
  return { width, height, mask, bounds };
}

function alignedSilhouetteDifference(firstFrame, secondFrame) {
  const first = croppedBinaryAlpha(firstFrame);
  const second = croppedBinaryAlpha(secondFrame);
  const width = Math.max(first.width, second.width);
  const height = Math.max(first.height, second.height);
  const firstLeft = Math.floor((width - first.width) / 2);
  const secondLeft = Math.floor((width - second.width) / 2);
  const firstTop = height - first.height;
  const secondTop = height - second.height;
  let different = 0;
  let union = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const firstX = x - firstLeft;
      const firstY = y - firstTop;
      const secondX = x - secondLeft;
      const secondY = y - secondTop;
      const a = firstX >= 0 && firstX < first.width && firstY >= 0 && firstY < first.height
        ? first.mask[firstY * first.width + firstX]
        : 0;
      const b = secondX >= 0 && secondX < second.width && secondY >= 0 && secondY < second.height
        ? second.mask[secondY * second.width + secondX]
        : 0;
      if (a || b) union += 1;
      if (a !== b) different += 1;
    }
  }
  return {
    different,
    union,
    ratio: union > 0 ? different / union : 0,
    first: first.bounds,
    second: second.bounds,
  };
}

async function runtimeAlphaDifference(firstFrame, secondFrame, width, height) {
  const resize = async (frame) => sharp(frame.data, { raw: frame.info })
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [first, second] = await Promise.all([resize(firstFrame), resize(secondFrame)]);
  let different = 0;
  let union = 0;
  for (let offset = 3; offset < first.data.length; offset += first.info.channels) {
    const a = first.data[offset] > 24;
    const b = second.data[offset] > 24;
    if (a || b) union += 1;
    if (a !== b) different += 1;
  }
  return { different, union, ratio: union > 0 ? different / union : 0 };
}

async function equipmentFrames(profile) {
  const bytes = await readFile(publicUrl(profile.sheet.path));
  const frames = [];
  for (let index = 0; index < profile.phases.length; index += 1) {
    frames.push(await sharp(bytes)
      .extract({
        left: index * profile.sheet.frameWidth,
        top: 0,
        width: profile.sheet.frameWidth,
        height: profile.sheet.frameHeight,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }));
  }
  return frames;
}

test("v0.9.9.0 CRAWLER assets are deterministic project-local raster derivatives", async () => {
  execFileSync(process.execPath, ["scripts/build-v099-crawler-assets.mjs", "--check"], {
    cwd: new URL("..", import.meta.url),
    stdio: "pipe",
  });
  const provenance = JSON.parse(await readFile(new URL("../assets/source/v099/crawler/provenance.json", import.meta.url), "utf8"));
  assert.equal(provenance.version, "0.9.9.0");
  assert.equal(provenance.generator, "scripts/build-v099-crawler-assets.mjs");
  assert.equal(provenance.generatorRevision, 2);
  assert.equal(provenance.source,
    "project-original approved CRAWLER identity plus project-original semantic equipment authoring masters");
  assert.equal(provenance.commercialUse, true);
  assert.equal(provenance.modification, true);
  assert.equal(provenance.redistribution, true);
  assert.equal(provenance.generation.runtimeCanvasGeometry, false);
  assert.equal(provenance.generation.rollback.previousAssetsModified, false);
  assert.equal(provenance.artifacts.length, 5);
  assert.deepEqual(Object.keys(provenance.equipmentAuthoring), ["barrage", "airstrike"]);
  for (const record of Object.values(provenance.equipmentAuthoring)) {
    assert.match(record.chromaSource.file, /^assets\/source\/v099\/crawler\/.+-chroma\.png$/u);
    assert.match(record.rgbaMaster.file, /^assets\/source\/v099\/crawler\/.+-rgba\.png$/u);
    for (const source of [record.chromaSource, record.rgbaMaster]) {
      const bytes = await readFile(new URL(`../${source.file}`, import.meta.url));
      assert.equal(bytes.length, source.bytes, source.file);
      assert.equal(sha256(bytes), source.sha256, source.file);
    }
  }
  for (const source of Object.values(provenance.sources)) {
    const bytes = await readFile(new URL(`../${source.file}`, import.meta.url));
    assert.equal(sha256(bytes), source.sha256, source.file);
  }
  for (const artifact of provenance.artifacts) {
    const bytes = await readFile(new URL(`../${artifact.file}`, import.meta.url));
    assert.equal(sha256(bytes), artifact.sha256, artifact.file);
    assert.equal(artifact.format, "png");
    assert.ok(artifact.alpha.transparentPixels > 0, artifact.file);
    assert.ok(artifact.alpha.opaquePixels > 0, artifact.file);
    assert.equal(artifact.pwaTransport.format, "lossless-webp");
    assert.match(artifact.pwaTransport.sourcePath, /^\/pwa-optimized\/art\/v099\/crawler\/.+\.webp$/u);
    assert.equal(artifact.pwaTransport.visiblePixelDifferences, 0);
    assert.equal(artifact.pwaTransport.alphaDifferences, 0);
    const transport = await readFile(publicUrl(artifact.pwaTransport.sourcePath));
    assert.equal(transport.length, artifact.pwaTransport.bytes);
    assert.equal(sha256(transport), artifact.pwaTransport.sha256);
    const pngRaw = await sharp(bytes).ensureAlpha().raw().toBuffer();
    const transportRaw = await sharp(transport).ensureAlpha().raw().toBuffer();
    assert.equal(transportRaw.length, pngRaw.length);
    for (let offset = 0; offset < pngRaw.length; offset += 4) {
      assert.equal(transportRaw[offset + 3], pngRaw[offset + 3], `${artifact.logicalPath} alpha drift`);
      if (pngRaw[offset + 3] === 0) continue;
      assert.equal(transportRaw[offset], pngRaw[offset], `${artifact.logicalPath} red drift`);
      assert.equal(transportRaw[offset + 1], pngRaw[offset + 1], `${artifact.logicalPath} green drift`);
      assert.equal(transportRaw[offset + 2], pngRaw[offset + 2], `${artifact.logicalPath} blue drift`);
    }
  }
});

test("deployment base and foreground are disjoint source-pixel layers with an authored doorway", async () => {
  const profile = V099_CRAWLER_RUNTIME_PROFILE.deployment;
  const base = await raw(profile.baseInterior.path);
  const foreground = await raw(profile.foregroundMask.path);
  assert.deepEqual(
    [base.info.width, base.info.height, foreground.info.width, foreground.info.height],
    [1536, 1024, 1536, 1024],
  );
  let overlap = 0;
  for (let offset = 3; offset < base.data.length; offset += 4) {
    if (base.data[offset] > 0 && foreground.data[offset] > 0) overlap += 1;
  }
  assert.equal(overlap, 0, "one vehicle pixel must belong to only one occlusion layer");
  assert.deepEqual(profile.drawOrder, ["base-interior", "deploying-unit-alpha-1", "foreground-mask"]);
  assert.deepEqual(profile.outsideDrawOrder, ["base-interior", "foreground-mask", "deployed-unit-alpha-1"]);

  const doorway = profile.doorwayInterior;
  const interiorOffset = ((doorway.y + Math.floor(doorway.height / 2)) * foreground.info.width
    + doorway.x + Math.floor(doorway.width / 2)) * 4 + 3;
  assert.equal(foreground.data[interiorOffset], 0, "the physical doorway remains open on the foreground layer");
  assert.ok(base.data[interiorOffset] > 0, "the approved amber door interior remains behind the unit");
});

test("barrage and airstrike sheets have seven named, bounded, physically anchored RGBA frames", async () => {
  const fixtures = [
    ["barrage", CRAWLER_BARRAGE_SPRITE_PHASES],
    ["airstrike", CRAWLER_AIRSTRIKE_SPRITE_PHASES],
  ];
  for (const [kind, expectedPhases] of fixtures) {
    const profile = V099_CRAWLER_RUNTIME_PROFILE.equipment[kind];
    assert.deepEqual(profile.phases, expectedPhases);
    const sheet = await raw(profile.sheet.path);
    assert.equal(sheet.info.width, profile.sheet.frameWidth * 7);
    assert.equal(sheet.info.height, profile.sheet.frameHeight);
    const hashes = new Set();
    const extracted = [];
    for (let index = 0; index < expectedPhases.length; index += 1) {
      const frame = resolveCrawlerEquipmentFrame(kind, expectedPhases[index]);
      assert.equal(frame.frame, index);
      assert.equal(frame.source.x, index * profile.sheet.frameWidth);
      assert.equal(frame.destination.x, profile.sourcePlacement.x);
      assert.equal(frame.destination.y, profile.sourcePlacement.y);
      const frameRaw = await sharp(await readFile(publicUrl(profile.sheet.path)))
        .extract({ left: frame.source.x, top: 0, width: frame.source.width, height: frame.source.height })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const bounds = alphaBounds(frameRaw.data, frameRaw.info);
      assert.ok(bounds.visible > 100, `${kind}:${expectedPhases[index]} must contain raster hardware`);
      assert.ok(bounds.bottom >= frameRaw.info.height - 42, `${kind}:${expectedPhases[index]} lost its vehicle contact edge`);
      hashes.add(sha256(frameRaw.data));
      extracted.push(frameRaw);
    }
    assert.equal(hashes.size, 7, `${kind} requires seven distinct raster frames`);

    for (let index = 0; index < extracted.length - 1; index += 1) {
      const semantic = alignedSilhouetteDifference(extracted[index], extracted[index + 1]);
      assert.ok(semantic.ratio >= .08,
        `${kind}:${expectedPhases[index]}->${expectedPhases[index + 1]} lacks aligned silhouette change: ${JSON.stringify(semantic)}`);
      const runtimeWidth = Math.max(1, Math.round(
        profile.sheet.frameWidth / V099_CRAWLER_RUNTIME_PROFILE.deployment.sourceCrop.width
          * WORLD_GEOMETRY.crawler.width,
      ));
      const runtimeHeight = Math.max(1, Math.round(
        profile.sheet.frameHeight / V099_CRAWLER_RUNTIME_PROFILE.deployment.sourceCrop.height
          * WORLD_GEOMETRY.crawler.height,
      ));
      const runtime = await runtimeAlphaDifference(
        extracted[index],
        extracted[index + 1],
        runtimeWidth,
        runtimeHeight,
      );
      assert.ok(runtime.different >= 8 && runtime.ratio >= .025,
        `${kind}:${expectedPhases[index]}->${expectedPhases[index + 1]} collapses below one-pixel runtime evidence: ${JSON.stringify({ runtimeWidth, runtimeHeight, ...runtime })}`);
    }
  }
  assert.equal(resolveCrawlerEquipmentFrame("barrage", "unknown"), null);
  assert.equal(resolveCrawlerEquipmentFrame("unknown", "stowed"), null);
});

test("semantic equipment tests reject pure translation and require state-specific geometry", async () => {
  const translated = (left, top) => {
    const width = 32;
    const height = 32;
    const data = Buffer.alloc(width * height * 4);
    for (let y = top; y < top + 8; y += 1) {
      for (let x = left; x < left + 12; x += 1) data[(y * width + x) * 4 + 3] = 255;
    }
    return { data, info: { width, height, channels: 4 } };
  };
  assert.equal(alignedSilhouetteDifference(translated(2, 3), translated(12, 17)).ratio, 0,
    "aligned comparison must identify pure translation as no semantic change");

  const barrage = await equipmentFrames(V099_CRAWLER_RUNTIME_PROFILE.equipment.barrage);
  const barrageBounds = barrage.map((frame) => alphaBounds(frame.data, frame.info));
  assert.ok(barrageBounds[1].top <= barrageBounds[0].top - 40,
    "hatch-open requires a large state-specific hatch region above stowed");
  assert.ok(barrageBounds[2].top <= barrageBounds[1].top - 20,
    "turret-rise requires a structurally taller pedestal than hatch-open");
  assert.ok(Math.abs(barrageBounds[4].right - barrageBounds[5].right) >= 6,
    "firing and recoil require a body/barrel difference after muzzle VFX removal");
  assert.ok(alignedSilhouetteDifference(barrage[4], barrage[5]).ratio >= .08,
    "firing and recoil must remain structurally distinct without muzzle VFX");

  const airstrike = await equipmentFrames(V099_CRAWLER_RUNTIME_PROFILE.equipment.airstrike);
  const airstrikeBounds = airstrike.map((frame) => alphaBounds(frame.data, frame.info));
  assert.ok(airstrikeBounds[1].top <= airstrikeBounds[0].top - 35,
    "mast-deploy requires a state-specific hatch and mast region");
  assert.ok(airstrikeBounds[2].top <= airstrikeBounds[1].top - 100,
    "antenna-extend requires a substantially taller physical mast");
  for (const [first, second] of [[3, 4], [4, 5]]) {
    const semantic = alignedSilhouetteDifference(airstrike[first], airstrike[second]);
    assert.ok(semantic.ratio >= .1,
      `airstrike ${CRAWLER_AIRSTRIKE_SPRITE_PHASES[first]}->${CRAWLER_AIRSTRIKE_SPRITE_PHASES[second]} requires hardware-state evidence without HUD: ${JSON.stringify(semantic)}`);
  }
});

test("runtime profile exposes stable vehicle anchors and effect handoff points without Canvas primitives", async () => {
  const profile = V099_CRAWLER_RUNTIME_PROFILE;
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(profile.equipment.barrage.vehicleAnchor.x, 1036);
  assert.equal(profile.equipment.airstrike.vehicleAnchor.x, 520);
  assert.deepEqual(Object.keys(profile.equipment.barrage.muzzleByPhase), ["aim", "firing", "recoil"]);
  assert.deepEqual(Object.keys(profile.equipment.airstrike.signalByPhase), ["targeting", "inbound-signal", "impact-confirmation"]);

  const runtimeSource = await readFile(new URL("../app/crawlerEquipmentSprites.js", import.meta.url), "utf8");
  assert.doesNotMatch(runtimeSource, /(?:beginPath|moveTo|lineTo|arc|fillRect|strokeRect|Path2D)/u);
  const manifestBuilder = await readFile(new URL("../scripts/build-asset-manifest.mjs", import.meta.url), "utf8");
  assert.match(manifestBuilder, /sweep\(V099_CRAWLER_RUNTIME_PROFILE, \{ pack: "units", category: "unit", criticality: "critical" \}\)/u);
});

test("runtime phases advance authored barrage and airstrike sheets without hiding idle hardware", () => {
  const barrageTimings = { deploySeconds: .55, fireSeconds: .65 };
  assert.equal(crawlerBarrageSpritePhase(null, barrageTimings), "stowed");
  assert.equal(crawlerBarrageSpritePhase({ phase: "ready" }, barrageTimings), "stowed");
  assert.equal(crawlerBarrageSpritePhase({ phase: "deploying", phaseTime: .5 }, barrageTimings), "hatch-open");
  assert.equal(crawlerBarrageSpritePhase({ phase: "deploying", phaseTime: .3 }, barrageTimings), "turret-rise");
  assert.equal(crawlerBarrageSpritePhase({ phase: "deploying", phaseTime: .05 }, barrageTimings), "aim");
  assert.equal(crawlerBarrageSpritePhase({ phase: "firing", phaseTime: .6 }, barrageTimings), "firing");
  assert.equal(crawlerBarrageSpritePhase({ phase: "firing", phaseTime: .05 }, barrageTimings), "recoil");
  assert.equal(crawlerBarrageSpritePhase({ phase: "recovering" }, barrageTimings), "retract");

  const airstrikeTimings = { radioSeconds: .55 };
  assert.equal(crawlerAirstrikeSpritePhase(null, airstrikeTimings), "stowed");
  assert.equal(crawlerAirstrikeSpritePhase({ phase: "idle" }, airstrikeTimings), "stowed");
  assert.equal(crawlerAirstrikeSpritePhase({ phase: "radio", phaseTime: .5 }, airstrikeTimings), "mast-deploy");
  assert.equal(crawlerAirstrikeSpritePhase({ phase: "radio", phaseTime: .1 }, airstrikeTimings), "antenna-extend");
  assert.equal(crawlerAirstrikeSpritePhase({ phase: "targeting" }, airstrikeTimings), "targeting");
  assert.equal(crawlerAirstrikeSpritePhase({ phase: "inbound" }, airstrikeTimings), "inbound-signal");
  assert.equal(crawlerAirstrikeSpritePhase({ phase: "impact" }, airstrikeTimings), "impact-confirmation");
  assert.equal(crawlerAirstrikeSpritePhase({ phase: "returning" }, airstrikeTimings), "retract");
});
