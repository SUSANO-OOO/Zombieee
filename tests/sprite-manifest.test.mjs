import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PRODUCTION_VISUALS } from "../app/productionVisuals.js";
import {
  CHARACTER_PORTRAIT_ART,
  PORTRAIT_ART,
  RADIO_PORTRAIT_ART,
  SPRITE_DIRECTIONS,
  SPRITE_MANIFEST,
  SPRITE_STATES,
  fitSpriteBattleDisplaySize,
  fitSpriteDisplaySize,
  spriteFrameFor,
  spriteKinds,
  spriteSheetPath,
  spriteStatesFor,
} from "../app/spriteManifest.js";
import {
  alphaBounds,
  decodeRgbaPng,
  decodeWebpDimensions,
  hasTransparentPerimeter,
  readPngHeader,
} from "./image-asset-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("battle display boxes preserve every authored source aspect ratio", () => {
  for (const kind of spriteKinds) {
    const frame = spriteFrameFor(kind, "idle", "right");
    const fitted = fitSpriteDisplaySize(frame, { w: 72, h: 104 });
    assert.ok(fitted.w <= 72 && fitted.h <= 104);
    assert.ok(Math.abs(fitted.w / fitted.h - frame.sourceRect.w / frame.sourceRect.h) < 1e-12, kind);
  }
  const newcomerBoxes = {
    scout: { w: 64, h: 102 },
    "crazy-king": { w: 72, h: 104 },
    kumaverson: { w: 64, h: 102 },
    babayaga: { w: 62, h: 103 },
  };
  for (const [kind, box] of Object.entries(newcomerBoxes)) {
    const frame = spriteFrameFor(kind, "idle", "right");
    const fitted = fitSpriteBattleDisplaySize(kind, frame, box);
    const opaqueHeight = fitted.h * frame.contentRect.h / frame.sourceRect.h;
    assert.ok(Math.abs(opaqueHeight - 68) < 1e-9, `${kind} visible battle height`);
    assert.ok(Math.abs(fitted.w / fitted.h - frame.sourceRect.w / frame.sourceRect.h) < 1e-12, `${kind} source aspect`);
  }
});

