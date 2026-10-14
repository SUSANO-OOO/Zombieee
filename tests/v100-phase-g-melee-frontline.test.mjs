import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import test from 'node:test';import vm from 'node:vm';import ts from 'typescript';
import {COMBAT_ROLE_RULES} from '../app/combatLifecycle.js';import {unitContentFor} from '../app/content/unitCatalog.js';import {enemyContentFor} from '../app/content/enemyCatalog.js';import {setupActorObservation} from '../scripts/v100-phase-g-runtime-evidence.mjs';
const source=await readFile(new URL('../scripts/v100-phase-g-production-matrix.mjs',import.meta.url),'utf8'),parsed=ts.createSourceFile('matrix.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const names=['deploymentCandidatesFromDiagnostics','ordinaryMeleeProofFrontline'],declarations=names.map(name=>parsed.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name));assert.ok(declarations.every(Boolean));
const plan=vm.runInNewContext(declarations.map(n=>n.getText(parsed)).join('\n')+'\nordinaryMeleeProofFrontline',{COMBAT_ROLE_RULES,unitContentFor});
const fixture=JSON.parse(await readFile(new URL('./fixtures/v100-phase-g-ranged-frontline-gap.json',import.meta.url))),enemy=enemyContentFor('grappler'),card=(kind,eligible=true)=>({kind,actionability:{eligible}}),cards={cards:[card('ranger'),card('scout'),card('kumaverson')]};
const normalize=value=>JSON.parse(JSON.stringify(value));
test('recorded two-marksman gap plans a real durable melee card without accepting a grappler warning as an attack',()=>{
 const runtime=structuredClone(fixture);assert.equal(setupActorObservation(runtime,'zombie','grappler',null).observed,false);
 assert.deepEqual(normalize(plan(runtime,enemy,cards)),{pending:true,kind:'kumaverson'});
 runtime.fighters[2].stationAbility={phase:'warning',remainingSeconds:1,targetId:8};assert.equal(setupActorObservation(runtime,'zombie','grappler',null).observed,false);
 assert.deepEqual(normalize(plan(runtime,enemy,cards)),{pending:true,kind:'kumaverson'});
 assert.equal(setupActorObservation(runtime,'zombie','grappler',null).observed,false,'Planning a card never counts as the exact attack');
});
test('frontline planning uses native actionability and cannot invent an unavailable or out-of-roster melee card',()=>{
 assert.deepEqual(normalize(plan(fixture,enemy,{cards:[card('ranger'),card('kumaverson',false),card('unknown')]})),{pending:true,kind:null});
 assert.deepEqual(normalize(plan(fixture,enemy,{cards:[card('kumaverson',false),card('scout')]})),{pending:true,kind:'scout'});
 assert.deepEqual(normalize(plan(fixture,enemy,null)),{pending:true,kind:null});
});
test('a living or arriving melee opponent prevents duplicate deployment; corpses do not',()=>{
 const runtime=structuredClone(fixture);runtime.fighters.push({id:40,side:'human',kind:'kumaverson',hp:1,gateEntering:true});
 assert.deepEqual(normalize(plan(runtime,enemy,cards)),{pending:false,kind:null});
 runtime.fighters.at(-1).hp=0;assert.deepEqual(normalize(plan(runtime,enemy,cards)),{pending:true,kind:'kumaverson'});
});
test('ranged, absent, entering and already observed enemies retain their original proof strategy',()=>{
 assert.deepEqual(normalize(plan(fixture,enemyContentFor('spitter'),cards)),{pending:false,kind:null});
 const runtime=structuredClone(fixture);runtime.fighters[2].gateEntering=true;assert.deepEqual(normalize(plan(runtime,enemy,cards)),{pending:false,kind:null});
 runtime.fighters=runtime.fighters.filter(f=>f.side==='human');assert.deepEqual(normalize(plan(runtime,enemy,cards)),{pending:false,kind:null});
 assert.deepEqual(normalize(plan(fixture,enemy,cards,true)),{pending:false,kind:null});
});

const unrelated=JSON.parse(await readFile(new URL('./fixtures/v100-phase-g-grappler-unrelated-frontline.json',import.meta.url)));
test('recorded living scout fighting another enemy cannot satisfy the exact grappler frontline',()=>{
 assert.equal(unrelated.source.head,'4e24ffebfc88721801d4f5721474718e0d3ee781');
 assert.equal(setupActorObservation(unrelated,'zombie','grappler',null).observed,false);
 const scout=unrelated.fighters.find(f=>f.id===26),grappler=unrelated.fighters.find(f=>f.id===18);
 assert.equal(scout.targetId,31);assert.equal(grappler.targetId,22);
 assert.ok(unrelated.fighters.some(f=>f.id===31&&f.side==='zombie'&&f.hp>0));
 assert.deepEqual(normalize(plan(unrelated,enemy,null)),{pending:true,kind:null});
 assert.deepEqual(normalize(plan(unrelated,enemy,{cards:[card('ranger'),card('kumaverson',false),card('scout')]})),{pending:true,kind:'scout'});
 assert.equal(setupActorObservation(unrelated,'zombie','grappler',null).observed,false,'Planning another native card does not count as an attack');
});

test('exact opposing ownership, a gate arrival, or an unresolved target still prevents duplicate frontline input',()=>{
 for(const mutation of [
  r=>{r.fighters.find(f=>f.id===26).targetId=18;},
  r=>{r.fighters.find(f=>f.id===18).targetId=26;},
  r=>{r.fighters.find(f=>f.id===26).gateEntering=true;},
  r=>{r.fighters.find(f=>f.id===26).targetId=null;},
  r=>{r.fighters.find(f=>f.id===31).hp=0;},
 ]){
  const r=structuredClone(unrelated);mutation(r);
  assert.deepEqual(normalize(plan(r,enemy,cards)),{pending:false,kind:null});
 }
});

test('actual sustain caller uses an affordable native frontline without treating deployment as the missing attack',async()=>{
 let caller;
 const visit=node=>{if(ts.isIfStatement(node)&&node.getText(parsed).includes('phase: "proof-target-continuity"'))caller=node;ts.forEachChild(node,visit);};visit(parsed);
 assert.ok(caller,'the actual background continuity caller must remain connected');
 for(const affordable of [true,false]){
  const runtime=structuredClone(unrelated),before=JSON.stringify(runtime),calls=[];
  const ctx={bossKind:null,proofActor:'grappler',bossDeploymentFinished:true,proofUnitDeployed:true,
   liveHumanTargetCount:2,proofUnitKind:null,proofActorAttackObserved:false,
   meleeFrontline:plan(runtime,enemy,{cards:[card('scout',affordable)]}),
   page:{},deployedKinds:new Set(),performVerifiedDeploymentPointer:async(page,request)=>{
    calls.push(request);return {accepted:true};
   }};
  await vm.runInNewContext('(async()=>{'+caller.getText(parsed)+'})()',ctx);
  assert.deepEqual(calls.map(c=>c.requestedKind),affordable?['scout']:[]);
  assert.equal(ctx.proofActorAttackObserved,false);
  assert.equal(JSON.stringify(runtime),before,'ordinary input planning cannot mutate the recorded battle');
 }
});
