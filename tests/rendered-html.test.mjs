import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  AIRSTRIKE_DEF,
  BARRICADE_MAX_HP,
  BATTLEFIELD_SUPPLY_DEFS,
  CAMERA_SHAKE_EVENTS,
  COMMAND_MAX,
  COMMAND_REGEN,
  CONTAINER_DEF,
  CRAWLER_BARRAGE_DEF,
  FIELD_OBJECT_CLEARANCE,
  LANE_NAMES,
  LANE_Y,
  MISSION_EVENTS,
  PREP_SECONDS,
  RAGE_MAX,
  RENDER_ARRAY_LIMITS,
  SUPPORT_GAUGE_MAX,
  SUPPORT_DEFS,
  TACTIC_MODES,
  UNIT_CARDS,
  WORLD_GEOMETRY,
  advanceAreaEffects,
  advanceBattlefieldSupply,
  advanceCrawlerAbilityRuntime,
  advanceEmergencySupportRuntime,
  advanceZombieX,
  advanceCommand,
  advanceLimitFor,
  applyBattlefieldSupplyDamage,
  applyContainerDamage,
  autonomousTargetScore,
  barricadeState,
  battleOutcome,
  battlefieldSupplyPlacementCheck,
  canDeploy,
  capRenderArray,
  containerBlocksEnemy,
  containerPlacementCheck,
  createCrawlerAbilityRuntime,
  createEmergencySupportRuntime,
  crawlerSiegeDamage,
  crawlerThreatLevel,
  damageContainer,
  enemyCanTargetBattlefieldSupply,
  humanAttackMultiplier,
  isBrawlerFinisher,
  interceptorTargetScore,
  isCrawlerRouteBlocker,
  laneForY,
  objectiveFor,
  phaseAt,
  rageReward,
  requestAirstrike,
  requestCrawlerBarrage,
  requestDrumDetonation,
  resolveAirstrikeImpact,
  resolveBattlefieldSupplyLanding,
  resolveBattlefieldSupplyPlacement,
  resolveContainerPlacement,
  resolveContainerLanding,
  resolveCrawlerBarrage,
  resolveDrumDetonation,
  resolveFieldSupportPlacement,
  roleTargetBias,
  selectBlockingContainer,
  structureDamageMultiplier,
  supportGaugeReward,
  tacticTargetBias,
} from "../app/gameRules.js";
import {
  APPROVED_BATTLE_BARK_LINES,
  BATTLE_BARK_CONFIG,
  LOCAL_QA_BATTLE_BARK_LINES,
  advanceBattleBarkRuntime,
  battleBarkPassesProbability,
  createBattleBarkRuntime,
  queueBattleBark,
} from "../app/battleBarks.js";
import { LOCAL_QA_MODES, resolveLocalQaMode } from "../app/localQa.js";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function assertClose(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not close to ${expected}`);
}

test("server-renders the Ashfall Outpost Early Access 0.5.0 boss-stage loadout", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>ASHFALL OUTPOST — Early Access 0\.5\.0/);
  assert.match(html, /aria-label="ASHFALL OUTPOST game"/);
  assert.match(html, /<canvas[^>]*width="960"[^>]*height="540"/);
  assert.match(html, /aria-label="Three-lane wasteland battlefield"/);
  assert.match(html, /BOSS STAGE LOADOUT · EARLY ACCESS 0\.5\.0/);
  assert.match(html, /6名の役割と戦場物資/);
  assert.match(html, /戦場物資を1つ選択/);
  assert.match(html, /戦術投下ポッド/);
  assert.match(html, /爆薬ドラム/);
  assert.match(html, /救急物資/);
  assert.match(html, /緊急航空支援/);
  assert.match(html, /CRAWLER一斉掃射/);
  assert.match(html, />方針</);
  assert.match(html, /TAKUYA/);
  assert.match(html, /アセット準備中/);
  assert.match(html, /CRAWLER SYSTEM CHECK/);
  assert.match(html, />BGM</);
  assert.match(html, />SFX</);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships the three-route infected checkpoint, mobile fortress, and dedicated battlefield-supply artwork", async () => {
  const [game, rules, css, layout] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/gameRules.js", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  await Promise.all([
    access(new URL("../public/battlefield-v4.png", import.meta.url)),
    access(new URL("../public/infected-checkpoint-v1.png", import.meta.url)),
    access(new URL("../public/crawler-fortress-v1.png", import.meta.url)),
    access(new URL("../public/takuya-boss-sprites-v2.png", import.meta.url)),
    access(new URL("../public/ranger-sprites-v1.png", import.meta.url)),
    access(new URL("../public/brawler-sprites-v1.png", import.meta.url)),
    access(new URL("../public/scout-sprites-v2.png", import.meta.url)),
    access(new URL("../public/breaker-sprites-v2.png", import.meta.url)),
    access(new URL("../public/gunner-sprites-v1.png", import.meta.url)),
    access(new URL("../public/medic-sprites-v1.png", import.meta.url)),
    access(new URL("../public/tactical-drop-pod-v1.png", import.meta.url)),
    access(new URL("../public/explosive-drum-v1.png", import.meta.url)),
    access(new URL("../public/medical-supply-station-v1.png", import.meta.url)),
  ]);

  assert.match(game, /loadImage\("\/infected-checkpoint-v1\.png"/);
  assert.match(game, /crawler: "\/crawler-fortress-v1\.png"/);
  assert.match(game, /pod: "\/tactical-drop-pod-v1\.png"/);
  assert.match(game, /drum: "\/explosive-drum-v1\.png"/);
  assert.match(game, /medical: "\/medical-supply-station-v1\.png"/);
  assert.match(game, /drawBattlefieldSupply\(ctx, renderable\.object, sprites\)/);
  assert.match(game, /function drawEnemyBase/);
  assert.match(game, /infected checkpoint closes all three routes/);
  assert.match(game, /barricadeHp: number/);
  assert.match(game, /barricadeHp: BARRICADE_MAX_HP/);
  assert.match(game, /g\.barricadeHp = Math\.max\(0, g\.barricadeHp - structureDamage\)/);
  assert.match(game, /const outcome = battleOutcome\(g\.baseHp, g\.barricadeHp\)/);
  assert.match(game, /TAKUYA DOWN — ENEMY BASE EXPOSED/);
  assert.match(game, /感染拠点 \/\/ 損傷/);
  assert.match(game, /感染拠点 \/\/ 大破/);
  assert.match(game, /感染拠点を制圧/);
  assert.match(rules, /最終機会 — 感染拠点を破壊/);
  assert.match(css, /\.barrier-health/);
  assert.match(css, /\.barrier-health\.vulnerable/);
  assert.match(css, /\.barrier-health\.hit/);
  assert.match(layout, /ASHFALL OUTPOST — Early Access 0\.5\.0/);
  assert.match(layout, /rel="preload" as="image" href="\/infected-checkpoint-v1\.png"/);
});

test("keeps the battlefield visually clean while routing freely across three roadway bands", async () => {
  const [game, css] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(game, /no lane-map overlay is drawn over the battlefield/);
  assert.doesNotMatch(game, /fillText\(`0\$\{lane \+ 1\}/);
  assert.doesNotMatch(game, /fillText\("MUSTER"/);
  assert.doesNotMatch(game, /ctx\.arc\(BASE_X, y, 16/);
  assert.match(game, /anchorLane: Lane \| null/);
  assert.match(game, /targetId: number \| null/);
  assert.match(game, /autonomousTargetScore/);
  assert.match(game, /targetClaims/);
  assert.match(game, /interceptorTargetScore/);
  assert.match(game, /routeBlockers/);
  assert.match(game, /isCrawlerRouteBlocker/);
  assert.match(game, /fighterDistance\(f, target\)/);
  assert.match(game, /new ResizeObserver\(configureCanvas\)/);
  assert.match(game, /window\.devicePixelRatio/);
  assert.match(css, /battlefield-v4\.png/);
  assert.doesNotMatch(css, /mask-image/);
  assert.doesNotMatch(css, /repeating-linear-gradient\(0deg/);
  assert.match(css, /orientation:portrait/);
});

test("provides a five-second preparation window, a three-slot bay, and selectable tactics", async () => {
  const [game, css] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.equal(PREP_SECONDS, 5);
  assert.deepEqual(TACTIC_MODES, ["defend", "balanced", "assault"]);
  assert.match(game, /banner: `DEPLOYMENT WINDOW \/\/ \$\{PREP_SECONDS\}`/);
  assert.match(game, /g\.time < PREP_SECONDS/);
  assert.match(game, /deployQueue: UnitKind\[\]/);
  assert.match(game, /g\.deployQueue\.length >= 3/);
  assert.match(game, /CRAWLER BAY FULL \/\/ 3/);
  assert.match(game, /g\.deployQueue\.shift\(\)/);
  assert.match(game, /格納庫 \{hud\.deployQueue\}\/3/);
  assert.match(game, /const setTactic/);
  assert.match(game, /const cycleTactic/);
  assert.match(game, /作戦方針 \/\//);
  assert.match(game, /event\.key\.toLowerCase\(\) === "r"/);
  assert.match(game, /aria-label=\{`作戦方針を切り替え（現在：\$\{tacticName\}）`\}/);
  assert.match(game, /advanceLimitFor\(g\.tactic, g\.phase, g\.barricadeVulnerable\)/);
  assert.match(game, /tacticTargetBias\(g\.tactic, enemy\.x\)/);
  assert.match(css, /\.tactic-cycle\.defend/);
  assert.match(css, /\.tactic-cycle\.assault/);
});

test("applies the COMMAND economy, deployment gates, and shared world geometry", () => {
  assert.equal(COMMAND_MAX, 100);
  assert.equal(COMMAND_REGEN, 3.5);
  assert.equal(SUPPORT_GAUGE_MAX, 100);
  assert.equal(RAGE_MAX, 100);
  assert.equal(BARRICADE_MAX_HP, 1000);
  assert.equal(advanceCommand(55, 10), 90);
  assert.equal(advanceCommand(95, 10), 100);
  assert.equal(advanceCommand(40, -5), 40);

  const ready = { running: true, paused: false, over: false, command: 45, cost: 45, cooldown: 0 };
  assert.equal(canDeploy(ready), true);
  assert.equal(canDeploy({ ...ready, running: false }), false);
  assert.equal(canDeploy({ ...ready, paused: true }), false);
  assert.equal(canDeploy({ ...ready, over: true }), false);
  assert.equal(canDeploy({ ...ready, command: 44.99 }), false);
  assert.equal(canDeploy({ ...ready, cooldown: 0.01 }), false);

  assert.deepEqual(LANE_NAMES, ["TOP", "MID", "LOW"]);
  assert.deepEqual(LANE_Y, [212, 282, 352]);
  assert.equal(new Set(LANE_Y).size, 3);
  assert.equal(laneForY(LANE_Y[0], 1), 0);
  assert.equal(laneForY(250, 1), 1);
  assert.equal(laneForY(240, 1), 0);
  assert.equal(laneForY(LANE_Y[2], 1), 2);
  assert.deepEqual(WORLD_GEOMETRY, {
    baseX: 188,
    musterX: 187,
    musterY: 352,
    crawler: {
      x: -70, y: 170, width: 310, height: 210, exitX: 205,
      commandDeckX: 88, commandDeckY: 186, weaponX: 132, weaponY: 224,
      damageX: 112, damageY: 250,
    },
    enemyBase: {
      drawX: 788, drawY: 88, width: 184, height: 340,
      attackX: 800, enemySpawnMinX: 744, enemySpawnMaxX: 776,
      gateX: 818, gateY: 282,
    },
    barricade: {
      drawX: 788, drawY: 88, width: 184, height: 340,
      attackX: 800, enemySpawnMinX: 744, enemySpawnMaxX: 776,
      gateX: 818, gateY: 282,
    },
    supportMinX: 230,
    supportMaxX: 760,
    threatNearX: 362,
    threatStartX: 482,
  });
  assert.ok(WORLD_GEOMETRY.barricade.drawY < LANE_Y[0]);
  assert.ok(WORLD_GEOMETRY.barricade.drawY + WORLD_GEOMETRY.barricade.height > LANE_Y[2]);
  assert.ok(WORLD_GEOMETRY.barricade.enemySpawnMaxX < WORLD_GEOMETRY.barricade.drawX);
  assert.equal(WORLD_GEOMETRY.enemyBase, WORLD_GEOMETRY.barricade);
  assert.ok(WORLD_GEOMETRY.musterX < WORLD_GEOMETRY.crawler.exitX);
  assert.ok(WORLD_GEOMETRY.crawler.exitX < WORLD_GEOMETRY.supportMinX);
});

test("bounds advance by phase, vulnerability, and tactical posture", () => {
  assert.equal(advanceLimitFor("defend", 1, false), 480);
  assert.equal(advanceLimitFor("balanced", 1, false), 520);
  assert.equal(advanceLimitFor("assault", 1, false), 560);
  assert.equal(advanceLimitFor("defend", 2, false), 690);
  assert.equal(advanceLimitFor("balanced", 2, false), 730);
  assert.equal(advanceLimitFor("assault", 2, false), 770);
  assert.equal(advanceLimitFor("defend", 3, false), 690);
  assert.equal(advanceLimitFor("balanced", 3, false), 730);
  assert.equal(advanceLimitFor("assault", 3, false), 770);
  assert.equal(advanceLimitFor("defend", 3, true), 800);
  assert.equal(advanceLimitFor("balanced", 3, true), 800);
  assert.equal(advanceLimitFor("assault", 3, true), 800);

  assert.equal(tacticTargetBias("defend", 400), -70);
  assert.equal(tacticTargetBias("defend", 500), 20);
  assert.equal(tacticTargetBias("balanced", 700), 0);
  assert.equal(tacticTargetBias("assault", 600), 15);
  assert.equal(tacticTargetBias("assault", 601), -45);
});

test("applies role focus, marking, finishing, and structure-breach multipliers", () => {
  assert.equal(roleTargetBias("scout", "runner"), -34);
  assert.equal(roleTargetBias("scout", "shade"), -34);
  assert.equal(roleTargetBias("ranger", "spitter"), -42);
  assert.equal(roleTargetBias("ranger", "walker"), 0);
  assert.equal(roleTargetBias("gunner", "crusher"), -34);
  assert.equal(roleTargetBias("gunner", "abomination"), -34);

  assert.equal(humanAttackMultiplier("gunner", "crusher"), 1.3);
  assert.equal(isBrawlerFinisher("brawler", .351), false);
  assert.equal(isBrawlerFinisher("brawler", .35), true);
  assert.equal(isBrawlerFinisher("scout", .2), false);
  assert.equal(humanAttackMultiplier("brawler", "walker", .351), 1);
  assert.equal(humanAttackMultiplier("brawler", "walker", .35), 1.35);
  assert.equal(humanAttackMultiplier("scout", "runner", 1, true), 1.15);
  assertClose(humanAttackMultiplier("brawler", "walker", .2, true), 1.5525);
  assertClose(humanAttackMultiplier("gunner", "crusher", 1, true), 1.495);

  assert.equal(structureDamageMultiplier("scout", "balanced"), 1);
  assert.equal(structureDamageMultiplier("brute", "balanced"), 1.5);
  assert.equal(structureDamageMultiplier("brawler", "balanced"), 1.2);
  assert.equal(structureDamageMultiplier("gunner", "balanced"), 1.1);
  assert.equal(structureDamageMultiplier("medic", "balanced"), .7);
  assertClose(structureDamageMultiplier("brute", "assault"), 1.68);
  assertClose(structureDamageMultiplier("brute", "defend"), 1.35);
});

test("tracks one barricade condition and resolves the battle from either structure", () => {
  assert.equal(barricadeState(1000), "INTACT");
  assert.equal(barricadeState(701), "INTACT");
  assert.equal(barricadeState(700), "BUCKLING");
  assert.equal(barricadeState(351), "BUCKLING");
  assert.equal(barricadeState(350), "BREACH IMMINENT");
  assert.equal(barricadeState(1), "BREACH IMMINENT");
  assert.equal(barricadeState(0), "BREACHED");
  assert.equal(barricadeState(-1), "BREACHED");

  assert.equal(battleOutcome(100, BARRICADE_MAX_HP), null);
  assert.equal(battleOutcome(0, 500), "lost");
  assert.equal(battleOutcome(100, 0), "won");
  assert.equal(battleOutcome(0, 0), "lost");
});

test("scores autonomous targets without collapsing every unit onto one enemy", () => {
  assert.equal(autonomousTargetScore({ distance: 300, claims: 0, capacity: 1, enemyX: 700 }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 1, capacity: 1, enemyX: 700 }), 382);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 1, capacity: 1, enemyX: 700, isCurrent: true }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 1, capacity: 2, enemyX: 700 }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 0, capacity: 1, enemyX: 350 }), 120);
});

