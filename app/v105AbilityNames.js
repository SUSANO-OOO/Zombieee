// Ephemeral battle presentation, created only at a successful gameplay start.
// Nothing here is serialized into saves/checkpoints or resurrected on reload.
const battles=new WeakMap();
export function clearV105AbilityNames(world){battles.delete(world);}
const liveOwner=(world,row)=>world.fighters?.find(f=>f.id===row.ownerId&&f.kind===row.ownerKind);
export function v105EnemyAbilityName(kind,{boss,infected,station}={}){
  return boss?.attackTelegraph?.displayName
    ??infected?.abilityDisplayName
    ??({grappler:station?.karamite,ooze:station?.leakMud,sprinter:station?.souki}[kind]?.displayName);
}
export const V105_ABILITY_NAME_PAINT=Symbol.for('Zombieee.actualAbilityNamePaint');
const entries=world=>{
  let value=battles.get(world);
  if(!value){value={active:[],seen:new Set(),serials:new Map(),receipts:[]};battles.set(world,value);}
  return value;
};
export function startV105AbilityName(world,owner,{name,activationId,source='manual'}={}){
  if(!world||world.ended||world.over||!owner||!(owner.hp>0)||!owner.combatReady||owner.contained
    ||typeof name!=='string'||!/[\u3040-\u30ff\u3400-\u9fff\u03a9]/u.test(name))return false;
  const state=entries(world);
  if(source==='enemy'){
    activationId=(state.serials.get(owner.id)??0)+1;state.serials.set(owner.id,activationId);
  }else if(!(activationId>0)||owner.manualAbility?.activationId!==activationId||owner.manualAbility?.phase!=='windup')return false;
  const key=`${source}:${owner.id}:${activationId}`;
  if(state.seen.has(key))return false;
  state.seen.add(key);
  state.active=state.active.filter(row=>row.ownerId!==owner.id);
  const row={key,ownerId:owner.id,ownerKind:owner.kind,name,activationId,source,startedAt:world.time,duration:1.35};
  state.active.push(row);state.receipts.push({key,ownerId:owner.id,name,activationId,source,startedAt:world.time});
  state.receipts=state.receipts.slice(-64);
  return true;
}
export function updateV105AbilityNames(world){
  const state=battles.get(world);if(!state)return;
  if(world.ended||world.over){state.active=[];return;}
  state.active=state.active.filter(row=>{
    const owner=liveOwner(world,row);
    if(!(owner?.hp>0)||!owner.combatReady||owner.contained)return false;
    // A real interruption ends the label with the interrupted actor. Ordinary
    // recovery/cooldown does not cut a short skill's readable display short.
    if(owner.stunned>0&&(row.source==='enemy'?owner.stationAbility?.phase==='idle'
      :owner.manualAbility?.phase==='cooldown'))return false;
    return world.time-row.startedAt<row.duration;
  });
}
export function v105AbilityNameSnapshot(world){
  const state=battles.get(world);
  return state?{active:state.active.map(row=>({...row,ownerX:liveOwner(world,row)?.x,ownerY:liveOwner(world,row)?.y})),
    starts:state.receipts.map(row=>({...row}))}:{active:[],starts:[]};
}

export function layoutV105AbilityNames(rows,{width,height,fontSize,measure}={}){
  const placed=[],gap=5,lineHeight=fontSize+10;
  for(const row of [...rows].sort((a,b)=>a.headX-b.headX||String(a.ownerId).localeCompare(String(b.ownerId)))){
    const textWidth=Math.min(width-20,measure(row.name)),w=textWidth+16;
    const preferredX=Math.max(w/2+6,Math.min(width-w/2-6,row.headX));
    const preferredY=Math.max(lineHeight/2+6,Math.min(height-lineHeight/2-6,row.headY-15));
    const xs=[preferredX,w/2+6,width-w/2-6,...placed.flatMap(p=>[p.x-(p.width+w)/2-gap,p.x+(p.width+w)/2+gap])];
    const ys=[preferredY,...Array.from({length:Math.ceil(height/(lineHeight+gap))},(_,i)=>[
      preferredY-(i+1)*(lineHeight+gap),preferredY+(i+1)*(lineHeight+gap),lineHeight/2+6+i*(lineHeight+gap)]).flat()];
    const choices=xs.flatMap(x=>ys.map(y=>({x,y,score:Math.abs(x-preferredX)*.7+Math.abs(y-preferredY)})))
      .filter(p=>p.x>=w/2+5&&p.x<=width-w/2-5&&p.y>=lineHeight/2+5&&p.y<=height-lineHeight/2-5
        &&!placed.some(q=>Math.abs(q.x-p.x)<(q.width+w)/2+gap-.001&&Math.abs(q.y-p.y)<lineHeight+gap-.001))
      .sort((a,b)=>a.score-b.score||a.y-b.y||a.x-b.x);
    const {x,y}=choices[0]??{x:preferredX,y:preferredY};
    placed.push({...row,x,y,width:w,height:lineHeight,fontSize});
  }
  return placed;
}

export function drawV105AbilityNames(ctx,world,{width,height,headY,cssScale=1}={}){
  updateV105AbilityNames(world);
  const state=battles.get(world);if(!state?.active.length||world.ended||world.over)return [];
  const fontSize=Math.max(22,Math.min(32,13/Math.max(.25,cssScale)));
  ctx.save();ctx.font=`700 ${fontSize}px "Noto Sans JP",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  const rows=state.active.map(row=>{const owner=liveOwner(world,row);return{...row,owner,headX:owner.x,headY:headY(owner)};});
  const layout=layoutV105AbilityNames(rows,{width,height,fontSize,measure:text=>ctx.measureText(text).width});
  for(const row of layout){
    const age=world.time-row.startedAt;
    ctx.globalAlpha=Math.min(1,age/.06,(row.duration-age)/.23);
    const color=row.owner.side==='human'?'#f4d887':'#f1a7a0';
    ctx.fillStyle='rgba(9,13,18,.9)';ctx.fillRect(row.x-row.width/2,row.y-row.height/2,row.width,row.height);
    ctx.strokeStyle=color;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(row.x, row.y+row.height/2);
    ctx.lineTo(Math.max(5,Math.min(width-5,row.headX)),row.headY-3);ctx.stroke();
    ctx.fillStyle=color;
    ctx[V105_ABILITY_NAME_PAINT]={ownerId:row.ownerId,activationId:row.activationId,name:row.name,key:row.key,startedAt:row.startedAt};
    try{ctx.fillText(row.name,row.x,row.y);}finally{delete ctx[V105_ABILITY_NAME_PAINT];}
    row.lastPaint={x:row.x,y:row.y,width:row.width,height:row.height,at:world.time};
    const active=state.active.find(entry=>entry.key===row.key);if(active)active.lastPaint=row.lastPaint;
  }
  ctx.restore();return layout.map(row=>({ownerId:row.ownerId,key:row.key,name:row.name,x:row.x,y:row.y,width:row.width,height:row.height}));
}
