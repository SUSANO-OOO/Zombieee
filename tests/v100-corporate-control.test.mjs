import test from "node:test";
import assert from "node:assert/strict";
import {
  drawV100CorporateControl, hasV100LureControl, v100ObjectiveDamageLabel, v100CorporateControlCondition,
  v100LureControlAim, v100LureControlReadout, v100LureWaveBlocked, V100_CORPORATE_CONTROLS, V100_CORPORATE_CONTROL_ART,
  V100_LURE_CONTROL_ART, V100_LURE_CONTROL_OBJECTIVE, V100_LURE_CONTROL_STAGE,
  v100ArmoryKeyStatus, V100_ARMORY_OBJECTIVE, V100_ARMORY_STAGE,
} from "../app/v100CorporateControl.js";
import {applyEnemyBaseDamage} from "../app/v100ResearchCore.js";
import {createEmergencySupportRuntime, requestAirstrike, WORLD_GEOMETRY} from "../app/gameRules.js";
import {requiredBattleAssetPlan} from "../app/battleAssetPlan.js";
import {objectiveForBattle,battleOutcomeFor} from "../app/battleDefinitions.js";
import {v100BattleDefinitionFor} from "../app/v100BattleAdapter.js";
import { V100_BRIDGE_ART } from "../app/v100BridgeEscort.js";
test("corporate objectives explain actual protection and destruction while legacy objectives remain intact",()=>{
  for(const [stageId,label] of Object.entries(V100_CORPORATE_CONTROLS)){
    const definition=v100BattleDefinitionFor(stageId);
    if (hasV100LureControl(definition) || definition.missionConfig.armoryKey) continue;
    assert.equal(objectiveForBattle(definition,{barricadeHp:1000,barricadeVulnerable:true}),`${label}を破壊`);
    const protectedObjective=objectiveForBattle(definition,{barricadeHp:1000,barricadeVulnerable:false});
    if (definition.missionConfig.v100StageNumber === 27) {
      assert.equal(definition.bossEnemyKind,null);
      assert.equal(definition.bossUnlocksEnemyBase,false);
      assert.equal(protectedObjective,"警備部隊を迎撃（最終ウェーブで防護解除）");
    } else {
      assert.equal(definition.bossUnlocksEnemyBase,true);
      assert.match(protectedObjective,definition.missionConfig.v100StageNumber===24?/フタゴを倒し/u:/変異ムガリアン社長を倒し/u);
      assert.ok(protectedObjective.endsWith(`${label}を破壊`));
    }
    const finished={baseHp:680,baseMaxHp:680,barricadeHp:0,barricadeVulnerable:true,bossDefeated:true};
    assert.equal(battleOutcomeFor(definition,finished),"won");
    assert.equal(objectiveForBattle(definition,finished),`${label}を破壊した`);
  }
  assert.equal(objectiveForBattle({stageId:"stage-mugarian-logistics-hq",missionType:"assault",missionConfig:{target:"infected-relay"}},{barricadeHp:1000,barricadeVulnerable:true}),"感染中継点を破壊");
});
test("the logistics loudspeaker can be destroyed at the start, blocks later signals and requires clearing existing enemies", () => {
  const definition = v100BattleDefinitionFor(V100_LURE_CONTROL_STAGE);
  assert.equal(definition.startsEnemyBaseVulnerable, true);
  assert.equal(definition.bossEnemyKind, null);
  assert.equal(definition.objective, V100_LURE_CONTROL_OBJECTIVE);

  const opening = definition.timeline.filter(event => !event.requiresActiveLure);
  const signals = definition.timeline.filter(event => event.requiresActiveLure);
  assert.deepEqual(opening.map(event => event.units.length), [3, 2]);
  assert.ok(opening.every(event => event.units.every(kind => kind.startsWith("red-panther-"))));
  assert.ok(opening[0].at < opening[1].advanceOnClearAfter && opening[1].advanceOnClearAfter < opening[1].at);
  assert.equal(signals.length, 3);
  assert.ok(signals.every(event => event.clearDelaySeconds === undefined));
  assert.ok(opening.at(-1).at < signals[0].at);
  assert.equal(signals[0].waitForPriorWaveClear, undefined);
  assert.ok(signals.slice(1).every(event => event.waitForPriorWaveClear === true));

  const playing = { definition, eventIndex: 0, time: signals[0].at - 12.3, barricadeHp: 1, baseHp: 200 };
  assert.equal(objectiveForBattle(definition, playing), V100_LURE_CONTROL_OBJECTIVE);
  assert.deepEqual(v100LureControlReadout(playing), { stopped: false, status: "増援まで13秒" });
  assert.equal(v100LureWaveBlocked(signals[0], playing.barricadeHp), false);
  assert.equal(battleOutcomeFor(definition, { ...playing, wavesResolved: true }), null);

  const stopped = { ...playing, barricadeHp: 0 };
  assert.deepEqual(v100LureControlReadout(stopped), { stopped: true, status: "増援停止" });
  assert.equal(objectiveForBattle(definition, stopped), "残る敵を倒して試験棟への道を開く");
  assert.ok(signals.every(event => v100LureWaveBlocked(event, stopped.barricadeHp)));
  assert.ok(opening.every(event => !v100LureWaveBlocked(event, stopped.barricadeHp)));
  assert.equal(battleOutcomeFor(definition, { ...stopped, wavesResolved: false }), null);
  assert.equal(battleOutcomeFor(definition, { ...stopped, wavesResolved: true }), "won");
  assert.equal(battleOutcomeFor(definition, { ...stopped, wavesResolved: true, baseHp: 0 }), "lost");
});

