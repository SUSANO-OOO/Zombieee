// Presentation only: applied HP loss is observed once per simulation step.
// Nothing here changes damage, defeat, rewards, collision or save data.
const worlds=new WeakMap();
export const V102_GORE_LIMITS=Object.freeze({impacts:14,pools:32,wounds:128,contexts:128,dropsPerImpact:18});
const cuts=new Set(['tky','miyamoto-musashi','red-panther-knife','crazy-king']);
const crushers=new Set(['brute','kumaverson','guardian','zakimiya','brawler','crusher','abomination','takuya','takuya-omega','gate-eater','pod']);
const blasts=new Set(['mrs-chiha','crawler','grenade','explosion','aircraft']);
const bullets=new Set(['ranger','babayaga','gunner','red-panther-smg','red-panther-commander','medic','engineer']);
const nonHumanoid=new Set(['mayo-chan-feral','ooze','mother','ooguchi','spindle','choir-knot','pall-manta','anchor-bloom','resonator']);
const v1=world=>Boolean(world?.definition?.missionConfig?.v100StageNumber);
const finite=(...v)=>v.every(Number.isFinite);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const random=(seed,index)=>{const v=Math.sin(seed*12.9898+index*78.233)*43758.5453;return v-Math.floor(v);};
function state(world){let s=worlds.get(world);if(!s){s={impacts:[],pools:[],wounds:new Map(),contexts:new Map(),periodic:new Map(),serial:0,step:null};worlds.set(world,s);}return s;}
export function clearV102CombatGore(world){worlds.delete(world);}
export function v102GoreWeaponStyle(weapon){return weapon==='crazy-king'?'saw':cuts.has(weapon)?'cut':blasts.has(weapon)?'blast':crushers.has(weapon)?'crush':bullets.has(weapon)?'bullet':'tear';}

