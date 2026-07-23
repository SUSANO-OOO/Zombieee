import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_CHARACTERS,
  CAMPAIGN_FORMATION_MAX_SLOTS,
  CAMPAIGN_FORMATION_PRESET_IDS,
  CAMPAIGN_GUIDE,
  CAMPAIGN_GUIDE_ID,
  CAMPAIGN_RECRUITMENT_COSTS,
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_STAGE_IDS,
  CAMPAIGN_STAGES,
  CAMPAIGN_UNIT_BY_ID,
  CAMPAIGN_UNIT_IDS,
  CAMPAIGN_UNITS,
  DEFAULT_REPLAY_REWARD_MULTIPLIERS,
  DEFAULT_STAR_THRESHOLDS,
  INITIAL_STAGE_ID,
  INITIAL_UNIT_IDS,
  PROVISIONAL_BASE_REWARDS,
  STAGE_VISUAL_SIGNATURES,
  applyStageResult,
  campaignUnitIdToCombatKind,
  calculateStageRewards,
  calculateStageStars,
  combatKindToCampaignUnitId,
  computeCampaignSaveIntegrity,
  createDefaultCampaignSave,
  deserializeCampaignSave,
  formationUnitIdsToCombatKinds,
  getSelectedFormationCombatKinds,
  getSelectedFormationUnitIds,
  grantStoryCampaignUnit,
  inspectCampaignSaveCandidate,
  isUnitDiscovered,
  isUnitOwned,
  isUnitRecruitable,
  isStageUnlocked,
  isUnitUnlocked,
  markStoryEventRead,
  markCampaignStarted,
  migrateCampaignSave,
  normalizeCampaignCharacterId,
  normalizeCampaignUnitId,
  recruitCampaignUnit,
  resolveStageResult,
  selectCampaignStage,
  selectFormationPreset,
  serializeCampaignSave,
  setFormationPresetUnits,
  updateCampaignSettings,
  updateStoryPlaybackSettings,
  verifyCampaignSaveIntegrity,
  withCampaignSaveIntegrity,
} from "../app/campaign.js";

const STAGE_1 = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
const STAGE_2 = CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE;
const STAGE_3 = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;
const STAGE_4 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE;
const STAGE_5 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM;
const STAGE_6 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL;

test("campaign defines six stable, ordered, data-driven stages", () => {
  assert.equal(CAMPAIGN_STAGES.length, 6);
  assert.deepEqual(CAMPAIGN_STAGES.map((stage) => stage.id), [
    STAGE_1,
    STAGE_2,
    STAGE_3,
    STAGE_4,
    STAGE_5,
    STAGE_6,
  ]);
  assert.deepEqual(CAMPAIGN_STAGES.map((stage) => stage.displayName), [
    "西新商店街",
    "早良区役所",
    "西新防衛線・TAKUYA",
    "西新駅・改札区域",
    "西新駅・ホーム／線路区域",
    "西新駅・保守トンネル／封鎖区域",
  ]);
  assert.equal(new Set(CAMPAIGN_STAGES.map((stage) => stage.id)).size, 6);

  for (const stage of CAMPAIGN_STAGES) {
    assert.equal(CAMPAIGN_STAGE_BY_ID[stage.id], stage);
    assert.equal(typeof stage.chapterId, "string");
    assert.equal(stage.mapPosition.unit, "percent");
    assert.equal(Number.isFinite(stage.mapPosition.x), true);
    assert.equal(Number.isFinite(stage.mapPosition.y), true);
    assert.equal(Array.isArray(stage.unlockRequirements), true);
    assert.equal(Array.isArray(stage.prerequisiteStageIds), true);
    assert.equal(typeof stage.missionType, "string");
    assert.equal(typeof stage.objective, "string");
    assert.equal(typeof stage.theme.id, "string");
    assert.equal(stage.waves.length > 0, true);
    assert.equal(stage.waves.every((wave) => wave.id
      && Number.isFinite(wave.atSeconds)
      && ((Array.isArray(wave.groups) && wave.groups.length > 0) || Array.isArray(wave.units))), true);
    assert.equal(stage.waves.every((wave) => !Object.hasOwn(wave, "lanes")), true);
    assert.equal(stage.waves.every((wave) => (wave.groups ?? []).every((group) => !Object.hasOwn(group, "lanes"))), true);
    assert.equal(stage.waves.every((wave) => (wave.units ?? []).every((kind) => typeof kind === "string")), true);
    assert.equal(stage.baseHp > 0, true);
    assert.deepEqual(stage.starThresholds, DEFAULT_STAR_THRESHOLDS);
    assert.deepEqual(stage.replayRewardMultipliers, DEFAULT_REPLAY_REWARD_MULTIPLIERS);
    assert.equal(stage.baseReward, PROVISIONAL_BASE_REWARDS[stage.id]);
    assert.deepEqual(Object.values(stage.firstTimeStarRewards), Array(3).fill(stage.baseReward * 0.5));
    assert.equal(typeof stage.preBattleEventId, "string");
    assert.equal(typeof stage.postBattleEventId, "string");
    assert.equal(Array.isArray(stage.nextUnlocks.stageIds), true);
    assert.equal(Array.isArray(stage.nextUnlocks.unitIds), true);
    assert.equal(Array.isArray(stage.nextUnlocks.discoveredUnitIds), true);
    assert.equal(Array.isArray(stage.nextUnlocks.recruitableUnitIds), true);
    assert.equal(Array.isArray(stage.nextUnlocks.mapSignalIds), true);
  }
  assert.deepEqual(CAMPAIGN_STAGES.map((stage) => stage.theme.backgroundId), [
    "background-nishijin-shopping-street-v1",
    "background-sawara-ward-office-v1",
    "background-nishijin-defense-line-v1",
    "background-nishijin-station-gate-v1",
    "background-nishijin-station-platform-v1",
    "background-nishijin-station-tunnel-v1",
  ]);
});

test("each stage has a unique multi-layer visual signature", () => {
  assert.deepEqual(
    Object.keys(STAGE_VISUAL_SIGNATURES).sort(),
    [STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, STAGE_6].sort(),
  );
  const signatures = Object.values(STAGE_VISUAL_SIGNATURES);
  assert.equal(new Set(signatures.map(({ kind }) => kind)).size, 6);
  for (const signature of signatures) {
    assert.equal(typeof signature.background, "string");
    assert.equal(typeof signature.landmark, "string");
    assert.equal(signature.environment.length >= 2, true);
    assert.equal(typeof signature.lighting, "string");
    assert.equal(signature.battleScars.length >= 1, true);
  }
});

