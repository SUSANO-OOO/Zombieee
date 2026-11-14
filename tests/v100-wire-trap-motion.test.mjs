import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {drawV100WireTrapMotion,wireTrapRigPose,V100_SPENT_TRAP_COIL} from '../app/v100WireTrapMotion.js';
import {drawV100DeployedWireTrap,drawV100SupportAbilityEffects,queueV100SupportAbilityEffect,getV100SupportAbilityEffectsSnapshot} from '../app/v100SupportAbilityVfx.js';

const images=()=>({'v100-support-trap-intact':{id:'intact',complete:true,naturalWidth:386,naturalHeight:242},
 'v100-support-trap-sprung':{id:'sprung',complete:true,naturalWidth:404,naturalHeight:193},
 'v100-dust':{id:'dust',complete:true,naturalWidth:64,naturalHeight:64}});
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function canvas(){
 const calls=[],stack=[];let matrix=[1,0,0,1,0,0];
 const ctx={globalAlpha:.7,globalCompositeOperation:'lighter',shadowBlur:8,
  save(){stack.push({matrix:[...matrix],alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadow:this.shadowBlur});},
  restore(){const r=stack.pop();matrix=r.matrix;this.globalAlpha=r.alpha;this.globalCompositeOperation=r.composite;this.shadowBlur=r.shadow;},
  translate(x,y){matrix=mul(matrix,[1,0,0,1,x,y]);},rotate(a){matrix=mul(matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},
  scale(x,y){matrix=mul(matrix,[x,0,0,y,0,0]);},
  drawImage(image,...args){calls.push({image,args,matrix:[...matrix],alpha:this.globalAlpha});}};
 return {ctx,calls,stack};
}
test('both approved trap textures keep their original dimensions and exact bytes',async()=>{
 for(const [file,width,height,sha] of [['intact',386,242,'aa161313c9cf55ac05b64a24be7d2317f4cc5b97d82ff5ee025510dfa72b67b4'],['sprung',404,193,'a15e8c564eb00ebb0a35995f8177c9ebc3e8c49093af1240e93a6ed7bfd2add7']]){
  const b=await readFile('public/art/v060/stage-objects/nishijin-wire-trap-'+file+'-v1.png');
  assert.equal(b.readUInt32BE(16),width);assert.equal(b.readUInt32BE(20),height);assert.equal(createHash('sha256').update(b).digest('hex'),sha);
 }
});
test('the deployed endpoint paints exactly the existing whole trap at its original size and ground position',()=>{
 const f=canvas(),objects=images();assert.equal(drawV100WireTrapMotion(f.ctx,objects,{x:400,y:205,progress:1}),true);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].image,objects['v100-support-trap-intact']);
 assert.deepEqual(f.calls[0].args,[359,205-82*242/386,82,82*242/386]);
 assert.deepEqual([f.ctx.globalAlpha,f.ctx.globalCompositeOperation,f.ctx.shadowBlur],[.7,'lighter',8]);assert.equal(f.stack.length,0);
});
test('both stakes and the coil move independently while all four bitmap wire joins stay connected',()=>{
 for(const phase of ['deploy','spring'])for(const progress of [0,.16,.37,.7,.9]){
  const f=canvas();assert.equal(drawV100WireTrapMotion(f.ctx,images(),{x:420,y:205,phase,progress}),true);
  assert.ok(f.calls.length>=5);const [left,right,leftCable,rightCable,coil]=f.calls;
  for(const [a,b,x,y] of [[left,leftCable,156,65],[leftCable,coil,166,65],[coil,rightCable,220,65],[rightCable,right,248,64]]){
   const p=point(a.matrix,x,y),q=point(b.matrix,x,y);assert.ok(Math.hypot(p[0]-q[0],p[1]-q[1])<1e-7,phase+' has an open wire join');
  }
  const pose=wireTrapRigPose(progress,phase);
  if((phase==='deploy'&&progress<=.7)||(phase==='spring'&&progress>0))assert.notEqual(pose.left.angle,pose.right.angle);
  if(phase==='deploy'&&progress===.9)assert.equal(Math.abs(pose.left.angle)+Math.abs(pose.right.angle),0,'both stakes settle before the static handoff');
  assert.equal(f.stack.length,0);
 }
});
test('the sprung endpoint uses the existing spent trap without stretching it to the intact aspect ratio',()=>{
 const f=canvas(),objects=images();assert.equal(drawV100WireTrapMotion(f.ctx,objects,{x:400,y:205,phase:'spring',progress:1,alpha:.4}),true);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].image,objects['v100-support-trap-sprung']);
 assert.deepEqual(f.calls[0].args,[359,205-82*193/404,82,82*193/404]);assert.equal(f.calls[0].alpha,.4);
});
test('expired, unknown, nonfinite or changed-calibration inputs do not paint an invented substitute',()=>{
 for(const options of [{x:NaN,y:2},{x:1,y:2,width:0},{x:1,y:2,phase:'unknown'},{x:1,y:2,alpha:0}]){
  const f=canvas();assert.equal(drawV100WireTrapMotion(f.ctx,images(),options),false);assert.equal(f.calls.length,0);
 }
 const f=canvas(),objects=images();objects['v100-support-trap-intact'].naturalWidth=400;
 assert.equal(drawV100WireTrapMotion(f.ctx,objects,{x:1,y:2,progress:.2}),false);assert.equal(f.calls.length,0);
});
test('deployment follows only the real matching effect clock, survives owner cloning and ends at the ordinary static object',()=>{
 const owner={id:5,manualAbility:{activationId:7}},world={time:10,definition:{missionConfig:{v100StageNumber:2}}},objects=images();
 assert.equal(queueV100SupportAbilityEffect(world,{ownerId:5,activationId:7,eventType:'trap-deploy',x:400,y:200,duration:.3}),true);
 world.time=10.12;const before=structuredClone(world),f=canvas();
 drawV100DeployedWireTrap(f.ctx,objects,world,{...owner},400,205);assert.equal(f.calls.length,5);assert.deepEqual(world,before);
 const stale=canvas();drawV100DeployedWireTrap(stale.ctx,objects,world,{id:5,manualAbility:{activationId:8}},400,205);assert.equal(stale.calls.length,1);
 world.time=10.31;const after=canvas();drawV100DeployedWireTrap(after.ctx,objects,world,owner,400,205);assert.equal(after.calls.length,1);assert.deepEqual(getV100SupportAbilityEffectsSnapshot(world),[]);
});
test('real trigger effects keep the deployed ground anchor and retain the same short duration and receipt',()=>{
 const world={time:20,definition:{missionConfig:{v100StageNumber:2}}};
 queueV100SupportAbilityEffect(world,{ownerId:5,activationId:7,eventType:'trap-sprung',x:400,y:200,duration:.3});
 const before=getV100SupportAbilityEffectsSnapshot(world),f=canvas(),oldRandom=Math.random;
 Math.random=()=>{throw new Error('Paint consumed simulation randomness');};
 try{drawV100SupportAbilityEffects(f.ctx,images(),world);}finally{Math.random=oldRandom;}
 assert.ok(f.calls.some(c=>c.image.id==='intact'));assert.deepEqual(getV100SupportAbilityEffectsSnapshot(world),before);
 world.time=20.301;const ended=canvas();drawV100SupportAbilityEffects(ended.ctx,images(),world);assert.equal(ended.calls.length,0);
});