test("sprite audit uses the same battle-size fitting path as runtime", async () => {
  const source = await readFile(new URL("../app/SpriteAuditScreen.tsx", import.meta.url), "utf8");
  assert.match(source, /fitSpriteBattleDisplaySize\(selection\.kind, frame, \{ w: battleWidth, h: battleHeight \}\)/);
  assert.doesNotMatch(source, /fitSpriteDisplaySize\(/);
});

function publicFile(assetPath) {
  return path.join(ROOT, "public", assetPath.replace(/^\//, ""));
}

async function sha256(filename) {
  return createHash("sha256").update(await readFile(filename)).digest("hex");
}

test("sprite manifest enumerates all six allies, eight enemy kinds, and three newcomers", () => {
  assert.deepEqual(spriteKinds, [
    "brawler", "scout", "ranger", "medic", "brute", "gunner",
    "walker", "runner", "turned", "spitter", "shade", "crusher", "abomination", "takuya",
    "crazy-king", "kumaverson", "babayaga",
  ]);
  assert.equal(spriteKinds.length, 17);
  for (const kind of spriteKinds) {
    assert.deepEqual(spriteStatesFor(kind), SPRITE_STATES);
    assert.equal(spriteSheetPath(kind), SPRITE_MANIFEST[kind].path);
  }
  assert.throws(() => spriteSheetPath("unknown"), RangeError);
  assert.throws(() => spriteFrameFor("brawler", "unknown", "right"), RangeError);
  assert.throws(() => spriteFrameFor("brawler", "idle", "up"), RangeError);
});

test("every kind/state/direction resolves to an in-bounds audited source and content rect", async () => {
  const decodedByPath = new Map();
  for (const kind of spriteKinds) {
    const entry = SPRITE_MANIFEST[kind];
    if (!decodedByPath.has(entry.path)) {
      const decoded = decodeRgbaPng(await readFile(publicFile(entry.path)));
      assert.equal(decoded.width, entry.sheet.width, `${kind} sheet width`);
      assert.equal(decoded.height, entry.sheet.height, `${kind} sheet height`);
      decodedByPath.set(entry.path, decoded);
    }
    const decoded = decodedByPath.get(entry.path);
    for (const state of SPRITE_STATES) {
      for (const direction of SPRITE_DIRECTIONS) {
        const frame = spriteFrameFor(kind, state, direction);
        assert.equal(frame.path, entry.path);
        assert.ok(frame.x >= 0 && frame.y >= 0 && frame.w > 0 && frame.h > 0);
        assert.ok(frame.x + frame.w <= decoded.width && frame.y + frame.h <= decoded.height);
        assert.ok(frame.contentRect.x >= frame.x && frame.contentRect.y >= frame.y);
        assert.ok(frame.contentRect.x + frame.contentRect.w <= frame.x + frame.w);
        assert.ok(frame.contentRect.y + frame.contentRect.h <= frame.y + frame.h);
        assert.deepEqual(alphaBounds(decoded, frame.sourceRect), frame.contentRect, `${kind}/${state}/${direction} alpha audit`);
        assert.equal(frame.gutter.left, frame.contentRect.x - frame.x);
        assert.equal(frame.gutter.top, frame.contentRect.y - frame.y);
        assert.equal(frame.gutter.right, frame.x + frame.w - frame.contentRect.x - frame.contentRect.w);
        assert.equal(frame.gutter.bottom, frame.y + frame.h - frame.contentRect.y - frame.contentRect.h);
        assert.equal(hasTransparentPerimeter(decoded, frame.sourceRect, 16), true, `${kind}/${state}/${direction} transparent gutter`);
        const measuredBottom = frame.contentRect.y + frame.contentRect.h - frame.y;
        assert.equal(frame.anchorY, measuredBottom / frame.h, `${kind}/${state}/${direction} measured baseline`);
      }
    }
  }
});

test("approved explicit atlases have seven states in both directions and a transparent cell perimeter", async () => {
  for (const kind of ["scout", "crazy-king", "kumaverson", "babayaga"]) {
    const decoded = decodeRgbaPng(await readFile(publicFile(spriteSheetPath(kind))));
    assert.deepEqual({ width: decoded.width, height: decoded.height }, { width: 3360, height: 896 });
    for (const state of SPRITE_STATES) {
      for (const direction of SPRITE_DIRECTIONS) {
        const frame = spriteFrameFor(kind, state, direction);
        assert.equal(frame.flipX, false, `${kind}/${state}/${direction} uses an authored atlas row`);
        if (state === "death") {
          assert.equal(frame.derivedFrom, undefined, `${kind}/${direction} keeps its authored death pose`);
          const fitted = fitSpriteBattleDisplaySize(kind, frame, { w: 72, h: 104 });
          assert.ok(Math.abs(fitted.w / fitted.h - frame.sourceRect.w / frame.sourceRect.h) < 1e-12, `${kind}/${direction} death aspect`);
        }
        assert.equal(hasTransparentPerimeter(decoded, frame.sourceRect, 12), true, `${kind}/${state}/${direction} gutter`);
      }
    }
  }
});

test("legacy source cells are segmented exactly and rendered from isolated gutter atlases", () => {
  const standard = SPRITE_MANIFEST.brawler;
  assert.deepEqual(
    { width: standard.sheet.width, height: standard.sheet.height, gutter: standard.sheet.gutter },
    { width: 2364, height: 757, gutter: 16 },
  );
  assert.deepEqual(standard.sourceSheet.cellWidths, [362, 362, 362, 362, 362, 362]);
  assert.deepEqual(standard.sourceSheet.cellEdges, [0, 362, 724, 1086, 1448, 1810, 2172]);
  assert.deepEqual(SPRITE_STATES.slice(0, 6).map((state) => standard.frames[state].right.w), [394, 394, 394, 394, 394, 394]);

  const gunner = SPRITE_MANIFEST.gunner;
  assert.equal(gunner.sourceSheet.width, 2170);
  assert.deepEqual(gunner.sourceSheet.cellEdges, [0, 361, 723, 1085, 1446, 1808, 2170]);
  assert.deepEqual(gunner.sourceSheet.cellWidths, [361, 362, 362, 361, 362, 362]);
  assert.deepEqual(SPRITE_STATES.slice(0, 6).map((state) => gunner.frames[state].right.authoredCell.w), [361, 362, 362, 361, 362, 362]);
  assert.equal(gunner.frames.death.right.derivedFrom, "hit");
});

test("legacy gutter atlases preserve every source-cell pixel without scaling or cropping", async () => {
  const uniqueEntries = [...new Map(
    Object.values(SPRITE_MANIFEST)
      .filter(({ sourceSheet }) => sourceSheet)
      .map((entry) => [entry.path, entry]),
  ).values()];
  assert.equal(uniqueEntries.length, 10);
  assert.equal(SPRITE_MANIFEST.scout.sourceSheet, undefined, "approved v070 Hachi no longer reads the legacy scout sheet");
  for (const entry of uniqueEntries) {
    assert.notEqual(entry.sourceSheet.path, "/takuya-boss-sprites-v1.png", "retired TAKUYA sheet cannot be a runtime source");
    assert.equal(entry.sourceSheet.cellEdges[0], 0);
    assert.equal(entry.sourceSheet.cellEdges.at(-1), entry.sourceSheet.width);
    assert.equal(entry.sourceSheet.cellEdges.every((edge, index, edges) => index === 0 || edge > edges[index - 1]), true);
    const source = decodeRgbaPng(await readFile(publicFile(entry.sourceSheet.path)));
    const derived = decodeRgbaPng(await readFile(publicFile(entry.path)));
    for (let index = 0; index < 6; index += 1) {
      const sourceX = entry.sourceSheet.cellEdges[index];
      const sourceWidth = entry.sourceSheet.cellWidths[index];
      const destinationX = index * entry.sheet.cellWidth + entry.sheet.gutter
        + Math.floor((362 - sourceWidth) / 2);
      const destinationY = entry.sheet.gutter + Math.floor((725 - source.height) / 2);
      const sourceHash = createHash("sha256");
      const derivedHash = createHash("sha256");
      for (let y = 0; y < source.height; y += 1) {
        const sourceStart = (y * source.width + sourceX) * 4;
        const destinationStart = ((destinationY + y) * derived.width + destinationX) * 4;
        sourceHash.update(source.data.subarray(sourceStart, sourceStart + sourceWidth * 4));
        derivedHash.update(derived.data.subarray(destinationStart, destinationStart + sourceWidth * 4));
      }
      assert.equal(derivedHash.digest("hex"), sourceHash.digest("hex"), `${entry.sourceSheet.path} cell ${index}`);
      let outsideAlpha = 0;
      const cellStartX = index * entry.sheet.cellWidth;
      for (let y = 0; y < entry.sheet.cellHeight; y += 1) {
        for (let localX = 0; localX < entry.sheet.cellWidth; localX += 1) {
          const insideAuthored = localX >= destinationX - cellStartX
            && localX < destinationX - cellStartX + sourceWidth
            && y >= destinationY
            && y < destinationY + source.height;
          if (!insideAuthored && derived.data[(y * derived.width + cellStartX + localX) * 4 + 3] !== 0) outsideAlpha += 1;
        }
      }
      assert.equal(outsideAlpha, 0, `${entry.path} cell ${index} has a fully transparent derived gutter`);
    }
  }
});

test("legacy derived padding preserves authored battle scale, center anchor, and baseline", () => {
  for (const [kind, entry] of Object.entries(SPRITE_MANIFEST).filter(([, { sourceSheet }]) => sourceSheet)) {
    for (const state of SPRITE_STATES) {
      const frame = entry.frames[state].right;
      const maximum = { w: 72, h: 104 };
      const fitted = fitSpriteBattleDisplaySize(kind, frame, maximum);
      const scale = Math.min(maximum.w / frame.authoredCell.w, maximum.h / frame.authoredCell.h) * entry.battleScale;
      assert.ok(Math.abs(fitted.w / frame.sourceRect.w - scale) < 1e-12);
      const authoredCenterAfterTransform = -fitted.w * frame.anchorX
        + (frame.authoredCell.x + frame.authoredCell.w / 2) * scale;
      assert.ok(Math.abs(authoredCenterAfterTransform) < 1e-9, `${entry.sourceSheet.path}/${state} center`);
      const localContentBottom = frame.contentRect.y + frame.contentRect.h - frame.sourceRect.y;
      const baselineAfterTransform = -fitted.h * frame.anchorY + localContentBottom * scale;
      assert.ok(Math.abs(baselineAfterTransform) < 1e-9, `${entry.sourceSheet.path}/${state} baseline`);
    }
  }
});

test("Ooba uses one uniform battle scale correction without changing crop, anchor, or baseline", () => {
  assert.equal(SPRITE_MANIFEST.brute.battleScale, 1.12);
  for (const [kind, entry] of Object.entries(SPRITE_MANIFEST).filter(([, { sourceSheet }]) => sourceSheet)) {
    if (kind !== "brute") assert.equal(entry.battleScale, 1, `${kind} keeps authored battle scale`);
  }

  const maximum = { w: 72, h: 104 };
  const bruteFrame = spriteFrameFor("brute", "idle", "right");
  const brawlerFrame = spriteFrameFor("brawler", "idle", "right");
  const bruteSize = fitSpriteBattleDisplaySize("brute", bruteFrame, maximum);
  const brawlerSize = fitSpriteBattleDisplaySize("brawler", brawlerFrame, maximum);
  const visibleSize = (frame, fitted) => ({
    w: fitted.w * frame.contentRect.w / frame.sourceRect.w,
    h: fitted.h * frame.contentRect.h / frame.sourceRect.h,
  });
  const bruteVisible = visibleSize(bruteFrame, bruteSize);
  const brawlerVisible = visibleSize(brawlerFrame, brawlerSize);
  assert.ok(bruteVisible.w > brawlerVisible.w * 1.15, "Ooba keeps the broader authored silhouette");
  assert.ok(bruteVisible.h > brawlerVisible.h * 1.05, "Ooba reads taller than the brawler in battle");

  for (const state of SPRITE_STATES) {
    const frame = spriteFrameFor("brute", state, "right");
    const fitted = fitSpriteBattleDisplaySize("brute", frame, maximum);
    const scale = fitted.h / frame.sourceRect.h;
    const localContentBottom = frame.contentRect.y + frame.contentRect.h - frame.sourceRect.y;
    const baseline = -fitted.h * frame.anchorY + localContentBottom * scale;
    assert.ok(Math.abs(baseline) < 1e-9, `${state} baseline`);
  }
});

test("Ooba's short opaque portrait is compensated only in the event portrait layer", async () => {
  const css = await readFile(new URL("../app/campaign.css", import.meta.url), "utf8");
  const selector = /\.event-portrait\[style\*="brute-portrait-v2\.webp"\]\s*\{[^}]*background-size:auto 142%;[^}]*background-position:center bottom;[^}]*\}/g;
  assert.equal(css.match(selector)?.length, 1);
  assert.doesNotMatch(css, /\.formation-portrait\[style\*="brute-portrait-v2\.webp"\]/);
});