export function beginV102GoreStep(world,{heightFor=()=>64}={}){
  if(!v1(world)||!finite(world.time))return null;
  const s=state(world);s.contexts.clear();s.periodic.clear();
  // A new spawn, imported fixture or restored save is not a damage event.
  s.step=new Map(world.fighters.filter(f=>f.hp>0&&f.summonSource!=='kurome-clone'&&!f.kuromeCloneDissolved)
    .map(f=>[f.id,{hp:f.hp,height:heightFor(f)}]));
  return s.step;
}
export function noteV102GoreImpact(world,target,{weapon,originX,originY}={}){
  const s=worlds.get(world);
  if(!s?.step?.has(target?.id)||!finite(originX))return false;
  s.contexts.set(target.id,{weapon,originX,originY});
  if(s.contexts.size>V102_GORE_LIMITS.contexts)s.contexts.delete(s.contexts.keys().next().value);
  return true;
}
export function noteV102GorePeriodicDamage(world,targetId,damage,kind){
  const s=worlds.get(world);
  if(!s?.step?.has(targetId)||!finite(damage)||damage<=0)return;
  const previous=s.periodic.get(targetId);
  s.periodic.set(targetId,{damage:damage+(previous?.damage??0),bloody:kind==='bleed'||previous?.bloody===true});
}
function expire(world,s){
  s.impacts=s.impacts.filter(e=>world.time>=e.at&&world.time-e.at<.85);
  s.pools=s.pools.filter(e=>world.time>=e.at&&world.time-e.at<7);
  const bodies=new Map([...(world.fighters??[]),...(world.corpses??[])].map(f=>[f.id,f]));
  for(const [id,w] of s.wounds){const f=bodies.get(id);if(!f||world.time<w.at||(!w.lethal&&world.time-w.at>3.5))s.wounds.delete(id);}
}
export function finishV102GoreStep(world,step){
  const s=worlds.get(world);if(!s||!step||s.step!==step)return 0;
  expire(world,s);let count=0;
  // Area effects replace fighter objects. Observe the current actor with the
  // same stable ID, rather than the stale object captured before that update.
  const actors=new Map(world.fighters.map(f=>[f.id,f]));
  for(const [id,before] of step){
    const f=actors.get(id);if(!f)continue;
    const loss=Math.min(before.hp,Math.max(0,before.hp-f.hp));
    if(!(loss>0)||!finite(f.hp,f.x,f.y,before.height)||f.kuromeCloneDissolved)continue;
    const context=s.contexts.get(id)??{};
    const periodic=s.periodic.get(id),periodicOnly=!s.contexts.has(id)&&periodic&&loss<=periodic.damage+.00001;
    if(periodicOnly&&(!periodic.bloody||world.time-(s.wounds.get(id)?.at??-Infinity)<.35))continue;
    const source=context.weapon?null:world.fighters.find(a=>a.side!==f.side&&a.hp>0&&a.targetId===id&&(a.attack>0||a.manualAbility?.phase==='active'));
    const weapon=context.weapon??source?.kind,style=periodicOnly?'bleed':v102GoreWeaponStyle(weapon);
    const direction=Math.sign(f.x-(context.originX??source?.x??f.x-1))||1;
    const height=clamp(before.height,20,220),lethal=f.hp<=0;
    const intensity=clamp(loss/Math.max(1,f.maxHp??before.hp)*2.5,.35,1.2)*(lethal?1.6:1);
    const e={id:++s.serial,targetId:id,kind:f.kind,style,direction,at:world.time,x:f.x,y:f.y-height*.49,groundY:f.y+2,height,intensity,
      seed:s.serial*3.71+Number(id||0)*.17,lethal,side:f.side};
    s.impacts.push(e);s.pools.push({...e,y:f.y+3});
    const previous=s.wounds.get(id);
    s.wounds.set(id,{...e,severed:f.side==='zombie'&&lethal&&(style==='cut'||style==='saw'||style==='blast'||style==='crush'),
      // Consecutive hits deepen the wound; they do not create duplicate
      // overlays for the same final HP change in this step.
      intensity:Math.max(intensity,previous?.intensity??0)});
    count++;
  }
  s.impacts=s.impacts.slice(-V102_GORE_LIMITS.impacts);s.pools=s.pools.slice(-V102_GORE_LIMITS.pools);
  while(s.wounds.size>V102_GORE_LIMITS.wounds)s.wounds.delete(s.wounds.keys().next().value);
  s.step=null;s.contexts.clear();s.periodic.clear();return count;
}
export function getV102GoreSnapshot(world){
  const s=worlds.get(world);if(!s)return {impacts:[],pools:[],wounds:[],pending:false};
  return {impacts:s.impacts.map(e=>({...e})),pools:s.pools.map(e=>({...e})),wounds:[...s.wounds.values()].map(e=>({...e})),pending:Boolean(s.step)};
}
function trace(ctx,points){for(let i=0;i<points.length;i++){if(i)ctx.lineTo(...points[i]);else ctx.moveTo(...points[i]);}ctx.closePath();}
function polygon(ctx,points){ctx.beginPath();trace(ctx,points);}
function ragged(seed,x,y,rx,ry,points=13){return Array.from({length:points},(_,i)=>{const a=i/points*Math.PI*2,r=.7+random(seed,i)*.3;return [x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r];});}

export function drawV102GoreGround(ctx,world){
  const s=worlds.get(world);if(!s||!v1(world))return;expire(world,s);
  ctx.save();ctx.shadowBlur=0;
  for(const e of s.pools){const age=world.time-e.at,fade=clamp((7-age)/1.4),grow=.5+.5*clamp(age/.35);
    const radius=clamp(e.height*.13*e.intensity*(e.style==='bleed'?.28:1),e.style==='bleed'?1:4,22)*grow;
    ctx.globalAlpha=.72*fade;ctx.fillStyle='#27090c';polygon(ctx,ragged(e.seed,e.x,e.y,radius*1.65,radius*.34));ctx.fill();
    ctx.fillStyle='#5d111a';polygon(ctx,ragged(e.seed+2,e.x+2,e.y-1,radius*1.2,radius*.22));ctx.fill();
    ctx.fillStyle='#88212b';ctx.globalAlpha=.38*fade;ctx.beginPath();
    for(let i=0;i<9;i++){const x=e.x+(random(e.seed,i+30)-.5)*radius*5,y=e.y+(random(e.seed,i+50)-.5)*radius*.8,r=.5+random(e.seed,i+70)*1.6;ctx.moveTo(x+r,y);ctx.ellipse(x,y,r,r*.4,0,0,Math.PI*2);}ctx.fill();
  }ctx.restore();
}

