import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

const DESIGN = "docs/design/v1.0.0/DESIGN_LOCK.md";
const INVENTORY = "docs/design/v1.0.0/ASSET_INVENTORY.md";
const HANDOFF = "docs/design/v1.0.0/LUNA_HANDOFF.md";
const PROVENANCE = "assets/source/v100/PROVENANCE.md";

const selectedAssets = Object.freeze([
  ["assets/source/v100/characters/segawa-identity-master-r2.png", "0bb98569efa36dbc7df6fbd7fb7ec2cce11671ddbe58f4ce84d9ce26fb187c1d", 934, 1684],
  ["assets/source/v100/characters/mugarian-president-identity-master-r2.png", "c5c6a40e161197a15855ca7733dc3c4af7f32138516eb885130244a2c3b22ab6", 1024, 1536],
  ["assets/source/v100/enemies/mugarian-president-mutated-identity-master-r4.png", "be58f640e7b918e0a37a04d6e128b448c71926483a95f9a5a161cd83dfae0d72", 1024, 1536],
  ["assets/source/v100/enemies/takuya-omega-identity-master-r2.png", "d46f6a96f693dbf0aa9b81b9ef2b1f5797f461c87505c7390c80464e3a0249af", 1024, 1536],
  ["assets/source/v100/enemies/red-panther-knife-identity-master-r1.png", "8875b636ed887caa34aa1a704c31291aa1a774c4429891d2c66e7356fc8082a2", 1024, 1536],
  ["assets/source/v100/enemies/red-panther-shield-identity-master-r1.png", "584e03350283e6e7a92709c98d14ca63a9574e53f46961a39b466a3760d5ea2f", 1024, 1536],
  ["assets/source/v100/enemies/red-panther-smg-identity-master-r1.png", "3f03c2e8e6eae37173e637ea801944b1016858222437b4e0c4d3d320b2f52fd8", 1024, 1536],
  ["assets/source/v100/enemies/red-panther-commander-identity-master-r1.png", "dab75e9ec7e6e1075f969d021d8089477ca2e2cb40e3a1e416e5e029bade6dba", 1024, 1536],
  ["assets/source/v100/portraits/minor-human-shared-event-silhouette-r2.png", "a5e58d69828d5dacf99ceae1ce427f88fe751fbf3b491eedd50e5992b8c0eeb7", 1024, 1536],
]);

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

test("v1.0.0 design documents bind one immutable Design ID and baseline", async () => {
  const [design, inventory, handoff, provenance] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(INVENTORY, "utf8"),
    readFile(HANDOFF, "utf8"),
    readFile(PROVENANCE, "utf8"),
  ]);

  for (const source of [design, inventory, handoff, provenance]) {
    assert.match(source, /V100-SOL-DL-001/u);
  }
  assert.match(design, /Revision: `r2`/u);
  assert.match(design, /Status: `DESIGN_LOCKED`/u);
  assert.match(design, /435dc959d1972646f7e82b6c45d3f1c25d890252/u);
  assert.match(design, /4833a1eed29e3901e3dcfca01cf77db6846e5265/u);
  assert.match(design, /c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4/u);
  assert.match(handoff, /STATUS: READY_FOR_SOL_FINAL_REVIEW/u);
  assert.match(handoff, /No amend, rebase, force push, direct main push/u);
});

