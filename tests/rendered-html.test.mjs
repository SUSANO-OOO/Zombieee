import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  BARRICADE_MAX_HP,
  COMMAND_MAX,
  COMMAND_REGEN,
  CONTAINER_DEF,
  LANE_NAMES,
  LANE_Y,
  MISSION_EVENTS,
  PREP_SECONDS,
  RAGE_MAX,
  SUPPORT_DEFS,
  TACTIC_MODES,
  UNIT_CARDS,
  WORLD_GEOMETRY,
  advanceCommand,
  advanceLimitFor,
  autonomousTargetScore,
  barricadeState,
  battleOutcome,
  canDeploy,
  containerBlocksEnemy,
  containerPlacementCheck,
  crawlerSiegeDamage,
  crawlerThreatLevel,
  damageContainer,
  humanAttackMultiplier,
  interceptorTargetScore,
  isCrawlerRouteBlocker,
  laneForY,
  objectiveFor,
  phaseAt,
  rageReward,
  roleTargetBias,
  structureDamageMultiplier,
  tacticTargetBias,
} from "../app/gameRules.js";

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

test("server-renders Ashfall Outpost Early Access 0.4.0", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>ASHFALL OUTPOST — Early Access 0\.4\.0/);
  assert.match(html, /aria-label="ASHFALL OUTPOST game"/);
  assert.match(html, /<canvas[^>]*width="960"[^>]*height="540"/);
  assert.match(html, /aria-label="Three-lane wasteland battlefield"/);
  assert.match(html, /EARLY ACCESS BUILD 0\.4\.0 · TACTICAL COMMAND · IRON BREACH/);
  assert.match(html, /Deploy during the five-second window/);
  assert.match(html, /bring down TAKUYA/);
  assert.match(html, /break the iron barricade sealing all three routes/);
  assert.match(html, /TACTIC/);
  assert.match(html, /IRON BARRICADE/);
  assert.match(html, /PREPARING ASSETS/);
  assert.match(html, /CRAWLER SYSTEM CHECK/);
  assert.match(html, />BGM</);
  assert.match(html, />SFX</);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships the three-route barricade objective and its dedicated artwork", async () => {
  const [game, rules, css, layout] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/gameRules.js", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  await Promise.all([
    access(new URL("../public/battlefield-v4.png", import.meta.url)),
    access(new URL("../public/iron-barricade-v1.png", import.meta.url)),
    access(new URL("../public/crawler-bus-v1.png", import.meta.url)),
    access(new URL("../public/takuya-boss-sprites-v2.png", import.meta.url)),
    access(new URL("../public/ranger-sprites-v1.png", import.meta.url)),
    access(new URL("../public/brawler-sprites-v1.png", import.meta.url)),
    access(new URL("../public/scout-sprites-v2.png", import.meta.url)),
    access(new URL("../public/breaker-sprites-v2.png", import.meta.url)),
    access(new URL("../public/gunner-sprites-v1.png", import.meta.url)),
    access(new URL("../public/medic-sprites-v1.png", import.meta.url)),
  ]);

  assert.match(game, /loadImage\("\/iron-barricade-v1\.png"/);
  assert.match(game, /function drawBarricade/);
  assert.match(game, /A single shared-HP barricade physically closes all three routes/);
  assert.match(game, /barricadeHp: number/);
  assert.match(game, /barricadeHp: BARRICADE_MAX_HP/);
  assert.match(game, /g\.barricadeHp = Math\.max\(0, g\.barricadeHp - structureDamage\)/);
  assert.match(game, /const outcome = battleOutcome\(g\.baseHp, g\.barricadeHp\)/);
  assert.match(game, /TAKUYA DOWN — BARRICADE EXPOSED/);
  assert.match(game, /IRON BARRICADE \/\/ BUCKLING/);
  assert.match(game, /IRON BARRICADE \/\/ BREACH IMMINENT/);
  assert.match(game, /BARRICADE BREACHED/);
  assert.match(rules, /LAST CHANCE — BREAK THE BARRICADE/);
  assert.match(css, /\.barrier-health/);
  assert.match(css, /\.barrier-health\.vulnerable/);
  assert.match(css, /\.barrier-health\.hit/);
  assert.match(layout, /ASHFALL OUTPOST — Early Access 0\.4\.0/);
  assert.match(layout, /rel="preload" as="image" href="\/iron-barricade-v1\.png"/);
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
  assert.match(game, /BAY \{hud\.deployQueue\}\/3/);
  assert.match(game, /const setTactic/);
  assert.match(game, /const cycleTactic/);
  assert.match(game, /TACTIC \/\/ \$\{tactic\.toUpperCase\(\)\}/);
  assert.match(game, /event\.key\.toLowerCase\(\) === "r"/);
  assert.match(game, /aria-label=\{`作戦方針を切り替え（現在：\$\{hud\.tactic\}）`\}/);
  assert.match(game, /advanceLimitFor\(g\.tactic, g\.phase, g\.barricadeVulnerable\)/);
  assert.match(game, /tacticTargetBias\(g\.tactic, enemy\.x\)/);
  assert.match(css, /\.tactic-cycle\.defend/);
  assert.match(css, /\.tactic-cycle\.assault/);
});

