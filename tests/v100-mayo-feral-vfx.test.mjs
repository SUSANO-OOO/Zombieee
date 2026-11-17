import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {drawV100MayoFeralVfx,clearV100MayoFeralVfx} from '../app/v100MayoFeralVfx.js';
import {restorePreMayoFeralSource} from './helpers/guard-spectacle-source.mjs';
function fixture(){
 const calls=[],stack=[],ctx={globalAlpha:.8,globalCompositeOperation:'screen',tx:0,ty:0,angle:0,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.tx,this.ty,this.angle]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.tx,this.ty,this.angle]=stack.pop();},
  translate(x,y){this.tx+=x;this.ty+=y;},rotate(x){this.angle+=x;},
  drawImage(...args){calls.push({args,alpha:this.globalAlpha,x:this.tx,y:this.ty,angle:this.angle});}};
 const objects=Object.fromEntries(['v100-dust','v100-smoke-b'].map(id=>[id,{id,complete:true,naturalWidth:64,naturalHeight:64}]));
 const owner={id:11,kind:'mayo-chan',side:'human',hp:64,maxHp:64,combatReady:true,x:330,y:230,aiMoveDirection:1,manualAbility:{activationId:1,phase:'feral',activeRemaining:6}};
 const world={time:1,definition:{missionConfig:{v100StageNumber:4}},fighters:[owner],manualAbilityReceipts:[{ownerId:11,kind:'mayo-chan',activationId:1,eventType:'start',at:.2},{ownerId:11,kind:'mayo-chan',activationId:1,eventType:'feral-start',at:.6}]};
 return{ctx,calls,stack,objects,owner,world};
}
function intact(f){assert.equal(f.ctx.globalAlpha,.8);assert.equal(f.ctx.globalCompositeOperation,'screen');assert.equal(f.ctx.tx,0);assert.equal(f.ctx.ty,0);assert.equal(f.ctx.angle,0);assert.deepEqual(f.stack,[]);}
test('a real Mayo activation paints a widening asymmetric ground release and restores canvas state without mutating gameplay',()=>{
 const f=fixture(),before=structuredClone(f.world);assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),1);
 assert.ok(f.calls.length>=3);assert.ok(f.calls.some(c=>c.x<f.owner.x)&&f.calls.some(c=>c.x>f.owner.x));
 assert.ok(f.calls.every(c=>c.args[0]===f.objects['v100-dust']||c.args[0]===f.objects['v100-smoke-b']));
 assert.ok(f.calls.every(c=>c.alpha>0&&c.alpha<=.8&&c.args.slice(1).every(Number.isFinite)));
 assert.ok(f.calls.every(c=>c.y+c.args[2]>f.owner.y-55),'paint stays below the head/health area');assert.deepEqual(f.world,before);intact(f);
});
test('missing genuine receipts, wrong activation or owner, other characters and dead actors do not manufacture an activation',()=>{
 for(const alter of [f=>f.world.manualAbilityReceipts=[],f=>f.owner.manualAbility.activationId=2,f=>f.owner.id=12,f=>f.owner.kind='scout',f=>f.owner.side='zombie',f=>f.owner.hp=0,f=>f.owner.combatReady=false,f=>f.world.definition.missionConfig={}]){
  const f=fixture();alter(f);const before=structuredClone(f.world);assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),0);assert.equal(f.calls.length,0);assert.deepEqual(f.world,before);intact(f);
 }
});
test('windup precedes feral and an expired burst is not replayed by a standing actor',()=>{
 const f=fixture();f.owner.manualAbility.phase='windup';f.world.time=.3;f.world.manualAbilityReceipts.pop();
 assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),1);assert.equal(f.calls.length,2);
 f.owner.manualAbility.phase='feral';f.world.manualAbilityReceipts.push({ownerId:11,kind:'mayo-chan',activationId:1,eventType:'feral-start',at:.6});f.world.time=2;f.calls.length=0;
 assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),0);assert.equal(f.calls.length,0);intact(f);
});
test('movement and retreat trails follow actual displacement, expire promptly and cannot accumulate during a paused clock',()=>{
 const f=fixture();f.world.time=2;drawV100MayoFeralVfx(f.ctx,f.objects,f.world);
 f.world.time=2.1;f.owner.x+=12;f.calls.length=0;assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),1);const count=f.calls.length;
 f.calls.length=0;drawV100MayoFeralVfx(f.ctx,f.objects,f.world);assert.equal(f.calls.length,count);
 f.world.time=2.5;f.calls.length=0;assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),0);
 f.owner.manualAbility.phase='cooldown';f.owner.mayoRetreat={reason:'ability',phase:'run',phaseElapsed:.1};f.world.time=2.6;f.owner.x-=20;f.calls.length=0;
 f.owner.combatReady=false;
 assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),1);assert.ok(f.calls.every(c=>c.x>f.owner.x));intact(f);
});
test('the layer stays bounded through dense moving samples and drops all trails on explicit lifecycle clear',()=>{
 const f=fixture();for(let i=0;i<40;i++){f.world.time=.8+i*.07;f.owner.x+=9;f.calls.length=0;drawV100MayoFeralVfx(f.ctx,f.objects,f.world);assert.ok(f.calls.length<=8);}
 clearV100MayoFeralVfx(f.world);f.world.time=5;f.calls.length=0;assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),0);assert.equal(f.calls.length,0);intact(f);
});
test('missing textures have no geometric fallback and a thrown paint still restores the canvas',()=>{
 const f=fixture();delete f.objects['v100-dust'];assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),0);assert.equal(f.calls.length,0);
 const g=fixture();g.ctx.drawImage=()=>{throw new Error('paint failure');};assert.throws(()=>drawV100MayoFeralVfx(g.ctx,g.objects,g.world),/paint failure/);intact(g);
});
test('a genuinely injured retreat uses ground material without a false skill activation',()=>{
 const f=fixture();f.owner.manualAbility={activationId:0,phase:'retreat'};f.owner.combatReady=false;f.owner.mayoRetreat={reason:'injury',phase:'fall',phaseElapsed:.1};f.world.manualAbilityReceipts=[];
 const before=structuredClone(f.world);assert.equal(drawV100MayoFeralVfx(f.ctx,f.objects,f.world),1);assert.equal(f.calls.length,2);assert.deepEqual(f.world,before);intact(f);
});
test('only the four declared App integrations differ from the accepted base, including negative controls',()=>{
 const file='app/AshfallGame.tsx',current=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
 const before=execFileSync('git',['show','3598a02b5ce7ece0e0edec85058e253d11b0cdab:'+file],{maxBuffer:4e6}).toString().replaceAll('\r\n','\n');
 assert.equal(restorePreMayoFeralSource(file,current),before);
 assert.throws(()=>assert.equal(restorePreMayoFeralSource(file,current.replace('drawV100MayoFeralVfx(ctx, stageObjects, g)','drawV100MayoFeralVfx(ctx, stageObjects, {})')),before));
 assert.throws(()=>assert.equal(restorePreMayoFeralSource(file,current+'\n  clearV100MayoFeralVfx(g);\n'),before));
 assert.throws(()=>assert.equal(restorePreMayoFeralSource(file,current.replace('drawAreaEffect(ctx, effect, g.time, stageObjects','drawAreaEffect(ctx, effect, g.time + .1, stageObjects')),before));
 assert.ok(current.indexOf('drawV100MayoFeralVfx(ctx, stageObjects, g)')<current.indexOf('  const renderables = ['),'ground pass precedes actors and health');
});
