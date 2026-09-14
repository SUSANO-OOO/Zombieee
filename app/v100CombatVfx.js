export const V100_COMBAT_VFX_ART=Object.freeze({
 'v100-explosion':'/art/v100/combat-vfx/explosion-fire-smoke.webp',
 'v100-smoke-a':'/art/v100/combat-vfx/blackSmoke01.webp',
 'v100-smoke-b':'/art/v100/combat-vfx/blackSmoke05.webp',
 'v100-dust':'/art/v100/combat-vfx/whitePuff00.webp',
 'v100-muzzle':'/art/v100/combat-vfx/muzzle-six-frames-r1.webp',
 'v100-contact':'/art/v100/combat-vfx/contact-six-frames-r1.webp',
 'v100-ground-impact':'/art/v100/combat-vfx/ground-impact-six-frames-r1.webp',
 'v100-metal-contact':'/art/v100/combat-vfx/metal-impact-six-r1.webp',
 'v100-claw-contact':'/art/v100/combat-vfx/claw-contact-six-r1.webp',
 'v100-support-trap-intact':'/art/v060/stage-objects/nishijin-wire-trap-intact-v1.png',
 'v100-support-trap-sprung':'/art/v060/stage-objects/nishijin-wire-trap-sprung-v1.png',
 'v100-grenade-projectile':'/art/v100/combat-vfx/grenade-projectile-r1.webp',
 'v100-fire-whisky-projectile':'/art/v100/combat-vfx/fire-whisky-projectile-r1.webp',
 'v100-lightblade':'/art/v100/combat-vfx/lightblade-six-frames-r1.webp',
 'v100-countercut':'/art/v100/combat-vfx/countercut-six-frames-r1.webp',
 'v100-ground-fire':'/art/v100/combat-vfx/ground-fire-smoke-r1.webp',
});