test("campaign contract has exactly 30 ordered, unique stages", async () => {
  const design = await readFile(DESIGN, "utf8");
  const campaignSection = design.match(/## 4\. Campaign and mission contract([\s\S]+?)### Acceptance criteria/u)?.[1] ?? "";
  const rows = [...campaignSection.matchAll(/^\|\s+(\d+)\s+\|\s+([^|]+)\|\s+([^|]+)\|/gmu)]
    .map((match) => ({ number: Number(match[1]), name: match[2].trim(), mission: match[3].trim() }));
  const stageRows = rows.filter(({ number }) => number >= 1 && number <= 30);
  assert.equal(stageRows.length, 30);
  assert.deepEqual(stageRows.map(({ number }) => number), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.equal(new Set(stageRows.map(({ name }) => name)).size, 30);
  assert.match(stageRows[2].name, /TAKUYA/u);
  assert.match(stageRows[29].mission, /TAKUYA-Ω boss; no hard timer/u);
});

test("economy, levels, vehicle, support, and boss values are fixed", async () => {
  const design = await readFile(DESIGN, "utf8");
  assert.match(design, /exactly 9,000 CAPS/u);
  assert.match(design, /approximately 7,875 CAPS/u);
  assert.match(design, /legacy release gift of 180 CAPS exactly once/u);
  assert.match(design, /`10,12,14,16,18,20,22,24,26,30,34,38,42,46,52,58,64,70,76,84,92,100,108,116,126,138,150,162,174`/u);
  assert.match(design, /Base vehicle HP: 680/u);
  assert.match(design, /maximum 1,080/u);
  assert.match(design, /120, 180, 260, 360, 480 CAPS/u);
  assert.match(design, /\| TAKUYA-Ω \| 9200 \| 56 \| 1\.35 s \| 75%, 45%, 20% \| 2 add waves \| 85 \|/u);
  assert.match(design, /\| mutated president \| 6200 \| 44 \| 1\.20 s \| 70%, 35% \| four-arm form \| 80 \|/u);
});

test("supports unlock at exact non-entry transitions and vehicle abilities stay separate", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  const expected = [
    ["回復支援", "support-healing", "v100:s02:support-healing:unlock", 50, 50, 25],
    ["爆薬ドラム缶", "support-explosive-drum", "v100:s06:support-explosive-drum:unlock", 40, 40, 20],
    ["火炎ドラム缶", "support-incendiary-drum", "v100:s09:support-incendiary-drum:unlock", 55, 55, 28],
  ];
  for (const [label, id, receipt, unlockCost, battleCost, cooldown] of expected) {
    const row = `\\| ${label} \\| ` + "`" + id + "`" + ` \\| Stage (?:2|6|9) first clear: ` + "`" + receipt + "`" + ` \\| ${unlockCost} CAPS \\| ${battleCost} \\| ${cooldown} s \\|`;
    assert.match(design, new RegExp(row, "u"));
  }
  assert.match(design, /Exactly one player-facing support is equipped before sortie/u);
  assert.match(design, /Stage 2, 6, and 9 are the exact unlock stages/u);
  assert.match(design, /\| 一斉砲撃 \| `vehicle-barrage` \| 70 \| 38 s \|/u);
  assert.match(design, /\| 航空支援 \| `vehicle-airstrike` \| 85 \| 50 s \|/u);
  assert.match(handoff, /three-support one-of-three loadout/u);
  assert.match(handoff, /barrage\/airstrike abilities/u);
});

test("all nine Story bosses own spoiler-safe receipts, mode gates, rewards, counts, and replay", async () => {
  const design = await readFile(DESIGN, "utf8");
  const bosses = [
    [3, "boss-takuya", 110, 20],
    [5, "boss-gate-eater", 130, 25],
    [11, "boss-mother", 190, 40],
    [14, "boss-ooguchi", 220, 45],
    [17, "boss-kurome", 250, 50],
    [20, "boss-gairen", 280, 55],
    [24, "boss-futago", 320, 65],
    [25, "boss-mugarian-president-mutated", 330, 65],
    [30, "boss-takuya-omega", 380, 75],
  ];
  for (const [stage, bossId, first, repeat] of bosses) {
    const padded = String(stage).padStart(2, "0");
    const tick = "`";
    const row = `\\| ${stage} \\| [^|]+ / ${tick}${bossId}${tick} \\| ${tick}v100:s${padded}:${bossId}:first-defeat${tick} \\| ${tick}compendium:${bossId}${tick} \\| ${tick}outbreak:${bossId}${tick} \\| ${tick}survival:${bossId}${tick} \\| ${first} / ${repeat} \\|`;
    assert.match(design, new RegExp(row, "u"));
  }
  assert.match(design, /bossDefeatCount\.<bossId>/u);
  assert.match(design, /enables Story replay/u);
  assert.match(design, /Before that receipt,[\s\S]*must omit the boss without leaving a spoiler-shaped locked slot/u);
  assert.match(design, /TAKUYA and TAKUYA-Ω are separate IDs, identities, counters, receipts, discoveries, and mode entries/u);
  assert.match(design, /`boss-kurome-prototype` remains reference-only/u);
});

test("Version 1.0.0 is a separate zero-CAPS campaign and legacy data is non-destructive eligibility only", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  assert.match(design, /primary storage namespace is `nishijin-campaign-v100`/u);
  assert.match(design, /campaignGeneration: "v100-new-campaign-1"/u);
  assert.match(design, /Stage 1 only,[\s\S]*\*\*0 CAPS\*\*/u);
  assert.match(design, /`nishijin-campaign-v1`[\s\S]*remain byte-preserved legacy data/u);
  assert.match(design, /Automatic transfer is forbidden for Stage completion, stars, owned\/discovered\/recruitable units, CAPS\/supplies/u);
  assert.match(design, /`bgmEnabled`, `sfxEnabled`, `bgmVolume`, `sfxVolume`, `reducedMotion`, `battleEventMode`, `graphicsQuality`, and `autoSkipReadStory`/u);
  assert.match(design, /v100:release-gift:legacy-180:v1/u);
  assert.match(design, /v100:release-gift:legacy-180:popup:v1/u);
  assert.match(design, /付与CAPS: 180/u);
  assert.match(design, /新しいCAPS残高/u);
  assert.match(design, /IndexedDB unique-key transaction/u);
  assert.match(design, /multiple tabs/u);
  assert.doesNotMatch(handoff, /additive, idempotent 1\.0\.0 save migration/u);
  assert.match(handoff, /Do not add an additive migration/u);
});

