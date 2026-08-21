import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

const DESIGN = "docs/design/v1.0.0/DESIGN_LOCK.md";
const INVENTORY = "docs/design/v1.0.0/ASSET_INVENTORY.md";
const HANDOFF = "docs/design/v1.0.0/LUNA_HANDOFF.md";
const PROVENANCE = "assets/source/v100/PROVENANCE.md";
const SPRITE_MANIFEST_SOURCE = "app/spriteManifest.js";

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
  assert.match(design, /Revision: `r6`/u);
  assert.match(design, /Status: `DESIGN_LOCKED`/u);
  assert.match(handoff, /Canonical Design Lock: `V100-SOL-DL-001 r6`/u);
  assert.match(handoff, /docs\/CODEX_LUNA_ROLE\.md/u);
  assert.doesNotMatch(handoff.match(/## 2\. Required reading([\s\S]+?)## 3\./u)?.[1] ?? "", /CODEX_SOL_ROLE/u);
  assert.match(design, /435dc959d1972646f7e82b6c45d3f1c25d890252/u);
  assert.match(design, /4833a1eed29e3901e3dcfca01cf77db6846e5265/u);
  assert.match(design, /c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4/u);
  assert.match(handoff, /STATUS: READY_FOR_SOL_FINAL_REVIEW/u);
  assert.match(handoff, /No amend, rebase, force push, direct main push/u);
});