test("Stage 1-6 objectives, prerequisites, recruits, and forward unlocks match the mission", () => {
  const shoppingStreet = CAMPAIGN_STAGE_BY_ID[STAGE_1];
  const wardOffice = CAMPAIGN_STAGE_BY_ID[STAGE_2];
  const defenseLine = CAMPAIGN_STAGE_BY_ID[STAGE_3];
  const stationGate = CAMPAIGN_STAGE_BY_ID[STAGE_4];
  const stationPlatform = CAMPAIGN_STAGE_BY_ID[STAGE_5];
  const stationTunnel = CAMPAIGN_STAGE_BY_ID[STAGE_6];

  assert.equal(shoppingStreet.objective, "感染拠点を破壊");
  assert.deepEqual(shoppingStreet.prerequisiteStageIds, []);
  assert.deepEqual(shoppingStreet.nextUnlocks.stageIds, [STAGE_2]);
  assert.deepEqual(shoppingStreet.nextUnlocks.unitIds, [CAMPAIGN_UNIT_IDS.CRAZY_KING]);
  assert.deepEqual(shoppingStreet.nextUnlocks.discoveredUnitIds, [
    CAMPAIGN_UNIT_IDS.CRAZY_KING,
    CAMPAIGN_UNIT_IDS.TATARA,
  ]);
  assert.deepEqual(shoppingStreet.nextUnlocks.recruitableUnitIds, [CAMPAIGN_UNIT_IDS.TATARA]);

  assert.equal(wardOffice.missionType, "timed-defense");
  assert.equal(wardOffice.objectiveConfig.durationSeconds, 180);
  assert.deepEqual(wardOffice.prerequisiteStageIds, [STAGE_1]);
  assert.deepEqual(wardOffice.nextUnlocks.stageIds, [STAGE_3]);
  assert.deepEqual(wardOffice.nextUnlocks.unitIds, []);
  assert.deepEqual(wardOffice.nextUnlocks.recruitableUnitIds, [CAMPAIGN_UNIT_IDS.RAIDER]);

  assert.equal(defenseLine.boss.id, "boss-takuya");
  assert.equal(defenseLine.boss.displayName, "TAKUYA");
  assert.match(defenseLine.objective, /TAKUYA.*感染拠点/);
  assert.deepEqual(defenseLine.prerequisiteStageIds, [STAGE_2]);
  assert.deepEqual(defenseLine.nextUnlocks.stageIds, [STAGE_4]);
  assert.deepEqual(defenseLine.nextUnlocks.mapSignalIds, ["map-signal-nishijin-station"]);
  assert.equal(defenseLine.waves.length, 12);
  assert.deepEqual(defenseLine.waves.map(({ atSeconds }) => atSeconds), [0, 12, 30, 47, 65, 84, 103, 120, 126, 147, 169, 196]);
  assert.equal(defenseLine.waves.find(({ waveNumber }) => waveNumber === 8).units.includes("takuya"), true);

  assert.equal(stationGate.missionType, "assault");
  assert.match(stationGate.objective, /感染中継点.*生存者/);
  assert.deepEqual(stationGate.objectiveConfig, {
    target: "infected-relay",
    rescueCount: 7,
    rescueMode: "automatic-on-objective-destroyed",
  });
  assert.deepEqual(stationGate.prerequisiteStageIds, [STAGE_3]);
  assert.deepEqual(stationGate.nextUnlocks.stageIds, [STAGE_5]);
  assert.deepEqual(stationGate.nextUnlocks.unitIds, [CAMPAIGN_UNIT_IDS.GANTETSU]);
  assert.deepEqual(stationGate.nextUnlocks.discoveredUnitIds, [CAMPAIGN_UNIT_IDS.GANTETSU]);
  assert.deepEqual(stationGate.nextUnlocks.recruitableUnitIds, []);

  assert.equal(stationPlatform.missionType, "assault");
  assert.match(stationPlatform.objective, /ホーム.*感染拠点.*破壊/);
  assert.deepEqual(stationPlatform.objectiveConfig, {
    target: "infection-base",
    rescueCount: 5,
    rescueMode: "automatic-on-objective-destroyed",
  });
  assert.deepEqual(stationPlatform.prerequisiteStageIds, [STAGE_4]);
  assert.deepEqual(stationPlatform.nextUnlocks.stageIds, [STAGE_6]);
  assert.deepEqual(stationPlatform.nextUnlocks.unitIds, []);
  assert.deepEqual(stationPlatform.nextUnlocks.discoveredUnitIds, [CAMPAIGN_UNIT_IDS.MONKEY]);

  assert.equal(stationTunnel.missionType, "sequential-seal");
  assert.match(stationTunnel.objective, /三つの電源.*感染流出路.*封鎖/);
  assert.deepEqual(stationTunnel.objectiveConfig, {
    targetsInOrder: [
      "power-1",
      "power-2",
      "power-3",
      "gate-eater-defeat",
      "research-container",
      "seal-door",
      "return-route",
    ],
    powerHoldSeconds: 6,
    powerReadyAtSeconds: [24, 62, 104],
    powerYs: [212, 352, 282],
    powerXs: [410, 584, 744],
    powerRadiusX: 84,
    powerRadiusY: 42,
    sealDoorX: 867,
    sealY: 282,
    researchContainerStartX: 708,
    researchContainerY: 282,
    returnX: 205,
    returnRadiusX: 96,
    returnRadiusY: 48,
    escapeSeconds: 45,
  });
  assert.deepEqual(stationTunnel.prerequisiteStageIds, [STAGE_5]);
  assert.equal(stationTunnel.boss.enemyKind, "gate-eater");
  assert.equal(stationTunnel.boss.displayName, "改札喰い");
  assert.deepEqual(stationTunnel.nextUnlocks.stageIds, []);
  assert.deepEqual(stationTunnel.nextUnlocks.unitIds, [CAMPAIGN_UNIT_IDS.MONKEY]);
  assert.deepEqual(stationTunnel.nextUnlocks.mapSignalIds, ["map-signal-university-hospital"]);
});

test("Stage 1-3 increase pressure through bounded cadence and mixed compositions", () => {
  const unitEntries = (wave) => Array.isArray(wave.units)
    ? wave.units.map((kind) => [kind])
    : (wave.groups ?? []).flatMap(({ kind, count }) => Array.from({ length: count }, () => [kind]));
  const waveSizes = (stage) => stage.waves.map((wave) => unitEntries(wave).length);
  const enemyKinds = (stage) => new Set(stage.waves.flatMap((wave) => unitEntries(wave).map(([kind]) => kind)));
  const largestGap = (stage) => Math.max(...stage.waves.slice(1).map((wave, index) => (
    wave.atSeconds - stage.waves[index].atSeconds
  )));

  const stage1 = CAMPAIGN_STAGE_BY_ID[STAGE_1];
  const stage2 = CAMPAIGN_STAGE_BY_ID[STAGE_2];
  const stage3 = CAMPAIGN_STAGE_BY_ID[STAGE_3];

  assert.deepEqual(stage1.waves.map(({ atSeconds }) => atSeconds), [4, 21, 39, 58, 76]);
  assert.deepEqual(stage2.waves.map(({ atSeconds }) => atSeconds), [6, 31, 56, 82, 109, 136, 162]);
  assert.deepEqual(stage3.waves.map(({ atSeconds }) => atSeconds), [0, 12, 30, 47, 65, 84, 103, 120, 126, 147, 169, 196]);
  assert.deepEqual([largestGap(stage1), largestGap(stage2), largestGap(stage3)], [19, 27, 27]);
  assert.deepEqual([
    waveSizes(stage1).reduce((total, count) => total + count, 0),
    waveSizes(stage2).reduce((total, count) => total + count, 0),
    waveSizes(stage3).reduce((total, count) => total + count, 0),
  ], [28, 53, 65]);
  assert.equal(Math.max(...[stage1, stage2, stage3].flatMap(waveSizes)), 9);
  assert.deepEqual([...enemyKinds(stage1)].sort(), ["crusher", "runner", "spitter", "walker"]);
  assert.deepEqual([...enemyKinds(stage2)].sort(), ["abomination", "crusher", "runner", "spitter", "walker"]);
  assert.deepEqual([...enemyKinds(stage3)].sort(), ["abomination", "crusher", "runner", "shade", "spitter", "takuya", "walker"]);
  assert.deepEqual([stage1, stage2, stage3].map(({ baseHp }) => baseHp), [1000, 1000, 520]);
});

test("Stage 4-6 introduce each station enemy through bounded mission-specific waves", () => {
  const enemyKinds = (stageId) => new Set(CAMPAIGN_STAGE_BY_ID[stageId].waves.flatMap((wave) => (
    Array.isArray(wave.units)
      ? wave.units
      : (wave.groups ?? []).map(({ kind }) => kind)
  )));

  assert.deepEqual([...enemyKinds(STAGE_4)].sort(), ["crusher", "grappler", "runner", "spitter", "walker"]);
  assert.deepEqual([...enemyKinds(STAGE_5)].sort(), ["crusher", "ooze", "runner", "spitter", "sprinter", "walker"]);
  assert.deepEqual(
    [...enemyKinds(STAGE_6)].sort(),
    ["crusher", "gate-eater", "grappler", "ooze", "runner", "spitter", "sprinter", "walker"],
  );
  assert.deepEqual(
    [STAGE_4, STAGE_5, STAGE_6].map((stageId) => CAMPAIGN_STAGE_BY_ID[stageId].baseHp),
    [850, 760, 720],
  );
});

test("eleven canonical playable units and guide-ikura use approved player-facing identities", () => {
  assert.equal(CAMPAIGN_UNITS.length, 11);
  assert.equal(CAMPAIGN_CHARACTERS.length, 12);
  assert.deepEqual(INITIAL_UNIT_IDS, [
    CAMPAIGN_UNIT_IDS.PAISEN,
    CAMPAIGN_UNIT_IDS.HACHI,
    CAMPAIGN_UNIT_IDS.MIZUCHI,
    CAMPAIGN_UNIT_IDS.NAO,
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
  ]);
  assert.deepEqual(CAMPAIGN_UNITS.map(({ id, displayName }) => [id, displayName]), [
    [CAMPAIGN_UNIT_IDS.PAISEN, "パイセン"],
    [CAMPAIGN_UNIT_IDS.HACHI, "ハチ"],
    [CAMPAIGN_UNIT_IDS.MIZUCHI, "ミズチ"],
    [CAMPAIGN_UNIT_IDS.NAO, "ナオ"],
    [CAMPAIGN_UNIT_IDS.TATARA, "タタラ"],
    [CAMPAIGN_UNIT_IDS.CRAZY_KING, "クレイジーキング"],
    [CAMPAIGN_UNIT_IDS.KUMAVERSON, "クマバーソン"],
    [CAMPAIGN_UNIT_IDS.BABAYAGA, "ババヤガ"],
    [CAMPAIGN_UNIT_IDS.RAIDER, "レイダー"],
    [CAMPAIGN_UNIT_IDS.GANTETSU, "ガンテツ"],
    [CAMPAIGN_UNIT_IDS.MONKEY, "モンキー"],
  ]);
  assert.equal(new Set(CAMPAIGN_UNITS.map(({ id }) => id)).size, 11);
  assert.equal(CAMPAIGN_UNIT_BY_ID.brawler.id, CAMPAIGN_UNIT_IDS.PAISEN);
  assert.equal(CAMPAIGN_UNIT_BY_ID.brute.id, CAMPAIGN_UNIT_IDS.TATARA);
  assert.equal(CAMPAIGN_UNIT_BY_ID["unit-rokka"].id, CAMPAIGN_UNIT_IDS.RAIDER);
  assert.equal(CAMPAIGN_UNIT_BY_ID[CAMPAIGN_UNIT_IDS.GANTETSU].combatKind, "guardian");
  assert.equal(CAMPAIGN_GUIDE.id, CAMPAIGN_GUIDE_ID);
  assert.equal(CAMPAIGN_GUIDE.displayName, "いくらちゃん");
  assert.equal(CAMPAIGN_GUIDE.roleName, "通信・地図・情報分析");
  assert.equal(CAMPAIGN_GUIDE.combatant, false);
  assert.equal(CAMPAIGN_GUIDE.age, 18);
  assert.equal(CAMPAIGN_GUIDE.portraitPath, "/art/v070/characters/portraits/guide-portrait-v1.webp");
  assert.equal(CAMPAIGN_GUIDE.assetStatus, "approved");
  assert.match(CAMPAIGN_GUIDE.appearanceAudit.presentation, /pink space bun/);
  assert.doesNotMatch(
    [...CAMPAIGN_UNITS.map(({ displayName }) => displayName), CAMPAIGN_GUIDE.displayName].join(" "),
    /センセイ|ノイズ|ロッカ|白石|真壁|橘|黒木|水城/,
  );
});

