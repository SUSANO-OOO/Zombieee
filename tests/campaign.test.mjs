import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_CHARACTERS,
  CAMPAIGN_GUIDE,
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
  calculateStageRewards,
  calculateStageStars,
  createDefaultCampaignSave,
  deserializeCampaignSave,
  isStageUnlocked,
  isUnitUnlocked,
  markStoryEventRead,
  markCampaignStarted,
  migrateCampaignSave,
  resolveStageResult,
  selectCampaignStage,
  serializeCampaignSave,
  updateCampaignSettings,
  updateStoryPlaybackSettings,
} from "../app/campaign.js";

const STAGE_1 = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
const STAGE_2 = CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE;
const STAGE_3 = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;

test("campaign defines three stable, ordered, data-driven stages", () => {
  assert.equal(CAMPAIGN_STAGES.length, 3);
  assert.deepEqual(CAMPAIGN_STAGES.map((stage) => stage.id), [STAGE_1, STAGE_2, STAGE_3]);
  assert.deepEqual(CAMPAIGN_STAGES.map((stage) => stage.displayName), [
    "西新商店街",
    "早良区役所",
    "西新防衛線・TAKUYA",
  ]);
  assert.equal(new Set(CAMPAIGN_STAGES.map((stage) => stage.id)).size, 3);

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
    assert.equal(stage.baseHp > 0, true);
    assert.deepEqual(stage.starThresholds, DEFAULT_STAR_THRESHOLDS);
    assert.deepEqual(stage.replayRewardMultipliers, DEFAULT_REPLAY_REWARD_MULTIPLIERS);
    assert.equal(stage.baseReward, PROVISIONAL_BASE_REWARDS[stage.id]);
    assert.deepEqual(Object.values(stage.firstTimeStarRewards), Array(3).fill(stage.baseReward * 0.5));
    assert.equal(typeof stage.preBattleEventId, "string");
    assert.equal(typeof stage.postBattleEventId, "string");
    assert.equal(Array.isArray(stage.nextUnlocks.stageIds), true);
    assert.equal(Array.isArray(stage.nextUnlocks.unitIds), true);
    assert.equal(Array.isArray(stage.nextUnlocks.mapSignalIds), true);
  }
  assert.deepEqual(CAMPAIGN_STAGES.map((stage) => stage.theme.backgroundId), [
    "background-nishijin-shopping-street-v1",
    "background-sawara-ward-office-v1",
    "background-nishijin-defense-line-v1",
  ]);
});

test("each stage has a unique multi-layer visual signature", () => {
  assert.deepEqual(Object.keys(STAGE_VISUAL_SIGNATURES).sort(), [STAGE_1, STAGE_2, STAGE_3].sort());
  const signatures = Object.values(STAGE_VISUAL_SIGNATURES);
  assert.equal(new Set(signatures.map(({ kind }) => kind)).size, 3);
  for (const signature of signatures) {
    assert.equal(typeof signature.background, "string");
    assert.equal(typeof signature.landmark, "string");
    assert.equal(signature.environment.length >= 2, true);
    assert.equal(typeof signature.lighting, "string");
    assert.equal(signature.battleScars.length >= 1, true);
  }
});

test("stage objectives, prerequisites, defense duration, boss, and future signal match the mission", () => {
  const shoppingStreet = CAMPAIGN_STAGE_BY_ID[STAGE_1];
  const wardOffice = CAMPAIGN_STAGE_BY_ID[STAGE_2];
  const defenseLine = CAMPAIGN_STAGE_BY_ID[STAGE_3];

  assert.equal(shoppingStreet.objective, "感染拠点を破壊");
  assert.deepEqual(shoppingStreet.prerequisiteStageIds, []);
  assert.deepEqual(shoppingStreet.nextUnlocks.stageIds, [STAGE_2]);
  assert.deepEqual(shoppingStreet.nextUnlocks.unitIds, [CAMPAIGN_UNIT_IDS.OBA_GO, CAMPAIGN_UNIT_IDS.CRAZY_KING]);

  assert.equal(wardOffice.missionType, "timed-defense");
  assert.equal(wardOffice.objectiveConfig.durationSeconds, 180);
  assert.deepEqual(wardOffice.prerequisiteStageIds, [STAGE_1]);
  assert.deepEqual(wardOffice.nextUnlocks.stageIds, [STAGE_3]);
  assert.deepEqual(wardOffice.nextUnlocks.unitIds, [
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
    CAMPAIGN_UNIT_IDS.MAKABE_REINA,
  ]);

  assert.equal(defenseLine.boss.id, "boss-takuya");
  assert.equal(defenseLine.boss.displayName, "TAKUYA");
  assert.match(defenseLine.objective, /TAKUYA.*感染拠点/);
  assert.deepEqual(defenseLine.prerequisiteStageIds, [STAGE_2]);
  assert.deepEqual(defenseLine.nextUnlocks.mapSignalIds, ["map-signal-momochihama-anomaly"]);
  assert.equal(defenseLine.waves.length, 12);
  assert.deepEqual(defenseLine.waves.map(({ atSeconds }) => atSeconds), [0, 15, 37, 55, 75, 98, 118, 137, 143, 163, 183, 215]);
  assert.equal(defenseLine.waves.find(({ waveNumber }) => waveNumber === 8).units.some(([kind]) => kind === "takuya"), true);
});