export function drawV102GoreAir(ctx,world,density=1,objects={}){
  const s=worlds.get(world);if(!s||!v1(world))return;
  ctx.save();ctx.shadowBlur=0;ctx.lineCap='round';
  for(const e of s.impacts){const age=world.time-e.at;if(age<0||age>=.85)continue;
    const force=clamp(e.height*.8,24,115)*e.intensity,gravity=220;
    const count=e.style==='bleed'?2:Math.max(8,Math.round(V102_GORE_LIMITS.dropsPerImpact*clamp(density,.4,1)));
    // Thin fast jets, slower viscous drops and dark tissue pieces have
    // different trajectories. All begin at the actual victim's body.
    for(let color=0;color<3;color++){ctx.beginPath();ctx.fillStyle=['#440c14','#8d1626','#c13a42'][color];ctx.globalAlpha=clamp((.85-age)/.22)*(.95-color*.12);
      for(let i=color;i<count;i+=3){const r=random(e.seed,i),blastAngle=(r-.5)*Math.PI*2;
        const vx=e.style==='bleed'?(r-.5)*5:e.style==='blast'?Math.cos(blastAngle)*force:e.direction*force*(e.style==='bullet'?.8:.4+r*.9);
        const vy=e.style==='bleed'?8:e.style==='blast'?Math.sin(blastAngle)*force: -force*(e.style==='bullet'?.15+random(e.seed,i+40)*.3:.24+random(e.seed,i+40)*.95);
        const x=e.x+vx*age,y=e.y+vy*age+gravity*age*age*.5;
        if(y>e.groundY)continue;
        const speed=Math.hypot(vx,vy+gravity*age),size=(.8+random(e.seed,i+80)*1.8)*(e.lethal?1.4:1);
        const tail=Math.min(10,speed*.035)*(1-age/.85),angle=Math.atan2(vy+gravity*age,vx),dx=Math.cos(angle),dy=Math.sin(angle);
        ctx.moveTo(x+dy*size,y-dx*size);ctx.quadraticCurveTo(x-dx*tail,y-dy*tail,x-dy*size,y+dx*size);ctx.quadraticCurveTo(x+dx*size,y+dy*size,x+dy*size,y-dx*size);
      }ctx.fill();
    }
    if(age<.19&&e.style!=='bleed'){const p=age/.19,length=force*.28*Math.sin(p*Math.PI),width=(1-p)*e.intensity*5;
      ctx.globalAlpha=1-p;ctx.strokeStyle='#60101d';ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.bezierCurveTo(e.x+e.direction*length*.35,e.y-7,e.x+e.direction*length*.7,e.y+3,e.x+e.direction*length,e.y-4);ctx.stroke();
    }
    if(e.style!=='bleed'&&(e.lethal||e.style==='saw'||e.style==='crush'||e.style==='blast')){
      for(let i=0;i<(e.lethal?5:2);i++){const r=random(e.seed,i+100),vx=e.direction*force*(r-.15),vy=-force*(.3+random(e.seed,i+110)*.6),x=e.x+vx*age,y=e.y+vy*age+gravity*age*age*.5;
        if(y>e.groundY)continue;
        ctx.save();ctx.translate(x,y);ctx.rotate(age*(r-.5)*14);ctx.globalAlpha=clamp((.85-age)/.2);
        const flesh=objects['v102-flesh-wound'];if(flesh?.naturalWidth)ctx.drawImage(flesh,-4,-3,8,6);
        ctx.strokeStyle=i%3===0?'#c8b293':'#aa3440';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(-2,-1);ctx.lineTo(2,1);ctx.stroke();ctx.restore();
      }
    }
  }ctx.restore();
}