test("all ten people use independent portrait files and radio remains a separate non-person asset", async () => {
  const expectedPeople = ["brawler", "scout", "ranger", "medic", "brute", "gunner", "crazy-king", "kumaverson", "babayaga", "guide"];
  assert.deepEqual(Object.keys(CHARACTER_PORTRAIT_ART), expectedPeople);
  assert.equal(new Set(Object.values(CHARACTER_PORTRAIT_ART)).size, 10);
  assert.equal(PORTRAIT_ART.radio, RADIO_PORTRAIT_ART);
  assert.notEqual(RADIO_PORTRAIT_ART, CHARACTER_PORTRAIT_ART.guide);

  const battlePaths = new Set(spriteKinds.map((kind) => spriteSheetPath(kind)));
  const portraitHashes = new Set();
  for (const [kind, assetPath] of Object.entries(CHARACTER_PORTRAIT_ART)) {
    if (kind === "scout") {
      assert.equal(assetPath, "/art/v070/characters/portraits/scout-portrait-v1.webp");
    } else {
      assert.match(assetPath, /^\/art\/v060\/characters\/portraits\/.+-portrait-v2\.webp$/);
    }
    assert.equal(battlePaths.has(assetPath), false, `${kind} cannot point at a battle sheet`);
    assert.equal(assetPath.includes("sprites"), false);
    const dimensions = decodeWebpDimensions(await readFile(publicFile(assetPath)));
    assert.deepEqual({ width: dimensions.width, height: dimensions.height }, { width: 512, height: 640 }, `${kind} is a dedicated waist-up portrait canvas`);
    portraitHashes.add(await sha256(publicFile(assetPath)));
  }
  assert.equal(portraitHashes.size, expectedPeople.length, "no person portrait may reuse another character's bytes");
  const radioDimensions = decodeWebpDimensions(await readFile(publicFile(RADIO_PORTRAIT_ART)));
  assert.ok(radioDimensions.width > 0 && radioDimensions.height > 0);
  assert.notEqual(await sha256(publicFile(RADIO_PORTRAIT_ART)), await sha256(publicFile(CHARACTER_PORTRAIT_ART.guide)));

  for (const kind of expectedPeople) {
    await assert.rejects(
      readFile(publicFile(`/art/v060/characters/portraits/${kind}-portrait-v1.webp`)),
      { code: "ENOENT" },
      `${kind} superseded portrait must not remain shippable`,
    );
  }
});

