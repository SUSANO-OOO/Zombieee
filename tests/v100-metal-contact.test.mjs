import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {drawV100Contact,drawV100ContactQueue,queueV100GuardContact,clearV100ContactQueue,getV100GuardContactSnapshot} from '../app/v100CombatVfx.js';

const objects={'v100-metal-contact':{complete:true,naturalWidth:1536}};
function observer(){
 const calls=[];
 const ctx={save(){},restore(){},translate(...args){calls.push(['translate',...args]);},scale(...args){calls.push(['scale',...args]);},drawImage(...args){calls.push(['image',...args]);}};
 return {ctx,calls,images:()=>calls.filter(c=>c[0]==='image')};
}
const battle=()=>({time:20,definition:{missionConfig:{v100StageNumber:3}}});
const guard=()=>({id:21,side:'human',kind:'kumaverson',hp:100,x:400,manualAbility:{phase:'active',activationId:3}});
const incoming=()=>({owner:guard(),attacker:{side:'zombie',x:440},incomingDamage:20,x:418,y:268});

test('Kuma guard contact requires a live active guard and an actual located incoming attack',()=>{
 const rejected=[
  {...incoming(),owner:{...guard(),hp:0}},
  {...incoming(),owner:{...guard(),kind:'brawler'}},
  {...incoming(),owner:{...guard(),side:'zombie'}},
  ...['ready','windup','recovery','cooldown'].map(phase=>({...incoming(),owner:{...guard(),manualAbility:{phase}}})),
  {...incoming(),attacker:null},{...incoming(),attacker:{side:'human',x:440}},
  ...[0,-1,NaN,Infinity].map(incomingDamage=>({...incoming(),incomingDamage})),
  {...incoming(),x:NaN},{...incoming(),y:Infinity},
 ];
 for(const hit of rejected){const world=battle(),view=observer();assert.equal(queueV100GuardContact(world,hit),false);drawV100ContactQueue(view.ctx,objects,world);assert.equal(view.images().length,0);}
 const legacy={time:20,definition:{missionConfig:{}}};assert.equal(queueV100GuardContact(legacy,incoming()),false);
 const world=battle(),view=observer();assert.equal(queueV100GuardContact(world,incoming()),true);drawV100ContactQueue(view.ctx,objects,world);assert.equal(view.images().length,0);drawV100ContactQueue(view.ctx,objects,world,()=>({x:418,y:268}));
 assert.deepEqual(view.calls.find(c=>c[0]==='translate'),['translate',418,268]);assert.equal(view.images().length,1);
});

test('metal contact has four authored decay frames and expires while the six-second guard remains active',()=>{
 const frames=[];
 for(const elapsed of [.001,.041,.081,.121]){
  const view=observer();assert.equal(drawV100Contact(view.ctx,objects,{x:0,y:0,elapsed,metal:true,size:54}),true);
  const image=view.images()[0];frames.push(image[2]/512+(image[3]/512)*3);
  assert.equal(view.ctx.globalCompositeOperation,'source-over');
 }
 assert.deepEqual(frames,[1,2,4,5]);
 for(const elapsed of [-1,.16,.2,6,Infinity,NaN])assert.equal(drawV100Contact({},objects,{elapsed,metal:true}),false);
 const world=battle(),view=observer(),hit=incoming();queueV100GuardContact(world,hit);
 world.time+=.17;drawV100ContactQueue(view.ctx,objects,world);assert.equal(view.images().length,0);assert.equal(hit.owner.manualAbility.phase,'active');
});

test('successive guard contacts use the current contact location and direction, and reset clears them',()=>{
 const world=battle(),view=observer();queueV100GuardContact(world,incoming());
 world.time+=.2;
 queueV100GuardContact(world,{...incoming(),owner:{...guard(),x:480},attacker:{side:'zombie',x:430},x:462,y:288});
 drawV100ContactQueue(view.ctx,objects,world);
 assert.equal(view.images().length,0);drawV100ContactQueue(view.ctx,objects,world,()=>({x:462,y:288}));assert.equal(view.images().length,1);assert.deepEqual(view.calls.find(c=>c[0]==='translate'),['translate',462,288]);assert.deepEqual(view.calls.find(c=>c[0]==='scale'),['scale',-1,1]);
 clearV100ContactQueue(world);const cleared=observer();drawV100ContactQueue(cleared.ctx,objects,world);assert.equal(cleared.images().length,0);
});

test('only the selected metal frames are used, each with genuine alpha and no visible cell seam',async()=>{
 const image=sharp('public/art/v100/combat-vfx/metal-impact-six-r1.webp'),metadata=await image.metadata();
 assert.equal(metadata.width,1536);assert.equal(metadata.height,1024);assert.equal(metadata.hasAlpha,true);
 const {data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let previousBrightness=Infinity;
 for(const frame of [1,2,4,5]){
  let edgeMaximum=0,edgeTotal=0,edgeCount=0,transparent=0,partial=0,brightness=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
   const i=((Math.floor(frame/3)*512+y)*info.width+frame%3*512+x)*4,a=data[i+3];
   if(a===0)transparent++;else if(a<255)partial++;
   brightness+=Math.max(data[i],data[i+1],data[i+2])*a/255;
   if(x>=12&&x<500&&y>=12&&y<500)continue;
   for(let c=0;c<3;c++){const v=data[i+c]*a/255;edgeMaximum=Math.max(edgeMaximum,v);edgeTotal+=v;edgeCount++;}
  }
  assert.ok(transparent>0&&partial>0);assert.ok(edgeMaximum<=8);assert.ok(edgeTotal/edgeCount<1);
  assert.ok(brightness<previousBrightness);previousBrightness=brightness;
 }
});

test('guard snapshot reads the real expiring queue without exposing mutable state',()=>{
 const world=battle();queueV100GuardContact(world,incoming());
 const contacts=getV100GuardContactSnapshot(world);
 assert.equal(contacts.length,1);assert.equal(contacts[0].ownerId,21);assert.equal(contacts[0].activationId,3);
 assert.equal(contacts[0].incomingDamage,20);assert.equal(contacts[0].ownerHp,100);assert.equal(contacts[0].startedAt,20);assert.equal(contacts[0].duration,.16);
 contacts[0].x=999;assert.equal(getV100GuardContactSnapshot(world)[0].x,418);
 world.time+=.17;assert.deepEqual(getV100GuardContactSnapshot(world),[]);
});