test("distributes enemy interceptors and only blocks the active Crawler route", () => {
  assert.equal(interceptorTargetScore({ distance: 120, claims: 0, capacity: 1 }), 120);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 1, capacity: 1 }), 216);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 1, capacity: 1, isCurrent: true }), 120);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 2, capacity: 2 }), 216);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 0, capacity: 1, rearward: 12 }), 144);

  const route = { enemyX: 700, defenderX: 620, routeY: LANE_Y[0] };
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderY: LANE_Y[0] }), true);
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderY: LANE_Y[2] }), false);
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderX: 590, defenderY: LANE_Y[0] }), false);
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderX: 710, defenderY: LANE_Y[0] }), false);
  assert.equal(isCrawlerRouteBlocker({ ...route, defenderY: LANE_Y[0] + 31 }), false);
});

test("returns phases, new objectives, siege scaling, rewards, and support costs", () => {
  assert.equal(phaseAt(0), 1);
  assert.equal(phaseAt(59.999), 1);
  assert.equal(phaseAt(60), 2);
  assert.equal(phaseAt(147.999), 2);
  assert.equal(phaseAt(148), 3);

  assert.equal(objectiveFor(1, false), "3レーンを防衛");
  assert.equal(objectiveFor(2, false), "感染拠点へ前進");
  assert.equal(objectiveFor(3, false), "TAKUYAを撃破");
  assert.equal(objectiveFor(3, true), "感染拠点を破壊");

  assert.equal(crawlerSiegeDamage(15, 1), 11);
  assert.equal(crawlerSiegeDamage(15, 2), 14);
  assert.equal(crawlerSiegeDamage(15, 3), 15);
  assert.equal(crawlerThreatLevel(Infinity), 0);
  assert.equal(crawlerThreatLevel(482), 0);
  assert.equal(crawlerThreatLevel(342), .5);
  assert.equal(crawlerThreatLevel(202), 1);

  const gaugeRewards = { walker: 4, runner: 5, spitter: 8, crusher: 14, shade: 22, abomination: 20, takuya: 25, turned: 7 };
  assert.deepEqual(
    Object.fromEntries(Object.keys(gaugeRewards).map((kind) => [kind, supportGaugeReward(kind)])),
    gaugeRewards,
  );
  assert.equal(rageReward("crusher"), supportGaugeReward("crusher"));
  assert.deepEqual(Object.values(BATTLEFIELD_SUPPLY_DEFS).map(({ kind, cost }) => [kind, cost]), [
    ["pod", 50],
    ["drum", 40],
    ["medical", 35],
  ]);
  assert.equal("maxActive" in BATTLEFIELD_SUPPLY_DEFS.pod, false);
  assert.equal("maxPerLane" in BATTLEFIELD_SUPPLY_DEFS.pod, false);
  assert.deepEqual(SUPPORT_DEFS.map(({ kind, cost }) => [kind, cost]), [
    ["barrel", 20],
    ["medkit", 25],
    ["molotov", 35],
    ["airstrike", 60],
  ]);
  assert.deepEqual(UNIT_CARDS.map(({ kind, desc }) => [kind, desc]), [
    ["scout", "高速敵を迎撃・マーク"],
    ["ranger", "毒吐きを優先狙撃"],
    ["brute", "前線を支え感染拠点を粉砕"],
    ["brawler", "瀕死の敵を仕留める"],
    ["gunner", "大型敵へ重火力"],
    ["medic", "周囲の味方を回復"],
  ]);
});

