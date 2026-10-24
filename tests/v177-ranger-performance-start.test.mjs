import test from 'node:test';
import assert from 'node:assert/strict';
import {readV177RangerPerformancePreparation as prepare} from '../scripts/v177-ranger-performance-start.mjs';

test('preparation requires a living scene-bound painted Ranger without starting or replacing the original clock',()=>{
 const lower={mode:'continuous-weighted-mesh',parts:5,meshVertices:130,meshTriangles:192,coverageSamples:4,duplicateWithinPart:0,degenerate:0};
 const tail={renderKind:'ranger',assetReady:true,jointAtlasPath:'/actual-ranger.webp',jointDrawSucceeded:true,
  jointWeightedLowerDrawSucceeded:true,jointWeightedLower:lower,renderSequence:21,jointPaintedAt:39};
 const ranger={id:5,kind:'ranger',side:'human',hp:0,renderAuditHistory:[tail]},boss={id:9,kind:'mugarian-president-mutated',side:'zombie',hp:100};
 const snapshot={running:true,over:false,time:39,fighters:[ranger,boss]};
 const boundary={renderSequence:21,simulationTime:39,actors:[{id:5,renderSequence:21,jointPaintedAt:39,worldWeightedLower:lower}]};
 const before={renderFrames:22,rangerDrawBoundary:boundary};let starts=0;const raf=[],listeners=[];
 const values={window:{__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot,getPerformanceSnapshot:()=>before},
  __V100_RAF_CALLBACK_DIAG__:{start:()=>starts++},addEventListener:(...args)=>listeners.push(args)},document:{visibilityState:'visible'},
  requestAnimationFrame:fn=>{raf.push(fn);return raf.length;}};
 const original=new Map(Object.keys(values).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{
  for(const[k,v]of Object.entries(values))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
  const call=()=>prepare({atlasPath:'/actual-ranger.webp'});
  assert.equal(call().ready,false,'the original missing/dead Ranger reproducer cannot start a lightweight window');
  ranger.hp=100;ranger.renderAuditHistory=[];assert.equal(call().ready,false,'a deployed but not painted Ranger is not ready');
  ranger.renderAuditHistory=[tail];boundary.actors[0].id=7;assert.equal(call().ready,false,'another actor cannot supply the paint');
  boundary.actors[0].id=5;lower.mode='legacy-cell-fallback';assert.equal(call().ready,false);
  lower.mode='continuous-weighted-mesh';boss.hp=0;assert.equal(call().ready,false,'the actual boss must still be alive');boss.hp=100;
  assert.equal(starts,0);assert.equal(raf.length,0);assert.equal(window.__V100_DEVICE_RAF__,undefined);
  const result=call();assert.equal(result.ready,true);assert.deepEqual(result.paintedRangerIds,[5]);
  assert.equal(window.__V100_DEVICE_RAF__,undefined);assert.equal(starts,0);assert.equal(raf.length,0);assert.equal(listeners.length,0);
  const state={active:true,startedAt:42};window.__V100_DEVICE_RAF__=state;
  assert.throws(call,/already active/);assert.equal(window.__V100_DEVICE_RAF__,state);assert.equal(starts,0);
  snapshot.over=true;state.active=false;assert.throws(call,/S25 ended/);
 }finally{for(const[k,descriptor]of original)if(descriptor)Object.defineProperty(globalThis,k,descriptor);else delete globalThis[k];}
});