test("every production WebP passes an actual image decoder", async () => {
  const productionWebps = [...new Set([
    ...Object.values(PORTRAIT_ART),
    PRODUCTION_VISUALS.title,
    PRODUCTION_VISUALS.command,
    PRODUCTION_VISUALS.guide,
    ...Object.values(PRODUCTION_VISUALS.stages),
  ])];
  assert.equal(productionWebps.length, 16);

  for (const assetPath of productionWebps) {
    assert.match(assetPath, /\.webp$/);
    const filename = publicFile(assetPath);
    const metadata = await sharp(filename, { failOn: "error" }).metadata();
    assert.equal(metadata.format, "webp", `${assetPath} format`);
    assert.ok(metadata.width > 0 && metadata.height > 0, `${assetPath} dimensions`);

    const { data, info } = await sharp(filename, { failOn: "error" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.deepEqual({ width: info.width, height: info.height, channels: info.channels }, {
      width: metadata.width,
      height: metadata.height,
      channels: 4,
    }, `${assetPath} decoded surface`);
    assert.equal(data.length, info.width * info.height * info.channels, `${assetPath} decoded byte count`);
  }
});

test("portrait provenance binds every character to one isolated reference and fixed source/final hashes", async () => {
  const provenancePath = path.join(ROOT, "reference", "characters", "portrait-provenance-v2.json");
  const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
  assert.equal(provenance.policyId, "portrait-reference-isolation-v2");
  assert.equal(provenance.entries.length, 10);
  assert.equal(new Set(provenance.entries.map(({ kind }) => kind)).size, 10);
  for (const entry of provenance.entries) {
    if (entry.kind === "scout") {
      assert.notEqual(entry.finalPath, `public${CHARACTER_PORTRAIT_ART[entry.kind]}`, "approved v070 Hachi supersedes the historical v060 portrait");
    } else {
      assert.equal(entry.finalPath, `public${CHARACTER_PORTRAIT_ART[entry.kind]}`);
    }
    assert.equal(await sha256(path.join(ROOT, entry.referencePath)), entry.referenceSha256, `${entry.kind} reference hash`);
    assert.equal(await sha256(path.join(ROOT, entry.sourcePath)), entry.sourceSha256, `${entry.kind} source hash`);
    assert.equal(await sha256(path.join(ROOT, entry.finalPath)), entry.finalSha256, `${entry.kind} final hash`);
    assert.match(entry.generationRecordPrefix, /^exec-[0-9a-f]{8}$/);
    if (entry.kind !== "brawler") {
      assert.equal(entry.referencePath.includes("brawler"), false, `${entry.kind} must not reference Paisen/brawler art`);
    }
  }
});

test("latest producer masters are byte-identical versioned copies and protected brawler stays unchanged", async () => {
  const masters = [
    ["crazy-king-producer-master-v2.png", 2172, 724, "0a4329786e31f6a10d646e3145eaed188ff434cedcb58a346ae8efa29161c789"],
    ["kumaverson-producer-master-v2.png", 1672, 941, "1ea53c1c22cc811a6163246b88b749d7aeed69eff636ec60ec5f6d2228d70e68"],
    ["babayaga-producer-master-v2.png", 2172, 724, "13b40c78d1de2d4b2cd83ce252745bdc91b5b5cc27c2ab4f4e90f63da265b143"],
  ];
  for (const [filename, width, height, expectedHash] of masters) {
    const fullPath = path.join(ROOT, "reference", "characters", "producer-masters-v2", filename);
    const header = readPngHeader(await readFile(fullPath));
    assert.deepEqual({ width: header.width, height: header.height }, { width, height });
    assert.equal(await sha256(fullPath), expectedHash);
  }
  assert.equal(
    await sha256(path.join(ROOT, "public", "brawler-sprites-v1.png")),
    "c2c8e5fa2241a4841c80ca817afe6efedcb235d0bccafabcad931776a8b7d3c4",
  );
});
