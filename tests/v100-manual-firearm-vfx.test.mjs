import assert from 'node:assert/strict';
import test from 'node:test';
import {queueV100ManualMuzzle,queueV100ManualFirearmImpact,drawV100ManualMuzzles,getV100ManualMuzzleSnapshot,clearV100ManualFirearmVfx} from '../app/v100ManualFirearmVfx.js';
import {getV100SkillContactSnapshot,clearV100ContactQueue} from '../app/v100CombatVfx.js';

const fixture=()=>({world:{time:5,definition:{missionConfig:{v100StageNumber:5}}},owner:{id:1,kind:'ranger',side:'human',hp:80,x:300,manualAbility:{activationId:2}},target:{id:7,side:'zombie',hp:38,x:550,y:250}});
test('manual firearm contact follows applied damage without changing actors or retaining mutable actor references',()=>{
 const f=fixture(),before=JSON.stringify(f);
 assert.equal(queueV100ManualFirearmImpact(f.world,{...f,hpBefore:130}),true);
 assert.equal(JSON.stringify(f),before);
 const [receipt]=getV100SkillContactSnapshot(f.world);assert.equal(receipt.hpBefore-receipt.hpAfter,92);assert.equal(receipt.targetId,7);assert.equal(receipt.activationId,2);
 receipt.hpBefore=999;f.target.hp=2;assert.equal(getV100SkillContactSnapshot(f.world)[0].hpAfter,38);
 f.world.time=5.21;assert.deepEqual(getV100SkillContactSnapshot(f.world),[]);
 clearV100ContactQueue(f.world);
});
test('a new burst round replaces its old muzzle while draw uses only a live measured socket',()=>{
 const f=fixture();f.owner.kind='gunner';const draws=[],positions=[];
 const ctx={save(){},restore(){},translate(x,y){positions.push([x,y]);},rotate(){},drawImage(...args){draws.push(args);}},objects={'v100-muzzle':{complete:true,naturalWidth:1536}};
 queueV100ManualMuzzle(f.world,{...f,shotIndex:0});f.world.time+=.074;queueV100ManualMuzzle(f.world,{...f,shotIndex:1});
 assert.equal(getV100ManualMuzzleSnapshot(f.world).length,1);assert.equal(getV100ManualMuzzleSnapshot(f.world)[0].shotIndex,1);
 drawV100ManualMuzzles(ctx,objects,f.world,()=>null);assert.equal(draws.length,0);
 drawV100ManualMuzzles(ctx,objects,f.world,()=>({x:331,y:212}));assert.equal(draws.length,1);assert.deepEqual(positions,[[331,212]]);
 assert.equal(ctx.globalAlpha,1);assert.equal(ctx.globalCompositeOperation,'lighter');
 f.world.time+=.086;drawV100ManualMuzzles(ctx,objects,f.world,()=>({x:331,y:212}));assert.equal(draws.length,1);assert.deepEqual(getV100ManualMuzzleSnapshot(f.world),[]);
 queueV100ManualMuzzle(f.world,f);clearV100ManualFirearmVfx(f.world);assert.deepEqual(getV100ManualMuzzleSnapshot(f.world),[]);
});
test('legacy, non-firearms, dead sources, non-damage and invalid positions cannot emit skill contacts',()=>{
 for(const mutate of [f=>{f.world.definition.missionConfig={};},f=>{f.owner.kind='scout';},f=>{f.owner.hp=0;},f=>{f.owner.hp=Infinity;},f=>{f.target.hp=130;},f=>{f.target.hp=160;},f=>{f.target.x=NaN;},f=>{f.owner.x=NaN;}]){
  const f=fixture();mutate(f);assert.equal(queueV100ManualFirearmImpact(f.world,{...f,hpBefore:130}),false);assert.deepEqual(getV100SkillContactSnapshot(f.world),[]);
 }
 const f=fixture();f.owner.kind='scout';assert.equal(queueV100ManualMuzzle(f.world,f),false);
 f.owner.kind='ranger';f.target.y=Infinity;assert.equal(queueV100ManualMuzzle(f.world,f),false);
});