test("nine stable combat units and the non-combat guide use Japanese player-facing data", () => {
  assert.equal(CAMPAIGN_UNITS.length, 9);
  assert.equal(CAMPAIGN_CHARACTERS.length, 10);
  assert.deepEqual(INITIAL_UNIT_IDS, [
    CAMPAIGN_UNIT_IDS.PAISEN,
    CAMPAIGN_UNIT_IDS.TACHIBANA_JIN,
    CAMPAIGN_UNIT_IDS.KUROKI_RIN,
    CAMPAIGN_UNIT_IDS.SHIRAISHI_NAOTO,
  ]);
  assert.deepEqual(
    CAMPAIGN_UNITS.map(({ displayName, roleName }) => [displayName, roleName]),
    [
      ["パイセン", "格闘家"],
      ["橘 迅", "遊撃手"],
      ["黒木 凛", "射撃手"],
      ["白石 直人", "衛生兵"],
      ["大庭 豪", "破砕兵"],
      ["クレイジーキング", "狂戦士"],
      ["クマバーソン", "前衛打撃"],
      ["ババヤガ", "精密射手"],
      ["真壁 玲奈", "制圧射手"],
    ],
  );
  assert.equal(CAMPAIGN_UNIT_BY_ID.brawler.displayName, "パイセン");
  assert.equal(CAMPAIGN_UNIT_BY_ID.brawler.roleName, "格闘家");
  assert.deepEqual(CAMPAIGN_UNIT_BY_ID.brute.unlock, { type: "stage-clear", stageId: STAGE_1 });
  assert.deepEqual(CAMPAIGN_UNIT_BY_ID["crazy-king"].unlock, { type: "stage-clear", stageId: STAGE_1 });
  assert.deepEqual(CAMPAIGN_UNIT_BY_ID.kumaverson.unlock, { type: "stage-clear", stageId: STAGE_2 });
  assert.deepEqual(CAMPAIGN_UNIT_BY_ID.babayaga.unlock, { type: "stage-clear", stageId: STAGE_2 });
  assert.deepEqual(CAMPAIGN_UNIT_BY_ID.gunner.unlock, { type: "stage-clear", stageId: STAGE_2 });
  assert.equal(CAMPAIGN_GUIDE.displayName, "水城 奈々");
  assert.equal(CAMPAIGN_GUIDE.roleName, "通信・地図・情報分析");
  assert.equal(CAMPAIGN_GUIDE.combatant, false);
});

