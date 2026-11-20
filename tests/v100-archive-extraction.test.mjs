import assert from "node:assert/strict";
import test from "node:test";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { battleOutcomeFor, objectiveForBattle } from "../app/battleDefinitions.js";
import { stageVisualFor } from "../app/productionVisuals.js";
import { createStationMissionRuntime } from "../app/stationStageMechanics.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { normalizeV100BattleReport, v100BattleReportFor, v100DefenseResultText, v100DeviceResultText } from "../app/v100BattleReport.js";
import { v100MissionBriefingFor } from "../app/v100MissionBriefing.js";
import { advanceArchiveExtraction, drawArchiveExtraction, stopArchiveErase, ARCHIVE_ROUTE_Y,
  ARCHIVE_TERMINAL_X, ARCHIVE_PICKUP_X, V100_ARCHIVE_ART, V100_ARCHIVE_BACKGROUND, V100_ARCHIVE_STAGE } from "../app/v100ArchiveExtraction.js";

const definition = v100BattleDefinitionFor(V100_ARCHIVE_STAGE);
const create = () => createStationMissionRuntime(definition.missionType, definition.missionConfig);
const ally = { side: "human", hp: 45, x: ARCHIVE_TERMINAL_X - 35, y: ARCHIVE_ROUTE_Y, combatReady: true };
const enemy = { side: "zombie", hp: 100, x: ARCHIVE_TERMINAL_X, y: ARCHIVE_ROUTE_Y, combatReady: true };
const stop = (runtime, actors) => stopArchiveErase(runtime, actors, ARCHIVE_ROUTE_Y);
const tick = (runtime, fighters = [], eventIndex = 1) =>
  advanceArchiveExtraction({ runtime, fighters, dt: 1, eventIndex, routeY: ARCHIVE_ROUTE_Y });

test("only the main archive stage installs the terminal and courier art, and all six original waves remain", () => {
  const stageId = V100_ARCHIVE_STAGE;
  const plan = requiredBattleAssetPlan({ stageId });
  const art = plan.stageObjects.find(entry => entry.id === V100_ARCHIVE_ART.id);
  assert.equal(art.path, V100_ARCHIVE_ART.path);
  assert.equal(art.optional, undefined);
  assert.equal(plan.background.path, V100_ARCHIVE_BACKGROUND);
  const outbreak = requiredBattleAssetPlan({ stageId, operationId: "outbreak-ooguchi-drainage-run" });
  assert.ok(!outbreak.paths.includes(V100_ARCHIVE_ART.path));
  assert.equal(outbreak.background.path, stageVisualFor("outbreak-ooguchi-drainage-run"));
  assert.notEqual(outbreak.background.path, V100_ARCHIVE_BACKGROUND);
  assert.equal(definition.defenseEndAt - definition.prepSeconds, 83);
  assert.equal(definition.timeline.length, 6);
  assert.match(v100MissionBriefingFor(stageId).verb, /消去/u);
});

test("the terminal requires nearby support and a clear area; it never stops itself", () => {
  const runtime = create();
  assert.equal(tick(runtime, [ally], 0), runtime);
  assert.equal(stop(runtime, []), runtime);
  assert.equal(stop(runtime, [ally, enemy]), runtime);
  assert.equal(stop(runtime, [{ ...ally, hp: 0 }]), runtime);
  const ready = tick(runtime, [ally]);
  assert.equal(ready.archiveReady, true);
  assert.equal(ready.archiveStopped, false);
  assert.match(objectiveForBattle(definition, { stageMission: ready, time: 14 }), /タップ/u);
  const stopped = stop(ready, [ally]);
  assert.equal(stopped.archiveStopped, true);
  assert.equal(stop(stopped, [ally]), stopped);
});

test("each box crosses to the vehicle and waits under threat; the timer alone cannot earn a win", () => {
  let runtime = stop(create(), [ally]);
  runtime = tick(runtime);
  assert.ok(runtime.archiveDistances[0] > 0);
  const nearCourier = { ...enemy, x: ARCHIVE_PICKUP_X - 61 };
  const delayed = tick(runtime, [nearCourier]);
  assert.equal(delayed.archiveBlocked, true);
  assert.equal(delayed.archiveDistances[0], runtime.archiveDistances[0]);
  const battle = { baseHp: 840, baseMaxHp: 840, time: definition.defenseEndAt, stageMission: create() };
  assert.equal(battleOutcomeFor(definition, battle), null);
  for (const [wave, count] of [[1, 1], [3, 2], [5, 3]]) {
    for (let second = 0; second < 17; second++) runtime = tick(runtime, [], wave);
    assert.equal(runtime.archiveDelivered, count);
    assert.equal(battleOutcomeFor(definition, { ...battle, stageMission: runtime }), count === 3 ? "won" : null);
  }
  assert.equal(battleOutcomeFor(definition, { ...battle, time: definition.defenseEndAt - 1, stageMission: runtime }), null);
  assert.equal(battleOutcomeFor(definition, { ...battle, baseHp: 0, stageMission: runtime }), "lost");
});

test("the atlas is actually painted in the right states and a defeat preserves the real box count", () => {
  let runtime = stop(create(), [ally]);
  runtime = tick(runtime);
  const log = [];
  const ctx = new Proxy({ drawImage: (...args) => log.push(args.slice(1)) }, { get:(target,key) => target[key] ?? (() => {}) });
  const image = { complete: true, naturalWidth: 312 };
  const art = { [V100_ARCHIVE_ART.id]: image };
  drawArchiveExtraction(ctx, create(), art, ARCHIVE_ROUTE_Y);
  assert.equal(log[0][0],0);
  log.length = 0;
  drawArchiveExtraction(ctx, runtime, art, ARCHIVE_ROUTE_Y);
  assert.equal(log[0][0],104);
  assert.equal(log.at(-1)[1],132);
  const movingX=log.at(-1)[4];
  log.length = 0;
  drawArchiveExtraction(ctx, tick(runtime, [{ ...enemy, x: ARCHIVE_PICKUP_X - 61 }]), art, ARCHIVE_ROUTE_Y);
  assert.equal(log.at(-1)[0],208);
  assert.equal(log.at(-1)[4],movingX);
  for(let time=0;time<17;time++) runtime = tick(runtime);
  const stageId = V100_ARCHIVE_STAGE;
  const report = v100BattleReportFor({ stageId, wave:2, kills:8, missionRuntime:runtime,
    defenseProgress:{stageId,elapsedSeconds:30,durationSeconds:83},unitStats:{damageByUnit:{},damageTakenByUnit:{},healingByUnit:{}} });
  assert.deepEqual(report.archiveExtraction, { stageId, stopped:true, delivered:1 });
  assert.match(v100DeviceResultText({stageId,won:false,battleReport:report}).progress,/1\/3/u);
  assert.equal(v100DefenseResultText({stageId,won:false,battleReport:report}),null);
  assert.equal(normalizeV100BattleReport({...report,archiveExtraction:{stageId,stopped:false,delivered:1}}).archiveExtraction,undefined);
});