test("all eleven units separate canonical IDs from combat kinds and use formal runtime art", () => {
  for (const unit of CAMPAIGN_UNITS) {
    assert.match(unit.id, /^unit-/);
    assert.equal(unit.unitId, unit.id);
    assert.equal(typeof unit.combatKind, "string");
    assert.match(unit.primaryClassId, /^class-/);
    assert.equal(unit.roleTags.length > 0, true);
    for (const field of ["displayName", "roleName", "roleIcon", "weaponName", "attackMode", "rangeBand", "primaryTarget", "deploymentHint"]) {
      assert.equal(typeof unit[field], "string");
      assert.equal(unit[field].length > 0, true);
    }
    assert.match(unit.appearanceAudit.presentation, /表現/);
    assert.ok(unit.appearanceAudit.weaponMatch.length > 0);
    assert.notEqual(unit.assetStatus, "pending-approval");
    assert.equal(typeof unit.spritePath, "string");
  }
  assert.equal(CAMPAIGN_UNIT_BY_ID[CAMPAIGN_UNIT_IDS.NAO].deploymentCost, 35);
  assert.equal(CAMPAIGN_UNIT_BY_ID[CAMPAIGN_UNIT_IDS.GANTETSU].deploymentCost, 48);
  const redesignedPaths = new Map([
    [CAMPAIGN_UNIT_IDS.HACHI, "/art/v070/characters/scout-battle-v1.png"],
    [CAMPAIGN_UNIT_IDS.MIZUCHI, "/art/v070/characters/ranger-battle-v1.png"],
    [CAMPAIGN_UNIT_IDS.NAO, "/art/v070/characters/medic-battle-v1.png"],
    [CAMPAIGN_UNIT_IDS.TATARA, "/art/v070/characters/brute-battle-v1.png"],
    [CAMPAIGN_UNIT_IDS.RAIDER, "/art/v070/characters/gunner-battle-v1.png"],
    [CAMPAIGN_UNIT_IDS.GANTETSU, "/art/v070/characters/guardian-battle-v1.png"],
    [CAMPAIGN_UNIT_IDS.MONKEY, "/art/v070/characters/engineer-battle-v1.png"],
  ]);
  for (const [unitId, spritePath] of redesignedPaths) {
    assert.equal(CAMPAIGN_UNIT_BY_ID[unitId].assetStatus, "approved");
    assert.equal(CAMPAIGN_UNIT_BY_ID[unitId].spritePath, spritePath);
  }
  assert.equal(CAMPAIGN_RECRUITMENT_COSTS[CAMPAIGN_UNIT_IDS.TATARA], 150);
  assert.equal(CAMPAIGN_RECRUITMENT_COSTS[CAMPAIGN_UNIT_IDS.RAIDER], 200);
  assert.equal(CAMPAIGN_UNIT_BY_ID[CAMPAIGN_UNIT_IDS.RAIDER].weaponName, "軽機関銃");
  assert.match(CAMPAIGN_UNIT_BY_ID[CAMPAIGN_UNIT_IDS.RAIDER].description, /軽機関銃/);
  assert.match(CAMPAIGN_UNIT_BY_ID[CAMPAIGN_UNIT_IDS.RAIDER].appearanceAudit.weaponMatch, /軽機関銃/);
});

test("migration aliases resolve to canonical IDs while player-facing names stay canonical", () => {
  const aliases = [
    ["scout", CAMPAIGN_UNIT_IDS.HACHI],
    ["橘 迅", CAMPAIGN_UNIT_IDS.HACHI],
    ["ranger", CAMPAIGN_UNIT_IDS.MIZUCHI],
    ["黒木凛", CAMPAIGN_UNIT_IDS.MIZUCHI],
    ["unit-sensei", CAMPAIGN_UNIT_IDS.NAO],
    ["白石 直人", CAMPAIGN_UNIT_IDS.NAO],
    ["brute", CAMPAIGN_UNIT_IDS.TATARA],
    ["大庭豪", CAMPAIGN_UNIT_IDS.TATARA],
    ["unit-rokka", CAMPAIGN_UNIT_IDS.RAIDER],
    ["真壁 玲奈", CAMPAIGN_UNIT_IDS.RAIDER],
  ];
  for (const [alias, canonicalId] of aliases) {
    assert.equal(normalizeCampaignUnitId(alias), canonicalId);
    assert.equal(combatKindToCampaignUnitId(alias), canonicalId);
  }
  assert.equal(campaignUnitIdToCombatKind(CAMPAIGN_UNIT_IDS.NAO), "medic");
  assert.equal(campaignUnitIdToCombatKind("unit-rokka"), "gunner");
  assert.equal(normalizeCampaignCharacterId("guide-noise"), CAMPAIGN_GUIDE_ID);
  assert.equal(normalizeCampaignCharacterId("水城 奈々"), CAMPAIGN_GUIDE_ID);
  assert.equal(normalizeCampaignCharacterId("いくらちゃん"), CAMPAIGN_GUIDE_ID);
  assert.equal(normalizeCampaignUnitId("unknown-unit"), null);
});

test("star calculation honors exact HP-ratio boundaries and victory only", () => {
  const stars = (baseHp, won = true) => calculateStageStars({
    won,
    baseHp,
    baseMaxHp: 100,
    elapsedSeconds: 999,
    enemiesDefeated: 999,
  });

  assert.equal(stars(90), 3);
  assert.equal(stars(89.9), 2);
  assert.equal(stars(70), 2);
  assert.equal(stars(69.9), 1);
  assert.equal(stars(1), 1);
  assert.equal(stars(0), 0);
  assert.equal(stars(100, false), 0);
});

test("star calculation ignores enemy-base and barricade HP fields", () => {
  assert.equal(calculateStageStars({
    won: true,
    baseHp: 71,
    baseMaxHp: 100,
    barricadeHp: 0,
    enemyBaseHp: 0,
    infectedBaseHp: 0,
  }), 2);
  assert.equal(calculateStageStars({
    won: true,
    baseHp: 1,
    baseMaxHp: 100,
    barricadeHp: 999999,
    enemyBaseHp: 999999,
  }), 1);
});

test("stage thresholds remain configurable without changing the default boundaries", () => {
  assert.equal(calculateStageStars({ won: true, baseHp: 80, baseMaxHp: 100 }), 2);
  assert.equal(calculateStageStars({
    won: true,
    baseHp: 80,
    baseMaxHp: 100,
    thresholds: { 1: 0.2, 2: 0.5, 3: 0.8 },
  }), 3);
  assert.deepEqual(DEFAULT_STAR_THRESHOLDS, { 1: 0.01, 2: 0.7, 3: 0.9 });
});

test("replay reward applies the configured multiplier for each star result", () => {
  const stage = CAMPAIGN_STAGE_BY_ID[STAGE_1];
  assert.equal(calculateStageRewards({ stageId: STAGE_1, stars: 0 }).replayReward, 0);
  assert.equal(calculateStageRewards({ stageId: STAGE_1, stars: 1 }).replayReward, stage.baseReward);
  assert.equal(calculateStageRewards({ stageId: STAGE_1, stars: 2 }).replayReward, stage.baseReward * 1.25);
  assert.equal(calculateStageRewards({ stageId: STAGE_1, stars: 3 }).replayReward, stage.baseReward * 1.5);
});

test("first clear at three stars awards all cumulative milestones once", () => {
  const first = resolveStageResult(createDefaultCampaignSave(), {
    resultId: "battle-first-three-star",
    stageId: STAGE_1,
    won: true,
    baseHp: 90,
    baseMaxHp: 100,
  });
  assert.equal(first.result.stars, 3);
  assert.deepEqual(first.result.newStarMilestones, [1, 2, 3]);
  assert.equal(first.result.firstTimeStarReward, 150);
  assert.equal(first.result.replayReward, 150);
  assert.equal(first.result.totalReward, 300);
  assert.deepEqual(first.save.claimedStarRewardsByStage[STAGE_1], [1, 2, 3]);

  const replay = resolveStageResult(first.save, STAGE_1, { resultId: "battle-replay-three-star", won: true, baseHp: 100, baseMaxHp: 100 });
  assert.deepEqual(replay.result.newStarMilestones, []);
  assert.equal(replay.result.firstTimeStarReward, 0);
  assert.equal(replay.result.replayReward, 150);
  assert.equal(replay.result.totalReward, 150);
  assert.deepEqual(replay.save.claimedStarRewardsByStage[STAGE_1], [1, 2, 3]);
});