function bounds(frame){const r=frame.sourceRect,c=frame.contentRect??r;return {x:c.x-r.x,y:c.y-r.y,w:c.w,h:c.h};}
function drawWound(ctx,seed,x,y,rx,ry,image){
  if(!image?.naturalWidth)return;
  ctx.save();ctx.shadowBlur=0;ctx.translate(x,y);ctx.rotate((random(seed,140)-.5)*.4);
  ctx.drawImage(image,-rx*1.35,-ry*1.35,rx*2.7,ry*2.7);ctx.restore();
}
export function drawV102GoreWound(ctx,world,fighter,frame,size,objects={}){
  const e=worlds.get(world)?.wounds.get(fighter.id);if(!e||e.lethal||fighter.kind==='mayo-chan')return;
  const b=bounds(frame),sx=size.w/frame.sourceRect.w,sy=size.h/frame.sourceRect.h;
  const x=(b.x+b.w*.52)*sx-size.w*frame.anchorX,y=(b.y+b.h*.43)*sy-size.h*frame.anchorY;
  drawWound(ctx,e.seed,x,y,Math.min(5.5,b.w*sx*.11)*e.intensity,Math.min(7,b.h*sy*.1)*e.intensity,objects['v102-flesh-wound']);
}

export function v102CorpseSeverPlan(world,corpse,frame,width,height){
  const e=worlds.get(world)?.wounds.get(corpse.id);if(!e?.severed||corpse.side!=='zombie')return null;
  const b=bounds(frame),sx=width/frame.sourceRect.w,sy=height/frame.sourceRect.h;
  const upright=frame.derivedFrom==='hit'||b.h>b.w*1.3;
  const part=nonHumanoid.has(corpse.kind)?{x:b.x+b.w*.72,y:b.y+b.h*.38,w:b.w*.28,h:b.h*.55}
    :upright?{x:b.x+b.w*.23,y:b.y,w:b.w*.54,h:b.h*.29}
    :{x:b.x+b.w*.72,y:b.y+b.h*.43,w:b.w*.28,h:b.h*.55};
  const local={x:part.x*sx-width*frame.anchorX,y:part.y*sy-height*frame.anchorY,w:part.w*sx,h:part.h*sy};
  const outline=upright&&!nonHumanoid.has(corpse.kind)
    ? [[local.x,local.y],[local.x+local.w,local.y],[local.x+local.w,local.y+local.h],
      ...Array.from({length:7},(_,i)=>[local.x+local.w*(1-i/6),local.y+local.h*(.9+random(e.seed,i+130)*.1)])]
    : [[local.x+local.w,local.y],[local.x+local.w,local.y+local.h],[local.x,local.y+local.h],
      ...Array.from({length:7},(_,i)=>[local.x+local.w*random(e.seed,i+130)*.15,local.y+local.h*(1-i/6)])];
  return {...e,part,local,outline,width,height,flight:clamp((world.time-e.at)/.42),age:world.time-e.at};
}
export function beginV102CorpseSever(ctx,plan){
  if(!plan)return;ctx.save();ctx.beginPath();ctx.rect(-plan.width,-plan.height,plan.width*2,plan.height*2);
  trace(ctx,plan.outline);ctx.clip('evenodd');
}
export function endV102CorpseSever(ctx,plan,sprite,frame,objects={}){
  if(!plan)return;ctx.restore();const r=plan.local,p=plan.part;
  drawWound(ctx,plan.seed,r.x+r.w*.12,r.y+r.h*.7,Math.max(2,r.w*.3),Math.max(2,r.h*.22),objects['v102-flesh-wound']);
  // The detached part is cut from the same authored death frame. It retains
  // skin, clothing and proportions, and shares that corpse's ash/opacity.
  ctx.save();ctx.translate(r.x+r.w*.5+plan.direction*plan.flight*plan.height*.2,r.y+r.h*.5-Math.sin(plan.flight*Math.PI)*plan.height*.18);
  ctx.rotate(plan.direction*plan.flight*2.4);ctx.save();polygon(ctx,plan.outline.map(([x,y])=>[x-r.x-r.w*.5,y-r.y-r.h*.5]));ctx.clip();ctx.drawImage(sprite,frame.sourceRect.x+p.x,frame.sourceRect.y+p.y,p.w,p.h,-r.w*.5,-r.h*.5,r.w,r.h);ctx.restore();
  drawWound(ctx,plan.seed+4,-r.w*.2,r.h*.35,Math.max(2,r.w*.3),Math.max(1.5,r.h*.14),objects['v102-flesh-wound']);ctx.restore();
}
