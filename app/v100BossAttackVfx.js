import {V100_BOSS_ATTACK_ART} from './v100BossAttackArt.js';
import {bossAttackReleaseSource} from './v100BossAftermath.js';
import {STATION_ENEMY_TUNING} from './stationEnemyMechanics.js';

const groundChoices=new WeakMap();
const gateClocks=new WeakMap();
const finite=(...values)=>values.every(Number.isFinite);
function cells(ctx,image,progress,rect,baseAlpha=1){
 const position=progress*5,first=Math.floor(position),next=Math.min(5,first+1),blend=position-first;
 for(const [cell,weight]of [[first,1-blend],[next,blend]]){
  if(weight<=0)continue;ctx.globalAlpha=baseAlpha*weight;
  ctx.drawImage(image,cell%3*512,Math.floor(cell/3)*512,512,512,...rect);
 }
}

// A real sword-ground contact owns its material until that .60s queue entry
// expires. It is deliberately independent of each tick's cloned fighter.
export function drawV100TakuyaGroundRelease(ctx,objects,entry,elapsed){
 const contact=entry?.takuyaGroundContact;
 if(!contact?.resolvedSocket||!finite(entry.x,entry.y,elapsed,entry.duration)
  ||entry.duration<=0||elapsed<0||elapsed>=entry.duration)return false;
 if(!groundChoices.has(entry)){
  const art=V100_BOSS_ATTACK_ART.takuya,image=objects?.[art.id];
  groundChoices.set(entry,image?.complete&&image.naturalWidth===1536&&image.naturalHeight===1024?{art,image}:null);
 }
 const chosen=groundChoices.get(entry);if(!chosen)return false;
 const {art,image}=chosen,progress=elapsed/entry.duration;
 contact.effectSourcePath=art.path;
 ctx.save();ctx.translate(entry.x,entry.y);ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
 cells(ctx,image,progress,[-art.renderWidth*art.anchorX,-art.renderHeight*art.anchorY,art.renderWidth,art.renderHeight],progress>.8?(1-progress)/.2:1);
 ctx.restore();return true;
}

function gateOwners(world,ownerId){
 if(!world||typeof world!=='object'||!Array.isArray(world.fighters)||!Number.isSafeInteger(ownerId))return null;
 const raw=world.battlePresentation?.generation,generation=Number.isFinite(raw)?raw:0;
 let state=gateClocks.get(world);
 if(!state||state.generation!==generation){state={generation,owners:new Map()};gateClocks.set(world,state);}
 const alive=new Set(world.fighters.filter(f=>f.kind==='gate-eater'&&f.hp>0).map(f=>f.id));
 for(const id of state.owners.keys())if(!alive.has(id))state.owners.delete(id);
 return alive.has(ownerId)?state.owners:null;
}

export function drawV100GateChargeTrail(ctx,objects,{world,ownerId,x,y,runtime}={}){
 if(!runtime||!finite(x,y,world?.time,runtime.remainingSeconds,runtime.direction)
  ||runtime.remainingSeconds<0||Math.abs(runtime.direction)!==1)return false;
 const owners=gateOwners(world,ownerId);if(!owners)return false;
 if(!['charging','exposed'].includes(runtime.phase)){owners.delete(ownerId);return false;}
 const tuning=STATION_ENEMY_TUNING.ticketGateEater;
 const settling=.4,normalDuration=tuning.chargeSeconds+settling;
 let progress;
 if(runtime.phase==='charging'){
  const elapsed=tuning.chargeSeconds-runtime.remainingSeconds;if(elapsed<0)return false;
  // Phase clocks measure actual charging even if an incoming hit moves the
  // body away from its original committed position. Fighters may be cloned.
  owners.set(ownerId,{phase:'charging',startedAt:world.time-elapsed});
  progress=elapsed/normalDuration;
 }else{
  const age=tuning.flankExposureSeconds-runtime.remainingSeconds;
  if(age<0||age>=settling){owners.delete(ownerId);return false;}
  const exposedAt=world.time-age,previous=owners.get(ownerId);
  let record=previous;
  if(record?.phase!=='exposed'||Math.abs(record.exposedAt-exposedAt)>1e-5){
   const actualCharge=previous?.phase==='charging'?exposedAt-previous.startedAt:NaN;
   const baseProgress=Number.isFinite(actualCharge)&&actualCharge>=0&&actualCharge<=tuning.chargeSeconds+1e-5
    ?Math.min(tuning.chargeSeconds,actualCharge)/normalDuration:tuning.chargeSeconds/normalDuration;
   record={phase:'exposed',exposedAt,baseProgress};owners.set(ownerId,record);
  }
  // Continue from the actual final charge frame. First seeing an already
  // exposed owner shows its settling tail instead of replaying the impact.
  progress=record.baseProgress+(1-record.baseProgress)*age/settling;
 }
 const chosen=bossAttackReleaseSource(objects,'gate-eater',world,ownerId);
 if(!chosen.art||chosen.image?.naturalWidth!==1536||chosen.image.naturalHeight!==1024)return false;
 const {art,image}=chosen;
 ctx.save();ctx.translate(x,y);if(runtime.direction>0)ctx.scale(-1,1);
 ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
 cells(ctx,image,progress,[-art.renderWidth*art.anchorX,-art.renderHeight*art.anchorY,art.renderWidth,art.renderHeight],progress>.7?(1-progress)/.3:1);
 ctx.restore();return true;
}

export function drawV100KuromeRay(ctx,objects,{world,ownerId,origin,target,halfWidth,progress}={}){
 if(!origin||!target||!finite(origin.x,origin.y,target.x,target.y,halfWidth,progress)
  ||halfWidth<=0||progress<0||progress>=1)return false;
 const dx=target.x-origin.x,dy=target.y-origin.y,length=Math.hypot(dx,dy);
 if(length<1)return false;
 const chosen=bossAttackReleaseSource(objects,'kurome',world,ownerId);
 if(!chosen.art||chosen.image?.naturalWidth!==1536||chosen.image.naturalHeight!==1024)return false;
 const {art,image}=chosen,span=art.beamEndX-art.beamStartX,width=length/span,height=halfWidth*2.4/art.beamSpanY;
 ctx.save();ctx.translate(origin.x,origin.y);ctx.rotate(Math.atan2(dy,dx));
 ctx.globalCompositeOperation='lighter';ctx.shadowBlur=0;
 cells(ctx,image,progress,[-width*art.beamStartX,-height*art.beamAxisY,width,height],Math.min(1,.72+Math.sin(progress*Math.PI)*.28));
 ctx.restore();return true;
}