test("r6 preserves the release loop and locks the required-CI diagnostic return", async () => {
  const [design, handoff] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(HANDOFF, "utf8"),
  ]);

  for (const state of [
    "SOL_DESIGN_ACTIVE",
    "LUNA_IMPLEMENTATION_ACTIVE",
    "BLOCKED_RETURN_TO_SOL",
    "PRODUCER_VISUAL_CHECKPOINT: REVIEW_REQUESTED",
    "PRODUCER_VISUAL_APPROVED_FREEZE",
    "READY_FOR_SOL_FINAL_REVIEW",
    "SOL_FINAL_REVIEW_APPROVED",
    "PRODUCER_FINAL_ACCEPTANCE",
    "STACKED_INTEGRATION_ACTIVE",
    "RELEASE_SHA_LOCKED",
    "POST_RELEASE_BLOCKED",
  ]) {
    assert.match(design, new RegExp(state.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  assert.match(design, /Any branch commit after Visual Approval invalidates that approval/u);
  assert.match(design, /PR #169: `docs\/story-v10-final-release-baseline` -> `main`/u);
  assert.match(design, /PR #171 merge result commit[\s\S]*becomes `RELEASE_SHA`/u);
  assert.match(design, /annotated tag `v1\.0\.0`/u);
  assert.match(design, /operation=release`.*deploy=true`.*issue_number=172`/u);
  assert.match(design, /High ambiguity: 0.*Medium ambiguity: 0/u);

  assert.match(handoff, /LAST_AUDITED_HEAD`: `21b3a2076b5ff580189c9cfe69fb4dc30193a45d`/u);
  assert.match(handoff, /NEXT_OWNER`: `LUNA_IMPLEMENTATION`/u);
  assert.match(handoff, /REQUIRED_CI_PRODUCT_RUNTIME_DIAGNOSTIC \/ DESIGN_CHANGE_REQUIRED/u);
  assert.match(handoff, /RESUME_FROM`: additive observations -> focused contract\/lint\/build\/diff checks -> one normal diagnostic push -> wait for that one CI run terminal -> `BLOCKED_RETURN_TO_SOL_DIAGNOSTIC_COMPLETE`/u);
  assert.match(handoff, /Do not make a second commit, retry, rerun, Phase G run, local full regression, or product correction/u);
  assert.match(design, /Artifact `9449229851`/u);
  assert.match(design, /one additive diagnostic commit affecting only/u);
  assert.match(design, /High ambiguity: 0` and `Medium ambiguity: 0/u);
  assert.match(handoff, /Luna never classifies a failure, finding, Producer rejection/u);
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

test("pre-implementation closure has zero product-decision gaps and an executable name/formation contract", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  for (const source of [design, handoff]) {
    assert.match(source, /PRE_IMPLEMENTATION_CLOSED/u);
    assert.match(source, /PRODUCT_DECISION_GAPS: 0/u);
  }
  assert.match(handoff, /LUNA_HANDOFF_READY: YES/u);

  assert.match(design, /Unicode NFC normalization/u);
  assert.match(design, /U\+0020\/U\+3000/u);
  assert.match(design, /Intl\.Segmenter\("ja", \{ granularity: "grapheme" \}\)/u);
  assert.match(design, /Valid length is 1-12 grapheme clusters/u);
  assert.match(design, /isolated variation selectors/u);
  assert.match(design, /U\+200D outside a valid emoji ZWJ sequence fail/u);
  assert.match(design, /falls back to the last valid Version 1\.0\.0 name, or `指揮官`/u);
  assert.match(design, /IDs, receipts, node keys, read state, and saved source text never contain the chosen name/u);

  assert.match(design, /Formation has exactly seven ordered slots/u);
  assert.match(design, /A character ID may occupy multiple slots/u);
  assert.match(design, /count reservation, command creation, battle-resource debit, cooldown start, and receipt creation in one serialized mutation/u);
  assert.match(design, /no command, resource, cooldown, receipt, animation, bark, or partial spawn/u);
  assert.match(handoff, /Slot eight rejects all of them atomically/u);
});

test("all 16 units have exact primary roles and all 30 stages have one closed implementation row", async () => {
  const design = await readFile(DESIGN, "utf8");
  const expectedRoles = new Map([
    ["Hachi", "skirmisher"],
    ["Paisen", "frontline"],
    ["Kumaverson", "heavy"],
    ["Babayaga", "marksman"],
    ["Nao", "support"],
    ["Mizuchi", "suppression"],
    ["Monkey", "engineer"],
    ["Crazy King", "frontline"],
    ["Raider", "suppression"],
    ["Tatara", "heavy"],
    ["Gantetsu", "heavy"],
    ["Mayo-chan", "skirmisher"],
    ["Zakimiya", "frontline"],
    ["TKY", "skirmisher"],
    ["MrsChiha", "marksman"],
    ["Miyamoto Musashi", "frontline"],
  ]);
  const roleSection = design.match(/Primary role ownership is exact[\s\S]+?### Level cap/u)?.[0] ?? "";
  const actualRoles = new Map(
    [...roleSection.matchAll(/^\| ([^|]+?) \| `([^`]+)` \|$/gmu)]
      .map((match) => [match[1].trim(), match[2]]),
  );
  assert.deepEqual(actualRoles, expectedRoles);

  const closure = design.match(/### 17\.5 Stage content closure matrix([\s\S]+?)### 17\.6/u)?.[1] ?? "";
  const rows = [...closure.matchAll(/^\| (\d+) \| `([^`]+)` \|/gmu)]
    .map((match) => ({ stage: Number(match[1]), id: match[2] }));
  assert.equal(rows.length, 30);
  assert.deepEqual(rows.map(({ stage }) => stage), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.equal(new Set(rows.map(({ id }) => id)).size, 30);
  assert.equal(rows[0].id, "stage-nishijin-shopping-street");
  assert.equal(rows[28].id, "stage-segawa-research-core");
  assert.equal(rows[29].id, "stage-nishijin-defense-line-takuya-omega");
  assert.match(closure, /Stage 29's two destruction targets must both complete/u);
  assert.match(closure, /Stage 30 has no midbattle story dialogue/u);
});

test("event flow, stars, receipts, unlock payloads, speakers, and required assets are closed", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  assert.match(design, /`v100:event:prologue`/u);
  assert.match(design, /for every `NN` from `01` to `30`, `v100:event:sNN:pre`, `v100:event:sNN:post`, and `v100:event:sNN:first-clear-post`/u);
  assert.match(design, /Defeat ends at a defeat result[\s\S]*without `post`, first-clear, star, reward, join, unlock, boss receipt, or next-stage unlock/u);
  assert.match(design, /After Stage 30 first-clear finalize: `ending -> credits -> epilogue -> postgame campaign-map`/u);
  assert.match(design, /persists `\{eventId, phase, nodeIndex, nodeKey\}`/u);
  assert.match(design, /final armored-vehicle HP \/ current maximum HP >= 0\.70/u);
  assert.match(design, /Three stars require >= 0\.90/u);
  assert.match(design, /replay victory continues `result -> post -> replay-finalize -> map` and never replays `first-clear-post`/u);
  assert.match(design, /`v100:sNN:first-clear`/u);
  assert.match(design, /`v100:sNN:replay:<battleRunId>`/u);

  const payloadSection = handoff.match(/### 10\.3 Exact first-clear payloads([\s\S]+?)### 10\.4/u)?.[1] ?? "";
  const payloadRows = [...payloadSection.matchAll(/^\| (\d+) \| ([^|]+) \|$/gmu)];
  assert.equal(payloadRows.length, 30);
  assert.deepEqual(payloadRows.map((match) => Number(match[1])), Array.from({ length: 30 }, (_, index) => index + 1));

  const speakerSection = handoff.match(/### 10\.4 Canonical speaker\/portrait routing by event([\s\S]+?)### 10\.5/u)?.[1] ?? "";
  const speakerRows = [...speakerSection.matchAll(/^\| (Prologue|S\d{2}|Ending|Credits|Epilogue) \|/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(speakerRows, [
    "Prologue",
    ...Array.from({ length: 30 }, (_, index) => `S${String(index + 1).padStart(2, "0")}`),
    "Ending",
    "Credits",
    "Epilogue",
  ]);
  assert.match(speakerSection, /Zakimiya's wife -> shared silhouette/u);
  assert.match(speakerSection, /Stage 13 `知らない声` has no portrait until Segawa is named/u);
  assert.match(speakerSection, /RED PANTHER\/red-lens captain uses the selected commander identity/u);
  assert.match(design, /Credits have no dialogue and no BGM/u);
  assert.match(design, /inherits only the ambience already owned by that source background route/u);

  assert.match(design, /Every stage\/event registers its background, all portraits reachable in that event, mission-object states, locked enemy\/boss states, VFX, battle audio, event audio, UI icons, fonts, and ending\/credits\/epilogue assets/u);
  assert.match(design, /after the gate opens, required fetches are zero/u);
  assert.match(handoff, /Return to Sol only for: \(1\) a true contradiction[\s\S]*\(4\) a technically impossible acceptance contract/u);
});

test("runtime derivatives are required implementation work without reopening character identity", async () => {
  const [design, handoff] = await Promise.all([readFile(DESIGN, "utf8"), readFile(HANDOFF, "utf8")]);
  for (const source of [design, handoff]) {
    assert.match(source, /RUNTIME_SPRITE_SCOPE_CLOSED/u);
    assert.match(source, /PRODUCT_DESIGN_CHANGE: 0/u);
    assert.match(source, /new character identity, character design, or identity-master candidate/u);
    assert.match(source, /runtime derivative/u);
    assert.match(source, /Phase 4/u);
  }
  assert.doesNotMatch(handoff, /There is no image-generation task/u);
  assert.match(handoff, /Producing the finite battle sprites\/atlases, event portraits, boss entrance\/idle\/attack\/hit\/phase\/death states/u);
  assert.match(handoff, /newly invented substitute identity-master candidate is forbidden/u);
  assert.match(handoff, /Do not enter Phase 4 until every required runtime character\/stage\/mission image is complete/u);
});

test("all 16 playable sprite statuses are finite and match the current production manifest", async () => {
  const [design, handoff, spriteManifest] = await Promise.all([
    readFile(DESIGN, "utf8"),
    readFile(HANDOFF, "utf8"),
    readFile(SPRITE_MANIFEST_SOURCE, "utf8"),
  ]);
  const expected = new Map([
    ["Hachi", "REUSE_COMPLETE"],
    ["Paisen", "DERIVE_RUNTIME_REQUIRED"],
    ["Kumaverson", "REUSE_COMPLETE"],
    ["Babayaga", "REUSE_COMPLETE"],
    ["Nao", "REUSE_COMPLETE"],
    ["Mizuchi", "REUSE_COMPLETE"],
    ["Monkey", "REUSE_COMPLETE"],
    ["Crazy King", "REUSE_COMPLETE"],
    ["Raider", "REUSE_COMPLETE"],
    ["Tatara", "REUSE_COMPLETE"],
    ["Gantetsu", "REUSE_COMPLETE"],
    ["Mayo-chan", "REUSE_COMPLETE"],
    ["Zakimiya", "REUSE_COMPLETE"],
    ["TKY", "REUSE_COMPLETE"],
    ["MrsChiha", "REUSE_COMPLETE"],
    ["Miyamoto Musashi", "REUSE_COMPLETE"],
  ]);
  const section = design.match(/### 17\.7 Runtime sprite scope closure([\s\S]+?)### 17\.8/u)?.[1] ?? "";
  const actual = new Map(
    [...section.matchAll(/^\| ([^|]+?) \| `[^`]+`(?: \/ `[^`]+`)? \| `(REUSE_COMPLETE|DERIVE_RUNTIME_REQUIRED|NEW_RUNTIME_SPRITE_REQUIRED)` \|/gmu)]
      .map((match) => [match[1].trim(), match[2]]),
  );
  assert.deepEqual(actual, expected);
  assert.match(section, /`NEW_RUNTIME_SPRITE_REQUIRED` playable units: none/u);
  assert.match(section, /Paisen's approved-identity atlas/u);
  assert.match(section, /legacy `hit`\/`death` alias/u);
  assert.match(handoff, /Phase 2 target: Paisen only, completed before Phase 3 begins/u);

  for (const kind of [
    "scout", "ranger", "medic", "brute", "gunner", "guardian", "engineer", "zakimiya", "tky",
    "mrs-chiha", "miyamoto-musashi", "mayo-chan", "mayo-chan-feral", "crazy-king", "kumaverson", "babayaga",
  ]) {
    const escaped = kind.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    assert.match(spriteManifest, new RegExp(`(?:${escaped}|"${escaped}"):\\s*explicitAtlasManifestEntry`, "u"));
  }
  assert.match(spriteManifest, /brawler: legacyManifestEntry\("brawler", "right"\)/u);
  assert.match(spriteManifest, /hit: 5,[\s\S]*death: 5,/u);
  for (const state of ["idle", "walk-a", "walk-b", "attack-a", "attack-b", "hit", "death"]) {
    assert.match(spriteManifest, new RegExp(`"${state.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`), `missing ${state}`);
  }
});