test("models all three battlefield supplies without fixed pod count or lane caps", () => {
  const base = {
    running: true, paused: false, over: false, scrap: 100,
    supplyKind: "pod", lane: 1, x: 440, supplies: [], areaEffects: [],
    nextId: 10, nextAreaEffectId: 30,
  };
  assert.deepEqual(battlefieldSupplyPlacementCheck(base), { ok: true, reason: "配置できます" });
  assert.equal(battlefieldSupplyPlacementCheck({ ...base, running: false }).ok, false);
  assert.equal(battlefieldSupplyPlacementCheck({ ...base, scrap: 49 }).reason, "スクラップが不足しています");
  assert.equal(battlefieldSupplyPlacementCheck({ ...base, x: 259 }).reason, "配置可能範囲外です");
  assert.equal(battlefieldSupplyPlacementCheck({ ...base, forbiddenZones: [{ lane: 1, minX: 420, maxX: 460 }] }).reason, "進行上の禁止領域です");

  const podPlacement = resolveBattlefieldSupplyPlacement(base);
  assert.equal(podPlacement.ok, true);
  assert.equal(podPlacement.scrap, 50);
  assert.equal(podPlacement.supplies[0].kind, "pod");
  assert.equal(podPlacement.supplies[0].phase, "dropping");
  assert.equal(podPlacement.nextId, 11);
  assert.deepEqual(battlefieldSupplyPlacementCheck({ ...base, supplies: [podPlacement.supplies[0]], x: 500 }), { ok: false, reason: "既存物資に近すぎます" });
  assert.deepEqual(battlefieldSupplyPlacementCheck({ ...base, supplies: [podPlacement.supplies[0]], x: 700 }), { ok: true, reason: "配置できます" });
  assert.deepEqual(battlefieldSupplyPlacementCheck({ ...base, supplies: [
    { ...podPlacement.supplies[0], lane: 0, x: 300, y: LANE_Y[0] },
    { ...podPlacement.supplies[0], id: 11, lane: 2, x: 600, y: LANE_Y[2] },
  ] }), { ok: true, reason: "配置できます" });

  const readyToLand = advanceBattlefieldSupply(podPlacement.supplies[0], BATTLEFIELD_SUPPLY_DEFS.pod.dropSeconds);
  assert.equal(podPlacement.supplies[0].targetable, false);
  assert.equal(podPlacement.supplies[0].blocksEnemies, false);
  assert.equal(resolveBattlefieldSupplyLanding({ supply: podPlacement.supplies[0], fighters: [] }).triggered, false);
  assert.equal(readyToLand.readyToLand, true);
  const landing = resolveBattlefieldSupplyLanding({
    supply: readyToLand,
    fighters: [
      { id: 1, side: "zombie", lane: 1, x: 450, y: LANE_Y[1], hp: 100, maxHp: 100 },
      { id: 2, side: "human", lane: 1, x: 430, y: LANE_Y[1], hp: 100, maxHp: 100 },
      { id: 3, side: "zombie", lane: 1, x: 700, y: LANE_Y[1], hp: 100, maxHp: 100 },
    ],
  });
  assert.equal(landing.triggered, true);
  assert.equal(landing.supply.targetable, true);
  assert.equal(landing.supply.blocksEnemies, true);
  assert.deepEqual(landing.hits.map(({ side, damage }) => [side, damage]), [["zombie", 72], ["human", 22]]);
  assert.equal(resolveBattlefieldSupplyLanding({ supply: landing.supply, fighters: landing.fighters }).triggered, false);
  const activePod = advanceBattlefieldSupply(landing.supply, BATTLEFIELD_SUPPLY_DEFS.pod.impactSeconds);
  assert.equal(activePod.phase, "active");
  const destroyedPod = applyBattlefieldSupplyDamage(activePod, activePod.hp + 1);
  assert.equal(destroyedPod.supply.phase, "destroying");
  assert.equal(advanceBattlefieldSupply(destroyedPod.supply, BATTLEFIELD_SUPPLY_DEFS.pod.destroySeconds).phase, "expired");

  const drumPlacement = resolveBattlefieldSupplyPlacement({ ...base, supplyKind: "drum", scrap: 100, nextId: 20 });
  const manual = requestDrumDetonation(drumPlacement.supplies[0]);
  assert.equal(manual.ok, true);
  const explosion = resolveDrumDetonation({
    supply: manual.supply,
    fighters: [
      { id: 4, side: "zombie", lane: 1, x: 450, y: LANE_Y[1], hp: 150, maxHp: 150 },
      { id: 5, side: "human", lane: 1, x: 450, y: LANE_Y[1], hp: 100, maxHp: 100 },
    ],
    nextAreaEffectId: 40,
  });
  assert.equal(explosion.triggered, true);
  assert.deepEqual(explosion.hits, [{ id: 4, damage: BATTLEFIELD_SUPPLY_DEFS.drum.blastDamage }]);
  assert.equal(explosion.areaEffects[0].kind, "burn");
  assert.equal(explosion.nextAreaEffectId, 41);
  assert.equal(resolveDrumDetonation({ supply: explosion.supply }).triggered, false);
  const burned = advanceAreaEffects({ areaEffects: explosion.areaEffects, fighters: explosion.fighters, seconds: 1 });
  assert.equal(burned.fighters[0].hp, 150 - BATTLEFIELD_SUPPLY_DEFS.drum.blastDamage - BATTLEFIELD_SUPPLY_DEFS.drum.burnDamagePerSecond);
  assert.equal(burned.fighters[1].hp, 100);
  assert.equal(burned.fighters[0].slowMultiplier, BATTLEFIELD_SUPPLY_DEFS.drum.slowMultiplier);
  assert.equal(advanceAreaEffects({ areaEffects: explosion.areaEffects, fighters: [], seconds: BATTLEFIELD_SUPPLY_DEFS.drum.burnSeconds }).areaEffects[0].phase, "expired");

  const destroyedDrum = applyBattlefieldSupplyDamage(drumPlacement.supplies[0], 999);
  assert.equal(destroyedDrum.detonationRequested, true);
  assert.equal(destroyedDrum.supply.phase, "detonating");
  assert.equal(destroyedDrum.supply.detonationReason, "destroyed");

  const medicalPlacement = resolveBattlefieldSupplyPlacement({ ...base, supplyKind: "medical", scrap: 100, nextId: 50, nextAreaEffectId: 60 });
  assert.equal(medicalPlacement.areaEffects[0].kind, "healing");
  const healed = advanceAreaEffects({
    areaEffects: medicalPlacement.areaEffects,
    activeSupplyIds: [50],
    seconds: 1,
    fighters: [
      { id: 6, side: "human", lane: 1, x: 440, y: LANE_Y[1], hp: 50, maxHp: 100 },
      { id: 7, side: "zombie", lane: 1, x: 440, y: LANE_Y[1], hp: 50, maxHp: 100 },
    ],
  });
  assert.equal(healed.fighters[0].hp, 68);
  assert.equal(healed.fighters[1].hp, 50);
  assert.equal(advanceBattlefieldSupply(medicalPlacement.supplies[0], BATTLEFIELD_SUPPLY_DEFS.medical.effectSeconds).phase, "expired");
  const missingSource = advanceAreaEffects({ areaEffects: medicalPlacement.areaEffects, activeSupplyIds: [], fighters: healed.fighters, seconds: 1 });
  assert.equal(missingSource.areaEffects[0].phase, "expired");
  assert.equal(missingSource.changes.length, 0);

  const leftBurn = advanceAreaEffects({ areaEffects: burned.areaEffects, fighters: burned.fighters.map((fighter) => ({ ...fighter, x: 900 })), seconds: 1 });
  assert.equal(leftBurn.fighters[0].burning, false);
  assert.equal(leftBurn.fighters[0].slowMultiplier, 1);
  assert.equal(enemyCanTargetBattlefieldSupply({ supply: landing.supply, enemyX: 600, enemyLane: 1, attackRange: 20 }), true);
  assert.equal(enemyCanTargetBattlefieldSupply({ supply: drumPlacement.supplies[0], enemyX: 600, enemyLane: 1, attackRange: 20 }), false);
  assert.equal(enemyCanTargetBattlefieldSupply({ supply: drumPlacement.supplies[0], enemyX: 480, enemyLane: 1, attackRange: 20 }), true);
});

