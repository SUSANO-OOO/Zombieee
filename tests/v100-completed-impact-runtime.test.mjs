import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {beginV102GoreStep,finishV102GoreStep,noteV102GoreImpact,noteV102GorePeriodicDamage,getV102GoreSnapshot} from '../app/v102CombatGore.js';
import {advanceAreaEffects} from '../app/gameRules.js';
import {battleVoiceReady} from '../app/v104CombatAudio.js';
import {weaponCueForUnit,LEGACY_SFX_CUE_MAP} from '../app/productionAudio.js';
import {
  advancePendingWeaponHits,
  cancelPendingWeaponTransaction,
  createCompletedAttackImpactReceipt,
  linkedWeaponTransactionId,
} from "../app/combatPresentation.js";

const source = await readFile(process.env.QUALITY_BURST_AUDIO_SOURCE ?? new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const found = [];
function walk(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'committedAttackSequence') found.push(['committed-sequence',node]);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'sharedEvent'
    && ts.isObjectLiteralExpression(node.initializer)
    && node.initializer.properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(tree)==='raiderSecondary'&&p.initializer.kind===ts.SyntaxKind.FalseKeyword)) found.push(['gunner-emitter',node]);
  if(ts.isExpressionStatement(node)&&ts.isBinaryExpression(node.expression)
    &&node.expression.left.getText(tree)==='f.attackSequence'
    &&node.expression.operatorToken.kind===ts.SyntaxKind.PlusEqualsToken)found.push(['sequence-increment',node]);
  if (ts.isIfStatement(node) && node.expression.getText(tree) === 'f.kind !== "mrs-chiha"') found.push(['structure-first-round-audio',node]);
  if (ts.isIfStatement(node) && node.expression.getText(tree).startsWith('roleEffect && ![')) found.push(['legacy-role-audio',node]);
  if (ts.isIfStatement(node) && ts.isPrefixUnaryExpression(node.expression)
    && node.expression.operator === ts.SyntaxKind.ExclamationToken
    && ts.isIdentifier(node.expression.operand)
    && node.expression.operand.text === 'defersMrsLauncherAudio') found.push(['first-round-audio',node]);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "appendCompletedAttackImpact") found.push(["helper", node]);
  if (ts.isForOfStatement(node)) {
    const expression = ts.isAsExpression(node.expression) ? node.expression.expression : node.expression;
    if (ts.isPropertyAccessExpression(expression)
      && ts.isIdentifier(expression.expression) && expression.expression.text === "pendingWeaponStep"
      && expression.name.text === "due") found.push(["dispatch", node]);
  }
  if (ts.isIfStatement(node) && ts.isBinaryExpression(node.expression)) {
    const left = node.expression.left;
    if (ts.isPropertyAccessExpression(left)
      && ts.isIdentifier(left.expression) && left.expression.text === "attackObservationBase"
      && left.name.text === "mode" && ts.isStringLiteral(node.expression.right)
      && node.expression.right.text === "direct") found.push(["direct", node]);
  }
  ts.forEachChild(node, walk);
}
walk(tree);
const textFor = (key) => {
  const nodes = found.filter(([name]) => name === key);
  assert.equal(nodes.length, 1, `one actual ${key} owner must exist`);
  return nodes[0][1].getText(tree);
};
const helper = textFor("helper");
const dispatch = textFor("dispatch");
const direct = textFor("direct");
const compile = (body) => ts.transpileModule(`${helper}\n${body}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const dispatchCode = compile(dispatch);
const directCode = compile(direct);

const observation = (mode) => ({
  battleGeneration: 2,
  sourceId: 3,
  sourceSide: mode === "enemy-projectile" ? "zombie" : "human",
  sourceKind: mode === "enemy-projectile" ? "spitter" : mode === "grenade" ? "mrs-chiha" : "gunner",
  attackSequence: 7,
  targetId: 1,
  targetSide: mode === "enemy-projectile" ? "human" : "zombie",
  targetKind: mode === "enemy-projectile" ? "ranger" : "walker",
  impactOrdinal: 0,
  mode: mode === "grenade" ? "delayed" : "projectile",
  committedAtBattleTime: 1,
  audioCueId: "exact-production-cue",
  audioReceiptId: "combat-attack:2:3:7",
});

function runContact(mode, options = {}) {
  const original = observation(mode);
  const observed = options.observed === false ? undefined : { ...original, ...options.observation };
  const primary = {
    id: 1, side: original.targetSide, kind: original.targetKind,
    x: options.outsideRadius ? 100 : 0, y: 0,
    hp: options.hp ?? 70, combatReady: true,
    contained: options.contained === true, flash: 0, knock: 0,
  };
  const secondary = { ...primary, id: 2, x: 0, hp: 70, contained: false };
  const requests = options.requests ?? [{
    cueId: original.audioCueId, receiptId: original.audioReceiptId,
    ownerId: original.sourceId, activationId: original.attackSequence,
  }];
  const g = {
    time: 2, battleAudioGeneration: options.generation ?? 2,
    completedAttackImpacts: [], pendingWeaponHits: [],
    fighters: [...(options.missingTarget ? [secondary] : [primary, secondary]),
      ...(options.sourceActor ? [{id:3,side:'human',kind:'gunner',hp:70,combatReady:true,...options.sourceActor}] : [])],
    roleMetrics: { raiderSuppressionApplications: 0, raiderPierceHits: 0 },
  };
  const hits = Array.from({ length: options.hits ?? 1 }, (_, shotIndex) => ({
    eventKind: options.eventKind ?? "impact", applyDamage: options.applyDamage !== false,
    remainingSeconds: 0, transactionId: `3:7:fighter:1:${shotIndex}`,
    targetKind: "fighter", targetSide: original.targetSide, targetId: 1,
    sourceId: 3, attackSequence: original.attackSequence, weapon: original.sourceKind,
    targetX: 0, targetY: -28, originX: 0,
    damageMode: mode, damage: 13, shotIndex, recoil: 0,
    raiderLineHit: mode === "direct",
    attackObservation: observed ? { ...observed, impactOrdinal: shotIndex } : undefined,
    ...options.hit,
  }));
  const effects = [];
  const goreStep=options.gore?beginV102GoreStep(Object.assign(g,{definition:{missionConfig:{v100StageNumber:1}},corpses:[]})):null;
  const record = (kind) => (...args) => { effects.push([kind, ...args]); };
  const context = {
    battleVoiceReady,
    noteV102GoreImpact,
    g, pendingWeaponStep: { due: hits }, canceledWeaponTransactions: new Set(),
    createCompletedAttackImpactReceipt, cancelPendingWeaponTransaction,
    productionCueQaLogRef: { current: requests },
    productionMixerRef: { current: true },
    Math: Object.assign(Object.create(Math), { random: () => { effects.push(["rng"]); return .9; } }),
    applyIncomingHumanDamage: (_game, target, damage) => {
      target.hp = Math.max(0, target.hp - damage);
      return { targetDamage: damage };
    },
    enemyProjectilePresentationFor: () => ({ color: "acid" }),
    MANUAL_ABILITY_REGISTRY: { "mrs-chiha": { grenadeRadius: 50, grenadeSplashMultiplier: .5 } },
    effectDistance: (target, point) => Math.hypot(target.x - point.x, target.y - point.y),
    applyRaiderSuppression: () => ({ stacks: 1, remainingSeconds: 1, speedMultiplier: .8 }),
    recordUnitDamage: (_game, ...args) => record("unit-damage")(...args),
    addDamageText: (_game, ...args) => record("damage-text")(...args),
    addParticles: (_game, ...args) => record("particles")(...args),
    addSemanticBattlePresentation: (_game, ...args) => record("semantic-vfx")(...args),
    addWeaponShot: (_game, ...args) => record("weapon-vfx")(...args),
    playProductionCue: record("production-audio"),
    playCue: record("fallback-audio"),
    humanVoiceCueForUnit: () => "human-hurt",
    enemyVoiceCue: () => "enemy-hurt",
    unitAudioCueFor: (_kind, _category, event) => event,
    weaponCueForUnit,
  };
  vm.runInNewContext(dispatchCode, context);
  if(options.burn){
    const area=advanceAreaEffects({fighters:g.fighters,seconds:.1,areaEffects:[{id:1,kind:'burn',x:100,y:0,radius:30,remaining:1,amountPerSecond:10,phase:'active'}]});
    for(const change of area.changes)if(change.kind==='damage')noteV102GorePeriodicDamage(g,change.id,change.amount,'burn');
    g.fighters=area.fighters;
  }
  if(goreStep)finishV102GoreStep(g,goreStep);
  return JSON.parse(JSON.stringify({
    receipts: g.completedAttackImpacts,
    gameplay: { fighters: g.fighters, roleMetrics: g.roleMetrics, effects, pendingCount: g.pendingWeaponHits.length },
    ...(options.gore?{gore:getV102GoreSnapshot(g)}:{}),
  }));
}

for (const mode of ["enemy-projectile", "grenade", "direct"]) {
  test(`${mode}: actual contact emits one exact receipt for normal and lethal impact without gameplay changes`, () => {
    for (const hp of [70, 5]) {
      const active = runContact(mode, { hp });
      const inactive = runContact(mode, { hp, observed: false });
      assert.deepEqual(active.gameplay, inactive.gameplay);
      assert.equal(inactive.receipts.length, 0);
      assert.equal(active.receipts.length, 1);
      assert.deepEqual(active.receipts[0], createCompletedAttackImpactReceipt({
        ...observation(mode), contactAtBattleTime: 2,
        reactionOutcome: hp === 5 ? "defeated" : "hit", audioRequestObserved: true,
      }));
    }
  });

  test(`${mode}: missing/dead/contained exact targets and non-damage events emit no borrowed receipt`, () => {
    for (const options of [{ missingTarget: true }, { hp: 0 }, { contained: true }, { applyDamage: false }]) {
      const active = runContact(mode, options);
      assert.equal(active.receipts.length, 0);
      assert.deepEqual(active.gameplay, runContact(mode, { ...options, observed: false }).gameplay);
    }
  });

  test(`${mode}: missing or mixed audio identity and stale generation fail closed`, () => {
    const original = observation(mode);
    const good = { cueId: original.audioCueId, receiptId: original.audioReceiptId, ownerId: 3, activationId: 7 };
    for (const requests of [[], [{ ...good, cueId: "other" }], [{ ...good, receiptId: "combat-attack:2:3:8" }],
      [{ ...good, ownerId: 9 }], [{ ...good, activationId: 8 }]]) {
      const active = runContact(mode, { requests });
      assert.equal(active.receipts.length, 0);
      assert.deepEqual(active.gameplay, runContact(mode, { requests, observed: false }).gameplay);
    }
    assert.equal(runContact(mode, { generation: 3 }).receipts.length, 0);
  });
}

test("grenade secondary-only contact cannot become evidence for the original primary target", () => {
  for (const options of [{ outsideRadius: true }, { missingTarget: true }, { hp: 0 }, { contained: true }]) {
    const result = runContact("grenade", options);
    assert.equal(result.receipts.length, 0);
    assert.equal(result.gameplay.fighters.find((fighter) => fighter.id === 2).hp, 63.5);
    assert.deepEqual(result.gameplay, runContact("grenade", { ...options, observed: false }).gameplay);
  }
});

test('missed grenade cannot turn a same-tick burn-only death into a blast or severed corpse',()=>{
  const result=runContact('grenade',{outsideRadius:true,hp:1,gore:true,burn:true});
  assert.equal(result.gameplay.fighters.find(f=>f.id===1).hp,0,'real area burn defeats the out-of-radius target');
  assert.equal(result.gore.impacts.some(e=>e.targetId===1),false);
  assert.equal(result.gore.wounds.some(e=>e.targetId===1),false);
  assert.equal(result.gore.impacts.filter(e=>e.targetId===2).length,1,'actual secondary grenade damage retains its blast');
  assert.equal(result.gore.impacts.find(e=>e.targetId===2).style,'blast');
  const contact=runContact('grenade',{hp:1,gore:true});
  assert.equal(contact.gore.wounds.find(e=>e.targetId===1).severed,true,'real lethal grenade impact still severs');
});

test("primary burst multi-hit preserves one attack identity and distinct exact impact ordinals", () => {
  const result = runContact("direct", { hits: 3 });
  assert.equal(result.receipts.length, 3);
  assert.deepEqual(result.receipts.map(({ sourceId, attackSequence, targetId, impactOrdinal }) =>
    [sourceId, attackSequence, targetId, impactOrdinal]), [[3, 7, 1, 0], [3, 7, 1, 1], [3, 7, 1, 2]]);
  assert.deepEqual(result.gameplay, runContact("direct", { hits: 3, observed: false }).gameplay);
});

test("canceled muzzle still produces neither damage nor a completed contact", () => {
  const result = runContact("direct", { eventKind: "muzzle", applyDamage: false });
  assert.equal(result.receipts.length, 0);
  assert.equal(result.gameplay.fighters[0].hp, 70);
  assert.deepEqual(result.gameplay.effects, []);
  const delayed = [{ eventKind: "impact", remainingSeconds: .22, damage: 13 }];
  assert.equal(advancePendingWeaponHits(delayed, .1).due.length, 0);
  assert.equal(advancePendingWeaponHits(delayed, .22).due.length, 1);
});

test("the unchanged normal direct contact owner emits only its exact post-reaction target", () => {
  for (const hp of [57, 0]) {
    const observed = { ...observation("direct"), mode: "direct" };
    const g = { time: 2, battleAudioGeneration: 2, completedAttackImpacts: [] };
    vm.runInNewContext(directCode, {
      g, target: { hp }, attackObservationBase: observed,
      createCompletedAttackImpactReceipt,
      productionCueQaLogRef: { current: [{ cueId: observed.audioCueId,
        receiptId: observed.audioReceiptId, ownerId: 3, activationId: 7 }] },
    });
    assert.equal(g.completedAttackImpacts.length, 1);
    assert.equal(g.completedAttackImpacts[0].reactionOutcome, hp === 0 ? "defeated" : "hit");
    assert.equal(g.completedAttackImpacts[0].targetId, 1);
  }
});

const firstRoundCode=compile(textFor('first-round-audio'));
function normalGunnerFirstRound(){
 const requests=[];vm.runInNewContext(firstRoundCode,{
  defersMrsLauncherAudio:false,f:{kind:'gunner',id:3,attackSequence:7},
  attackAudioCueId:weaponCueForUnit('gunner'),contactAudioX:0,
  attackObservationBase:observation('direct'),playProductionCue:(...args)=>requests.push(args),
 });return JSON.parse(JSON.stringify(requests));
}
const burstRequests=result=>result.gameplay.effects.filter(e=>e[0]==='production-audio'&&e[1]===weaponCueForUnit('gunner')).map(e=>e.slice(1));
test('a normal three-round LMG burst requests one recorded discharge per muzzle, preserving its initial audio policy',()=>{
 const first=normalGunnerFirstRound(),later=runContact('direct',{eventKind:'muzzle',applyDamage:false,hits:3,sourceActor:{}}),requests=[...first,...burstRequests(later)];
 assert.equal(first.length,1);assert.equal(requests.length,3);
 for(const [, ,options]of requests)for(const k of['priority','maxInstances','fallbackCue'])assert.equal(options[k],first[0][2][k],k);
 assert.equal(first[0][2].cooldownMs,45);
 for(const [, ,o]of burstRequests(later))assert.equal(o.cooldownMs,0,'committed rounds use event dedupe rather than a global wall-clock throttle');
 assert.equal(new Set(requests.map(([, ,o])=>o.instanceKey)).size,1,'all three rounds belong to one burst');
 assert.equal(requests[0][2].instanceKey,'gunner-burst:3:7');
 assert.equal(new Set(requests.map(([, ,o])=>o.receiptId)).size,3);
 assert.equal(new Set(burstRequests(later).map(([, ,o])=>o.dedupeKey)).size,2);
 assert.equal(later.receipts.length,0);assert.equal(later.gameplay.fighters[0].hp,70);
});
test('later LMG audio follows the existing shooter cancellation and committed-shot rules',()=>{
 for(const sourceActor of[{hp:0},{combatReady:false}]){const r=runContact('direct',{eventKind:'muzzle',applyDamage:false,hits:3,sourceActor});assert.equal(burstRequests(r).length,0);assert.equal(r.gameplay.effects.filter(e=>e[0]==='weapon-vfx').length,0);}
 const missing=runContact('direct',{eventKind:'muzzle',applyDamage:false,hits:3});assert.equal(burstRequests(missing).length,0);
 const goneTarget=runContact('direct',{eventKind:'muzzle',applyDamage:false,hits:3,sourceActor:{},missingTarget:true});assert.equal(burstRequests(goneTarget).length,2,'a live shooter still emits already-committed later rounds');
});
test('normal LMG bursts against enemy bases and S29 apparatus emit the same later discharges without applying impact damage',()=>{
 const first=[];
 vm.runInNewContext(compile(textFor('structure-first-round-audio')),{f:{kind:'gunner',id:3,attackSequence:7},
  structureWeaponEvent:null,structureAudioX:0,weaponCueForUnit,unitAudioCueFor:()=>null,playProductionCue:(...a)=>first.push(a)});
 assert.equal(first.length,1);assert.equal(first[0][2].instanceKey,'gunner-burst:3:7');
 for(const researchTargetId of[undefined,'research-apparatus-1']){
  const r=runContact('direct',{eventKind:'muzzle',applyDamage:false,hits:3,sourceActor:{},
   hit:{targetKind:'enemy-base',targetId:null,raiderLineHit:false,researchTargetId}});
  assert.equal(burstRequests(r).length,2);assert.equal(r.receipts.length,0);
  for(const [, ,options]of burstRequests(r))assert.equal(options.instanceKey,first[0][2].instanceKey);
  assert.ok(r.gameplay.fighters.every(f=>f.hp===70));
 }
});
test('initial, ability, piercing-secondary and other-weapon events cannot duplicate normal LMG discharge audio',()=>{
 for(const hit of[{shotIndex:0},{raiderLineHit:false},{raiderSecondary:true},{weapon:'ranger'},{transactionId:undefined},{attackSequence:undefined}]){
  const r=runContact('direct',{eventKind:'muzzle',applyDamage:false,hits:3,sourceActor:{},hit});assert.equal(burstRequests(r).length,0,JSON.stringify(hit));
 }
 const impacts=runContact('direct',{hits:3,sourceActor:{}});assert.equal(burstRequests(impacts).length,0,'contact is not another discharge');
});

test('normal attack role aliases do not request the same discharge twice, while distinct support and legacy paths remain',()=>{
 const code=compile(textFor('legacy-role-audio'));
 const run=(kind,mixer=true)=>{const calls=[];vm.runInNewContext(code,{roleEffect:kind,f:{kind},productionMixerRef:{current:mixer},LEGACY_SFX_CUE_MAP,attackAudioCueId:weaponCueForUnit(kind),playCue:(...a)=>calls.push(a)});return calls;};
 for(const kind of['scout','ranger','brute','brawler','gunner']){assert.equal(run(kind).length,0,kind);assert.equal(run(kind,false).length,1,'legacy dispatch stays available: '+kind);}
 assert.equal(run('medic').length,1,'the distinct healing cue is retained');
 for(const kind of['crazy-king','kumaverson','babayaga'])assert.equal(run(kind).length,0,'existing specialized owners stay exclusive: '+kind);
});

test('real normal attack producer order gives the initial and pending discharges the same committed burst identity',()=>{
 const emitter=found.find(([k])=>k==='gunner-emitter')?.[1],first=found.find(([k])=>k==='first-round-audio')?.[1];assert.ok(emitter&&first);
 const increments=found.filter(([k,n])=>k==='sequence-increment'&&n.getStart(tree)>emitter.end&&n.end<first.getStart(tree));assert.equal(increments.length,1);
 const initial=[];const context={f:{id:3,kind:'gunner',side:'human',attackSequence:7},target:{id:1,kind:'walker',x:0,y:0},event:{shotIndex:1,recoil:0,casing:false,hitStopSeconds:0,travelSeconds:.1},muzzle:{x:0,y:0},g:{definition:{missionType:''}},linkedWeaponTransactionId,attackObservationBase:null,defersMrsLauncherAudio:false,attackAudioCueId:weaponCueForUnit('gunner'),contactAudioX:0,playProductionCue:(...a)=>initial.push(a)};
 vm.runInNewContext(compile('const '+textFor('committed-sequence')+';const '+emitter.getText(tree)+';'+increments[0][1].getText(tree)+';'+textFor('first-round-audio')+';globalThis.pending=sharedEvent;'),context);
 assert.equal(context.f.attackSequence,8);assert.equal(context.pending.attackSequence,8);
 const later=runContact('direct',{eventKind:'muzzle',applyDamage:false,hits:1,sourceActor:{},observed:false,hit:JSON.parse(JSON.stringify(context.pending))});
 assert.equal(burstRequests(later).length,1);assert.equal(burstRequests(later)[0][2].instanceKey,initial[0][2].instanceKey);assert.equal(initial[0][2].instanceKey,'gunner-burst:3:8');
});
