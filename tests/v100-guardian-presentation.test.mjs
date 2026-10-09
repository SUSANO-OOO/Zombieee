import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {v100GuardianGuardPose,v100RenderedShieldSocket,V100_GUARDIAN_STABLE_POSE} from '../app/v100GuardianPresentation.js';
import {MANUAL_ABILITY_REGISTRY,createManualAbilityRuntime,beginManualAbility,advanceManualAbility} from '../app/manualAbilities.js';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {beginTicketGateEaterCharge,advanceTicketGateEaterCharge} from '../app/stationEnemyMechanics.js';
import {queueV100GuardContact,getV100GuardContactSnapshot,drawV100ContactQueue} from '../app/v100CombatVfx.js';

test('guardian holds its authored brace for the whole actual six-second skill and reacts only while hit flash remains',()=>{
 const definition=MANUAL_ABILITY_REGISTRY.guardian;
 let runtime=beginManualAbility(createManualAbilityRuntime('guardian'),{x:450,y:300,direction:1}).runtime;
 assert.equal(v100GuardianGuardPose(runtime,definition),'idle');
 runtime=advanceManualAbility(runtime,.25).runtime;assert.equal(v100GuardianGuardPose(runtime,definition),'attack-a');
 runtime=advanceManualAbility(runtime,.21).runtime;assert.equal(runtime.phase,'active');
 for(let i=0;i<59;i++){
  assert.equal(v100GuardianGuardPose(runtime,definition),'attack-a');
  assert.equal(v100GuardianGuardPose(runtime,definition,.12),'hit');
  assert.equal(v100GuardianGuardPose(runtime,definition,.03),'attack-a');
  assert.equal(v100GuardianGuardPose(runtime,definition,0,{moving:true}),null,'Keep actual walking poses');
  assert.equal(v100GuardianGuardPose(runtime,definition,0,{attacking:true}),null,'Keep actual normal attack poses');
  runtime=advanceManualAbility(runtime,.1).runtime;
 }
 runtime=advanceManualAbility(runtime,.1).runtime;assert.equal(runtime.phase,'recovery');
 assert.equal(v100GuardianGuardPose(runtime,definition),'attack-a');
 runtime=advanceManualAbility(runtime,.19).runtime;assert.equal(v100GuardianGuardPose(runtime,definition),'idle');
 runtime=advanceManualAbility(runtime,.02).runtime;assert.equal(v100GuardianGuardPose(runtime,definition),null);
 assert.equal(V100_GUARDIAN_STABLE_POSE.scaleX,1);assert.equal(V100_GUARDIAN_STABLE_POSE.scaleY,1);
});

test('guardian contact points lie on opaque steel in both unchanged source poses and face the rendered plate',async()=>{
 for(const direction of ['left','right'])for(const state of ['attack-a','hit']){
  const frame=spriteFrameFor('guardian',state,direction),size={w:480,h:448};
  const point=v100RenderedShieldSocket({kind:'guardian',state,direction,frame,size,pose:V100_GUARDIAN_STABLE_POSE,x:frame.anchorX*480,y:frame.anchorY*448});
  const {data}=await sharp('public'+frame.path).extract({left:frame.sourceRect.x+point.x,top:frame.sourceRect.y+point.y,width:1,height:1}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(data[3],255);assert.ok(data[0]<130&&data[1]<130&&data[2]<130,'The measured point must be on dark shield plate');
  assert.ok(direction==='right'?point.x>270:point.x<215);
 }
});

test('guardian sparks require a real frontal active guard hit, resolve to the rendered shield once and expire',()=>{
 const world={time:10,definition:{missionConfig:{v100StageNumber:2}}},owner={id:8,kind:'guardian',side:'human',hp:180,x:300,manualAbility:{phase:'active',activationId:3,target:{direction:1}}};
 const incoming={owner,attacker:{side:'zombie',x:360},incomingDamage:20,x:316,y:240};
 assert.equal(queueV100GuardContact(world,{...incoming,attacker:{side:'zombie',x:280}}),false);
 assert.equal(queueV100GuardContact(world,{...incoming,incomingDamage:0}),false);
 assert.equal(queueV100GuardContact(world,{...incoming,owner:{...owner,manualAbility:{phase:'ready'}}}),false);
 assert.equal(queueV100GuardContact(world,incoming),true);
 const calls=[],ctx={save(){},restore(){},translate(x,y){calls.push([x,y]);},scale(){},drawImage(){}};
 const objects={'v100-metal-contact':{complete:true,naturalWidth:1536}};
 drawV100ContactQueue(ctx,objects,world);assert.equal(calls.length,0,'No guessed body-origin spark before the shield is rendered');
 drawV100ContactQueue(ctx,objects,world,()=>({x:324,y:248}));assert.deepEqual(calls,[[324,248]]);
 const receipt=getV100GuardContactSnapshot(world)[0];assert.equal(receipt.resolvedSocket,true);assert.equal(receipt.incomingDamage,20);
 world.time+=.05;drawV100ContactQueue(ctx,objects,world,()=>({x:370,y:270}));assert.deepEqual(calls.at(-1),[324,248],'The particles stay at the impact point');
 world.time+=.12;drawV100ContactQueue(ctx,objects,world,()=>({x:370,y:270}));assert.equal(getV100GuardContactSnapshot(world).length,0);assert.equal(calls.length,2);
 assert.equal(owner.hp,180,'Presentation never changes combat HP');
});

test('a gate-eater charge crosses the shield owner, so metal contact must use its incoming origin instead of its final position',()=>{
 const boss={id:2,side:'zombie',kind:'gate-eater',hp:2100,x:500,y:280,lane:1,combatReady:true};
 const started=beginTicketGateEaterCharge({boss,targetX:388});
 const charge=advanceTicketGateEaterCharge({boss,runtime:started.runtime,elapsedSeconds:2});
 assert.equal(charge.chargeEnded,true);assert.ok(charge.boss.x<400);
 const world={time:30,definition:{missionConfig:{v100StageNumber:5}}};
 const owner={id:1,side:'human',kind:'guardian',hp:180,x:400,animationPresentation:{direction:'left'},manualAbility:{phase:'active',activationId:2,target:{direction:1}}};
 const hit={owner,incomingDamage:34,x:420,y:250};
 assert.equal(queueV100GuardContact(world,{...hit,attacker:charge.boss}),false,'Final position would misclassify this frontal charge');
 assert.equal(queueV100GuardContact(world,{...hit,attacker:boss}),true,'The actual incoming position preserves the frontal contact');
 assert.equal(getV100GuardContactSnapshot(world)[0].incomingDamage,34);
});
