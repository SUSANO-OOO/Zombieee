import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {advancePendingWeaponHits} from '../app/combatPresentation.js';
import {advanceRuntimeFrameSchedule,createRuntimeFrameSchedule} from '../app/renderPerformance.js';

function proofCallbacks(){
 const source=readFileSync(new URL('../scripts/v102-combat-browser.mjs',import.meta.url),'utf8');
 const ast=ts.createSourceFile('proof.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),callbacks={};
 function visit(node){
  if(ts.isCallExpression(node)&&['page.evaluate','page.waitForFunction'].includes(node.expression.getText(ast))){
   const fn=node.arguments[0]?.getText(ast)??'';
   if(fn.includes('prepareEnemyFacingRuntimeProof'))callbacks.prepare=fn;
   if(fn.includes('return a.fighter?.hp>0'))callbacks.alive=fn;
   if(fn.includes('setEnemyVfxProofPaused(false)'))callbacks.resume=fn;
   if(fn.includes('corpseRenderHistory.length>0'))callbacks.dead=fn;
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);for(const name of ['prepare','alive','resume','dead'])assert.ok(callbacks[name],name);
 return callbacks;
}

test('Gore proof paints the living body before a delayed first frame can consume the lethal hit',()=>{
 const callbacks=proofCallbacks();
 const app=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
 const factory=app.slice(app.indexOf('prepareEnemyFacingRuntimeProof:'),app.indexOf('ensureEnemyFacingProofAsset:',app.indexOf('prepareEnemyFacingRuntimeProof:')));
 const delay=Number(factory.match(/remainingSeconds:\s*([.\d]+)/u)?.[1]);assert.ok(delay>0);
 function fixture(){
  const world={hp:100,paused:false,pending:[{remainingSeconds:delay,damage:101}],live:[],dead:[]};
  const qa={
   prepareEnemyFacingRuntimeProof(){world.paused=false;return {fighterId:1,initial:{enemyHp:world.hp}};},
   setEnemyVfxProofPaused(value){world.paused=value;},
   getEnemyFacingRuntimeAudit(){return {fighter:world.hp>0?{hp:world.hp}:null,renderHistory:world.live,corpseRenderHistory:world.dead};},
   getPhaseGCombatSnapshot(){return {combatGore:{wounds:world.hp>0?[]:[{targetId:1,lethal:true,severed:true}]}};}
  };
  const context={window:{__ASHFALL_BATTLE_QA__:qa}};
  const f=Object.fromEntries(Object.entries(callbacks).map(([key,fn])=>[key,vm.runInNewContext(`(${fn})`,context)]));
  const schedule=createRuntimeFrameSchedule();advanceRuntimeFrameSchedule(schedule,0,{renderHz:60});
  return {world,qa,f,frame(now){
   const cadence=advanceRuntimeFrameSchedule(schedule,now,{renderHz:60});
   for(let step=0;step<cadence.simulationStepCount;step++)if(!world.paused){
    const hits=advancePendingWeaponHits(world.pending,cadence.simulationStepSeconds);world.pending=hits.pending;
    for(const hit of hits.due)world.hp=Math.max(0,world.hp-hit.damage);
   }
   if(cadence.shouldRender)(world.hp>0?world.live:world.dead).push({height:100});
  }};
 }
 const old=fixture();old.qa.prepareEnemyFacingRuntimeProof();old.frame(200);
 assert.equal(old.world.hp,0,'the real catch-up cadence can consume the hit before its first paint');
 assert.equal(old.f.alive(1),false,'the original unpaused fixture has no living paint');
 const fixed=fixture();fixed.f.prepare('crusher');fixed.frame(200);
 assert.equal(fixed.world.hp,100);assert.equal(fixed.f.alive(1),true);assert.equal(fixed.f.dead(1),false);
 fixed.f.resume();fixed.frame(400);
 assert.equal(fixed.world.hp,0);assert.equal(fixed.f.dead(1),true);
 assert.ok(fixed.world.live.length&&fixed.world.dead.length,'both receipts are required without changing the hit delay');
});