test("only an active logistics tower accepts the direct airstrike beyond the regular floor targeting range", () => {
  const definition = v100BattleDefinitionFor(V100_LURE_CONTROL_STAGE);
  const battlefield = WORLD_GEOMETRY.enemyBase;
  const lanes = [232, 280, 328];
  const g = { definition, barricadeHp: 1000 };
  const aim = v100LureControlAim(g, { x: 889, y: 266 }, battlefield, lanes);
  assert.deepEqual(aim, { x: 885, y: 328 });
  assert.equal(v100LureControlAim(g, { x: 780, y: 266 }, battlefield, lanes), null);
  assert.equal(v100LureControlAim(g, { x: 889, y: 179 }, battlefield, lanes), null);
  assert.equal(v100LureControlAim({ ...g, barricadeHp: 0 }, aim, battlefield, lanes), null);
  assert.equal(v100LureControlAim({ ...g, definition: v100BattleDefinitionFor("stage-mugarian-special-operations-armory") },
    aim, battlefield, lanes), null);

  const strike = { running: true, paused: false, over: false, supportGauge: 100, lane: 2, ...aim,
    laneCenters: lanes, runtime: createEmergencySupportRuntime(true) };
  assert.equal(requestAirstrike(strike).ok, false);
  assert.equal(requestAirstrike({ ...strike, authoredTargetX: aim.x, supportGauge: 0 }).ok, false);
  const accepted = requestAirstrike({ ...strike, authoredTargetX: aim.x });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.runtime.targetX, aim.x);
  assert.ok(accepted.supportGauge < strike.supportGauge);
});

test("authored corporate damage states follow actual protected and applied base damage without owning results",()=>{
  for(const stageId of Object.keys(V100_CORPORATE_CONTROLS)){
    if (stageId === V100_ARMORY_STAGE) continue;
    const lure=stageId==="stage-mugarian-logistics-hq";
    assert.ok(requiredBattleAssetPlan({stageId}).paths.includes(lure?V100_LURE_CONTROL_ART:V100_CORPORATE_CONTROL_ART));
    const game={definition:{stageId},barricadeHp:1000,barricadeMaxHp:1000,barricadeVulnerable:false};
    const frames=[],context=new Proxy({drawImage:(_image,left)=>frames.push(left)},{get:(target,key)=>key in target?target[key]:()=>{}});
    const draw=()=>{const before=JSON.stringify(game);assert.equal(drawV100CorporateControl(context,game,{corporateControlStates:{complete:true,naturalWidth:2172},lureControlStates:{complete:true,naturalWidth:2172}},{attackX:875},[212,282,352]),true);assert.equal(JSON.stringify(game),before);};
    applyEnemyBaseDamage(game,1000);draw();assert.equal(game.barricadeHp,1000);
    game.barricadeVulnerable=true;applyEnemyBaseDamage(game,300);draw();applyEnemyBaseDamage(game,400);draw();applyEnemyBaseDamage(game,300);draw();
    assert.deepEqual(frames,lure?[0,530,1060,1560]:[0,530,1030,1530]);
    assert.throws(()=>drawV100CorporateControl(context,game,{}, {attackX:875},[212,282,352]),/decoded/);
  }
});

