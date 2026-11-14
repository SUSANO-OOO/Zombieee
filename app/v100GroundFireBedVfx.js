import {V100_GROUND_FIRE_BED_ART} from './v100GroundFireArt.js';
import {combatVariation} from './v100RasterAtmosphere.js';

// Area-effect records are cloned by the simulation each tick. Keep visual
// choice in the actual battle's weakly held context, never on those records.
const selections=new WeakMap();
export function clearV100GroundFireBed(world){selections.delete(world);}

export function drawV100GroundFireBed(ctx,objects,effect,time,world){
 if(!effect||effect.kind!=='burn'||effect.phase!=='active'||!(effect.remaining>0)||!(effect.radius>0)
  ||![effect.id,effect.x,effect.y,effect.radius,effect.remaining,time].every(Number.isFinite))return false;
 const key=world??effect;
 let entries=selections.get(key);
 if(!entries){entries=new Map();selections.set(key,entries);}
 if(!entries.has(effect.id)){
  // Prune only finished effects; do not replace a live effect's chosen art.
  if(Array.isArray(world?.areaEffects)){
   const active=new Set(world.areaEffects.filter(e=>e.kind==='burn'&&e.phase==='active'&&e.remaining>0).map(e=>e.id));
   for(const id of entries.keys())if(!active.has(id))entries.delete(id);
  }
  const image=objects?.[V100_GROUND_FIRE_BED_ART.burn.id];
  const ready=image?.complete&&image.naturalWidth===768&&image.naturalHeight===512;
  entries.set(effect.id,ready?image:null);
 }
 const image=entries.get(effect.id);
 if(!image)return false;
 const art=V100_GROUND_FIRE_BED_ART.burn;
 const variation=combatVariation(effect.id,45),period=.92+variation*.48;
 const phase=((time/period+combatVariation(effect.id,46))%1+1)%1*6;
 const frame=Math.floor(phase),blend=phase-frame;
 const width=effect.radius*2.2,height=effect.radius*(1.28+variation*.18);
 const fade=Math.min(1,effect.remaining/.45);
 ctx.save();
 ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
 ctx.translate(effect.x,effect.y);
 if(combatVariation(effect.id,47)>.5)ctx.scale(-1,1);
 for(const [cell,weight] of [[frame,1-blend],[(frame+1)%6,blend]]){
  if(weight<=0)continue;
  ctx.globalAlpha=fade*.96*weight;
  ctx.drawImage(image,cell%3*256,Math.floor(cell/3)*256,256,256,
   -width*art.anchorX,-height*art.anchorY,width,height);
 }
 ctx.restore();return true;
}
