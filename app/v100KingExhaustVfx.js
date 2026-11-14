import {V100_KING_EXHAUST_ART,V100_KING_EXHAUST_SOCKET} from './v100KingExhaustArt.js';
import {combatVariation} from './v100RasterAtmosphere.js';

// Private paint state. Fighter objects are cloned by the real simulation, so
// an activation is identified by world generation, stable owner ID and manual ID.
const worlds=new WeakMap();
const LIFE=.64,PERIOD=.18,MAX_PUFFS=24;
const finite=(...values)=>values.every(Number.isFinite);
function current(world){
  if(!world?.definition?.missionConfig?.v100StageNumber||!finite(world.time)||world.over){
    if(world&&typeof world==='object')worlds.delete(world);
    return null;
  }
  const generation=world.battlePresentation?.generation??0;
  let state=worlds.get(world);
  if(!state||state.generation!==generation||world.time<state.time){
    state={generation,time:world.time,owners:new Map(),puffs:[]};worlds.set(world,state);
  }
  state.time=world.time;
  state.puffs=state.puffs.filter(p=>world.time-p.startedAt>=0&&world.time-p.startedAt<LIFE);
  return state;
}
function painted(point,world){
  return point&&finite(point.x,point.y,point.axisX,point.axisY,point.paintedAt)
    &&Math.abs(point.paintedAt-world.time)<1e-6
    &&point.sourcePath===V100_KING_EXHAUST_SOCKET.bodyPath
    &&point.sourceBone===V100_KING_EXHAUST_SOCKET.sourceBone
    &&Math.hypot(point.axisX-point.x,point.axisY-point.y)>.5;
}

export function drawV100KingExhaust(ctx,objects,world,resolveSocket){
  const state=current(world);if(!state)return;
  const liveIds=new Set();
  for(const owner of world.fighters??[]){
    if(owner.kind!=='crazy-king'||owner.side!=='human'||!(owner.hp>0)||owner.combatReady!==true
      ||!finite(owner.id,owner.manualAbility?.activationId)||owner.manualAbility.activationId<=0)continue;
    liveIds.add(owner.id);
    const manual=owner.manualAbility;
    if(!['windup','active'].includes(manual.phase))continue;
    const point=resolveSocket?.(owner.id);
    if(!painted(point,world))continue;
    let choice=state.owners.get(owner.id);
    if(!choice||choice.activationId!==manual.activationId){
      const image=objects?.[V100_KING_EXHAUST_ART['crazy-king'].id];
      choice={activationId:manual.activationId,lastEmitAt:-Infinity,sequence:0,
        image:image?.complete&&image.naturalWidth===768&&image.naturalHeight===512?image:null};
      state.owners.set(owner.id,choice);
    }
    // A late optional decode never replaces the same running activation.
    // Skipped/off-screen frames emit one current packet, never a catch-up burst.
    if(!choice.image||world.time-choice.lastEmitAt<PERIOD)continue;
    const seed=owner.id*37+manual.activationId*101+choice.sequence*17;
    const variation=combatVariation(seed,0);
    const preparation=manual.phase==='windup';
    state.puffs.push({ownerId:owner.id,activationId:manual.activationId,sequence:choice.sequence++,
      startedAt:world.time,x:point.x,y:point.y,angle:Math.atan2(point.axisY-point.y,point.axisX-point.x),
      width:100*(.94+variation*.12),height:56*(.96+variation*.08),
      alpha:(preparation?.22:.39)*( .92+variation*.16),image:choice.image});
    choice.lastEmitAt=world.time;
  }
  for(const id of state.owners.keys())if(!liveIds.has(id))state.owners.delete(id);
  state.puffs=state.puffs.slice(-MAX_PUFFS);
  for(const p of state.puffs){
    const progress=(world.time-p.startedAt)/LIFE,position=progress*5;
    const first=Math.floor(position),next=Math.min(5,first+1),blend=position-first;
    const fade=progress>.72?(1-progress)/.28:1;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
    // Released packets keep their actual birth position and orientation when
    // the saw moves or turns; only new packets follow the newly painted socket.
    ctx.translate(p.x+Math.cos(p.angle)*progress*8,p.y+Math.sin(p.angle)*progress*8-progress*3);
    ctx.rotate(p.angle);
    for(const [cell,weight]of [[first,1-blend],[next,blend]]){
      if(weight<=0)continue;
      ctx.globalAlpha=p.alpha*fade*weight;
      ctx.drawImage(p.image,cell%3*256,Math.floor(cell/3)*256,256,256,
        -p.width*80/512,-p.height*360/512,p.width,p.height);
    }
    ctx.restore();
  }
}

export function getV100KingExhaustSnapshot(world){
  const state=current(world);
  return state?state.puffs.map(({image,...p})=>({...p,elapsed:world.time-p.startedAt})):[];
}
