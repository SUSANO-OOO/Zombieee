import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {V100_COMBAT_VFX_ART,v100ExplosionFrame,drawV100Explosion,v100MuzzleFrame,drawV100Muzzle,drawV100Contact,queueV100Contact,drawV100ContactQueue,clearV100ContactQueue,drawV100GroundFire} from '../app/v100CombatVfx.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
test('V1 effects have decoded stage and offline sources, preserving fractional alpha',async()=>{
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 for(const [id,path] of Object.entries(V100_COMBAT_VFX_ART)){
  const image=sharp('public'+path),m=await image.metadata(),s=await image.stats();
  if(['v100-muzzle','v100-contact','v100-ground-impact','v100-metal-contact','v100-claw-contact','v100-lightblade','v100-countercut'].includes(id)){
   assert.equal(m.width,1536);assert.equal(m.height,1024);
   // Check visible light. The generator also supplied fractional alpha;
   // RGB beneath zero-alpha pixels is irrelevant and must stay unmodified.
   const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let maximum=0,total=0,count=0;
   const cells=id==='v100-metal-contact'?[1,2,4,5]:[0,1,2,3,4,5];
   for(const frame of cells)for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    if(x>=12&&x<500&&y>=12&&y<500)continue;
    const offset=((Math.floor(frame/3)*512+y)*info.width+frame%3*512+x)*4;
    for(let channel=0;channel<3;channel++){const v=data[offset+channel]*data[offset+3]/255;maximum=Math.max(maximum,v);total+=v;count++;}
   }
   assert.ok(maximum<=8,'cell edges must not introduce bright rectangular seams');
   assert.ok(total/count<1,'black gutters should have no visible rectangular veil');
  }else{
   assert.ok(m.hasAlpha,path);assert.equal(s.channels[3].min,0);assert.equal(s.channels[3].max,255);
   assert.ok(s.channels[3].mean>1&&s.channels[3].mean<230,path);
  }
  assert.ok(manifest.assets.some(a=>a.path===path&&a.criticality==='critical'));
  for(const stageId of V100_STAGE_IDS)assert.ok(requiredBattleAssetPlan({stageId}).stageObjects.some(a=>a.id===id&&a.path===path),stageId);
 }
});
test('contact effects are finite, bounded, tied to battle time, and cleared with transient state',()=>{
 const draws=[],ctx={save(){},restore(){},translate(){},scale(){},drawImage(...a){draws.push(a)}};
 const objects={'v100-contact':{complete:true,naturalWidth:1536},'v100-ground-impact':{complete:true,naturalWidth:1536}};
 const world={time:20,definition:{missionConfig:{v100StageNumber:1}}};
 for(let i=0;i<60;i++)queueV100Contact(world,{x:i,y:10});
 drawV100ContactQueue(ctx,objects,world);assert.equal(draws.length,48);
 world.time+=.21;draws.length=0;drawV100ContactQueue(ctx,objects,world);assert.equal(draws.length,0);
 queueV100Contact(world,{x:1,y:2,ground:true});world.time+=.3;drawV100ContactQueue(ctx,objects,world);
 assert.equal(draws.length,1);assert.equal(draws[0][0],objects['v100-ground-impact']);assert.deepEqual(draws[0].slice(1,5),[0,512,512,512]);
 clearV100ContactQueue(world);draws.length=0;drawV100ContactQueue(ctx,objects,world);assert.equal(draws.length,0);
 for(const elapsed of [-1,.2,1,NaN,Infinity])assert.equal(drawV100Contact({},objects,{elapsed}),false);
 const legacy={time:0,definition:{missionConfig:{}}};queueV100Contact(legacy,{x:1,y:2});drawV100ContactQueue(ctx,objects,legacy);assert.equal(draws.length,0);
});
test('firearms emit once at their muzzle and all other weapons stay free of muzzle flame',()=>{
 for(const weapon of ['ranger','babayaga','gunner','red-panther-smg','red-panther-commander','crawler']){
  assert.equal(v100MuzzleFrame(weapon,0).frame,0);
  const duration=weapon==='crawler'?.14:['gunner','red-panther-smg'].includes(weapon)?.085:.1;
  assert.equal(v100MuzzleFrame(weapon,duration*.999).frame,5);
  for(const elapsed of [-.01,duration,1,Infinity,NaN]){
   assert.equal(v100MuzzleFrame(weapon,elapsed),null);
   assert.equal(drawV100Muzzle({}, {}, {weapon,elapsed}),false);
  }
 }
 for(const weapon of ['engineer','mrs-chiha','brawler','kumaverson','medic','spitter','ooze','resonator','red-panther-knife']){
  assert.equal(drawV100Muzzle({}, {}, {weapon,elapsed:0}),false,weapon);
 }
 const calls=[],ctx={
  save(){calls.push(['save'])},restore(){calls.push(['restore'])},
  translate(...args){calls.push(['translate',...args])},rotate(...args){calls.push(['rotate',...args])},
  drawImage(...args){calls.push(['drawImage',...args.slice(1)])},
 };
 const objects={'v100-muzzle':{complete:true,naturalWidth:1536}};
 drawV100Muzzle(ctx,objects,{weapon:'babayaga',elapsed:.04,x:300,y:120,tx:200,ty:120});
 assert.deepEqual(calls.find(c=>c[0]==='translate'),['translate',300,120]);
 assert.deepEqual(calls.find(c=>c[0]==='rotate'),['rotate',Math.PI]);
 assert.deepEqual(calls.find(c=>c[0]==='drawImage').slice(1,5),[1024,0,512,512]);
 assert.equal(ctx.globalCompositeOperation,'lighter');assert.equal(ctx.shadowBlur,0);
 assert.equal(calls.at(-1)[0],'restore');
});
test('explosion frames advance once and draw nothing after the effect lifetime',()=>{
 for(const duration of [.72,1.05,1.42,2.6]){
  assert.equal(v100ExplosionFrame({elapsed:0,duration}),0);
  assert.equal(v100ExplosionFrame({elapsed:duration*.5,duration}),15);
  assert.equal(v100ExplosionFrame({elapsed:duration*.999,duration}),29);
  assert.equal(v100ExplosionFrame({elapsed:duration,duration}),null);
  assert.equal(v100ExplosionFrame({elapsed:duration+1,duration}),null);
  drawV100Explosion({}, {}, {elapsed:duration,duration});
 }
});
test('ground fire uses bounded atlas frames, fades at expiry, and restores alpha',()=>{
 const calls=[],alphas=[];let alpha=1;const ctx={save(){calls.push('save')},restore(){calls.push('restore');alpha=1},translate(){},drawImage(...args){calls.push(args)},set globalAlpha(value){alpha=value;alphas.push(value)},get globalAlpha(){return alpha}};
 const objects={'v100-ground-fire':{complete:true,naturalWidth:768,naturalHeight:640}};
 const effect={id:7,kind:'burn',phase:'active',x:300,y:200,radius:88,remaining:1};
 assert.equal(drawV100GroundFire(ctx,objects,effect,20),true);assert.equal(calls.filter((item)=>Array.isArray(item)).length,5);assert.ok(calls.filter((item)=>Array.isArray(item)).every((args)=>args[1]>=0&&args[1]<768&&args[2]>=0&&args[2]<640));assert.equal(alpha,1);
 const before=calls.length;effect.remaining=.2;assert.equal(drawV100GroundFire(ctx,objects,effect,20.4),true);assert.ok(alphas.at(-1)<alphas[0]);assert.equal(alpha,1);assert.equal(drawV100GroundFire(ctx,objects,{...effect,remaining:0},20.5),false);assert.equal(calls.length,before+7);
});