test("upgrading from one to three stars grants only the missing two milestones", () => {
  const oneStar = resolveStageResult(createDefaultCampaignSave(), STAGE_1, {
    resultId: "battle-first-one-star",
    won: true,
    baseHp: 1,
    baseMaxHp: 100,
  });
  assert.deepEqual(oneStar.result.newStarMilestones, [1]);
  assert.equal(oneStar.result.firstTimeStarReward, 50);

  const threeStars = resolveStageResult(oneStar.save, STAGE_1, {
    resultId: "battle-upgrade-three-star",
    won: true,
    baseHp: 90,
    baseMaxHp: 100,
  });
  assert.deepEqual(threeStars.result.newStarMilestones, [2, 3]);
  assert.equal(threeStars.result.firstTimeStarReward, 100);
  assert.deepEqual(threeStars.save.claimedStarRewardsByStage[STAGE_1], [1, 2, 3]);
});

test("best star never decreases and applying a result does not mutate the input save", () => {
  const original = createDefaultCampaignSave();
  const originalSnapshot = JSON.stringify(original);
  const threeStars = applyStageResult(original, STAGE_1, { resultId: "battle-best-three", won: true, baseHp: 90, baseMaxHp: 100 });
  assert.equal(JSON.stringify(original), originalSnapshot);
  assert.equal(threeStars.bestStarsByStage[STAGE_1], 3);

  const worse = resolveStageResult(threeStars, STAGE_1, { resultId: "battle-worse-one", won: true, baseHp: 1, baseMaxHp: 100 });
  assert.equal(worse.result.stars, 1);
  assert.equal(worse.result.bestStars, 3);
  assert.equal(worse.result.isNewBest, false);
  assert.equal(worse.save.bestStarsByStage[STAGE_1], 3);

  const loss = resolveStageResult(worse.save, STAGE_1, { resultId: "battle-loss", won: false, baseHp: 100, baseMaxHp: 100 });
  assert.equal(loss.result.stars, 0);
  assert.equal(loss.result.totalReward, 0);
  assert.equal(loss.save.bestStarsByStage[STAGE_1], 3);
});

test("fresh progression separates free ownership from discovery and caps recruitment", () => {
  const initial = createDefaultCampaignSave();
  assert.deepEqual(initial.unlockedStageIds, [STAGE_1]);
  assert.equal(isStageUnlocked(initial, STAGE_2), false);
  assert.equal(isUnitUnlocked(initial, CAMPAIGN_UNIT_IDS.TATARA), false);
  assert.equal(isUnitUnlocked(initial, CAMPAIGN_UNIT_IDS.CRAZY_KING), false);
  assert.equal(isUnitOwned(initial, CAMPAIGN_UNIT_IDS.KUMAVERSON), true);
  assert.equal(isUnitOwned(initial, CAMPAIGN_UNIT_IDS.BABAYAGA), true);

  const afterStage1 = applyStageResult(initial, STAGE_1, { resultId: "unlock-stage-1", won: true, baseHp: 70, baseMaxHp: 100 });
  assert.equal(isStageUnlocked(afterStage1, STAGE_2), true);
  assert.equal(isStageUnlocked(afterStage1, STAGE_3), false);
  assert.equal(isUnitOwned(afterStage1, CAMPAIGN_UNIT_IDS.TATARA), false);
  assert.equal(isUnitDiscovered(afterStage1, CAMPAIGN_UNIT_IDS.TATARA), true);
  assert.equal(isUnitRecruitable(afterStage1, CAMPAIGN_UNIT_IDS.TATARA), true);
  assert.equal(isUnitUnlocked(afterStage1, CAMPAIGN_UNIT_IDS.CRAZY_KING), true);
  assert.equal(isUnitOwned(afterStage1, CAMPAIGN_UNIT_IDS.RAIDER), false);

  const afterStage2 = applyStageResult(afterStage1, STAGE_2, { resultId: "unlock-stage-2", won: true, baseHp: 1, baseMaxHp: 100 });
  assert.equal(isStageUnlocked(afterStage2, STAGE_3), true);
  assert.equal(isUnitOwned(afterStage2, CAMPAIGN_UNIT_IDS.RAIDER), false);
  assert.equal(isUnitRecruitable(afterStage2, CAMPAIGN_UNIT_IDS.RAIDER), true);
  assert.deepEqual(afterStage2.completedStageIds, [STAGE_1, STAGE_2]);
});

test("Stage 4 and Stage 6 story joins are free while Stage 5 only discovers Monkey", () => {
  let save = createDefaultCampaignSave();
  for (const [index, stageId] of [STAGE_1, STAGE_2, STAGE_3].entries()) {
    save = applyStageResult(save, stageId, {
      resultId: `station-progression-prerequisite-${index + 1}`,
      won: true,
      baseHp: 100,
      baseMaxHp: 100,
    });
  }
  assert.equal(isStageUnlocked(save, STAGE_4), true);
  assert.equal(isUnitOwned(save, CAMPAIGN_UNIT_IDS.GANTETSU), false);

  const stage4 = resolveStageResult(save, STAGE_4, {
    resultId: "station-progression-stage-4",
    won: true,
    baseHp: 100,
    baseMaxHp: 100,
  });
  assert.deepEqual(stage4.result.newlyUnlockedStageIds, [STAGE_5]);
  assert.deepEqual(stage4.result.newlyUnlockedUnitIds, [CAMPAIGN_UNIT_IDS.GANTETSU]);
  assert.equal(isUnitOwned(stage4.save, CAMPAIGN_UNIT_IDS.GANTETSU), true);
  assert.equal(isUnitRecruitable(stage4.save, CAMPAIGN_UNIT_IDS.GANTETSU), false);

  const stage5 = resolveStageResult(stage4.save, STAGE_5, {
    resultId: "station-progression-stage-5",
    won: true,
    baseHp: 100,
    baseMaxHp: 100,
  });
  assert.deepEqual(stage5.result.newlyUnlockedStageIds, [STAGE_6]);
  assert.deepEqual(stage5.result.newlyUnlockedUnitIds, []);
  assert.deepEqual(stage5.result.newlyDiscoveredUnitIds, [CAMPAIGN_UNIT_IDS.MONKEY]);
  assert.equal(isUnitDiscovered(stage5.save, CAMPAIGN_UNIT_IDS.MONKEY), true);
  assert.equal(isUnitOwned(stage5.save, CAMPAIGN_UNIT_IDS.MONKEY), false);
  assert.equal(isUnitRecruitable(stage5.save, CAMPAIGN_UNIT_IDS.MONKEY), false);

  const stage6 = resolveStageResult(stage5.save, STAGE_6, {
    resultId: "station-progression-stage-6",
    won: true,
    baseHp: 100,
    baseMaxHp: 100,
  });
  assert.deepEqual(stage6.result.newlyUnlockedStageIds, []);
  assert.deepEqual(stage6.result.newlyUnlockedUnitIds, [CAMPAIGN_UNIT_IDS.MONKEY]);
  assert.equal(isUnitOwned(stage6.save, CAMPAIGN_UNIT_IDS.MONKEY), true);

  const replay = resolveStageResult(stage6.save, STAGE_4, {
    resultId: "station-progression-stage-4-replay",
    won: true,
    baseHp: 100,
    baseMaxHp: 100,
  });
  assert.deepEqual(replay.result.newlyUnlockedUnitIds, []);
  assert.equal(replay.save.ownership.filter((unitId) => unitId === CAMPAIGN_UNIT_IDS.GANTETSU).length, 1);
});