test('a manual trap retains its original spent material and continuous wire while its actual targets remain held',()=>{
 const world={time:10,definition:{missionConfig:{v100StageNumber:2}},fighters:[
  {id:2,side:'zombie',hp:100,x:390,y:205,stunned:1.35},{id:3,side:'zombie',hp:100,x:440,y:205,stunned:1.35}]};
 const targetIds=[2,3];assert.equal(queueV100SupportAbilityEffect(world,{ownerId:5,activationId:7,eventType:'trap-sprung',targetIds,x:400,y:200,duration:1.35,springSeconds:.3}),true);
 targetIds.push(999);const exposed=getV100SupportAbilityEffectsSnapshot(world);exposed[0].targetIds.push(998);assert.deepEqual(getV100SupportAbilityEffectsSnapshot(world)[0].targetIds,[2,3]);
 world.time=10.6;for(const f of world.fighters)f.stunned=.75;
 const before=JSON.stringify(world),f=canvas(),oldRandom=Math.random;Math.random=()=>{throw new Error('Binding paint changed simulation randomness');};
 try{drawV100SupportAbilityEffects(f.ctx,images(),world);}finally{Math.random=oldRandom;}
 assert.equal(JSON.stringify(world),before);assert.equal(f.calls[0].image.id,'sprung');
 const wires=f.calls.slice(1);assert.ok(wires.length>0&&wires.length<=18);assert.ok(wires.every(c=>c.image.id==='intact'&&c.args.slice(0,4).join(',')==='220,58,28,14'));
 const start=c=>point(c.matrix,220,65),end=c=>point(c.matrix,248,64),coil=V100_SPENT_TRAP_COIL;
 const anchor=[400+(coil.x/coil.width-.5)*82,205+(coil.y-coil.height)/coil.width*82];
 assert.ok(Math.hypot(...start(wires[0]).map((v,i)=>v-anchor[i]))<1e-7);
 for(let i=1;i<wires.length;i++)assert.ok(Math.hypot(...start(wires[i]).map((v,k)=>v-end(wires[i-1])[k]))<1e-7,'barbed wire has a disconnected join');
 assert.ok(Math.hypot(...end(wires.at(-1)).map((v,i)=>v-[449,201][i]))<1e-7);assert.equal(f.stack.length,0);
 assert.deepEqual([f.ctx.globalAlpha,f.ctx.globalCompositeOperation,f.ctx.shadowBlur],[.7,'lighter',8]);
});

