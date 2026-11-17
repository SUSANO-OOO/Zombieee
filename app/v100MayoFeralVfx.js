// Ground paint owned by the real Mayo activation, retreat and actual movement.
// This layer never starts a skill, moves an actor, changes a clock or plays audio.
const rooms=new WeakMap();
const BURST_SECONDS=.82,TRAIL_SECONDS=.28,MAX_TRAILS=4;
const burstPuffs=Object.freeze([
 {delay:0,side:-1,spread:30,lift:9,width:58,height:33,rotation:-.2,dark:false},
 {delay:.06,side:1,spread:43,lift:14,width:77,height:37,rotation:.16,dark:false},
 {delay:.13,side:-1,spread:54,lift:4,width:89,height:27,rotation:-.1,dark:true},
 {delay:.2,side:1,spread:62,lift:5,width:90,height:30,rotation:.08,dark:true},
]);
const image=(objects,id)=>{
 const value=objects?.[id];return value?.complete&&value.naturalWidth>0&&value.naturalHeight>0?value:null;
};
function puff(ctx,source,x,y,width,height,alpha,rotation=0){
 if(!source||!(alpha>0)||![x,y,width,height,alpha,rotation].every(Number.isFinite))return 0;
 ctx.save();
 try{ctx.globalCompositeOperation='source-over';ctx.globalAlpha*=Math.min(.7,alpha);ctx.translate(x,y);ctx.rotate(rotation);
  ctx.drawImage(source,-width/2,-height*.72,width,height);
 }finally{ctx.restore();}
 return 1;
}
function receipt(world,owner,type){
 for(let i=(world.manualAbilityReceipts?.length??0)-1;i>=0;i--){const row=world.manualAbilityReceipts[i];
  if(row.ownerId===owner.id&&row.kind==='mayo-chan'&&row.activationId===owner.manualAbility.activationId&&row.eventType===type)
   return Number.isFinite(row.at)?row.at:null;
 }
 return null;
}
export function clearV100MayoFeralVfx(world){rooms.delete(world);}
export function drawV100MayoFeralVfx(ctx,objects,world){
 if(!world?.definition?.missionConfig?.v100StageNumber||!Number.isFinite(world.time))return 0;
 const dust=image(objects,'v100-dust'),smoke=image(objects,'v100-smoke-b');if(!dust)return 0;
 let room=rooms.get(world);if(!room){room=new Map();rooms.set(world,room);}
 const live=new Set();let drawnOwners=0;
 for(const owner of world.fighters??[]){
  const retreat=['ability','injury'].includes(owner.mayoRetreat?.reason)&&['fall','rise','run'].includes(owner.mayoRetreat?.phase)?owner.mayoRetreat:null;
  if(owner.kind!=='mayo-chan'||owner.side!=='human'||!(owner.hp>0)||(owner.combatReady!==true&&!retreat)
   ||!Number.isSafeInteger(owner.manualAbility?.activationId)||(owner.manualAbility.activationId<1&&!retreat)
   ||![owner.id,owner.x,owner.y].every(Number.isFinite))continue;
  const startAt=receipt(world,owner,'start');if(!retreat&&(startAt===null||world.time<startAt))continue;
  const feralAt=receipt(world,owner,'feral-start'),phase=owner.manualAbility.phase;
  if(!['windup','recovery','feral'].includes(phase)&&!retreat)continue;
  live.add(owner.id);let state=room.get(owner.id);
  if(!state||state.activationId!==owner.manualAbility.activationId||world.time<state.time){
   state={activationId:owner.manualAbility.activationId,time:world.time,x:owner.x,lastTrailAt:world.time,trails:[]};room.set(owner.id,state);
  }
  const delta=owner.x-state.x,direction=Math.sign(delta)||Math.sign(owner.aiMoveDirection)||1;
  // Walking and retreat leave short, asymmetric puffs only where this actor moved.
  if((phase==='feral'||retreat?.phase==='run')&&Math.abs(delta)>=.6&&world.time-state.lastTrailAt>=.065){
   state.trails.push({x:owner.x-direction*12,y:owner.y,at:world.time,direction});state.lastTrailAt=world.time;
  }
  state.trails=state.trails.filter(row=>world.time-row.at<TRAIL_SECONDS).slice(-MAX_TRAILS);
  state.time=world.time;state.x=owner.x;let draws=0;
  if((phase==='windup'||phase==='recovery')&&feralAt===null){
   const progress=Math.max(0,Math.min(1,(world.time-startAt)/.46));
   for(const side of [-1,1])draws+=puff(ctx,dust,owner.x+side*(9+progress*7),owner.y-1,22+progress*18,9+progress*8,.12+progress*.24,side*.16);
  }
  if(phase==='feral'&&feralAt!==null){
   const age=world.time-feralAt;
   for(const spec of burstPuffs){
    const local=age-spec.delay;if(local<0||local>=BURST_SECONDS)continue;
    const t=local/BURST_SECONDS,spread=1-(1-t)**2,envelope=Math.sin(Math.PI*t)**.7;
    draws+=puff(ctx,spec.dark?(smoke??dust):dust,owner.x+spec.side*(10+spec.spread*spread),owner.y-spec.lift*spread,
     spec.width*(.4+.65*spread),spec.height*(.5+.55*spread),envelope*(spec.dark?.3:.68),spec.rotation*(.6+spread));
   }
  }
  if(retreat?.phase==='fall'){
   const t=Math.min(1,Math.max(0,retreat.phaseElapsed/.34)),a=(retreat.reason==='ability'?.4:.25)*Math.sin(t*Math.PI);
   for(const side of [-1,1])draws+=puff(ctx,dust,owner.x+side*(7+16*t),owner.y,31+22*t,12+8*t,a,side*.08);
  }
  for(const row of state.trails){const t=Math.max(0,(world.time-row.at)/TRAIL_SECONDS);
   draws+=puff(ctx,dust,row.x-row.direction*10*t,row.y-3*t,28+20*t,10+8*t,.42*(1-t)**1.4,row.direction*.12);
  }
  if(draws>0)drawnOwners++;
 }
 for(const id of room.keys())if(!live.has(id))room.delete(id);
 return drawnOwners;
}