test("default save is versioned and contains initial progression, selection, and settings", () => {
  const save = createDefaultCampaignSave();
  assert.equal(save.schemaVersion, CAMPAIGN_SAVE_SCHEMA_VERSION);
  assert.equal(save.schemaVersion, 6);
  assert.equal(save.revision, 0);
  assert.equal(save.updatedAt, "");
  assert.equal(save.integrity, "");
  assert.equal(save.storyScriptVersion, "outbreak-origin-v8");
  assert.deepEqual(save.readStoryEventIds, []);
  assert.equal(save.autoSkipReadStory, false);
  assert.equal(save.campaignStarted, false);
  assert.deepEqual(save.processedResultIds, []);
  assert.deepEqual(save.processedAcquisitionIds, []);
  assert.deepEqual(save.processedUpgradeIds, []);
  assert.deepEqual(Object.values(save.unitRanks), Array(CAMPAIGN_UNITS.length).fill(0));
  assert.deepEqual(save.completedStageIds, []);
  assert.deepEqual(save.bestStarsByStage, {});
  assert.deepEqual(save.claimedStarRewardsByStage, {});
  assert.equal(save.caps, 0);
  assert.equal(save.supplies, save.caps);
  assert.deepEqual(save.unlockedStageIds, [INITIAL_STAGE_ID]);
  assert.deepEqual(save.ownership, INITIAL_UNIT_IDS);
  assert.deepEqual(save.discovery, INITIAL_UNIT_IDS);
  assert.deepEqual(save.recruitable, []);
  assert.deepEqual(save.unlockedUnitIds, save.ownership);
  assert.deepEqual(save.formationPresets.map(({ id, displayName, unitIds }) => [id, displayName, unitIds]), [
    [CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1, "部隊1", INITIAL_UNIT_IDS],
    [CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_2, "部隊2", INITIAL_UNIT_IDS],
    [CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_3, "部隊3", INITIAL_UNIT_IDS],
  ]);
  assert.equal(save.selectedFormationPresetId, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1);
  assert.equal(save.selectedPresetId, save.selectedFormationPresetId);
  assert.equal(CAMPAIGN_FORMATION_MAX_SLOTS, 7);
  assert.equal(save.lastSelectedStageId, INITIAL_STAGE_ID);
  assert.deepEqual(save.settings, {
    bgmEnabled: true,
    sfxEnabled: true,
    bgmVolume: 0.75,
    sfxVolume: 0.8,
    reducedMotion: false,
    battleEventMode: "first-time",
  });
});

test("formation presets enforce one to seven unique owned cards and convert only at the battle boundary", () => {
  const progressed = applyStageResult(createDefaultCampaignSave(), STAGE_1, {
    resultId: "formation-stage-1",
    won: true,
    baseHp: 70,
    baseMaxHp: 100,
  });
  const squad = [
    "brawler",
    CAMPAIGN_UNIT_IDS.HACHI,
    "ranger",
    CAMPAIGN_UNIT_IDS.NAO,
    "crazy-king",
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
  ];
  const updated = setFormationPresetUnits(progressed, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_2, squad);
  const selected = selectFormationPreset(updated, "部隊2");

  assert.deepEqual(getSelectedFormationUnitIds(selected), [
    CAMPAIGN_UNIT_IDS.PAISEN,
    CAMPAIGN_UNIT_IDS.HACHI,
    CAMPAIGN_UNIT_IDS.MIZUCHI,
    CAMPAIGN_UNIT_IDS.NAO,
    CAMPAIGN_UNIT_IDS.CRAZY_KING,
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
  ]);
  assert.deepEqual(getSelectedFormationCombatKinds(selected), [
    "brawler", "scout", "ranger", "medic", "crazy-king", "kumaverson", "babayaga",
  ]);
  assert.deepEqual(formationUnitIdsToCombatKinds(["unit-sensei", "unit-rokka", "unknown"]), ["medic", "gunner"]);
  assert.equal(selected.selectedFormationPresetId, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_2);
  assert.equal(selected.revision, progressed.revision + 2);
  assert.throws(
    () => setFormationPresetUnits(selected, 1, []),
    /1-7/,
  );
  assert.throws(
    () => setFormationPresetUnits(selected, 1, Array(8).fill(CAMPAIGN_UNIT_IDS.PAISEN)),
    /1-7/,
  );
  assert.throws(
    () => setFormationPresetUnits(selected, 1, ["brawler", CAMPAIGN_UNIT_IDS.PAISEN]),
    /duplicate/,
  );
  assert.throws(
    () => setFormationPresetUnits(selected, 1, [CAMPAIGN_UNIT_IDS.TATARA]),
    /not owned/,
  );
});

test("one-to-seven slot presets remain independent and survive serialization with empty slots", () => {
  let save = applyStageResult(createDefaultCampaignSave(), STAGE_1, {
    resultId: "formation-three-preset-roundtrip",
    won: true,
    baseHp: 80,
    baseMaxHp: 100,
  });
  const oneUnit = [CAMPAIGN_UNIT_IDS.PAISEN];
  const threeUnits = [
    CAMPAIGN_UNIT_IDS.HACHI,
    CAMPAIGN_UNIT_IDS.MIZUCHI,
    CAMPAIGN_UNIT_IDS.NAO,
  ];
  const sevenUnits = [
    CAMPAIGN_UNIT_IDS.PAISEN,
    CAMPAIGN_UNIT_IDS.HACHI,
    CAMPAIGN_UNIT_IDS.MIZUCHI,
    CAMPAIGN_UNIT_IDS.NAO,
    CAMPAIGN_UNIT_IDS.CRAZY_KING,
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
  ];

  save = setFormationPresetUnits(save, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1, oneUnit);
  save = setFormationPresetUnits(save, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_2, threeUnits);
  save = setFormationPresetUnits(save, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_3, sevenUnits);

  assert.deepEqual(
    selectFormationPreset(save, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1).formationPresets.map(({ unitIds }) => unitIds),
    [oneUnit, threeUnits, sevenUnits],
  );
  assert.deepEqual(
    getSelectedFormationUnitIds(selectFormationPreset(save, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1)),
    oneUnit,
  );
  assert.deepEqual(
    getSelectedFormationUnitIds(selectFormationPreset(save, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_2)),
    threeUnits,
  );
  assert.deepEqual(
    getSelectedFormationUnitIds(selectFormationPreset(save, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_3)),
    sevenUnits,
  );

  const restored = deserializeCampaignSave(serializeCampaignSave(
    selectFormationPreset(save, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_2),
  ));
  assert.deepEqual(restored.formationPresets.map(({ unitIds }) => unitIds), [oneUnit, threeUnits, sevenUnits]);
  assert.equal(restored.selectedFormationPresetId, CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_2);
});

test("migration accepts schema-less and v0 aliases, derives unlocks, and tolerates unknown fields", () => {
  const migrated = migrateCampaignSave({
    version: 0,
    clearedStages: [STAGE_1],
    stageStars: { [STAGE_1]: 2 },
    claimedStarMilestones: { [STAGE_1]: 1 },
    currency: 345.8,
    unlockedStages: [STAGE_1],
    unlockedUnits: [...INITIAL_UNIT_IDS],
    lastStageId: STAGE_2,
    options: { bgm: false, sfx: true, bgmVolume: 0.4, sfxVolume: 0.6, reducedMotion: true },
    futureUnknownField: { mustNotResetKnownProgress: true },
  });

  assert.equal(migrated.schemaVersion, CAMPAIGN_SAVE_SCHEMA_VERSION);
  assert.equal(migrated.campaignStarted, true);
  assert.deepEqual(migrated.completedStageIds, [STAGE_1]);
  assert.equal(migrated.bestStarsByStage[STAGE_1], 2);
  assert.deepEqual(migrated.claimedStarRewardsByStage[STAGE_1], [1]);
  assert.equal(migrated.caps, 345);
  assert.equal(migrated.supplies, 345);
  assert.equal(migrated.unlockedStageIds.includes(STAGE_2), true);
  assert.equal(migrated.ownership.includes(CAMPAIGN_UNIT_IDS.TATARA), true);
  assert.equal(migrated.unlockedUnitIds.includes(CAMPAIGN_UNIT_IDS.CRAZY_KING), true);
  assert.equal(migrated.storyScriptVersion, "outbreak-origin-v8");
  assert.deepEqual(migrated.readStoryEventIds, []);
  assert.equal(migrated.autoSkipReadStory, false);
  assert.equal(migrated.lastSelectedStageId, STAGE_2);
  assert.deepEqual(migrated.settings, {
    bgmEnabled: false,
    sfxEnabled: true,
    bgmVolume: 0.4,
    sfxVolume: 0.6,
    reducedMotion: true,
    battleEventMode: "first-time",
  });
});

test("migration repairs malformed fields without crashing or removing mandatory defaults", () => {
  const repaired = migrateCampaignSave({
    schemaVersion: "broken",
    completedStageIds: "not-an-array",
    bestStarsByStage: { [STAGE_1]: 99, [STAGE_2]: "bad" },
    claimedStarRewardsByStage: { [STAGE_1]: [1, 1, 7, "2"] },
    supplies: -12,
    unlockedStageIds: null,
    unlockedUnitIds: [null, "", CAMPAIGN_UNIT_IDS.PAISEN],
    lastSelectedStageId: STAGE_3,
    settings: { bgmEnabled: "yes", sfxEnabled: false, bgmVolume: 5, sfxVolume: -2 },
  });

  assert.equal(repaired.schemaVersion, CAMPAIGN_SAVE_SCHEMA_VERSION);
  assert.equal(repaired.bestStarsByStage[STAGE_1], 3);
  assert.deepEqual(repaired.claimedStarRewardsByStage[STAGE_1], [1, 2]);
  assert.equal(repaired.supplies, 0);
  assert.equal(repaired.unlockedStageIds.includes(STAGE_1), true);
  assert.deepEqual(INITIAL_UNIT_IDS.every((id) => repaired.unlockedUnitIds.includes(id)), true);
  assert.equal(repaired.lastSelectedStageId, INITIAL_STAGE_ID);
  assert.deepEqual(repaired.settings, {
    bgmEnabled: true,
    sfxEnabled: false,
    bgmVolume: 1,
    sfxVolume: 0,
    reducedMotion: false,
    battleEventMode: "first-time",
  });
});

