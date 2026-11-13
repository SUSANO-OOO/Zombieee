import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {BOSS_ANOMALY_TUNING} from '../app/bossAnomalies.js';
import {drawV100BossDefeat} from '../app/v100BossDefeatVfx.js';
import {createBattlePresentationRuntime,queueSemanticBattlePresentation,advanceBattlePresentationRuntime,V099_BOSS_DEFEAT_TIMELINE} from '../app/battlePresentationV099.js';
const kinds=['takuya','gate-eater','kurome','mother','ooguchi','gairen','futago','mugarian-president-mutated','takuya-omega'];
function effect(label){return {...queueSemanticBattlePresentation(createBattlePresentationRuntime(),{semantic:'boss-defeat',receiptId:'boss:1',ownerId:1,kind:'boss-defeat',label,x:640,y:280,seed:73}).effect,elapsed:1.3};}
function paint(){
 const calls=[],stack=[],ctx={globalAlpha:.6,globalCompositeOperation:'screen',shadowBlur:4,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
  translate(...v){assert.ok(v.every(Number.isFinite));},rotate(v){assert.ok(Number.isFinite(v));},scale(...v){assert.ok(v.every(Number.isFinite));},
  drawImage(...args){calls.push({args,alpha:this.globalAlpha});}};
 const objects=Object.fromEntries(['quality-boss-blast','v100-explosion','v100-dust','v100-smoke-a','v100-smoke-b'].map(id=>[id,{id,complete:true,naturalWidth:id==='quality-boss-blast'?1536:id==='v100-explosion'?768:128,naturalHeight:id==='quality-boss-blast'?1024:id==='v100-explosion'?640:128}]));
 return {calls,stack,ctx,objects};
}
test('all nine bosses stage distinct painted collapses without changing receipt, timing or canvas state',()=>{
 const signatures=[];
 for(const label of kinds){const p=paint(),e=effect(label),before=structuredClone(e);
  assert.equal(drawV100BossDefeat(p.ctx,p.objects,e,.7),true);assert.deepEqual(e,before);
  assert.ok(p.calls.length>0&&p.calls.length<100);assert.ok(p.calls.every(c=>Object.values(p.objects).includes(c.args[0])&&c.args.slice(1).every(Number.isFinite)&&c.alpha>=0&&c.alpha<=1));
  assert.equal(p.ctx.globalAlpha,.6);assert.equal(p.ctx.globalCompositeOperation,'screen');assert.equal(p.ctx.shadowBlur,4);assert.equal(p.stack.length,0);
  assert.equal(e.duration,V099_BOSS_DEFEAT_TIMELINE.durationSeconds);
  signatures.push(JSON.stringify(p.calls.map(c=>[c.args[0].id,...c.args.slice(1),c.alpha])));
 }
 assert.equal(new Set(signatures).size,kinds.length);
});
test('defeat drawing expires with the semantic event and rejects invalid or unrelated states',()=>{
 for(const patch of [{elapsed:-1},{elapsed:2.6},{kind:'explosion'},{x:NaN},{duration:0},{seed:NaN}]){
  const p=paint();assert.equal(drawV100BossDefeat(p.ctx,p.objects,{...effect('mother'),...patch}),false);assert.equal(p.calls.length,0);
 }
 let runtime=createBattlePresentationRuntime();
 runtime=queueSemanticBattlePresentation(runtime,{semantic:'boss-defeat',receiptId:'boss:1',kind:'boss-defeat',x:640,y:280,label:'mother'}).runtime;
 assert.equal(queueSemanticBattlePresentation(runtime,{semantic:'boss-defeat',receiptId:'boss:1',x:640,y:280}).accepted,false);
 assert.equal(advanceBattlePresentationRuntime(runtime,2.6).effects.length,0);
});
test('the actual V1 presentation branch calls the new collapse renderer exactly once',()=>{
 const source=fs.readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='drawBattlePresentationEffects');assert.ok(fn);
 const calls=[],draw=vm.runInNewContext(ts.transpileModule(fn.getText(tree)+';drawBattlePresentationEffects;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{drawV100BossDefeat:(...args)=>calls.push(args)});
 const e=effect('mother'),ctx={},objects={};draw(ctx,{definition:{missionConfig:{v100StageNumber:5}},battlePresentation:{effects:[e]}},.7,objects);
 assert.equal(calls.length,1);assert.equal(calls[0][0],ctx);assert.equal(calls[0][1],objects);assert.equal(calls[0][2],e);assert.equal(calls[0][3],.7);
});

test('the real Ooguchi caller keeps its wake behind the committed leftward charge after passing the target',()=>{
 const source=fs.readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='drawAnomalyBossCombatVfx');assert.ok(fn);
 const calls=[],draw=vm.runInNewContext(ts.transpileModule(fn.getText(tree)+';drawAnomalyBossCombatVfx;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{BOSS_ANOMALY_TUNING,drawV100BossAftermath:(_ctx,_objects,entry)=>calls.push(entry)});
 for(const x of [500,376])draw({}, {id:7,kind:'ooguchi',x,y:250,stationAbility:{phase:'active',targetX:400,remainingSeconds:.32}}, {definition:{missionConfig:{v100StageNumber:14}}},{});
 assert.deepEqual(calls.map(c=>c.direction),[-1,-1]);assert.ok(calls.every(c=>c.seed===7));
});