test("all nine units expose Japanese role, weapon, range, target, deployment, and audited sprite metadata", () => {
  const expected = {
    brawler: ["パイセン", "格闘家", "拳", "素手", "連続打撃", "近距離", "前線の感染者", "先頭で敵を押し返す", "/brawler-sprites-v1.png"],
    scout: ["橘 迅", "遊撃手", "速", "バール", "高速接近・打撃", "近距離", "走行型・影走り", "敵の薄い経路へ素早く投入", "/scout-sprites-v2.png"],
    ranger: ["黒木 凛", "射撃手", "狙", "自動小銃", "遠距離精密射撃", "遠距離", "吐瀉型・大型", "後列から危険個体を狙う", "/ranger-sprites-v1.png"],
    medic: ["白石 直人", "衛生兵", "救", "自動小銃・救急バッグ", "援護射撃・味方治療", "中距離", "負傷した味方", "味方の後方へ配備", "/medic-sprites-v1.png"],
    brute: ["大庭 豪", "破砕兵", "砕", "大型ハンマー", "重打撃", "近距離", "重装型・感染拠点", "前線の要所へ配備", "/breaker-sprites-v2.png"],
    "crazy-king": ["クレイジーキング", "狂戦士", "鋸", "チェーンソー", "範囲斬撃・押し返し", "近距離", "密集群・感染拠点", "密集した前線へ投入", "/art/v060/characters/crazy-king-battle-v1.png"],
    kumaverson: ["クマバーソン", "前衛打撃", "鍋", "フライパン", "打撃・足止め", "近距離", "重装型・前線の感染者", "前線へ投入して敵を足止め", "/art/v060/characters/kumaverson-battle-v1.png"],
    babayaga: ["ババヤガ", "精密射手", "精", "サプレッサー付き拳銃", "精密射撃・特殊個体排除", "中～遠距離", "特殊個体・危険個体", "危険個体を狙える後列へ配備", "/art/v060/characters/babayaga-battle-v1.png"],
    gunner: ["真壁 玲奈", "制圧射手", "制", "自動小銃", "制圧連射", "中～遠距離", "大型・密集群", "火線を通せる後列へ配備", "/gunner-sprites-v1.png"],
  };

  for (const unit of CAMPAIGN_UNITS) {
    assert.deepEqual([
      unit.displayName,
      unit.roleName,
      unit.roleIcon,
      unit.weaponName,
      unit.attackMode,
      unit.rangeBand,
      unit.primaryTarget,
      unit.deploymentHint,
      unit.spritePath,
    ], expected[unit.combatKind]);
    assert.match(unit.appearanceAudit.presentation, /表現/);
    assert.ok(unit.appearanceAudit.weaponMatch.length > 0);
    assert.match(unit.appearanceAudit.result, /整合/);
    assert.doesNotMatch(Object.values(unit).filter((value) => typeof value === "string").join(" "), /暫定|SCOUT|RANGER|BREAKER|BRAWLER|GUNNER|MEDIC/);
  }

  assert.equal(CAMPAIGN_UNIT_BY_ID.brawler.weaponName, "素手");
  assert.equal(CAMPAIGN_UNIT_BY_ID.brawler.spritePath, "/brawler-sprites-v1.png");
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

test("stage clears unlock the next stage and the specified units in order", () => {
  const initial = createDefaultCampaignSave();
  assert.deepEqual(initial.unlockedStageIds, [STAGE_1]);
  assert.equal(isStageUnlocked(initial, STAGE_2), false);
  assert.equal(isUnitUnlocked(initial, CAMPAIGN_UNIT_IDS.OBA_GO), false);
  assert.equal(isUnitUnlocked(initial, CAMPAIGN_UNIT_IDS.CRAZY_KING), false);

  const afterStage1 = applyStageResult(initial, STAGE_1, { resultId: "unlock-stage-1", won: true, baseHp: 70, baseMaxHp: 100 });
  assert.equal(isStageUnlocked(afterStage1, STAGE_2), true);
  assert.equal(isStageUnlocked(afterStage1, STAGE_3), false);
  assert.equal(isUnitUnlocked(afterStage1, CAMPAIGN_UNIT_IDS.OBA_GO), true);
  assert.equal(isUnitUnlocked(afterStage1, CAMPAIGN_UNIT_IDS.CRAZY_KING), true);
  assert.equal(isUnitUnlocked(afterStage1, CAMPAIGN_UNIT_IDS.KUMAVERSON), false);
  assert.equal(isUnitUnlocked(afterStage1, CAMPAIGN_UNIT_IDS.BABAYAGA), false);
  assert.equal(isUnitUnlocked(afterStage1, CAMPAIGN_UNIT_IDS.MAKABE_REINA), false);

  const afterStage2 = applyStageResult(afterStage1, STAGE_2, { resultId: "unlock-stage-2", won: true, baseHp: 1, baseMaxHp: 100 });
  assert.equal(isStageUnlocked(afterStage2, STAGE_3), true);
  assert.equal(isUnitUnlocked(afterStage2, CAMPAIGN_UNIT_IDS.KUMAVERSON), true);
  assert.equal(isUnitUnlocked(afterStage2, CAMPAIGN_UNIT_IDS.BABAYAGA), true);
  assert.equal(isUnitUnlocked(afterStage2, CAMPAIGN_UNIT_IDS.MAKABE_REINA), true);
  assert.deepEqual(afterStage2.completedStageIds, [STAGE_1, STAGE_2]);
});

test("default save is versioned and contains initial progression, selection, and settings", () => {
  const save = createDefaultCampaignSave();
  assert.equal(save.schemaVersion, CAMPAIGN_SAVE_SCHEMA_VERSION);
  assert.equal(save.storyScriptVersion, "prologue-v5");
  assert.deepEqual(save.readStoryEventIds, []);
  assert.equal(save.autoSkipReadStory, false);
  assert.equal(save.campaignStarted, false);
  assert.deepEqual(save.processedResultIds, []);
  assert.deepEqual(save.completedStageIds, []);
  assert.deepEqual(save.bestStarsByStage, {});
  assert.deepEqual(save.claimedStarRewardsByStage, {});
  assert.equal(save.supplies, 0);
  assert.deepEqual(save.unlockedStageIds, [INITIAL_STAGE_ID]);
  assert.deepEqual(save.unlockedUnitIds, INITIAL_UNIT_IDS);
  assert.equal(save.lastSelectedStageId, INITIAL_STAGE_ID);
  assert.deepEqual(save.settings, {
    bgmEnabled: true,
    sfxEnabled: true,
    bgmVolume: 0.75,
    sfxVolume: 0.8,
    reducedMotion: false,
  });
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
  assert.equal(migrated.supplies, 345);
  assert.equal(migrated.unlockedStageIds.includes(STAGE_2), true);
  assert.equal(migrated.unlockedUnitIds.includes(CAMPAIGN_UNIT_IDS.OBA_GO), true);
  assert.equal(migrated.unlockedUnitIds.includes(CAMPAIGN_UNIT_IDS.CRAZY_KING), true);
  assert.equal(migrated.storyScriptVersion, "prologue-v5");
  assert.deepEqual(migrated.readStoryEventIds, []);
  assert.equal(migrated.autoSkipReadStory, false);
  assert.equal(migrated.lastSelectedStageId, STAGE_2);
  assert.deepEqual(migrated.settings, {
    bgmEnabled: false,
    sfxEnabled: true,
    bgmVolume: 0.4,
    sfxVolume: 0.6,
    reducedMotion: true,
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

test("schema v2 to v3 migration is idempotent and preserves progress, receipts, settings, and story preferences", () => {
  const schema2 = {
    schemaVersion: 2,
    campaignStarted: true,
    processedResultIds: ["old-result-a", "old-result-b"],
    completedStageIds: [STAGE_1, STAGE_2],
    bestStarsByStage: { [STAGE_1]: 3, [STAGE_2]: 2 },
    claimedStarRewardsByStage: { [STAGE_1]: [1, 2, 3], [STAGE_2]: [1, 2] },
    supplies: 987,
    unlockedStageIds: [STAGE_1, STAGE_2, STAGE_3],
    unlockedUnitIds: [...INITIAL_UNIT_IDS, CAMPAIGN_UNIT_IDS.OBA_GO, CAMPAIGN_UNIT_IDS.MAKABE_REINA],
    lastSelectedStageId: STAGE_3,
    settings: { bgmEnabled: false, sfxEnabled: true, bgmVolume: 0.2, sfxVolume: 0.6, reducedMotion: true },
    readStoryEventIds: ["prologue-opening", "stage-nishijin-pre", "prologue-opening"],
    autoSkipReadStory: true,
  };
  const migrated = migrateCampaignSave(schema2);

  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.storyScriptVersion, "prologue-v5");
  assert.deepEqual(migrated.processedResultIds, schema2.processedResultIds);
  assert.deepEqual(migrated.completedStageIds, schema2.completedStageIds);
  assert.deepEqual(migrated.bestStarsByStage, schema2.bestStarsByStage);
  assert.deepEqual(migrated.claimedStarRewardsByStage, schema2.claimedStarRewardsByStage);
  assert.equal(migrated.supplies, schema2.supplies);
  assert.equal(migrated.lastSelectedStageId, schema2.lastSelectedStageId);
  assert.deepEqual(migrated.settings, schema2.settings);
  assert.deepEqual(migrated.readStoryEventIds, ["prologue-opening", "stage-nishijin-pre"]);
  assert.equal(migrated.autoSkipReadStory, true);
  assert.deepEqual(migrated.unlockedUnitIds, [
    ...INITIAL_UNIT_IDS,
    CAMPAIGN_UNIT_IDS.OBA_GO,
    CAMPAIGN_UNIT_IDS.CRAZY_KING,
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
    CAMPAIGN_UNIT_IDS.MAKABE_REINA,
  ]);
  assert.deepEqual(migrateCampaignSave(migrated), migrated);
});

test("migration repairs accidentally persisted QA all-unlock flags", () => {
  const repaired = migrateCampaignSave({
    schemaVersion: 2,
    campaignStarted: true,
    completedStageIds: [],
    unlockedStageIds: [STAGE_1, STAGE_2, STAGE_3],
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
    unlockedUnitIds: [...INITIAL_UNIT_IDS, CAMPAIGN_UNIT_IDS.OBA_GO, "future-unit"],
  });
  assert.deepEqual(migrated.unlockedStageIds, [STAGE_1, STAGE_2, "future-stage"]);
  assert.deepEqual(migrated.unlockedUnitIds, [...INITIAL_UNIT_IDS, CAMPAIGN_UNIT_IDS.OBA_GO, "future-unit"]);
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
    storyScriptVersion: "prologue-v5",
    readStoryEventIds: ["prologue-opening"],
  });
  assert.deepEqual(currentVersion.readStoryEventIds, ["prologue-opening"]);

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
  save = updateCampaignSettings(save, { bgmEnabled: false, sfxVolume: 0.25 });
  const serialized = serializeCampaignSave(save);
  const restored = deserializeCampaignSave(serialized);

  assert.deepEqual(restored, save);
  assert.equal(restored.bestStarsByStage[STAGE_1], 3);
  assert.deepEqual(restored.claimedStarRewardsByStage[STAGE_1], [1, 2, 3]);
  assert.equal(restored.unlockedStageIds.includes(STAGE_2), true);
  assert.equal(restored.unlockedUnitIds.includes(CAMPAIGN_UNIT_IDS.OBA_GO), true);
  assert.equal(restored.lastSelectedStageId, STAGE_2);
  assert.equal(restored.settings.bgmEnabled, false);
  assert.equal(restored.settings.sfxVolume, 0.25);
});

test("read tracking and read-only auto-skip preferences update without erasing campaign progress", () => {
  const progressed = applyStageResult(createDefaultCampaignSave(), STAGE_1, {
    resultId: "story-setting-progress",
    won: true,
    baseHp: 90,
    baseMaxHp: 100,
  });
  const readOnce = markStoryEventRead(progressed, "stage-nishijin-post");
  const readTwice = markStoryEventRead(readOnce, "stage-nishijin-post");
  const enabled = updateStoryPlaybackSettings(readTwice, { autoSkipReadStory: true });

  assert.deepEqual(readOnce.readStoryEventIds, ["stage-nishijin-post"]);
  assert.deepEqual(readTwice.readStoryEventIds, readOnce.readStoryEventIds);
  assert.equal(enabled.autoSkipReadStory, true);
  assert.equal(enabled.storyScriptVersion, "prologue-v5");
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
  assert.deepEqual(first.result.newlyUnlockedUnitIds, [CAMPAIGN_UNIT_IDS.OBA_GO, CAMPAIGN_UNIT_IDS.CRAZY_KING]);
  assert.equal(first.result.totalReward > 0, true);
  assert.deepEqual(first.save.processedResultIds, [input.resultId]);

  assert.equal(duplicate.result.applied, false);
  assert.equal(duplicate.result.alreadyProcessed, true);
  assert.equal(duplicate.result.replayReward, 0);
  assert.equal(duplicate.result.firstTimeStarReward, 0);
  assert.equal(duplicate.result.totalReward, 0);
  assert.deepEqual(duplicate.result.newlyUnlockedStageIds, []);
  assert.deepEqual(duplicate.result.newlyUnlockedUnitIds, []);
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