test("schema v1 saves are treated as existing campaigns even before a clear", () => {
  const migrated = migrateCampaignSave({
    schemaVersion: 1,
    completedStageIds: [],
    bestStarsByStage: {},
    claimedStarRewardsByStage: {},
    supplies: 0,
    unlockedStageIds: [STAGE_1],
    unlockedUnitIds: [...INITIAL_UNIT_IDS],
    lastSelectedStageId: STAGE_1,
    settings: {},
  });
  assert.equal(migrated.campaignStarted, true);
});

test("schema v2 to v4 migration is idempotent and preserves progress, receipts, non-silent settings, and story preferences", () => {
  const schema2 = {
    schemaVersion: 2,
    campaignStarted: true,
    processedResultIds: ["old-result-a", "old-result-b"],
    completedStageIds: [STAGE_1, STAGE_2],
    bestStarsByStage: { [STAGE_1]: 3, [STAGE_2]: 2 },
    claimedStarRewardsByStage: { [STAGE_1]: [1, 2, 3], [STAGE_2]: [1, 2] },
    supplies: 987,
    unlockedStageIds: [STAGE_1, STAGE_2, STAGE_3],
    unlockedUnitIds: [...INITIAL_UNIT_IDS, "brute", "unit-rokka"],
    lastSelectedStageId: STAGE_3,
    settings: { bgmEnabled: false, sfxEnabled: true, bgmVolume: 0.2, sfxVolume: 0.6, reducedMotion: true },
    readStoryEventIds: ["prologue-opening", "stage-nishijin-pre", "prologue-opening"],
    autoSkipReadStory: true,
  };
  const migrated = migrateCampaignSave(schema2);

  assert.equal(migrated.schemaVersion, 6);
  assert.equal(migrated.storyScriptVersion, "outbreak-origin-v8");
  assert.deepEqual(migrated.processedResultIds, schema2.processedResultIds);
  assert.deepEqual(migrated.completedStageIds, schema2.completedStageIds);
  assert.deepEqual(migrated.bestStarsByStage, schema2.bestStarsByStage);
  assert.deepEqual(migrated.claimedStarRewardsByStage, schema2.claimedStarRewardsByStage);
  assert.equal(migrated.caps, schema2.supplies);
  assert.equal(migrated.supplies, schema2.supplies);
  assert.equal(migrated.lastSelectedStageId, schema2.lastSelectedStageId);
  assert.deepEqual(migrated.settings, { ...schema2.settings, battleEventMode: "first-time" });
  assert.deepEqual(migrated.readStoryEventIds, ["prologue-opening", "stage-nishijin-pre"]);
  assert.equal(migrated.autoSkipReadStory, true);
  assert.deepEqual(migrated.ownership, [
    CAMPAIGN_UNIT_IDS.PAISEN,
    CAMPAIGN_UNIT_IDS.HACHI,
    CAMPAIGN_UNIT_IDS.MIZUCHI,
    CAMPAIGN_UNIT_IDS.NAO,
    CAMPAIGN_UNIT_IDS.TATARA,
    CAMPAIGN_UNIT_IDS.CRAZY_KING,
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
    CAMPAIGN_UNIT_IDS.RAIDER,
  ]);
  assert.deepEqual(migrated.unlockedUnitIds, migrated.ownership);
  assert.deepEqual(migrated.recruitable, []);
  assert.equal(migrated.formationPresets.length, 3);
  assert.deepEqual(migrateCampaignSave(migrated), migrated);
});

test("v2, v3, and v4 migration preserves every formerly usable character and canonicalizes legacy formations", () => {
  for (const schemaVersion of [2, 3, 4]) {
    const migrated = migrateCampaignSave({
      schemaVersion,
      campaignStarted: true,
      completedStageIds: [STAGE_1, STAGE_2],
      bestStarsByStage: { [STAGE_1]: 2, [STAGE_2]: 1 },
      claimedStarRewardsByStage: { [STAGE_1]: [1, 2], [STAGE_2]: [1] },
      processedResultIds: [`v${schemaVersion}-receipt`],
      supplies: 432,
      unlockedUnitIds: ["brawler", "scout", "ranger", "medic", "brute", "crazy-king", "kumaverson", "babayaga", "gunner"],
      formationKinds: ["brawler", "medic", "gunner"],
    });
    assert.equal(migrated.schemaVersion, 6);
    assert.equal(migrated.caps, 432);
    assert.deepEqual(migrated.processedResultIds, [`v${schemaVersion}-receipt`]);
    for (const unitId of [
      CAMPAIGN_UNIT_IDS.PAISEN,
      CAMPAIGN_UNIT_IDS.HACHI,
      CAMPAIGN_UNIT_IDS.MIZUCHI,
      CAMPAIGN_UNIT_IDS.NAO,
      CAMPAIGN_UNIT_IDS.TATARA,
      CAMPAIGN_UNIT_IDS.CRAZY_KING,
      CAMPAIGN_UNIT_IDS.KUMAVERSON,
      CAMPAIGN_UNIT_IDS.BABAYAGA,
      CAMPAIGN_UNIT_IDS.RAIDER,
    ]) {
      assert.equal(migrated.ownership.includes(unitId), true, `v${schemaVersion} lost ${unitId}`);
    }
    assert.deepEqual(migrated.formationPresets[0].unitIds, [
      CAMPAIGN_UNIT_IDS.PAISEN,
      CAMPAIGN_UNIT_IDS.NAO,
      CAMPAIGN_UNIT_IDS.RAIDER,
    ]);
    assert.deepEqual(migrateCampaignSave(migrated), migrated);
  }
});

test("schema v3 migrates a fully silent legacy audio configuration once, while v4 preserves explicit mute", () => {
  const legacySilent = migrateCampaignSave({
    schemaVersion: 3,
    settings: { bgmEnabled: false, sfxEnabled: false, bgmVolume: 0, sfxVolume: 0 },
  });
  assert.deepEqual(legacySilent.settings, {
    bgmEnabled: true,
    sfxEnabled: true,
    bgmVolume: 0.75,
    sfxVolume: 0.8,
    reducedMotion: false,
    battleEventMode: "first-time",
  });

  const currentSilent = migrateCampaignSave({
    schemaVersion: 4,
    settings: { bgmEnabled: false, sfxEnabled: false, bgmVolume: 0, sfxVolume: 0 },
  });
  assert.deepEqual(currentSilent.settings, {
    bgmEnabled: false,
    sfxEnabled: false,
    bgmVolume: 0,
    sfxVolume: 0,
    reducedMotion: false,
    battleEventMode: "first-time",
  });
});

test("migration repairs accidentally persisted QA all-unlock flags", () => {
  const repaired = migrateCampaignSave({
    schemaVersion: 2,
    campaignStarted: true,
    completedStageIds: [],
    unlockedStageIds: CAMPAIGN_STAGES.map(({ id }) => id),
    unlockedUnitIds: CAMPAIGN_UNITS.map(({ id }) => id),
  });
  assert.deepEqual(repaired.unlockedStageIds, [STAGE_1]);
  assert.deepEqual(repaired.unlockedUnitIds, INITIAL_UNIT_IDS);
});

test("migration preserves legitimate explicit unlocks that are independent of clear history", () => {
  const migrated = migrateCampaignSave({
    schemaVersion: 2,
    campaignStarted: true,
    completedStageIds: [],
    unlockedStageIds: [STAGE_1, STAGE_2, "future-stage"],
    unlockedUnitIds: [...INITIAL_UNIT_IDS, CAMPAIGN_UNIT_IDS.TATARA, "future-unit"],
  });
  assert.deepEqual(migrated.unlockedStageIds, [STAGE_1, STAGE_2, "future-stage"]);
  assert.deepEqual(migrated.unlockedUnitIds, [
    CAMPAIGN_UNIT_IDS.PAISEN,
    CAMPAIGN_UNIT_IDS.HACHI,
    CAMPAIGN_UNIT_IDS.MIZUCHI,
    CAMPAIGN_UNIT_IDS.NAO,
    CAMPAIGN_UNIT_IDS.TATARA,
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
    "future-unit",
  ]);
});

test("explicitly versioned story receipts reset only when the script version changes", () => {
  const oldVersion = migrateCampaignSave({
    schemaVersion: 3,
    storyScriptVersion: "prologue-v4",
    readStoryEventIds: ["prologue-opening", "stage-nishijin-pre"],
  });
  assert.deepEqual(oldVersion.readStoryEventIds, []);

  const currentVersion = migrateCampaignSave({
    schemaVersion: 3,
    storyScriptVersion: "outbreak-origin-v8",
    readStoryEventIds: ["prologue-kumaya-v070"],
  });
  assert.deepEqual(currentVersion.readStoryEventIds, ["prologue-kumaya-v070"]);

  const legacyWithoutVersion = migrateCampaignSave({
    schemaVersion: 2,
    readStoryEventIds: ["prologue-opening"],
  });
  assert.deepEqual(legacyWithoutVersion.readStoryEventIds, ["prologue-opening"]);
});

