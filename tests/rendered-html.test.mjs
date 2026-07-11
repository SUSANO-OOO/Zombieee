import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  COMMAND_MAX,
  COMMAND_REGEN,
  LANE_NAMES,
  LANE_Y,
  MISSION_EVENTS,
  RAGE_MAX,
  SUPPORT_DEFS,
  UNIT_CARDS,
  advanceCommand,
  autonomousTargetScore,
  canDeploy,
  interceptorTargetScore,
  isCrawlerRouteBlocker,
  laneForY,
  objectiveFor,
  phaseAt,
  rageReward,
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

test("server-renders Ashfall Outpost Early Access 0.3.0", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>ASHFALL OUTPOST — Early Access 0\.3\.0/);
  assert.match(html, /aria-label="ASHFALL OUTPOST game"/);
  assert.match(html, /<canvas[^>]*width="960"[^>]*height="540"/);
  assert.match(html, /aria-label="Three-lane wasteland battlefield"/);
  assert.match(html, /BEGIN OPERATION/);
  assert.match(html, /AIRSTRIKE/);
  assert.match(html, /COMMAND/);
  assert.match(html, /RAGE/);
  assert.match(html, /AUTO-DEPLOY/);
  assert.match(html, />BGM</);
  assert.match(html, />SFX</);
  assert.match(html, /EARLY ACCESS BUILD 0\.3\.0 · THREE-LANE WARFARE · DYNAMIC BGM/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships the upgraded three-lane battlefield and combat systems", async () => {
  const [game, rules, css, layout] = await Promise.all([
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/gameRules.js", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  await access(new URL("../public/battlefield-v2.png", import.meta.url));
  await access(new URL("../public/ranger-sprites-v1.png", import.meta.url));
  await access(new URL("../public/brawler-sprites-v1.png", import.meta.url));
  await access(new URL("../public/scout-sprites-v2.png", import.meta.url));
  await access(new URL("../public/breaker-sprites-v2.png", import.meta.url));
  await access(new URL("../public/gunner-sprites-v1.png", import.meta.url));
  await access(new URL("../public/medic-sprites-v1.png", import.meta.url));
  await access(new URL("../public/infected-sprites-v1.png", import.meta.url));
  await access(new URL("../public/crusher-sprites-v1.png", import.meta.url));
  await access(new URL("../public/spitter-sprites-v1.png", import.meta.url));
  await access(new URL("../public/infected-nest-v1.png", import.meta.url));
  await access(new URL("../public/takuya-boss-sprites-v2.png", import.meta.url));
  await access(new URL("../public/shade-raider-sprites-v1.png", import.meta.url));
  await access(new URL("../public/crawler-bus-v1.png", import.meta.url));
  assert.match(game, /battlefield-v2\.png/);
  assert.match(game, /ranger-sprites-v1\.png/);
  assert.match(game, /brawler-sprites-v1\.png/);
  assert.match(game, /gunner-sprites-v1\.png/);
  assert.match(game, /medic-sprites-v1\.png/);
  assert.match(game, /infected-nest-v1\.png/);
  assert.match(game, /takuya-boss-sprites-v2\.png/);
  assert.match(game, /shade-raider-sprites-v1\.png/);
  assert.match(game, /crawler-bus-v1\.png/);
  assert.match(rules, /ELITE ENEMY — SHADE/);
  assert.match(rules, /BOSS — TAKUYA \/ IRON JUDGE/);

  assert.match(game, /no lane-map overlay is drawn over the battlefield/);
  assert.doesNotMatch(game, /fillText\(`0\$\{lane \+ 1\}/);
  assert.doesNotMatch(game, /fillText\("MUSTER"/);
  assert.doesNotMatch(game, /ctx\.arc\(BASE_X, y, 16/);
  assert.match(game, /aria-label="Three-lane wasteland battlefield"/);
  assert.match(game, /advanceCommand\(g\.energy, dt\)/);
  assert.match(game, /canDeploy/);
  assert.match(game, /rageReward/);
  assert.match(game, /<span>COMMAND<\/span>/);
  assert.match(game, /<span>RAGE<\/span>/);
  assert.match(game, /deploySupport/);
  assert.match(game, /damageEnemiesInRadius/);
  assert.match(game, /supportDefs\.map/);
  assert.match(rules, /IRON BARREL/);
  assert.match(rules, /MEDKIT/);
  assert.match(rules, /MOLOTOV/);
  assert.match(rules, /AIRSTRIKE/);

  assert.match(game, /supportCooldown/);
  assert.match(game, /const MUSTER_X = 148/);
  assert.match(game, /anchorLane: Lane \| null/);
  assert.match(game, /targetId: number \| null/);
  assert.match(game, /laneForY/);
  assert.match(game, /autonomousTargetScore/);
  assert.match(game, /targetClaims/);
  assert.match(game, /fighterDistance\(f, target\)/);
  assert.match(game, /enemyLaneSpeedFor/);
  assert.match(game, /routeBlockers/);
  assert.match(game, /availableBlockers/);
  assert.match(game, /isCrawlerRouteBlocker/);
  assert.match(game, /claimsFromOthers < defenderCapacity\(human\)/);
  assert.match(game, /const crawlerInRange = f\.x - BASE_X <= f\.range \+ 10/);
  assert.match(game, /physicalContact = crawlerInRange \? undefined/);
  assert.match(game, /!target && f\.x > 520/);
  assert.doesNotMatch(game, /f\.anchorLane = laneForY\(target\.y/);
  assert.match(game, /interceptorClaims/);
  assert.match(game, /interceptorTargetScore/);
  assert.match(game, /f\.anchorLane = routes\.reduce/);
  assert.match(game, /The CRAWLER remains the objective/);
  assert.match(game, /zombieTargetFloor === null \? proposedX/);
  assert.match(game, /Queue separation keeps the lead attacker fixed/);
  assert.match(game, /zombieTargetFloor/);
  assert.match(game, /CRAWLER DEPLOYED/);
  assert.match(game, /onClick=\{\(\) => deployHuman\(card\.kind\)\}/);
  assert.doesNotMatch(game, /TAP TOP \/ MID \/ LOW LANE/);
  assert.doesNotMatch(game, /event\.key\.toLowerCase\(\) === "a"/);
  assert.match(game, /reviveIn/);
  assert.match(game, /medicNearby/);
  assert.match(game, /kind: "turned"/);
  assert.match(game, /SURVIVOR TURNED/);
  assert.match(game, /phaseAt\(g\.time\)/);
  assert.match(game, /PHASE II — PUSH THE CHECKPOINT/);
  assert.match(game, /PHASE III — IRON JUDGE/);
  assert.match(game, /nestUnlocked/);

  assert.match(game, /const startMusic/);
  assert.match(game, /type MusicMode = "normal" \| "danger" \| "boss"/);
  assert.match(game, /syncMusicMode/);
  assert.match(game, /normalBus/);
  assert.match(game, /dangerBus/);
  assert.match(game, /bossBus/);
  assert.match(game, /playEndJingle/);
  assert.match(game, /const stopJingle/);
  assert.match(game, /scheduled < 2/);
  assert.match(game, /master\.gain\.setValueAtTime\(\.16/);
  assert.match(game, /const melody = \[220/);
  assert.match(game, /musicStartTokenRef/);
  assert.match(game, /data-playing=\{musicActive\}/);
  assert.match(game, /BGMをミュート/);
  assert.match(game, /効果音をミュート/);
  assert.match(game, /DYNAMIC BGM/);
  assert.match(game, /abomination/);
  assert.match(game, /spitter/);
  assert.match(game, /damageTexts/);
  assert.match(game, /corpses/);
  assert.match(game, /comboTime/);
  assert.match(game, /if \(f\.hp <= 0\) continue/);
  assert.match(css, /orientation:portrait/);
  assert.match(layout, /ASHFALL OUTPOST — Early Access 0\.3\.0/);
});

test("applies the COMMAND economy and deployment gates at their boundaries", () => {
  assert.equal(COMMAND_MAX, 100);
  assert.equal(COMMAND_REGEN, 3.5);
  assert.equal(RAGE_MAX, 100);
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
  assert.equal(LANE_Y.length, 3);
  assert.equal(new Set(LANE_Y).size, 3);
  assert.equal(laneForY(LANE_Y[0], 1), 0);
  assert.equal(laneForY(275, 1), 1);
  assert.equal(laneForY(270, 1), 0);
  assert.equal(laneForY(LANE_Y[2], 1), 2);
  assert.deepEqual(UNIT_CARDS.map(({ kind, deployCooldown }) => [kind, deployCooldown]), [
    ["scout", 8],
    ["ranger", 11],
    ["brute", 18],
    ["brawler", 13],
    ["gunner", 15],
    ["medic", 20],
  ]);
});

test("scores autonomous targets without collapsing every unit onto one enemy", () => {
  assert.equal(autonomousTargetScore({ distance: 300, claims: 0, capacity: 1, enemyX: 700 }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 1, capacity: 1, enemyX: 700 }), 382);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 1, capacity: 1, enemyX: 700, isCurrent: true }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 1, capacity: 2, enemyX: 700 }), 300);
  assert.equal(autonomousTargetScore({ distance: 300, claims: 0, capacity: 1, enemyX: 250 }), 120);
});

test("distributes enemy interceptors without sending them backward", () => {
  assert.equal(interceptorTargetScore({ distance: 120, claims: 0, capacity: 1 }), 120);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 1, capacity: 1 }), 216);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 1, capacity: 1, isCurrent: true }), 120);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 2, capacity: 2 }), 216);
  assert.equal(interceptorTargetScore({ distance: 120, claims: 0, capacity: 1, rearward: 12 }), 144);
});

test("only treats defenders on the active Crawler route as blockers", () => {
  const base = { enemyX: 700, defenderX: 620, routeY: LANE_Y[0] };
  assert.equal(isCrawlerRouteBlocker({ ...base, defenderY: LANE_Y[0] }), true);
  assert.equal(isCrawlerRouteBlocker({ ...base, defenderY: LANE_Y[2] }), false);
  assert.equal(isCrawlerRouteBlocker({ ...base, defenderX: 590, defenderY: LANE_Y[0] }), false);
  assert.equal(isCrawlerRouteBlocker({ ...base, defenderX: 710, defenderY: LANE_Y[0] }), false);
  assert.equal(isCrawlerRouteBlocker({ ...base, defenderY: LANE_Y[0] + 31 }), false);
});

test("returns the intended phases, objectives, RAGE rewards, and support costs", () => {
  assert.equal(phaseAt(0), 1);
  assert.equal(phaseAt(59.999), 1);
  assert.equal(phaseAt(60), 2);
  assert.equal(phaseAt(137.999), 2);
  assert.equal(phaseAt(138), 3);

  assert.equal(objectiveFor(1, false), "HOLD ALL THREE LANES");
  assert.equal(objectiveFor(2, false), "PUSH TO THE CHECKPOINT");
  assert.equal(objectiveFor(3, false), "ELIMINATE TAKUYA");
  assert.equal(objectiveFor(3, true), "DESTROY THE INFECTED NEST");

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
});

test("defines a unique ordered mission timeline with TAKUYA at 138 seconds", () => {
  const eventTimes = MISSION_EVENTS.map(({ at }) => at);
  assert.deepEqual(eventTimes, [0, 20, 42, 60, 80, 103, 123, 132, 138, 158, 178, 210]);
  assert.equal(new Set(eventTimes).size, MISSION_EVENTS.length);
  assert.equal(new Set(MISSION_EVENTS.map(({ at, label }) => `${at}:${label}`)).size, MISSION_EVENTS.length);
  assert.ok(eventTimes.every((at, index) => index === 0 || at > eventTimes[index - 1]));
  assert.ok(MISSION_EVENTS.every(({ units }) => units.every(([, lane]) => Number.isInteger(lane) && lane >= 0 && lane < 3)));

  const takuyaEvents = MISSION_EVENTS.filter(({ units }) => units.some(([kind]) => kind === "takuya"));
  assert.equal(takuyaEvents.length, 1);
  assert.equal(takuyaEvents[0].at, 138);
  assert.equal(takuyaEvents[0].wave, 8);
  assert.deepEqual(takuyaEvents[0].units.find(([kind]) => kind === "takuya"), ["takuya", 1]);

  const warning = MISSION_EVENTS.find(({ at }) => at === 132);
  assert.deepEqual(warning?.units, []);
  const enrage = MISSION_EVENTS.find(({ at }) => at === 178);
  assert.equal(enrage?.bossOnly, true);
});