test("models airstrike request and one-at-a-time emergency-support transitions", () => {
  const idle = createEmergencySupportRuntime();
  assert.deepEqual(idle, { phase: "idle", phaseTime: 0, targetX: null, targetLane: null, impactTriggered: false });
  const insufficient = requestAirstrike({ running: true, paused: false, over: false, supportGauge: AIRSTRIKE_DEF.gaugeCost - 1, lane: 1, x: 500, runtime: idle });
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.supportGauge, AIRSTRIKE_DEF.gaugeCost - 1);

  const requested = requestAirstrike({ running: true, paused: false, over: false, supportGauge: 100, lane: 1, x: 999, runtime: idle });
  assert.equal(requested.ok, true);
  assert.equal(requested.supportGauge, 40);
  assert.equal(requested.runtime.phase, "radio");
  assert.equal(requested.runtime.targetX, AIRSTRIKE_DEF.maxX);
  assert.equal(requestAirstrike({ running: true, paused: false, over: false, supportGauge: 100, lane: 1, x: 500, runtime: requested.runtime }).ok, false);

  const targeting = advanceEmergencySupportRuntime(requested.runtime, AIRSTRIKE_DEF.radioSeconds);
  assert.equal(targeting.runtime.phase, "targeting");
  const inbound = advanceEmergencySupportRuntime(targeting.runtime, AIRSTRIKE_DEF.targetingSeconds);
  assert.equal(inbound.runtime.phase, "inbound");
  const impact = advanceEmergencySupportRuntime(inbound.runtime, AIRSTRIKE_DEF.inboundSeconds);
  assert.equal(impact.runtime.phase, "impact");
  assert.deepEqual(impact.events, ["impact"]);
  const largeDeltaImpact = advanceEmergencySupportRuntime(requested.runtime, 99);
  assert.equal(largeDeltaImpact.runtime.phase, "impact");
  assert.deepEqual(largeDeltaImpact.events, ["impact"]);
  const resolved = resolveAirstrikeImpact({
    runtime: impact.runtime,
    fighters: [
      { id: 1, side: "zombie", lane: 1, x: AIRSTRIKE_DEF.maxX, y: LANE_Y[1], hp: 200 },
      { id: 2, side: "human", lane: 1, x: AIRSTRIKE_DEF.maxX, y: LANE_Y[1], hp: 200 },
      { id: 3, side: "zombie", lane: 0, x: 300, y: LANE_Y[0], hp: 200 },
    ],
  });
  assert.equal(resolved.triggered, true);
  assert.deepEqual(resolved.hits, [{ id: 1, damage: AIRSTRIKE_DEF.damage }]);
  assert.equal(resolveAirstrikeImpact({ runtime: resolved.runtime, fighters: resolved.fighters }).triggered, false);
  const returning = advanceEmergencySupportRuntime(resolved.runtime, AIRSTRIKE_DEF.impactSeconds);
  assert.equal(returning.runtime.phase, "returning");
  const complete = advanceEmergencySupportRuntime(returning.runtime, AIRSTRIKE_DEF.returnSeconds);
  assert.equal(complete.runtime.phase, "idle");
  assert.deepEqual(complete.events, ["complete"]);
});

