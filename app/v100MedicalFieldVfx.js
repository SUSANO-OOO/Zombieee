import {pointInGroundEffectEllipse} from './gameRules.js';
import {combatVariation,drawRasterPlume} from './v100RasterAtmosphere.js';

function activeMedicalArea(effect,time,world){
 if(!effect||effect.kind!=='healing'||effect.phase!=='active'||!(effect.remaining>0)||!(effect.radius>0)
  ||![effect.id,effect.sourceSupplyId,effect.x,effect.y,effect.radius,effect.remaining,time].every(Number.isFinite))return false;
 return Array.isArray(world?.battlefieldObjects)&&world.battlefieldObjects.some(s=>s.id===effect.sourceSupplyId
  &&s.kind==='medical'&&s.phase==='active'&&s.hp>0);
}
function ready(objects,id){
 const image=objects?.[id];
 return image?.complete&&image.naturalWidth>0&&image.naturalHeight>0?image:null;
}

// Ground-level mist marks the existing aid station without painting a magic
// circle or covering the living actors. Presentation never spends resources.
export function drawV100MedicalArea(ctx,objects,effect,time,world){
 if(!activeMedicalArea(effect,time,world))return false;
 const mist=ready(objects,'v100-dust');if(!mist)return false;
 const fade=Math.min(1,effect.remaining/.4);
 for(let patch=0;patch<2;patch++){
  const variation=combatVariation(effect.id,patch+61);
  const age=((time*(.65+variation*.2)+variation)%1+1)%1;
  const offset=(patch?1:-1)*effect.radius*(.29+age*.08);
  const width=Math.min(116,effect.radius*(.87+age*.08));
  drawRasterPlume(ctx,mist,{x:effect.x+offset,y:effect.y+2-age*4,width,height:Math.min(24,width*.24),
   alpha:fade*(.10+.12*Math.sin(age*Math.PI)),flip:patch===0});
 }
 return true;
}

// Use the same spatial predicate as real healing. A full, dead, inactive or
// out-of-range unit gets no dressing. Overlapping stations never duplicate it.
export function drawV100MedicalRecipients(ctx,objects,world){
 const time=world?.time;
 const areas=(world?.areaEffects??[]).filter(effect=>activeMedicalArea(effect,time,world));
 const image=ready(objects,'quality-medic-gauze');
 if(!areas.length||!image||image.naturalWidth!==1536||image.naturalHeight!==1024)return false;
 const cellWidth=image.naturalWidth/3,cellHeight=image.naturalHeight/2;
 let painted=false;
 for(const fighter of world.fighters??[]){
  if(fighter.side!=='human'||fighter.combatReady===false||!(fighter.hp>0)||!(fighter.maxHp>fighter.hp)
   ||![fighter.id,fighter.x,fighter.y,fighter.hp,fighter.maxHp].every(Number.isFinite))continue;
  const area=areas.filter(effect=>pointInGroundEffectEllipse(effect,{x:fighter.x,y:fighter.y}))
   .sort((a,b)=>b.remaining-a.remaining)[0];
  if(!area)continue;
  const progress=((time*1.6+combatVariation(fighter.id,71))%1+1)%1;
  const sample=progress*6,frame=Math.floor(sample),next=(frame+1)%6;
  const blend=Math.max(0,Math.min(1,(sample-frame-.75)/.25));
  const fade=Math.min(1,area.remaining/.4,(fighter.maxHp-fighter.hp)/7.2);
  const alpha=fade*(.42+.06*Math.sin(progress*Math.PI));
  const width=72+Math.sin(progress*Math.PI)*4,height=width*.72;
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
  const paint=(cell,weight)=>{
   if(weight<=0)return;
   ctx.globalAlpha=alpha*weight;
   ctx.drawImage(image,cell%3*cellWidth,Math.floor(cell/3)*cellHeight,cellWidth,cellHeight,
    fighter.x-width/2,fighter.y-60,width,height);
  };
  paint(frame,1-blend);paint(next,blend);ctx.restore();painted=true;
 }
 return painted;
}
