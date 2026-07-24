import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  FORMATION_CARD_ART,
  PERSONNEL_CARD_ART,
} from "../app/spriteManifest.js";
import {
  CAMPAIGN_UNIT_BY_ID,
  CAMPAIGN_UNIT_IDS,
} from "../app/campaign.js";
import { weaponCueForUnit } from "../app/productionAudio.js";
import {
  V080_CARD_READ_CONTRACTS,
  V080_UNIT_VISUAL_PROFILES,
} from "../app/visualProfiles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicFile = (assetPath) => path.join(ROOT, "public", assetPath.replace(/^\//, ""));
const filesBelow = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
};

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
    assert.equal(profile.formationCard.weaponRead, V080_CARD_READ_CONTRACTS[kind].weaponId);
    assert.equal(profile.formationCard.roleRead, V080_CARD_READ_CONTRACTS[kind].role);
    assert.equal(profile.formationCard.accent, V080_CARD_READ_CONTRACTS[kind].accent);
    assert.equal(profile.personnelCard.weaponRead, V080_CARD_READ_CONTRACTS[kind].weaponId);
    assert.equal(profile.personnelCard.roleRead, V080_CARD_READ_CONTRACTS[kind].role);
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
    const accent = V080_CARD_READ_CONTRACTS[kind].accent.match(/[a-f0-9]{2}/gi).map((value) => Number.parseInt(value, 16));
    let accentPixels = 0;
    for (let pixel = 0; pixel < cardPixels.info.width * cardPixels.info.height; pixel += 1) {
      const channel = pixel * 4;
      if (cardPixels.data[channel + 3] <= 8) continue;
      const distance = Math.abs(cardPixels.data[channel] - accent[0])
        + Math.abs(cardPixels.data[channel + 1] - accent[1])
        + Math.abs(cardPixels.data[channel + 2] - accent[2]);
      if (distance <= 48) accentPixels += 1;
    }
    assert.ok(accentPixels >= 1_200, `${kind} generated card is missing its weapon/role badge`);
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

test("visual identity locks agree with the canonical campaign weapon and production audio", () => {
  const babayaga = V080_UNIT_VISUAL_PROFILES.babayaga;
  const babayagaCampaign = CAMPAIGN_UNIT_BY_ID[CAMPAIGN_UNIT_IDS.BABAYAGA];
  assert.equal(babayagaCampaign.weaponName, "サプレッサー付き拳銃");
  assert.match(babayagaCampaign.appearanceAudit.weaponMatch, /サプレッサー付き拳銃/);
  assert.ok(babayaga.identityLock.includes("suppressed-pistol"));
  assert.equal(babayaga.identityLock.some((lock) => lock.includes("rifle")), false);
  assert.equal(weaponCueForUnit("babayaga"), "weapon-suppressed-pistol");

  const guardian = V080_UNIT_VISUAL_PROFILES.guardian;
  const guardianCampaign = CAMPAIGN_UNIT_BY_ID[CAMPAIGN_UNIT_IDS.GANTETSU];
  assert.equal(guardianCampaign.weaponName, "大型防護盾");
  assert.match(guardianCampaign.appearanceAudit.weaponMatch, /副武器は画面に出さない/);
  assert.ok(guardian.identityLock.includes("large-shield-only-no-visible-secondary-weapon"));
  assert.equal(guardian.identityLock.some((lock) => /shotgun|baton/.test(lock)), false);

  const monkey = V080_UNIT_VISUAL_PROFILES.engineer;
  const monkeyCampaign = CAMPAIGN_UNIT_BY_ID[CAMPAIGN_UNIT_IDS.MONKEY];
  assert.match(monkeyCampaign.weaponName, /サプレッサー付きコンパクトカービン/);
  assert.match(monkeyCampaign.appearanceAudit.weaponMatch, /サプレッサー付きコンパクトカービン/);
  assert.ok(monkey.identityLock.includes("suppressed-compact-carbine"));
  assert.equal(weaponCueForUnit("engineer"), "weapon-suppressed-carbine");
});

test("Monkey battle atlas uses authored movement, shouldered fire, hit, and grounded defeat poses", async () => {
  const atlasPath = publicFile(V080_UNIT_VISUAL_PROFILES.engineer.battleSprite.path);
  const cells = [];
  for (let column = 0; column < 7; column += 1) {
    const cell = await sharp(atlasPath)
      .extract({ left: column * 480, top: 0, width: 480, height: 448 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let left = 480;
    let top = 448;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < 448; y += 1) {
      for (let x = 0; x < 480; x += 1) {
        if (cell.data[(y * 480 + x) * 4 + 3] <= 8) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    }
    cells.push({
      digest: createHash("sha256").update(cell.data).digest("hex"),
      width: right - left,
      height: bottom - top,
      bottom,
    });
  }
  assert.equal(new Set(cells.map(({ digest }) => digest)).size, 7, "states cannot be transform-identical duplicates");
  assert.ok(cells[1].width !== cells[2].width, "walk contact and passing silhouettes must differ");
  assert.ok(cells[3].width >= cells[0].width + 70, "attack pose must visibly shoulder and extend the carbine");
  assert.ok(cells[4].width >= cells[0].width + 60, "recoil pose must retain the shouldered carbine");
  assert.ok(cells[5].width >= cells[0].width + 60, "hit pose must visibly recoil");
  assert.ok(cells[6].height <= cells[0].height * .55, "death must be a collapsed body, not a rotated standing pose");
  assert.ok(cells[6].width >= 430, "collapsed pose must preserve full-body combat scale");
  assert.equal(cells.every(({ bottom }) => bottom === 432), true, "every pose must share the authored ground line");
});

test("event presentation never invents an inactive portrait from another dialogue line", async () => {
  const source = await readFile(path.join(ROOT, "app/CampaignScreens.tsx"), "utf8");
  assert.equal(source.includes("contextLine"), false);
  assert.equal(source.includes("event-portrait inactive"), false);
});

test("the rights ledger covers every retained Version 0.8.0 visual with its exact hash", async () => {
  const files = [
    ...await filesBelow(path.join(ROOT, "assets", "source", "v080")),
    ...await filesBelow(path.join(ROOT, "public", "art", "v080")),
  ].sort();
  assert.equal(files.length, 31);
  const ledger = await readFile(path.join(ROOT, "docs", "THIRD_PARTY_ASSETS.md"), "utf8");
  for (const absolute of files) {
    const relative = path.relative(ROOT, absolute).split(path.sep).join("/");
    const digest = createHash("sha256").update(await readFile(absolute)).digest("hex");
    assert.match(ledger, new RegExp(`\\| \`${relative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\` \\| \`${digest}\` \\|`));
  }
  assert.match(ledger, /制作途中のformation card R1 11件とMonkey event portrait R1.*repositoryから除外/);
});