test("models the independently charged all-lane Crawler barrage with boss mitigation", () => {
  const half = createCrawlerAbilityRuntime();
  assert.equal(half.phase, "cooldown");
  assert.equal(half.charge, .5);
  assert.equal(half.cooldownRemaining, CRAWLER_BARRAGE_DEF.cooldownSeconds / 2);
  const ready = advanceCrawlerAbilityRuntime(half, CRAWLER_BARRAGE_DEF.cooldownSeconds / 2);
  assert.equal(ready.runtime.phase, "ready");
  assert.deepEqual(ready.events, ["ready"]);
  const requested = requestCrawlerBarrage({ running: true, paused: false, over: false, runtime: ready.runtime });
  assert.equal(requested.ok, true);
  assert.equal(requested.runtime.phase, "deploying");
  const firing = advanceCrawlerAbilityRuntime(requested.runtime, CRAWLER_BARRAGE_DEF.deploySeconds);
  assert.equal(firing.runtime.phase, "firing");
  assert.deepEqual(firing.events, ["fire"]);
  const largeDeltaFiring = advanceCrawlerAbilityRuntime(requested.runtime, 99);
  assert.equal(largeDeltaFiring.runtime.phase, "firing");
  assert.deepEqual(largeDeltaFiring.events, ["fire"]);

  const barrage = resolveCrawlerBarrage({
    runtime: firing.runtime,
    fighters: [
      { id: 1, side: "zombie", kind: "walker", lane: 0, hp: 100 },
      { id: 2, side: "zombie", kind: "takuya", lane: 1, hp: 200 },
      { id: 3, side: "zombie", kind: "crusher", lane: 2, hp: 100 },
      { id: 4, side: "human", kind: "scout", lane: 1, hp: 100 },
    ],
  });
  assert.equal(barrage.triggered, true);
  assert.deepEqual(barrage.hits.map(({ lane }) => lane), [0, 1, 2]);
  assert.equal(barrage.hits[0].damage, CRAWLER_BARRAGE_DEF.damage);
  assert.equal(barrage.hits[1].damage, Math.round(CRAWLER_BARRAGE_DEF.damage * CRAWLER_BARRAGE_DEF.bossDamageMultiplier));
  assert.equal(barrage.fighters[3].hp, 100);
  assert.equal(resolveCrawlerBarrage({ runtime: barrage.runtime, fighters: barrage.fighters }).triggered, false);

  const recovering = advanceCrawlerAbilityRuntime(barrage.runtime, CRAWLER_BARRAGE_DEF.fireSeconds);
  assert.equal(recovering.runtime.phase, "recovering");
  const cooldown = advanceCrawlerAbilityRuntime(recovering.runtime, CRAWLER_BARRAGE_DEF.recoverSeconds);
  assert.equal(cooldown.runtime.phase, "cooldown");
  assert.equal(cooldown.runtime.charge, 0);
  assert.deepEqual(cooldown.events, ["cooldown"]);
});