test("absent and corrupted saves fall back safely", () => {
  assert.deepEqual(migrateCampaignSave(undefined), createDefaultCampaignSave());
  assert.deepEqual(migrateCampaignSave(null), createDefaultCampaignSave());
  assert.deepEqual(deserializeCampaignSave("{definitely-not-json"), createDefaultCampaignSave());
  assert.deepEqual(deserializeCampaignSave("null"), createDefaultCampaignSave());
});

test("serialization round-trips stars, rewards, unlocks, selection, and settings", () => {
  let save = applyStageResult(createDefaultCampaignSave(), STAGE_1, { resultId: "roundtrip-stage-1", won: true, baseHp: 90, baseMaxHp: 100 });
  save = selectCampaignStage(save, STAGE_2);
  const revisionBeforeSettings = save.revision;
  save = updateCampaignSettings(save, { bgmEnabled: false, sfxVolume: 0.25 });
  const serialized = serializeCampaignSave(save);
  const restored = deserializeCampaignSave(serialized);

  assert.equal(verifyCampaignSaveIntegrity(serialized), true);
  assert.deepEqual(restored, save);
  assert.equal(restored.bestStarsByStage[STAGE_1], 3);
  assert.deepEqual(restored.claimedStarRewardsByStage[STAGE_1], [1, 2, 3]);
  assert.equal(restored.unlockedStageIds.includes(STAGE_2), true);
  assert.equal(restored.ownership.includes(CAMPAIGN_UNIT_IDS.CRAZY_KING), true);
  assert.equal(restored.ownership.includes(CAMPAIGN_UNIT_IDS.TATARA), false);
  assert.equal(restored.recruitable.includes(CAMPAIGN_UNIT_IDS.TATARA), true);
  assert.equal(restored.caps, restored.supplies);
  assert.equal(restored.lastSelectedStageId, STAGE_2);
  assert.equal(restored.settings.bgmEnabled, false);
  assert.equal(restored.settings.sfxVolume, 0.25);
  assert.equal(restored.revision, revisionBeforeSettings + 1);
  assert.equal(Number.isFinite(Date.parse(restored.updatedAt)), true);
});

test("battle event mode migrates safely and round-trips without touching progress or receipts", () => {
  let progressed = applyStageResult(createDefaultCampaignSave(), STAGE_1, {
    resultId: "battle-event-mode-receipt",
    won: true,
    baseHp: 90,
    baseMaxHp: 100,
  });
  progressed = markStoryEventRead(progressed, "stage-nishijin-battle-runner");
  const compact = updateStoryPlaybackSettings(progressed, { battleEventMode: "compact" });
  const restored = deserializeCampaignSave(serializeCampaignSave(compact));

  assert.equal(restored.settings.battleEventMode, "compact");
  assert.equal(restored.supplies, progressed.supplies);
  assert.deepEqual(restored.completedStageIds, progressed.completedStageIds);
  assert.deepEqual(restored.bestStarsByStage, progressed.bestStarsByStage);
  assert.deepEqual(restored.claimedStarRewardsByStage, progressed.claimedStarRewardsByStage);
  assert.deepEqual(restored.processedResultIds, ["battle-event-mode-receipt"]);
  assert.deepEqual(restored.readStoryEventIds, ["stage-nishijin-battle-runner"]);

  const showAll = updateStoryPlaybackSettings(restored, { battleEventMode: "all" });
  assert.equal(deserializeCampaignSave(serializeCampaignSave(showAll)).settings.battleEventMode, "all");
  assert.equal(updateStoryPlaybackSettings(showAll, { battleEventMode: "invalid" }).settings.battleEventMode, "all");
  assert.equal(migrateCampaignSave({ schemaVersion: 4, settings: { battleEventMode: "invalid" } }).settings.battleEventMode, "first-time");
});

test("read tracking and read-only auto-skip preferences update without erasing campaign progress", () => {
  const progressed = applyStageResult(createDefaultCampaignSave(), STAGE_1, {
    resultId: "story-setting-progress",
    won: true,
    baseHp: 90,
    baseMaxHp: 100,
  });
  const readOnce = markStoryEventRead(progressed, "stage-nishijin-post-v070");
  const readTwice = markStoryEventRead(readOnce, "stage-nishijin-post-v070");
  const enabled = updateStoryPlaybackSettings(readTwice, { autoSkipReadStory: true, battleEventMode: "compact" });

  assert.deepEqual(readOnce.readStoryEventIds, ["stage-nishijin-post-v070"]);
  assert.deepEqual(readTwice.readStoryEventIds, readOnce.readStoryEventIds);
  assert.equal(enabled.autoSkipReadStory, true);
  assert.equal(enabled.settings.battleEventMode, "compact");
  assert.equal(enabled.storyScriptVersion, "outbreak-origin-v8");
  assert.equal(enabled.supplies, progressed.supplies);
  assert.deepEqual(enabled.processedResultIds, progressed.processedResultIds);
  assert.deepEqual(enabled.completedStageIds, progressed.completedStageIds);
});

test("starting a story is explicit and never erases existing progress", () => {
  const fresh = createDefaultCampaignSave();
  const started = markCampaignStarted(fresh);
  assert.equal(started.campaignStarted, true);
  assert.deepEqual(started.completedStageIds, []);
  const progressed = applyStageResult(started, STAGE_1, { resultId: "begin-preserves-progress", won: true, baseHp: 80, baseMaxHp: 100 });
  assert.deepEqual(markCampaignStarted(progressed), progressed);
  assert.equal(markCampaignStarted(progressed).supplies, progressed.supplies);
  assert.deepEqual(markCampaignStarted(progressed).completedStageIds, [STAGE_1]);
});

test("caps recruitment and story joins are receipt-backed, free/paid as specified, and never double-apply", () => {
  const afterStage1 = applyStageResult(createDefaultCampaignSave(), STAGE_1, {
    resultId: "recruit-stage-1",
    won: true,
    baseHp: 1,
    baseMaxHp: 100,
  });
  assert.equal(afterStage1.caps, CAMPAIGN_RECRUITMENT_COSTS[CAMPAIGN_UNIT_IDS.TATARA]);
  const recruited = recruitCampaignUnit(afterStage1, "brute", { acquisitionId: "recruit-tatara-once" });
  assert.equal(recruited.result.applied, true);
  assert.equal(recruited.result.spentCaps, 150);
  assert.equal(recruited.save.caps, 0);
  assert.equal(recruited.save.supplies, 0);
  assert.equal(isUnitOwned(recruited.save, CAMPAIGN_UNIT_IDS.TATARA), true);
  assert.equal(isUnitRecruitable(recruited.save, CAMPAIGN_UNIT_IDS.TATARA), false);
  assert.deepEqual(recruited.save.processedAcquisitionIds, ["recruit-tatara-once"]);

  const duplicateReceipt = recruitCampaignUnit(recruited.save, CAMPAIGN_UNIT_IDS.TATARA, {
    acquisitionId: "recruit-tatara-once",
  });
  assert.equal(duplicateReceipt.result.alreadyProcessed, true);
  assert.deepEqual(duplicateReceipt.save, recruited.save);
  const differentReceipt = recruitCampaignUnit(recruited.save, CAMPAIGN_UNIT_IDS.TATARA, {
    acquisitionId: "recruit-tatara-twice",
  });
  assert.equal(differentReceipt.result.alreadyOwned, true);
  assert.equal(differentReceipt.result.spentCaps, 0);
  assert.deepEqual(differentReceipt.save, recruited.save);

  const freeJoin = grantStoryCampaignUnit(recruited.save, CAMPAIGN_UNIT_IDS.GANTETSU, {
    acquisitionId: "story-gantetsu",
  });
  assert.equal(freeJoin.result.applied, true);
  assert.equal(freeJoin.result.spentCaps, 0);
  assert.equal(freeJoin.save.caps, recruited.save.caps);
  assert.equal(isUnitOwned(freeJoin.save, CAMPAIGN_UNIT_IDS.GANTETSU), true);
  const duplicateJoin = grantStoryCampaignUnit(freeJoin.save, "guardian", { acquisitionId: "story-gantetsu" });
  assert.equal(duplicateJoin.result.alreadyProcessed, true);
  assert.deepEqual(duplicateJoin.save, freeJoin.save);
});

test("recruitment rejects undiscovered or underfunded units without consuming a receipt", () => {
  const freshAttempt = recruitCampaignUnit(createDefaultCampaignSave(), CAMPAIGN_UNIT_IDS.TATARA, {
    acquisitionId: "too-early",
  });
  assert.equal(freshAttempt.result.reason, "not-recruitable");
  assert.deepEqual(freshAttempt.save.processedAcquisitionIds, []);

  const afterStage1 = applyStageResult(createDefaultCampaignSave(), STAGE_1, {
    resultId: "underfunded-stage-1",
    won: true,
    baseHp: 1,
    baseMaxHp: 100,
  });
  const underfunded = recruitCampaignUnit({ ...afterStage1, caps: 149, supplies: 149 }, CAMPAIGN_UNIT_IDS.TATARA, {
    acquisitionId: "underfunded-tatara",
  });
  assert.equal(underfunded.result.reason, "insufficient-caps");
  assert.equal(underfunded.save.caps, 149);
  assert.deepEqual(underfunded.save.processedAcquisitionIds, []);
  assert.throws(
    () => recruitCampaignUnit(afterStage1, CAMPAIGN_UNIT_IDS.TATARA, {}),
    /acquisitionId/,
  );
});