test("applies the COMMAND economy, deployment gates, and shared world geometry", () => {
  assert.equal(COMMAND_MAX, 100);
  assert.equal(COMMAND_REGEN, 3.5);
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
    musterX: 124,
    musterY: 352,
    crawler: { x: -12, y: 219, width: 230, height: 144, exitX: 128 },
    barricade: { drawX: 790, drawY: 104, width: 168, height: 306, attackX: 800, enemySpawnMinX: 746, enemySpawnMaxX: 778 },
    supportMinX: 230,
    supportMaxX: 760,
    threatNearX: 362,
    threatStartX: 482,
  });
  assert.ok(WORLD_GEOMETRY.barricade.drawY < LANE_Y[0]);
  assert.ok(WORLD_GEOMETRY.barricade.drawY + WORLD_GEOMETRY.barricade.height > LANE_Y[2]);
  assert.ok(WORLD_GEOMETRY.barricade.enemySpawnMaxX < WORLD_GEOMETRY.barricade.drawX);
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

  assert.equal(objectiveFor(1, false), "HOLD THE THREE ROUTES");
  assert.equal(objectiveFor(2, false), "PUSH TO THE IRON LINE");
  assert.equal(objectiveFor(3, false), "ELIMINATE TAKUYA");
  assert.equal(objectiveFor(3, true), "BREACH THE ENEMY BARRICADE");

  assert.equal(crawlerSiegeDamage(15, 1), 11);
  assert.equal(crawlerSiegeDamage(15, 2), 14);
  assert.equal(crawlerSiegeDamage(15, 3), 15);
  assert.equal(crawlerThreatLevel(Infinity), 0);
  assert.equal(crawlerThreatLevel(482), 0);
  assert.equal(crawlerThreatLevel(342), .5);
  assert.equal(crawlerThreatLevel(202), 1);

  assert.deepEqual(
    Object.fromEntries(["walker", "runner", "spitter", "crusher", "shade", "abomination", "takuya", "turned"].map((kind) => [kind, rageReward(kind)])),
    { walker: 4, runner: 5, spitter: 8, crusher: 14, shade: 22, abomination: 20, takuya: 25, turned: 7 },
  );
  assert.deepEqual(SUPPORT_DEFS.map(({ kind, cost }) => [kind, cost]), [
    ["barrel", 20],
    ["medkit", 25],
    ["molotov", 35],
    ["airstrike", 60],
  ]);
  assert.deepEqual(UNIT_CARDS.map(({ kind, desc }) => [kind, desc]), [
    ["scout", "MARK / INTERCEPT"],
    ["ranger", "ANTI-SPITTER"],
    ["brute", "TANK / BREACH"],
    ["brawler", "FINISHER"],
    ["gunner", "ANTI-HEAVY"],
    ["medic", "HEAL / PURGE"],
  ]);
});

test("validates, damages, and releases the battlefield container without changing Crawler priority", async () => {
  const base = { running: true, paused: false, over: false, scrap: CONTAINER_DEF.cost, lane: 1, x: 440, objects: [], fighters: [] };
  assert.deepEqual(containerPlacementCheck(base), { ok: true, reason: "配置できます" });
  assert.equal(containerPlacementCheck({ ...base, running: false }).ok, false);
  assert.equal(containerPlacementCheck({ ...base, paused: true }).reason, "一時停止中は配置できません");
  assert.equal(containerPlacementCheck({ ...base, scrap: CONTAINER_DEF.cost - 1 }).reason, "スクラップが不足しています");
  assert.equal(containerPlacementCheck({ ...base, x: CONTAINER_DEF.minX - 1 }).reason, "配置可能範囲外です");
  assert.equal(containerPlacementCheck({ ...base, objects: [{ lane: 1, x: 500, y: LANE_Y[1], phase: "active" }] }).reason, "このレーンには設置済みです");
  assert.equal(containerPlacementCheck({ ...base, objects: [
    { lane: 0, x: 300, y: LANE_Y[0], phase: "active" },
    { lane: 2, x: 600, y: LANE_Y[2], phase: "dropping" },
  ] }).reason, "設置上限は2個です");
  assert.equal(containerPlacementCheck({ ...base, fighters: [{ x: 450, y: LANE_Y[1], hp: 10 }] }).reason, "ユニットに近すぎます");

  assert.deepEqual(damageContainer(CONTAINER_DEF.maxHp, 35), { hp: CONTAINER_DEF.maxHp - 35, phase: "active" });
  assert.deepEqual(damageContainer(20, 35), { hp: 0, phase: "destroying" });
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 1, containerX: 440, containerLane: 1, phase: "active" }), true);
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 0, containerX: 440, containerLane: 1, phase: "active" }), false);
  assert.equal(containerBlocksEnemy({ enemyX: 400, enemyLane: 1, containerX: 440, containerLane: 1, phase: "active" }), false);
  assert.equal(containerBlocksEnemy({ enemyX: 600, enemyLane: 1, containerX: 440, containerLane: 1, phase: "destroying" }), false);

  const game = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(game, /battlefieldObjects: BattlefieldObject\[\]/);
  assert.match(game, /targetObjectId: number \| null/);
  assert.match(game, /kind: "container", lane, x, y: LANE_Y\[lane\]/);
  assert.match(game, /const routeLane = f\.lane/);
  assert.match(game, /physicalContact \?\? \(blockingContainer \? undefined/);
  assert.match(game, /!target && !objectTarget && f\.x > 520/);
  assert.match(game, /objectTarget \? Math\.abs\(f\.x - objectTarget\.x\)/);
  assert.match(game, /防護コンテナ破壊/);
  assert.match(game, /drawPlacementIndicator/);
  assert.match(game, /CONTAINER_DEF\.cost/);
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
  assert.equal(MISSION_EVENTS.at(-1)?.label, "LAST CHANCE — BREAK THE BARRICADE");
});