export function drawV100GroundFire(ctx, objects, effect, time) {
  if (!effect || effect.kind !== 'burn' || effect.phase !== 'active' || !(effect.remaining > 0) || !(effect.radius > 0)
    || ![effect.id, effect.x, effect.y, effect.radius, effect.remaining, time].every(Number.isFinite)) return false;
  const source = objects?.['v100-ground-fire'];
  if (!source?.complete || !source.naturalWidth || !source.naturalHeight) return false;
  const cellWidth = source.naturalWidth / 6;
  const cellHeight = source.naturalHeight / 5;
  if (!(cellWidth > 0 && cellHeight > 0)) return false;
  const fade = effect.remaining < .45 ? Math.max(0, effect.remaining / .45) : 1;
  ctx.save();
  ctx.translate(effect.x, effect.y);
  for (let patch = 0; patch < 5; patch += 1) {
    const frame = Math.floor((((time / 1.1 + effect.id * .037 + patch / 5) % 1 + 1) % 1) * 30) % 30;
    const sx = frame % 6 * cellWidth;
    const sy = Math.floor(frame / 6) * cellHeight;
    const spread = (patch - 2) / 2;
    const x = spread * effect.radius * .65 + Math.sin(time * 1.7 + effect.id + patch) * effect.radius * .025;
    const width = Math.max(80, Math.min(160, effect.radius * 1.5));
    const height = width * .75;
    ctx.globalAlpha = fade * (.82 - (patch % 2) * .06);
    ctx.drawImage(source, sx, sy, cellWidth, cellHeight, x - width / 2, -height * (110 / 128), width, height);
  }
  ctx.restore();
  return true;
}
// A muzzle belongs only to a firearm, never to a thrown grenade, bolt or
// infected mouth. Each actual burst shot owns one short, non-looping flash.
const MUZZLE_PROFILES=Object.freeze({
 ranger:{duration:.1,size:48},
 babayaga:{duration:.1,size:52},
 gunner:{duration:.085,size:48},
 'red-panther-smg':{duration:.085,size:44},
 'red-panther-commander':{duration:.1,size:42},
 crawler:{duration:.14,size:90},
});
export function v100MuzzleFrame(weapon,elapsed){
 const profile=MUZZLE_PROFILES[weapon];
 if(!profile||!Number.isFinite(elapsed)||elapsed<0||elapsed>=profile.duration)return null;
 return {frame:Math.min(5,Math.floor(elapsed/profile.duration*6)),size:profile.size};
}
export function drawV100Muzzle(ctx,objects,{weapon,elapsed,x,y,tx,ty}){
 const sample=v100MuzzleFrame(weapon,elapsed);if(!sample)return false;
 const image=ready(objects,'v100-muzzle'),{frame,size}=sample;
 // The six authored cells have a common ignition point (112,246). Retain
 // their fractional alpha; additive light leaves the background untouched.
 ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='lighter';ctx.shadowBlur=0;
 ctx.translate(x,y);ctx.rotate(Math.atan2(ty-y,tx-x));
 ctx.drawImage(image,frame%3*512,Math.floor(frame/3)*512,512,512,-112/512*size,-246/512*size,size,size);
 ctx.restore();return true;
}
const clamp=value=>Math.max(0,Math.min(1,value));
const ready=(objects,id)=>{
 const image=objects[id];
 if(!image?.complete||!image.naturalWidth)throw new Error(`Combat VFX must decode before battle: ${id}`);
 return image;
};
export const V100_CONTACT_WEAPONS=Object.freeze(['scout','brawler','kumaverson','brute','guardian','crazy-king','zakimiya','walker','runner','crusher','abomination','takuya','grappler','sprinter','gate-eater','cagewalker','red-panther-knife']);
export const V100_CLAW_CONTACT_WEAPONS=Object.freeze(['walker','runner','grappler','sprinter']);
const contactQueues=new WeakMap();
export function clearV100ContactQueue(world){contactQueues.delete(world);}
export function queueV100Contact(world,{x,y,ground=false,metal=false,claw=false,size=58,direction=1,delay=0,guardContact=null,clawContact=null,skillContact=null}){
 if(!world.definition?.missionConfig?.v100StageNumber)return;
 const entries=(contactQueues.get(world)??[]).filter(e=>world.time-e.startedAt<e.duration);
 entries.push({x,y,ground,metal,claw,size,direction,guardContact,clawContact,skillContact,startedAt:world.time+delay,duration:metal?.16:ground?.6:.2});
 contactQueues.set(world,entries.slice(-48));
}
export function queueV100TakuyaGroundContact(world,{owner}={}){
 if(!world.definition?.missionConfig?.v100StageNumber||owner?.kind!=='takuya'||owner?.side!=='zombie'||!(owner.hp>0)||!owner.id)return false;
 const entry={x:null,y:null,ground:true,size:136,direction:owner.x>=0?1:-1,startedAt:world.time,duration:.6,
  takuyaGroundContact:{sourceId:'takuya-battle-repaired-v1',kind:'takuya-ground-blade',ownerId:owner.id,resolvedSocket:false}};
 const entries=(contactQueues.get(world)??[]).filter(e=>world.time-e.startedAt<e.duration);
 contactQueues.set(world,[...entries,entry].slice(-48)); return true;
}
export function queueV100TataraGroundContact(world,{owner}={}){
 if(!world.definition?.missionConfig?.v100StageNumber||owner?.kind!=='brute'||owner?.side!=='human'||!(owner.hp>0)||!owner.id
  ||!Number.isFinite(owner.manualAbility?.activationId)||!Number.isFinite(owner.x)||!Number.isFinite(owner.y))return false;
 const activationId=owner.manualAbility.activationId;
 const entry={x:null,y:null,ground:true,size:180,direction:owner.manualAbility.target?.direction<0?-1:1,startedAt:world.time,duration:.6,
  tataraGroundContact:{sourceId:owner.id,kind:'brute-ground-hammer',ownerId:owner.id,activationId,resolvedSocket:false,sourcePath:V100_COMBAT_VFX_ART['v100-ground-impact'],effectSourcePath:V100_COMBAT_VFX_ART['v100-ground-impact'],bodySourcePath:null,sourcePixel:null}};
 const entries=(contactQueues.get(world)??[]).filter(e=>world.time-e.startedAt<e.duration);
 if(entries.some(e=>e.tataraGroundContact?.ownerId===owner.id&&e.tataraGroundContact.activationId===activationId))return false;
 contactQueues.set(world,[...entries,entry].slice(-48)); return true;
}
// Body contact follows applied damage, so misses, retreat immunity, counters
// and active pan/shield guards cannot spray fibers from an untouched body.
export function queueV100ClawContact(world,{attacker,target,hpBefore,attackKind}){
 if(!world.definition?.missionConfig?.v100StageNumber||attackKind!=='melee'
  ||attacker?.side!=='zombie'||!V100_CLAW_CONTACT_WEAPONS.includes(attacker.kind)
  ||target?.side!=='human'||!(hpBefore>0)
  ||![world.time,hpBefore,target.hp,attacker.x,target.x,target.y].every(Number.isFinite)
  ||target.hp>=hpBefore
  ||(['kumaverson','guardian'].includes(target.kind)&&target.manualAbility?.phase==='active'))return false;
 const direction=Math.sign(target.x-attacker.x)||-1;
 // Mayo shares the allied faction but her medical harness is much lower than
 // a standing person's torso. Keep the contact on her smaller body.
 const torsoOffset=target.kind==='mayo-chan'?16:30;
 queueV100Contact(world,{x:target.x-direction*4,y:target.y-torsoOffset,claw:true,size:54,direction,
  clawContact:{sourceId:attacker.id,sourceKind:attacker.kind,attackSequence:attacker.attackSequence,targetId:target.id,targetKind:target.kind,hpBefore,hpAfter:target.hp}});
 return true;
}
export function getV100ClawContactSnapshot(world){
 return (contactQueues.get(world)??[]).filter(e=>e.claw&&e.clawContact&&world.time>=e.startedAt&&world.time-e.startedAt<e.duration)
  .map(e=>({...e.clawContact,x:e.x,y:e.y,direction:e.direction,startedAt:e.startedAt,duration:e.duration}));
}
export function getV100SkillContactSnapshot(world){
 return (contactQueues.get(world)??[]).filter(e=>(e.skillContact||e.takuyaGroundContact||e.tataraGroundContact)&&world.time>=e.startedAt&&world.time-e.startedAt<e.duration)
  .map(e=>({...e.skillContact??e.takuyaGroundContact??e.tataraGroundContact,x:e.x,y:e.y,direction:e.direction,startedAt:e.startedAt,duration:e.duration,resolvedSocket:(e.takuyaGroundContact?.resolvedSocketPoint??e.tataraGroundContact?.resolvedSocketPoint??null),sourcePath:e.tataraGroundContact?.sourcePath??null,effectSourcePath:e.tataraGroundContact?.effectSourcePath??null,bodySourcePath:e.tataraGroundContact?.bodySourcePath??null,sourcePixel:e.tataraGroundContact?.sourcePixel??null}));
}
// Guard contact is owned by an actual incoming hit. Activation, an expired
// guard and ownerless environmental damage must never emit a metal spark.
export function queueV100GuardContact(world,{owner,attacker,incomingDamage,x,y}){
 if(!world.definition?.missionConfig?.v100StageNumber
  ||owner?.side!=='human'||!['kumaverson','guardian'].includes(owner.kind)||!(owner.hp>0)
  ||owner.manualAbility?.phase!=='active'||attacker?.side!=='zombie'
  ||!Number.isFinite(incomingDamage)||incomingDamage<=0
  ||![x,y,attacker.x,owner.x].every(Number.isFinite))return false;
 // Hit recoil can temporarily report the opposite locomotion direction.
 // The shield still covers the direction committed by this guard activation.
 const guardFacing=Number(owner.manualAbility.target?.direction)||1;
 if(owner.kind==='guardian'&&(attacker.x-owner.x)*guardFacing<0)return false;
  queueV100Contact(world,{x,y,metal:true,size:54,direction:attacker.x<owner.x?-1:1,guardContact:{ownerId:owner.id,activationId:owner.manualAbility.activationId,ownerHp:owner.hp,incomingDamage,ownerKind:owner.kind,resolvedSocket:false}});
 return true;
}
// Read-only inspection of the same bounded, expiring render queue. No second
// lifetime, persistent event history, actor reference or save data is created.
export function getV100GuardContactSnapshot(world){
 return (contactQueues.get(world)??[]).filter(e=>e.metal&&e.guardContact&&world.time>=e.startedAt&&world.time-e.startedAt<e.duration)
  .map(e=>({...e.guardContact,x:e.x,y:e.y,startedAt:e.startedAt,duration:e.duration}));
}
export function drawV100Contact(ctx,objects,{x,y,elapsed,ground=false,metal=false,claw=false,size=58,direction=1,duration=metal?.16:ground?.6:.2}){
 if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=duration)return false;
 const frame=metal?[1,2,4,5][Math.min(3,Math.floor(elapsed/duration*4))]:Math.min(5,Math.floor(elapsed/duration*6));
 const anchor=metal?{x:180,y:256}:ground?{x:256,y:360}:claw?{x:256,y:256}:{x:228,y:270};
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.shadowBlur=0;
 ctx.translate(x,y);if(!ground&&direction<0)ctx.scale(-1,1);
 ctx.drawImage(ready(objects,metal?'v100-metal-contact':ground?'v100-ground-impact':claw?'v100-claw-contact':'v100-contact'),frame%3*512,Math.floor(frame/3)*512,512,512,-anchor.x/512*size,-anchor.y/512*size,size,size);
 ctx.restore();return true;
}
export function drawV100ContactQueue(ctx,objects,world,shieldSocketForOwner,takuyaGroundSocketForOwner,tataraGroundSocketForOwner){
 const active=(contactQueues.get(world)??[]).filter(e=>{
  if(world.time<e.startedAt-1||world.time-e.startedAt>=e.duration)return false;
  const t=e.tataraGroundContact;
  if(t&&!t.resolvedSocket){
   const owner=world.fighters?.find(f=>String(f.id)===String(t.ownerId));
   if(!owner||owner.hp<=0||owner.manualAbility?.activationId!==t.activationId)return false;
  }
  return true;
 });
 contactQueues.set(world,active);
  for(const e of active){
  if(e.guardContact?.ownerKind&&['guardian','kumaverson'].includes(e.guardContact.ownerKind)&&!e.guardContact.resolvedSocket){
   const point=shieldSocketForOwner?.(e.guardContact.ownerId);
   if(!point||![point.x,point.y].every(Number.isFinite))continue;
   e.x=point.x;e.y=point.y;e.guardContact.resolvedSocket=true;
  }
  if(e.takuyaGroundContact&&!e.takuyaGroundContact.resolvedSocket){
   const point=takuyaGroundSocketForOwner?.(e.takuyaGroundContact.ownerId);
   if(!point||![point.x,point.y].every(Number.isFinite))continue;
   e.x=point.x;e.y=point.y;e.takuyaGroundContact.resolvedSocket=true;
   e.takuyaGroundContact.resolvedSocketPoint={x:point.x,y:point.y,sourceId:point.sourceId,kind:point.kind,pixel:point.pixel};
  }
  if(e.tataraGroundContact&&!e.tataraGroundContact.resolvedSocket){
   const point=tataraGroundSocketForOwner?.(e.tataraGroundContact.ownerId,e.tataraGroundContact.activationId);
   if(!point||![point.x,point.y].every(Number.isFinite))continue;
   e.x=point.x;e.y=point.y;e.tataraGroundContact.resolvedSocket=true;
   e.tataraGroundContact.resolvedSocketPoint={x:point.x,y:point.y};
   e.tataraGroundContact.bodySourcePath=point.sourcePath??null;
   e.tataraGroundContact.sourcePixel=point.sourcePixel??null;
  }
  if(e.tataraGroundContact&&!e.tataraGroundContact.resolvedSocket)continue;
  drawV100Contact(ctx,objects,{...e,elapsed:world.time-e.startedAt});
 }
}
export function v100ExplosionFrame(effect){
 if(effect.elapsed<0||effect.elapsed>=effect.duration)return null;
 return Math.min(29,Math.floor(effect.elapsed/effect.duration*30));
}
function puff(ctx,image,x,y,size,alpha,rotation=0,ground=false){
 if(alpha<=0)return;
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(rotation);
 ctx.drawImage(image,-size/2,-size*(ground?.2:.65),size,size*(ground?.4:1));ctx.restore();
}
export function drawV100Explosion(ctx,objects,effect,x=effect.x,y=effect.y,multiplier=1,density=1){
 const frame=v100ExplosionFrame(effect);if(frame===null)return;
 const image=ready(objects,'v100-explosion'),dust=ready(objects,'v100-dust');
 const size=({small:150,medium:220,large:320,boss:390}[effect.scale]??150)*multiplier;
 const progress=effect.elapsed/effect.duration;
 for(let i=0;i<2;i++){
  const age=clamp((progress-.24)/.76);
  puff(ctx,ready(objects,i?'v100-smoke-b':'v100-smoke-a'),x+(i?1:-1)*size*age*.15,y-size*(.18+age*.27),size*(.18+age*.3),.48*Math.sin(age*Math.PI),i?.2:-.2);
 }
 // Pressure lifts ground dust first; the authored fire then curls into smoke.
 for(let i=0;i<Math.max(2,Math.round(5*density));i++){
  const direction=i%2?1:-1,travel=size*(.08+progress*.45)*(1+i*.12);
  puff(ctx,dust,x+direction*travel,y+8,size*(.22+progress*.27),.24*(1-progress),direction*.1,true);
 }
 ctx.save();ctx.globalAlpha=clamp((1-progress)/.18);
 ctx.drawImage(image,frame%6*128,Math.floor(frame/6)*128,128,128,x-size/2,y-size*.85,size,size);
 ctx.restore();
}
export function drawV100FootDust(ctx,objects,{x,y,time,seed=0,direction=-1,rush=false,windup=false,density=1}){
 const image=ready(objects,'v100-dust');
 const count=Math.max(1,Math.round((rush?5:windup?3:2)*density));
 for(let i=0;i<count;i++){
  const age=((time*(rush?2.6:1.5)+seed*.13+i*.31)%1+1)%1;
  const size=(rush?32:windup?18:13)*(1+age*.6);
  const distance=(rush?58:windup?10:20)*age;
  puff(ctx,image,x-direction*(distance+4+i*3),y+1-age*(rush?7:3),size,(rush?.32:windup?.22:.12)*(1-age),direction*(.2+age*.16),true);
 }
}