test("save integrity stamps canonical v5 data and strict inspection distinguishes missing, legacy, valid, and corrupt", () => {
  const save = applyStageResult(createDefaultCampaignSave(), STAGE_1, {
    resultId: "integrity-stage-1",
    won: true,
    baseHp: 90,
    baseMaxHp: 100,
  });
  const stamped = withCampaignSaveIntegrity(save);
  assert.equal(stamped.integrity, computeCampaignSaveIntegrity(save));
  assert.equal(verifyCampaignSaveIntegrity(stamped), true);
  assert.equal(save.integrity, "");

  const serialized = JSON.stringify(stamped);
  const valid = inspectCampaignSaveCandidate(serialized, { source: "local" });
  assert.equal(valid.status, "valid");
  assert.equal(valid.source, "local");
  assert.equal(valid.reason, "verified");
  assert.deepEqual(valid.save, save);
  assert.equal(valid.revision, save.revision);

  const tampered = JSON.stringify({ ...stamped, caps: stamped.caps + 1 });
  assert.equal(verifyCampaignSaveIntegrity(tampered), false);
  assert.equal(inspectCampaignSaveCandidate(tampered).status, "corrupt");
  assert.equal(inspectCampaignSaveCandidate(tampered).reason, "integrity-mismatch");
  assert.equal(inspectCampaignSaveCandidate("").status, "missing");
  assert.equal(inspectCampaignSaveCandidate("{bad").reason, "invalid-json");

  const legacy = inspectCampaignSaveCandidate(JSON.stringify({
    schemaVersion: 4,
    campaignStarted: true,
    processedResultIds: ["legacy-result"],
    completedStageIds: [STAGE_1],
    bestStarsByStage: { [STAGE_1]: 2 },
    claimedStarRewardsByStage: { [STAGE_1]: [1, 2] },
    supplies: 77,
    unlockedStageIds: [STAGE_1, STAGE_2],
    unlockedUnitIds: ["medic", "gunner"],
    lastSelectedStageId: STAGE_2,
    settings: {},
  }));
  assert.equal(legacy.status, "valid");
  assert.equal(legacy.reason, "migrated");
  assert.equal(legacy.save.caps, 77);
  assert.equal(legacy.save.ownership.includes(CAMPAIGN_UNIT_IDS.NAO), true);
  assert.equal(legacy.save.ownership.includes(CAMPAIGN_UNIT_IDS.RAIDER), true);
});

test("strict save inspection accepts complete v0 and v2-v4 fingerprints but rejects truncated or foreign JSON", () => {
  const versionedFixture = (schemaVersion) => ({
    schemaVersion,
    campaignStarted: true,
    processedResultIds: [`v${schemaVersion}-result`],
    completedStageIds: [STAGE_1],
    bestStarsByStage: { [STAGE_1]: 2 },
    claimedStarRewardsByStage: { [STAGE_1]: [1, 2] },
    supplies: 432,
    unlockedStageIds: [STAGE_1, STAGE_2],
    unlockedUnitIds: [...INITIAL_UNIT_IDS, "brute"],
    lastSelectedStageId: STAGE_2,
    settings: { bgmEnabled: true, sfxEnabled: true },
  });

  for (const schemaVersion of [2, 3, 4]) {
    const inspected = inspectCampaignSaveCandidate(JSON.stringify(versionedFixture(schemaVersion)));
    assert.equal(inspected.status, "valid", `v${schemaVersion} should be recognized`);
    assert.equal(inspected.reason, "migrated");
    assert.equal(inspected.sourceSchemaVersion, schemaVersion);
  }

  const v0 = inspectCampaignSaveCandidate(JSON.stringify({
    version: 0,
    clearedStages: [STAGE_1],
    stageStars: { [STAGE_1]: 2 },
    claimedStarMilestones: { [STAGE_1]: [1, 2] },
    currency: 345,
    unlockedStages: [STAGE_1, STAGE_2],
    unlockedUnits: [...INITIAL_UNIT_IDS],
    lastStageId: STAGE_2,
    options: { bgm: true, sfx: true },
  }));
  assert.equal(v0.status, "valid");
  assert.equal(v0.sourceSchemaVersion, 0);

  for (const candidate of [
    {},
    { foo: "bar" },
    { version: 0 },
    { schemaVersion: 4 },
    { schemaVersion: 4, settings: {} },
    { schemaVersion: 4, caps: "bad", unlockedUnitIds: [] },
  ]) {
    const inspected = inspectCampaignSaveCandidate(JSON.stringify(candidate));
    assert.equal(inspected.status, "corrupt", JSON.stringify(candidate));
    assert.equal(inspected.reason, "unrecognized-legacy-shape", JSON.stringify(candidate));
  }

  assert.equal(
    inspectCampaignSaveCandidate(JSON.stringify({ ...versionedFixture(4), schemaVersion: "4" })).reason,
    "invalid-schema",
  );
});

test("the same result receipt applies rewards, stars, and unlocks exactly once", () => {
  const input = {
    resultId: "receipt-stage-1-clear",
    stageId: STAGE_1,
    won: true,
    baseHp: 95,
    baseMaxHp: 100,
  };
  const first = resolveStageResult(createDefaultCampaignSave(), input);
  const snapshot = JSON.stringify(first.save);
  const duplicate = resolveStageResult(first.save, input);

  assert.equal(first.result.applied, true);
  assert.equal(first.result.alreadyProcessed, false);
  assert.deepEqual(first.result.newlyUnlockedStageIds, [STAGE_2]);
  assert.deepEqual(first.result.newlyUnlockedUnitIds, [CAMPAIGN_UNIT_IDS.CRAZY_KING]);
  assert.deepEqual(first.result.newlyOwnedUnitIds, [CAMPAIGN_UNIT_IDS.CRAZY_KING]);
  assert.deepEqual(first.result.newlyDiscoveredUnitIds, [CAMPAIGN_UNIT_IDS.TATARA, CAMPAIGN_UNIT_IDS.CRAZY_KING]);
  assert.deepEqual(first.result.newlyRecruitableUnitIds, [CAMPAIGN_UNIT_IDS.TATARA]);
  assert.equal(first.result.totalReward > 0, true);
  assert.deepEqual(first.save.processedResultIds, [input.resultId]);

  assert.equal(duplicate.result.applied, false);
  assert.equal(duplicate.result.alreadyProcessed, true);
  assert.equal(duplicate.result.replayReward, 0);
  assert.equal(duplicate.result.firstTimeStarReward, 0);
  assert.equal(duplicate.result.totalReward, 0);
  assert.deepEqual(duplicate.result.newlyUnlockedStageIds, []);
  assert.deepEqual(duplicate.result.newlyUnlockedUnitIds, []);
  assert.deepEqual(duplicate.result.newlyRecruitableUnitIds, []);
  assert.equal(JSON.stringify(duplicate.save), snapshot);
});

test("a persisted receipt remains idempotent after serialization and more than 200 later battles", () => {
  const firstInput = { resultId: "receipt-never-expires", stageId: STAGE_1, won: true, baseHp: 80, baseMaxHp: 100 };
  let save = resolveStageResult(createDefaultCampaignSave(), firstInput).save;
  for (let index = 0; index < 205; index += 1) {
    save = resolveStageResult(save, {
      resultId: `later-battle-${index}`,
      stageId: STAGE_1,
      won: true,
      baseHp: 80,
      baseMaxHp: 100,
    }).save;
  }
  const restored = deserializeCampaignSave(serializeCampaignSave(save));
  const duplicate = resolveStageResult(restored, firstInput);
  assert.equal(restored.processedResultIds.length, 206);
  assert.equal(duplicate.result.alreadyProcessed, true);
  assert.equal(duplicate.result.totalReward, 0);
  assert.deepEqual(duplicate.save, restored);
});

test("a new receipt on a legitimate replay still awards only the normal replay reward", () => {
  const first = resolveStageResult(createDefaultCampaignSave(), {
    resultId: "legitimate-replay-a", stageId: STAGE_1, won: true, baseHp: 95, baseMaxHp: 100,
  });
  const replay = resolveStageResult(first.save, {
    resultId: "legitimate-replay-b", stageId: STAGE_1, won: true, baseHp: 95, baseMaxHp: 100,
  });
  assert.equal(replay.result.applied, true);
  assert.equal(replay.result.firstTimeStarReward, 0);
  assert.equal(replay.result.replayReward, 150);
  assert.equal(replay.save.supplies, first.save.supplies + 150);
});

test("missing result receipts are rejected before campaign progress can change", () => {
  assert.throws(
    () => resolveStageResult(createDefaultCampaignSave(), { stageId: STAGE_1, won: true, baseHp: 100, baseMaxHp: 100 }),
    /resultId/,
  );
});