test("PWA first install is commit-gated and updates retain a rollback generation", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  assert.match(design, /first standalone\/PWA install/u);
  assert.match(design, /complete required-runtime manifest is downloaded, byte-size and content-hash verified, stored, and acknowledged by a durable manifest commit/u);
  assert.match(design, /network requests for required runtime assets are exactly zero/u);
  assert.match(design, /downloads only changed or missing hashes/u);
  assert.match(design, /previous committed generation and its manifest remain intact for rollback/u);
  assert.match(handoff, /Gate first standalone\/PWA gameplay/u);
  assert.match(handoff, /zero required-runtime fetches after gameplay begins/u);
});

test("latest Producer identity corrections remain explicit and non-negotiable", async () => {
  const [design, inventory, handoff] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(INVENTORY, "utf8"),
    readFile(HANDOFF, "utf8"),
  ]);
  for (const source of [design, inventory, handoff]) {
    assert.match(source, /exactly four/u);
    assert.match(source, /no orange/u);
    assert.match(source, /minor human/u);
  }
  assert.match(inventory, /mugarian-president-mutated-identity-master-r4\.png/u);
  assert.match(inventory, /r3\.png` — coherent two-arm form but superseded/u);
  assert.match(design, /private photos are never committed or distributed/u);
  assert.match(design, /simple, featureless, gender-neutral and age-neutral human silhouette/u);
  assert.match(inventory, /no face, hair, costume, occupation, accessory, weapon, or identity cues/u);
});

test("selected authoring masters match exact bytes, dimensions, and true RGBA transparency", async () => {
  for (const [path, expectedHash, width, height] of selectedAssets) {
    const bytes = await readFile(path);
    assert.equal(sha256(bytes), expectedHash, `${path} hash drift`);
    const image = sharp(bytes, { failOn: "error" });
    const metadata = await image.metadata();
    assert.equal(metadata.width, width, `${path} width`);
    assert.equal(metadata.height, height, `${path} height`);
    assert.equal(metadata.hasAlpha, true, `${path} must have alpha`);

    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minAlpha = 255;
    let maxAlpha = 0;
    let transparentPixels = 0;
    for (let index = 3; index < data.length; index += info.channels) {
      const alpha = data[index];
      minAlpha = Math.min(minAlpha, alpha);
      maxAlpha = Math.max(maxAlpha, alpha);
      if (alpha === 0) transparentPixels += 1;
    }
    assert.equal(minAlpha, 0, `${path} needs fully transparent background pixels`);
    assert.ok(maxAlpha >= 254, `${path} needs effectively opaque identity pixels`);
    assert.ok(transparentPixels > width * height * 0.01, `${path} transparent area is too small`);
  }
});

test("the inventory is finite and selected paths are the only provenance entries", async () => {
  const [inventory, provenance] = await Promise.all([
    readFile(INVENTORY, "utf8"),
    readFile(PROVENANCE, "utf8"),
  ]);
  for (const [path, hash] of selectedAssets) {
    assert.match(inventory, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.match(provenance, new RegExp(hash, "u"));
  }
  const provenanceRows = [...provenance.matchAll(/^\| `assets\/source\/v100\/[^`]+` \| `[a-f0-9]{64}` \|$/gmu)];
  assert.equal(provenanceRows.length, selectedAssets.length);
  assert.doesNotMatch(provenance, /identity-master-r3\.png/u);
  assert.doesNotMatch(provenance, /segawa-identity-master-r1\.png/u);
  assert.doesNotMatch(provenance, /mugarian-president-mutated-identity-master-r1\.png/u);
  assert.doesNotMatch(provenance, /minor-human-shared-event-portrait-r1\.png/u);
});
