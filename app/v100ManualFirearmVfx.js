import {drawV100PrecisionRifleRelease,V100_PRECISION_RIFLE_TAIL_SECONDS} from './v100BallisticVfx.js';
import {drawV100Muzzle,v100MuzzleFrame,queueV100Contact} from './v100CombatVfx.js';

export const V100_MANUAL_FIREARM_KINDS=Object.freeze(['ranger','babayaga','gunner']);
const muzzles=new WeakMap();
const isV1=world=>Boolean(world.definition?.missionConfig?.v100StageNumber);
const validOwner=owner=>owner?.side==='human'&&Number.isFinite(owner.hp)&&owner.hp>0&&V100_MANUAL_FIREARM_KINDS.includes(owner.kind)
 &&Number.isFinite(owner.id)&&Number.isFinite(owner.manualAbility?.activationId);
const active=(world)=>(muzzles.get(world)??[]).filter(entry=>{
 const age=world.time-entry.startedAt;
 return v100MuzzleFrame(entry.kind,age)!==null||Boolean(entry.precision&&age>=0&&age<V100_PRECISION_RIFLE_TAIL_SECONDS);
});

export function clearV100ManualFirearmVfx(world){muzzles.delete(world);}
export function queueV100ManualMuzzle(world,{owner,target,shotIndex=0,precisionEnd}){
 if(!isV1(world)||!validOwner(owner)||![world.time,target?.x,target?.y,shotIndex].every(Number.isFinite))return false;
 // A fresh round replaces the previous flash on the same gun, so adjacent
 // burst shots cannot stack additive light or extend an expired flash.
 const entries=active(world).filter(entry=>entry.ownerId!==owner.id);
 const entry={ownerId:owner.id,kind:owner.kind,activationId:owner.manualAbility.activationId,shotIndex,
  startedAt:world.time,tx:target.x,ty:target.y,x:null,y:null};
 if(owner.kind==='ranger'&&[precisionEnd?.x,precisionEnd?.y].every(Number.isFinite)){
  entry.precision={end:{x:precisionEnd.x,y:precisionEnd.y},origin:null};
 }
 entries.push(entry);
 muzzles.set(world,entries.slice(-16));return true;
}
export function queueV100ManualFirearmImpact(world,{owner,target,hpBefore,shotIndex=0}){
 if(!isV1(world)||!validOwner(owner)||target?.side!=='zombie'||!(hpBefore>0)
  ||![world.time,owner.x,target.x,target.y,target.hp,hpBefore,shotIndex].every(Number.isFinite)||target.hp>=hpBefore)return false;
 queueV100Contact(world,{x:target.x,y:target.y-30,direction:Math.sign(target.x-owner.x)||1,size:48,
  skillContact:{ownerId:owner.id,kind:owner.kind,activationId:owner.manualAbility.activationId,shotIndex,targetId:target.id,hpBefore,hpAfter:target.hp}});
 return true;
}
export function drawV100ManualMuzzles(ctx,objects,world,socketForOwner){
 const entries=active(world);muzzles.set(world,entries);
 for(const entry of entries){
  const elapsed=world.time-entry.startedAt;
  const muzzle=v100MuzzleFrame(entry.kind,elapsed);
  const socket=muzzle?socketForOwner(entry.ownerId,entry.kind):null;
  const painted=socket&&[socket.x,socket.y].every(Number.isFinite);
  entry.x=painted?socket.x:null;entry.y=painted?socket.y:null;
  if(entry.precision){
   if(painted&&!entry.precision.origin)entry.precision.origin={x:socket.x,y:socket.y};
   if(entry.precision.origin)drawV100PrecisionRifleRelease(ctx,objects,world,entry.precision,elapsed);
  }
  if(painted)drawV100Muzzle(ctx,objects,{weapon:entry.kind,elapsed,x:socket.x,y:socket.y,tx:entry.tx,ty:entry.ty});
 }
}
export function getV100ManualMuzzleSnapshot(world){
 return active(world).filter(entry=>v100MuzzleFrame(entry.kind,world.time-entry.startedAt)!==null)
  .map(({ownerId,kind,activationId,shotIndex,startedAt,tx,ty,x,y})=>({ownerId,kind,activationId,shotIndex,startedAt,tx,ty,x,y}));
}