test('manual wire follows only the living held targets and falls slack before its exact control window ends',()=>{
 const world={time:20,definition:{missionConfig:{v100StageNumber:2}},fighters:[
  {id:2,side:'zombie',hp:100,x:390,y:205,stunned:1.35},{id:3,side:'zombie',hp:100,x:440,y:205,stunned:1.35},
  {id:4,side:'human',hp:100,x:420,y:205,stunned:1.35}]};
 queueV100SupportAbilityEffect(world,{ownerId:5,activationId:7,eventType:'trap-sprung',targetIds:[2,3],x:400,y:200,duration:1.35,springSeconds:.3});
 world.time=21.2;world.fighters[0].hp=0;Object.assign(world.fighters[1],{x:450,y:210,stunned:.15});
 const fading=canvas();drawV100SupportAbilityEffects(fading.ctx,images(),world);assert.ok(fading.calls.length>1);assert.ok(fading.calls.every(c=>c.alpha>0&&c.alpha<1));
 const last=fading.calls.at(-1),lastPoint=point(last.matrix,248,64);assert.ok(Math.abs(lastPoint[0]-459)<1e-7);assert.ok(lastPoint[1]>206&&lastPoint[1]<210);
 world.fighters[1].stunned=0;const released=canvas();drawV100SupportAbilityEffects(released.ctx,images(),world);assert.equal(released.calls.length,0,'wire must not hold an actor that can move');
 world.time=21.351;world.fighters[1].stunned=10;const expired=canvas();drawV100SupportAbilityEffects(expired.ctx,images(),world);assert.equal(expired.calls.length,0,'another later stun cannot extend this trap');
 assert.deepEqual(getV100SupportAbilityEffectsSnapshot(world),[]);
});

test('binding metadata rejects invented targets and keeps a short real binding within its original duration',()=>{
 const world={time:30,definition:{missionConfig:{v100StageNumber:2}},fighters:[]};
 const base={ownerId:5,activationId:7,eventType:'trap-sprung',x:400,y:200,duration:.1};
 for(const patch of [{targetIds:[]},{targetIds:[2,2]},{targetIds:[NaN]},{targetIds:[2],springSeconds:0},{targetIds:[2],eventType:'medic-impact'}])assert.equal(queueV100SupportAbilityEffect(world,{...base,...patch}),false);
 assert.deepEqual(getV100SupportAbilityEffectsSnapshot(world),[]);
 assert.equal(queueV100SupportAbilityEffect(world,{...base,targetIds:[2],springSeconds:.3}),true);assert.equal(getV100SupportAbilityEffectsSnapshot(world)[0].springSeconds,.1);
 const missing=canvas();drawV100SupportAbilityEffects(missing.ctx,images(),world);assert.equal(missing.calls.length,0);
});
test('a trap triggered during deployment starts from that actual pose and retains it after the deployment record expires',()=>{
 const world={time:30,definition:{missionConfig:{v100StageNumber:2}}};
 queueV100SupportAbilityEffect(world,{ownerId:5,activationId:7,eventType:'trap-deploy',x:400,y:200,duration:.3});
 world.time=30.1;queueV100SupportAbilityEffect(world,{ownerId:5,activationId:7,eventType:'trap-sprung',x:400,y:200,duration:.3});
 const captured=getV100SupportAbilityEffectsSnapshot(world).find(e=>e.eventType==='trap-sprung');assert.ok(Math.abs(captured.deploymentProgress-1/3)<1e-10);
 const a=wireTrapRigPose(captured.deploymentProgress,'deploy'),b=wireTrapRigPose(0,'spring',captured.deploymentProgress);
 for(const key of ['leftEnd','rightEnd','coilLeft','coilRight'])assert.ok(Math.hypot(a[key].x-b[key].x,a[key].y-b[key].y)<1e-7);
 world.time=30.31;const still=getV100SupportAbilityEffectsSnapshot(world);assert.equal(still.length,1);assert.equal(still[0].deploymentProgress,captured.deploymentProgress);
});
