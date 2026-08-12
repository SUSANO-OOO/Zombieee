import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { V080_UNIT_VISUAL_PROFILES, V090_UNIT_VISUAL_PROFILES } from "../app/visualProfiles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicFile = (assetPath) => path.join(ROOT, "public", assetPath.replace(/^\//, ""));
const NEWCOMERS = Object.freeze(["zakimiya", "tky", "mrs-chiha", "miyamoto-musashi", "mayo-chan"]);

async function alphaAudit(assetPath) {
  const decoded = await sharp(publicFile(assetPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelCount = decoded.info.width * decoded.info.height;
  let visible = 0;
  let fractional = 0;
  let paleFractional = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const channel = pixel * 4;
    const alpha = decoded.data[channel + 3];
    if (alpha > 8) visible += 1;
    if (alpha <= 8 || alpha >= 247) continue;
    fractional += 1;
    const darkest = Math.min(decoded.data[channel], decoded.data[channel + 1], decoded.data[channel + 2]);
    const lightest = Math.max(decoded.data[channel], decoded.data[channel + 1], decoded.data[channel + 2]);
    if (darkest >= 205 && lightest - darkest <= 42) paleFractional += 1;
  }
  return Object.freeze({
    width: decoded.info.width,
    height: decoded.info.height,
    visibleRatio: visible / pixelCount,
    paleFractionalRatio: fractional ? paleFractional / fractional : 0,
    data: decoded.data,
  });
}

test("all five newcomer event and card derivatives keep transparent UI-owned backgrounds without white matte fringe", async () => {
  for (const kind of NEWCOMERS) {
    const profile = V090_UNIT_VISUAL_PROFILES[kind];
    assert.match(profile.eventPortrait.path, /^\/art\/v0995\/characters\/portraits\//);
    assert.match(profile.formationCard.path, /^\/art\/v0995\/characters\/cards\//);

    const portrait = await alphaAudit(profile.eventPortrait.path);
    assert.deepEqual([portrait.width, portrait.height], [512, 640]);
    assert.ok(portrait.visibleRatio >= .22 && portrait.visibleRatio <= .82, `${kind} portrait is a readable transparent subject`);
    // A resized eye highlight or white clothing can legitimately be fractional;
    // compare against the former derivative and require a substantial reduction.
    const formerPortrait = await alphaAudit(`/art/v090/characters/portraits/${kind}-event-portrait-r1.webp`);
    assert.ok(
      portrait.paleFractionalRatio <= formerPortrait.paleFractionalRatio * .78,
      `${kind} portrait reduces pale studio-matte fringe instead of preserving it`,
    );

    const card = await alphaAudit(profile.formationCard.path);
    assert.deepEqual([card.width, card.height], [512, 512]);
    assert.ok(card.visibleRatio >= .22 && card.visibleRatio <= .82, `${kind} card cannot bake an opaque full-panel background`);
    assert.ok(card.paleFractionalRatio <= .015, `${kind} card has no pale studio-matte fringe`);
    for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) {
      assert.equal(card.data[(y * 512 + x) * 4 + 3], 0, `${kind} card corner remains UI-transparent`);
    }
  }
});

test("Monkey runtime identity is the exact producer-approved V070 r11 lineage", async () => {
  const profile = V080_UNIT_VISUAL_PROFILES.engineer;
  const expected = Object.freeze({
    identity: "8dbe4f5cf4e64160d7fdd22f246b4762a650988fc6bac4ad13021ba418820ad7",
    portrait: "f0fc8f45f86c395ea604515444df3fbedd541faabbf749a4fbc6e4d70990f3e3",
    battle: "8b8587b1fba86e2a44cbe15576e6d64407ecfca4d1c1747eb460583c17669d8e",
  });
  for (const [key, assetPath] of Object.entries({
    identity: profile.identityMaster.path,
    portrait: profile.eventPortrait.path,
    battle: profile.battleSprite.path,
  })) {
    const digest = createHash("sha256").update(await readFile(publicFile(assetPath))).digest("hex");
    assert.equal(digest, expected[key], `${key} is the approved byte revision`);
  }

  const card = await alphaAudit(profile.formationCard.path);
  assert.ok(card.visibleRatio >= .2 && card.visibleRatio <= .82, "Monkey card is a transparent subject/badge derivative");
  assert.equal(profile.formationCard.weaponRead, "crossbow");
  assert.equal(profile.battleSprite.revision, "r4");
});

test("identity derivative generator encodes both failure-preventing contracts", async () => {
  const source = await readFile(path.join(ROOT, "scripts/v090-identity-derivatives.mjs"), "utf8");
  assert.match(source, /Remove the white studio matte/);
  assert.equal(source.includes("<rect width=\"512\" height=\"512\" fill=\"url(#shade)\"/>"), false);
  assert.match(source, /background: \{ r: 0, g: 0, b: 0, alpha: 0 \}/);
});

test("Version 0.9.9.5 approval ledger fixes exact candidate bytes and approved-only ancestry", async () => {
  const ledger = JSON.parse(await readFile(path.join(ROOT, "docs/ASSET_APPROVALS_0.9.9.5.json"), "utf8"));
  assert.equal(ledger.designLock, "VISUAL-165-SOL-DL-001 r1");
  assert.equal(ledger.rightsProvenance.thirdPartyDownloadedVisuals, false);
  assert.equal(ledger.rightsProvenance.newIdentityGeneration, false);
  assert.equal(ledger.assets.length, 11);
  for (const record of ledger.assets) {
    assert.match(record.source, /^(V070|V090)-/);
    const data = await readFile(path.join(ROOT, record.path));
    assert.equal(createHash("sha256").update(data).digest("hex"), record.sha256, record.path);
    assert.equal(data.length, record.bytes, record.path);
    const metadata = await sharp(data).metadata();
    assert.deepEqual([metadata.width, metadata.height], [record.width, record.height], record.path);
  }
});

test("pale fractional studio fringe is bounded on both dark and light runtime composites", async () => {
  for (const kind of NEWCOMERS) {
    for (const key of ["eventPortrait", "formationCard"]) {
      const assetPath = V090_UNIT_VISUAL_PROFILES[kind][key].path;
      const decoded = await sharp(publicFile(assetPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const backgrounds = [[8, 11, 14], [232, 229, 220]];
      for (const background of backgrounds) {
        let paleEdge = 0;
        let edge = 0;
        for (let pixel = 0; pixel < decoded.info.width * decoded.info.height; pixel += 1) {
          const channel = pixel * 4;
          const alphaByte = decoded.data[channel + 3];
          if (alphaByte <= 8 || alphaByte >= 247) continue;
          edge += 1;
          const alpha = alphaByte / 255;
          const composite = [0, 1, 2].map((offset) => (
            decoded.data[channel + offset] * alpha + background[offset] * (1 - alpha)
          ));
          const darkest = Math.min(...composite);
          const lightest = Math.max(...composite);
          if (darkest >= 205 && lightest - darkest <= 42) paleEdge += 1;
        }
        assert.ok(
          paleEdge / Math.max(1, edge) <= (background[0] < 20 ? .14 : .72),
          `${kind} ${key} avoids a white matte on ${background[0] < 20 ? "dark" : "light"} UI`,
        );
      }
    }
  }
});
