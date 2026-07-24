import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  FORMATION_CARD_ART,
  PERSONNEL_CARD_ART,
} from "../app/spriteManifest.js";
import { V080_UNIT_VISUAL_PROFILES } from "../app/visualProfiles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicFile = (assetPath) => path.join(ROOT, "public", assetPath.replace(/^\//, ""));

test("all eleven units define explicit event, formation, personnel, and battle visual profiles", async () => {
  const profiles = Object.entries(V080_UNIT_VISUAL_PROFILES);
  assert.equal(profiles.length, 11);
  assert.equal(new Set(profiles.map(([, profile]) => profile.unitId)).size, 11);

  for (const [kind, profile] of profiles) {
    assert.equal(profile.combatKind, kind);
    assert.ok(profile.unitId.startsWith("unit-"));
    assert.ok(profile.identityMaster.path);
    assert.ok(profile.eventPortrait.path);
    assert.ok(profile.formationCard.path);
    assert.ok(profile.personnelCard.path);
    assert.ok(profile.battleSprite.path);
    assert.notEqual(profile.eventPortrait.path, profile.formationCard.path);
    assert.equal(profile.formationCard.path, FORMATION_CARD_ART[kind]);
    assert.equal(profile.personnelCard.path, PERSONNEL_CARD_ART[kind]);
    assert.ok(profile.identityLock.length >= 3);
    await Promise.all([
      access(publicFile(profile.identityMaster.path)),
      access(publicFile(profile.eventPortrait.path)),
      access(publicFile(profile.formationCard.path)),
      access(publicFile(profile.battleSprite.path)),
    ]);

    const eventMetadata = await sharp(publicFile(profile.eventPortrait.path)).metadata();
    assert.deepEqual(
      { width: eventMetadata.width, height: eventMetadata.height, hasAlpha: eventMetadata.hasAlpha },
      { width: 512, height: 640, hasAlpha: true },
      `${kind} event portrait geometry`,
    );
    const cardMetadata = await sharp(publicFile(profile.formationCard.path)).metadata();
    assert.deepEqual(
      { width: cardMetadata.width, height: cardMetadata.height, hasAlpha: cardMetadata.hasAlpha },
      { width: 512, height: 512, hasAlpha: true },
      `${kind} card geometry`,
    );
    const cardPixels = await sharp(publicFile(profile.formationCard.path))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let left = cardPixels.info.width;
    let top = cardPixels.info.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < cardPixels.info.height; y += 1) {
      for (let x = 0; x < cardPixels.info.width; x += 1) {
        if (cardPixels.data[(y * cardPixels.info.width + x) * 4 + 3] <= 8) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    }
    assert.ok(right - left >= 400 && bottom - top >= 450, `${kind} upper-body card cannot remain a full-body thumbnail`);
  }
});

test("Monkey keeps one carbine identity across master, portrait, card, and battle representation", async () => {
  const profile = V080_UNIT_VISUAL_PROFILES.engineer;
  assert.equal(profile.identityMaster.path, "/art/v080/characters/reference/monkey-identity-master-r1.png");
  assert.equal(profile.eventPortrait.path, "/art/v080/characters/portraits/monkey-event-portrait-r2.webp");
  assert.equal(profile.formationCard.path, "/art/v080/characters/cards/monkey-formation-card-r2.webp");
  assert.equal(profile.battleSprite.path, "/art/v080/characters/monkey-battle-r2.png");
  assert.ok(profile.identityLock.includes("layered-silver-hair-with-dark-roots"));
  assert.ok(profile.identityLock.includes("suppressed-compact-carbine"));
  const master = await sharp(publicFile(profile.identityMaster.path)).metadata();
  assert.deepEqual({ width: master.width, height: master.height }, { width: 1024, height: 1536 });
  const battle = await sharp(publicFile(profile.battleSprite.path)).metadata();
  assert.deepEqual({ width: battle.width, height: battle.height, hasAlpha: battle.hasAlpha }, { width: 3360, height: 896, hasAlpha: true });
});

test("event presentation never invents an inactive portrait from another dialogue line", async () => {
  const source = await readFile(path.join(ROOT, "app/CampaignScreens.tsx"), "utf8");
  assert.equal(source.includes("contextLine"), false);
  assert.equal(source.includes("event-portrait inactive"), false);
});