test("caps transient render arrays and limits camera shake to major events", () => {
  assert.deepEqual(RENDER_ARRAY_LIMITS, { particles: 420, shots: 180, damageTexts: 140, areaEffects: 24, battleBarks: 2 });
  assert.deepEqual(capRenderArray([1, 2, 3, 4], 2), [3, 4]);
  assert.deepEqual(capRenderArray([1, 2, 3], 0), []);
  assert.deepEqual(capRenderArray([1, 2, 3], "battleBarks"), [2, 3]);
  assert.deepEqual(Object.keys(CAMERA_SHAKE_EVENTS), ["podLanding", "airstrikeImpact", "crawlerBarrage", "takuyaHeavy", "enemyBaseCollapse"]);
  assert.equal("normalAttack" in CAMERA_SHAKE_EVENTS, false);
  assert.ok(Object.values(CAMERA_SHAKE_EVENTS).every(({ strength, seconds }) => strength >= 0 && seconds > 0));
});

test("validates, damages, and releases the battlefield container without changing Crawler priority", async () => {
  const base = { running: true, paused: false, over: false, scrap: CONTAINER_DEF.cost, lane: 1, x: 440, objects: [], fighters: [], supports: [], nextId: 40 };
  assert.equal(CONTAINER_DEF.objectClearance, FIELD_OBJECT_CLEARANCE);
  assert.deepEqual(containerPlacementCheck(base), { ok: true, reason: "配置できます" });
  assert.equal(containerPlacementCheck({ ...base, running: false }).ok, false);
  assert.equal(containerPlacementCheck({ ...base, paused: true }).reason, "一時停止中は配置できません");
  assert.equal(containerPlacementCheck({ ...base, scrap: CONTAINER_DEF.cost - 1 }).reason, "スクラップが不足しています");
  assert.equal(containerPlacementCheck({ ...base, x: CONTAINER_DEF.minX - 1 }).reason, "配置可能範囲外です");
  assert.equal(containerPlacementCheck({ ...base, objects: [{ lane: 1, x: 500, y: LANE_Y[1], phase: "active" }] }).reason, "既存物資に近すぎます");
  assert.deepEqual(containerPlacementCheck({ ...base, objects: [
    { lane: 0, x: 300, y: LANE_Y[0], phase: "active" },
    { lane: 2, x: 600, y: LANE_Y[2], phase: "dropping" },
  ] }), { ok: true, reason: "配置できます" });
  assert.deepEqual(containerPlacementCheck({ ...base, objects: [{ lane: 1, x: 700, y: LANE_Y[1], phase: "active" }] }), { ok: true, reason: "配置できます" });
  assert.deepEqual(containerPlacementCheck({ ...base, fighters: [{ x: 450, y: LANE_Y[1], hp: 10 }] }), { ok: true, reason: "配置できます" });

  const placed = resolveContainerPlacement(base);
  assert.equal(placed.ok, true);
  assert.equal(placed.scrap, 0);
  assert.equal(placed.objects.length, 1);
  assert.equal(placed.objects[0].id, 40);
  assert.equal(placed.objects[0].phase, "dropping");
  assert.equal(placed.objects[0].landingTriggered, false);

  const landing = resolveContainerLanding({
    lane: 1, x: 440,
    fighters: [
      { id: 1, side: "zombie", x: 450, y: LANE_Y[1], hp: 100 },
      { id: 2, side: "human", x: 430, y: LANE_Y[1], hp: 100 },
      { id: 3, side: "zombie", x: 700, y: LANE_Y[1], hp: 100 },
    ],
  });
  assert.deepEqual(landing.hits, [
    { id: 1, side: "zombie", damage: CONTAINER_DEF.enemyLandingDamage },
    { id: 2, side: "human", damage: CONTAINER_DEF.allyLandingDamage },
  ]);
  assert.equal(landing.fighters[0].hp, 100 - CONTAINER_DEF.enemyLandingDamage);
  assert.equal(landing.fighters[1].hp, 100 - CONTAINER_DEF.allyLandingDamage);
  assert.equal(landing.fighters[2].hp, 100);
  assert.ok(CONTAINER_DEF.enemyLandingDamage > CONTAINER_DEF.allyLandingDamage);

  const invalid = resolveContainerPlacement({ ...base, x: CONTAINER_DEF.minX - 1 });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.scrap, CONTAINER_DEF.cost);
  assert.equal(invalid.objects.length, 0);

  const activeSupport = { id: 7, kind: "medkit", lane: 1, x: 440, y: LANE_Y[1], life: 5 };
  const containerOnSupport = resolveContainerPlacement({ ...base, supports: [activeSupport] });
  assert.equal(containerOnSupport.ok, false);
  assert.equal(containerOnSupport.reason, "既存物資に近すぎます");
  assert.equal(containerOnSupport.scrap, CONTAINER_DEF.cost);
  assert.equal(containerOnSupport.objects.length, 0);

  const activeContainer = { ...placed.objects[0], phase: "active" };
  const supportOnContainer = resolveFieldSupportPlacement({
    running: true, paused: false, over: false, rage: 30, cost: 20, kind: "barrel", lane: 1, x: 440,
    supports: [], containers: [activeContainer],
  });
  assert.equal(supportOnContainer.ok, false);
  assert.equal(supportOnContainer.reason, "防護コンテナに近すぎます");
  assert.equal(supportOnContainer.rage, 30);

  assert.deepEqual(damageContainer(CONTAINER_DEF.maxHp, 35), { hp: CONTAINER_DEF.maxHp - 35, phase: "active" });
  assert.deepEqual(damageContainer(20, 35), { hp: 0, phase: "destroying" });
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 1, containerX: 440, containerLane: 1, phase: "active" }), true);
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 1, containerX: 440, containerLane: 1, phase: "impact" }), true);
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 0, containerX: 440, containerLane: 1, phase: "active" }), false);
  assert.equal(containerBlocksEnemy({ enemyX: 400, enemyLane: 1, containerX: 440, containerLane: 1, phase: "active" }), false);
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 1, containerX: 440, containerLane: 1, phase: "destroying" }), false);

  const rearContainer = { ...activeContainer, id: 41, x: 360 };
  const blocking = selectBlockingContainer({ enemyX: 600, enemyLane: 1, objects: [rearContainer, activeContainer] });
  assert.equal(blocking.id, activeContainer.id);

  const destroyed = applyContainerDamage({ ...activeContainer, hp: 20 }, 35);
  assert.equal(destroyed.hp, 0);
  assert.equal(destroyed.phase, "destroying");
  assert.equal(destroyed.blocksEnemies, false);
  assert.equal(destroyed.targetable, false);
  assert.equal(selectBlockingContainer({ enemyX: 600, enemyLane: 1, objects: [destroyed] }), undefined);
  assert.equal(advanceZombieX({ enemyX: 600, speed: 20, seconds: 1 }), 580);
  assert.equal(battleOutcome(0, 0), "lost");

  const game = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(game, /battlefieldObjects: BattlefieldObject\[\]/);
  assert.match(game, /targetObjectId: number \| null/);
  assert.match(game, /resolveBattlefieldSupplyPlacement\(\{/);
  assert.match(game, /requestAirstrike\(\{/);
  assert.match(game, /requestCrawlerBarrage\(\{/);
  assert.match(game, /placeBattlefieldSupply\(kind, lane, x\)/);
  assert.match(game, /if \(deployAirstrike\(lane, x\)\) chooseAction\(null\)/);
  assert.match(game, /const routeLane = f\.lane/);
  assert.match(game, /selectBlockingContainer\(\{/);
  assert.match(game, /physicalContact \?\? \(blockingSupply \? undefined/);
  assert.match(game, /!target && !objectTarget && f\.x > 520/);
  assert.match(game, /objectTarget \? Math\.abs\(f\.x - objectTarget\.x\)/);
  assert.match(game, /applyBattlefieldSupplyDamage\(objectTarget, f\.damage\)/);
  assert.match(game, /resolveBattlefieldSupplyLanding\(\{/);
  assert.match(game, /resolveDrumDetonation\(\{/);
  assert.match(game, /advanceAreaEffects\(\{/);
  assert.match(game, /索敵マーク/);
  assert.match(game, /対・毒吐き/);
  assert.match(game, /前線保持/);
  assert.match(game, /フィニッシュ/);
  assert.match(game, /重装破砕/);
  assert.match(game, /value: "救護"/);
  for (const effect of ["scout", "ranger", "brute", "brawler", "gunner", "medic"]) {
    assert.match(game, new RegExp(`shot\\.effect === "${effect}"|effect: "${effect}"`));
  }
  assert.match(game, /effect: f\.kind as RoleEffect, emphasized/);
  assert.match(game, /const brawlerFinishApplied = f\.side === "human" && isBrawlerFinisher\(f\.kind, targetHpRatio\)/);
  assert.match(game, /brawlerFinishApplied \? "フィニッシュ"/);
  assert.match(game, /function prepareRolesQa/);
  assert.match(game, /prepareQaMode\(fresh, qaMode\)/);
  assert.match(game, /resolveLocalQaMode\(window\.location\.hostname, window\.location\.search\)/);
  assert.match(game, /advanceZombieX\(\{/);
  assert.match(game, /supplyDefs\[objectTarget\.kind\]\.name}破壊/);
  assert.match(game, /drawPlacementIndicator/);
  assert.match(game, /supplyDefs\[selectedSupply\]\.cost/);
});

test("models replaceable battle dialogue with QA-only copy, expiry, cooldowns, duplicate prevention, and priority", () => {
  assert.deepEqual(APPROVED_BATTLE_BARK_LINES, []);
  assert.equal(BATTLE_BARK_CONFIG.maxVisible, 2);
  assert.equal(LOCAL_QA_BATTLE_BARK_LINES.length, 10);
  assert.ok(LOCAL_QA_BATTLE_BARK_LINES.every((line) => line.probability === 1 && line.weight === 1 && line.tone === "qa"));
  assert.equal(battleBarkPassesProbability(.5, .49), true);
  assert.equal(battleBarkPassesProbability(.5, .5), false);
  const initial = createBattleBarkRuntime();
  const normal = queueBattleBark({ runtime: initial, event: { trigger: "role-cue", speakerKind: "scout", speakerId: 1 } });
  assert.equal(normal.shown, false);
  assert.equal(normal.reason, "no-approved-line");

  const scout = queueBattleBark({ runtime: initial, event: { trigger: "role-cue", speakerKind: "scout", speakerId: 1 }, qa: true });
  assert.equal(scout.shown, true);
  assert.equal(scout.bark.text, "QA // SCOUT ROLE CUE");
  const duplicate = queueBattleBark({ runtime: scout.runtime, event: { trigger: "role-cue", speakerKind: "scout", speakerId: 1 }, qa: true });
  assert.equal(duplicate.reason, "duplicate-active");
  const globalBlocked = queueBattleBark({ runtime: scout.runtime, event: { trigger: "role-cue", speakerKind: "ranger", speakerId: 2 }, qa: true });
  assert.equal(globalBlocked.reason, "global-cooldown");
  assert.deepEqual(globalBlocked.runtime, scout.runtime);

  const afterActive = advanceBattleBarkRuntime(scout.runtime, 2.3);
  assert.equal(afterActive.active.length, 0);
  const speakerBlocked = queueBattleBark({ runtime: afterActive, event: { trigger: "role-cue", speakerKind: "ranger", speakerId: 1 }, qa: true });
  assert.equal(speakerBlocked.reason, "speaker-cooldown");
  const lineBlocked = queueBattleBark({ runtime: afterActive, event: { trigger: "role-cue", speakerKind: "scout", speakerId: 99 }, qa: true });
  assert.equal(lineBlocked.reason, "line-cooldown");

  const afterGlobal = advanceBattleBarkRuntime(scout.runtime, BATTLE_BARK_CONFIG.globalCooldown);
  const ranger = queueBattleBark({ runtime: afterGlobal, event: { trigger: "role-cue", speakerKind: "ranger", speakerId: 2 }, qa: true });
  assert.equal(ranger.runtime.active.length, 2);
  const critical = queueBattleBark({ runtime: ranger.runtime, event: { trigger: "crawler-critical", speakerKind: "crawler", speakerId: "crawler" }, qa: true });
  assert.equal(critical.shown, true);
  assert.equal(critical.runtime.active.length, 2);
  assert.ok(critical.runtime.active.some((bark) => bark.lineId === "qa-crawler-critical"));
  assert.ok(critical.runtime.active.every((bark) => bark.lineId !== "qa-role-scout"));
  const majorPair = queueBattleBark({ runtime: critical.runtime, event: { trigger: "takuya-down", speakerKind: "crawler", speakerId: "tactical" }, qa: true });
  assert.equal(majorPair.shown, true);
  const afterMajorGlobal = advanceBattleBarkRuntime(majorPair.runtime, BATTLE_BARK_CONFIG.globalCooldown);
  const lowerPriority = queueBattleBark({ runtime: afterMajorGlobal, event: { trigger: "role-cue", speakerKind: "medic", speakerId: 6 }, qa: true });
  assert.equal(lowerPriority.reason, "lower-priority");
  assert.deepEqual(lowerPriority.runtime, afterMajorGlobal);
  assert.equal(advanceBattleBarkRuntime(critical.runtime, 10).active.length, 0);
});

test("exposes localhost-only QA routes and wires every deterministic boss-stage scenario", async () => {
  assert.deepEqual(LOCAL_QA_MODES, ["endgame", "roles", "supplies", "airstrike", "crawler", "loadout", "dialogue", "stress"]);
  for (const mode of LOCAL_QA_MODES) {
    assert.equal(resolveLocalQaMode("localhost", `?qa=${mode}`), mode);
    assert.equal(resolveLocalQaMode("127.0.0.1", `?qa=${mode}`), mode);
  }
  assert.equal(resolveLocalQaMode("ashfall.example", "?qa=endgame"), null);
  assert.equal(resolveLocalQaMode("localhost.example", "?qa=roles"), null);
  assert.equal(resolveLocalQaMode("localhost", "?qa=unknown"), null);
  const game = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(game, /qaMode === "roles" \|\| qaMode === "dialogue"\) prepareRolesQa\(g\)/);
  assert.match(game, /qaMode === "endgame"\) prepareEndgameQa\(g\)/);
  assert.match(game, /qaMode === "supplies"\) prepareSuppliesQa\(g\)/);
  assert.match(game, /qaMode === "airstrike"\) prepareAirstrikeQa\(g\)/);
  assert.match(game, /qaMode === "crawler"\) prepareCrawlerQa\(g\)/);
  assert.match(game, /qaMode === "stress"\) prepareStressQa\(g\)/);
  assert.match(game, /if \(qaMode === "dialogue"\)[\s\S]*emitBattleBark\(g, "role-cue"/);
  assert.match(game, /placeQaSupply\(g, "pod", 0, 430\)/);
  assert.match(game, /placeQaSupply\(g, "drum", 1, 535\)/);
  assert.match(game, /placeQaSupply\(g, "medical", 2, 640\)/);
  assert.match(game, /g\.supportGauge = SUPPORT_GAUGE_MAX/);
  assert.match(game, /for \(const lane of \[0, 1, 2\] as Lane\[\]\)[\s\S]*index < 3/);
  assert.match(game, /g\.crawlerAbility = createCrawlerAbilityRuntime\(1\)/);
  assert.match(game, /function prepareStressQa[\s\S]*index < 5[\s\S]*index < 8[\s\S]*index < 18/);
  assert.match(game, /g\.supportGauge = 0/);
  assert.match(game, /takuya\.hp = 35/);
  assert.match(game, /g\.phase = 3/);
  assert.match(game, /g\.wave = 8/);
  for (const kind of ["scout", "ranger", "brute", "brawler", "gunner", "medic"]) assert.match(game, new RegExp(`\\["${kind}",`));
  assert.match(game, /aria-live="polite" aria-label="戦闘台詞"/);
  assert.match(css, /\.battle-barks \{ position:absolute; z-index:16; top:32%; left:2%;/);
  assert.match(css, /\.start-screen,\.pause-screen,\.end-screen \{ position:absolute; z-index:15;/);
  assert.match(css, /\.game-frame:has\(\.start-screen\) \.qa-badge \{ top:4%; left:50%; right:auto; bottom:auto; transform:translateX\(-100%\); \}/);
  assert.match(css, /\.game-frame:has\(\.pause-screen\) \.battle-barks \{ display:none; \}/);
  assert.match(css, /\.game-frame:has\(\.end-screen\) \.battle-barks \{ top:4%; left:2%; \}/);
  assert.match(css, /\.game-frame:has\(\.pause-screen\) \.qa-badge,\.game-frame:has\(\.end-screen\) \.qa-badge/);
  assert.match(css, /\.pause-screen button,\.end-screen button \{ min-height:44px; \}/);
  assert.match(css, /\.qa-badge \{ bottom:35%; \}\.battle-barks \{ top:32%;/);
});

test("keeps BGM and procedural SFX lifecycle bounded across pause, mute, retry, and loadout return", async () => {
  const game = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(game, /type SfxCategory = "ui" \| "combat" \| "ambient" \| "major"/);
  assert.match(game, /const MAX_SFX_VOICES = 10/);
  assert.match(game, /const SFX_CUES = \{/);
  assert.match(game, /"airstrike-impact"[\s\S]*priority: 100[\s\S]*duck:/);
  assert.match(game, /"crawler-barrage"[\s\S]*priority: 95[\s\S]*duck:/);
  assert.match(game, /"takuya-slam"[\s\S]*priority: 95[\s\S]*duck:/);
  assert.match(game, /runtime\.active\.size >= MAX_SFX_VOICES/);
  assert.match(game, /victim\.priority >= cue\.priority/);
  assert.match(game, /gain\.connect\(runtime\.buses\[cue\.category\]\)/);
  assert.match(game, /music\.master\.gain\.setTargetAtTime\(MUSIC_MASTER_GAIN \* level/);
  assert.match(game, /master\.connect\(ensureSfxRuntime\(audio\)\.buses\.ui\)/);
  assert.match(game, /const stopSfx = useCallback/);
  assert.match(game, /window\.clearTimeout\(startCueTimerRef\.current\)/);
  assert.match(game, /window\.clearInterval\(music\.timer\)/);
  assert.match(game, /runtime\.active\.clear\(\)/);
  assert.match(game, /runtime\.lastPlayedAt\.clear\(\)/);
  assert.match(game, /for \(const bus of Object\.values\(runtime\.buses\)\)/);
  assert.match(game, /sfxMutedRef\.current = next/);
  assert.match(game, /if \(g\.paused\) \{[\s\S]*g\.battleBarks = createBattleBarkRuntime\(\)[\s\S]*stopMusic\(\); stopJingle\(\); stopSfx\(\);/);
  assert.match(game, /stopMusic\(\); stopSfx\(\); playEndJingle\(g\.won\)/);
  assert.match(game, /const returnToLoadout = useCallback/);
  assert.match(game, /data-muted=\{bgmMuted\}/);
  assert.match(game, /data-muted=\{sfxMuted\}/);
  assert.match(game, /同じ装備で再戦/);
  assert.match(game, /ロードアウトへ戻る/);
  assert.doesNotMatch(game, /\btone\(/);
  assert.doesNotMatch(game, /["'][^"']+\.(?:mp3|ogg|wav|m4a)["']/i);
});

test("defines an ordered mission timeline after the five-second preparation window", () => {
  const eventTimes = MISSION_EVENTS.map(({ at }) => at);
  assert.deepEqual(eventTimes, [5, 20, 42, 60, 80, 103, 123, 142, 148, 168, 188, 220]);
  assert.equal(new Set(eventTimes).size, MISSION_EVENTS.length);
  assert.equal(new Set(MISSION_EVENTS.map(({ at, label }) => `${at}:${label}`)).size, MISSION_EVENTS.length);
  assert.ok(eventTimes.every((at, index) => index === 0 || at > eventTimes[index - 1]));
  assert.ok(MISSION_EVENTS.every(({ units }) => units.every(([, lane]) => Number.isInteger(lane) && lane >= 0 && lane < 3)));
  assert.deepEqual(MISSION_EVENTS[0].units, [["walker", 0], ["walker", 1], ["walker", 2]]);

  const takuyaEvents = MISSION_EVENTS.filter(({ units }) => units.some(([kind]) => kind === "takuya"));
  assert.equal(takuyaEvents.length, 1);
  assert.equal(takuyaEvents[0].at, 148);
  assert.equal(takuyaEvents[0].wave, 8);
  assert.deepEqual(takuyaEvents[0].units.find(([kind]) => kind === "takuya"), ["takuya", 1]);

  const warning = MISSION_EVENTS.find(({ at }) => at === 142);
  assert.deepEqual(warning?.units, []);
  const enrage = MISSION_EVENTS.find(({ at }) => at === 188);
  assert.equal(enrage?.bossOnly, true);
  assert.equal(MISSION_EVENTS.at(-1)?.label, "最終機会 — 感染拠点を破壊");
});