test("projectile and melee damage announcements name all five corporate targets and preserve legacy/research fallback",()=>{
  for(const [stageId,label]of Object.entries(V100_CORPORATE_CONTROLS)){
    const game={definition:v100BattleDefinitionFor(stageId),researchCoreTargets:null,barricadeHp:700,barricadeVulnerable:true};
    const before=structuredClone(game);
    for(const state of ["損傷","大破"])assert.equal(v100ObjectiveDamageLabel(game,state),label+" // "+state);
    assert.deepEqual(game,before);
    const legacy={...game,definition:{stageId,missionConfig:{}}};
    assert.equal(v100ObjectiveDamageLabel(legacy,"損傷"),"感染拠点 // 損傷");
    assert.equal(v100ObjectiveDamageLabel({...game,researchCoreTargets:[{hp:700}]},"大破"),"研究中枢の破壊目標 // 大破");
  }
  assert.equal(v100ObjectiveDamageLabel({definition:{missionConfig:{}}},"大破"),"感染拠点 // 大破");
});

test("the armory is cleared only after the actual command vehicle is stopped and the key recovered", () => {
  const definition = v100BattleDefinitionFor(V100_ARMORY_STAGE);
  assert.equal(definition.objective, V100_ARMORY_OBJECTIVE);
  const base = { baseHp: 680, barricadeHp: 1000, barricadeVulnerable: false,
    stageMission: {}, eventIndex: definition.timeline.length, enemySpawn: { pending: [] }, fighters: [] };
  assert.equal(objectiveForBattle(definition, base), V100_ARMORY_OBJECTIVE);
  const stopped = { ...base, barricadeHp: 0, barricadeVulnerable: true };
  assert.equal(v100ArmoryKeyStatus(definition, { ...stopped, eventIndex: 1 }), "contested");
  assert.equal(v100ArmoryKeyStatus(definition, { ...stopped, enemySpawn: { pending: [{}] } }), "contested");
  assert.equal(v100ArmoryKeyStatus(definition, { ...stopped, fighters: [{ side: "zombie", hp: 1 }] }), "contested");
  assert.equal(v100ArmoryKeyStatus(definition, { ...stopped, fighters: [{ side: "human", hp: 0 }] }), "ready");
  assert.equal(battleOutcomeFor(definition, { ...stopped, wavesResolved: true }), null);
  const collected = { ...stopped, stageMission: { armoryKeyRecovered: true }, wavesResolved: true };
  assert.equal(battleOutcomeFor(definition, collected), "won");
  assert.equal(battleOutcomeFor(definition, { ...collected, wavesResolved: false }), null);
  assert.equal(battleOutcomeFor(definition, { ...collected, baseHp: 0 }), "lost");

  const plan = requiredBattleAssetPlan({ stageId: V100_ARMORY_STAGE });
  assert.ok(plan.paths.includes(V100_BRIDGE_ART.path));
  assert.ok(!plan.paths.includes(V100_CORPORATE_CONTROL_ART));
  const offsets = [], rotations = [], images = [];
  const ctx = { save() {}, restore() {}, translate(x) { offsets.push(x); },
    rotate(angle) { rotations.push(angle); }, drawImage(image) { images.push(image); } };
  const sprite = { complete: true, naturalWidth: 1500 };
  for (const [state, time] of [[base, definition.prepSeconds], [base, definition.prepSeconds + 3],
                               [stopped, definition.prepSeconds + 3]]) {
    assert.equal(drawV100CorporateControl(ctx, { ...state, definition, time },
      { [V100_BRIDGE_ART.id]: sprite }, WORLD_GEOMETRY.enemyBase, [212, 282, 352]), true);
  }
  assert.ok(offsets[0] > offsets[1]);
  assert.equal(offsets[1], offsets[2]);
  assert.equal(rotations.length, 1);
  assert.deepEqual(images, [sprite, sprite, sprite]);
});

test("corporate condition text follows the authored70/35percent art states at any target capacity",()=>{
  for(const max of [350,1000,1600]){
    for(const [ratio,label]of [[1,"健全"],[.70001,"健全"],[.7,"損傷"],[.35001,"損傷"],[.35,"大破"],[0,"破壊"],[-.1,"破壊"]]){
      const game=Object.freeze({barricadeHp:max*ratio,barricadeMaxHp:max});
      assert.equal(v100CorporateControlCondition(game),label);
    }
  }
});
