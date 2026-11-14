import {V100_BALLISTIC_MATERIAL_ART} from './v100BallisticMaterialArt.js';
import {combatVariation} from './v100RasterAtmosphere.js';

const profiles=Object.freeze({
 ranger:{glint:1,casing:4,caseWidth:6.8},
 babayaga:{glint:2,casing:3,caseWidth:5.6},gunner:{glint:1,casing:4,caseWidth:6.8},
 'red-panther-smg':{glint:0,casing:3,caseWidth:6},
 'red-panther-commander':{glint:0,casing:3,caseWidth:6},
 crawler:{glint:1,casing:5,caseWidth:8.8},
});
const selectedArt=new WeakMap();
export function clearV100BallisticArtwork(world){selectedArt.delete(world);}

// Optional art is selected once for the actual battle, rather than keyed to
// pooled shots or their temporary socket copies. Late decode waits for reset.
function artworkFor(objects,world){
 const key=world&&typeof world==='object'?world:objects;
 if(!selectedArt.has(key)){
  const candidate=objects?.[V100_BALLISTIC_MATERIAL_ART.materials.id];
  selectedArt.set(key,candidate?.complete&&candidate.naturalWidth===768&&candidate.naturalHeight===512?candidate:null);
 }
 return selectedArt.get(key);
}
function paintCell(ctx,image,frame,width,height,alpha){
 ctx.globalAlpha=alpha;
 ctx.drawImage(image,frame.frame%3*256,Math.floor(frame.frame/3)*256,256,256,
  -frame.anchorX*width,-frame.anchorY*height,width,height);
}
export function drawV100BallisticShot(ctx,objects,shot,{x,y,ux,uy,p,elapsed,distance,weapon,weaponProfile},world){
 const profile=profiles[weapon];
 if(!profile||shot?.style==='melee')return false;
 if(!objects||typeof objects!=='object'||!(shot?.life>0)||!(distance>0)||p<0||p>1||elapsed<0
  ||![x,y,ux,uy,p,elapsed,distance,shot.x,shot.y,shot.life].every(Number.isFinite)||Math.hypot(ux,uy)<.001)return true;
 const image=artworkFor(objects,world),art=V100_BALLISTIC_MATERIAL_ART.materials;
 const inherited=Number.isFinite(ctx.globalAlpha)?ctx.globalAlpha:1;
 const angle=Math.atan2(uy,ux),seed=(shot.sourceId??0)*17+(shot.targetId??0)*7+(shot.shotIndex??0)*31;
 // Red Panther hits are already resolved when their visual shot is emitted.
 // Show and fade that committed trace immediately, without inventing travel.
 const instantHit=shot.side==='zombie'&&(weapon==='red-panther-smg'||weapon==='red-panther-commander')&&shot.impactDelaySeconds===0;
 if(instantHit&&![shot.tx,shot.ty].every(Number.isFinite))return true;
 const instantFade=instantHit?Math.min(1,shot.life/(Number.isFinite(shot.duration)&&shot.duration>0?shot.duration:.16)):1;
 const flightProgress=instantHit?1:p;
 if(p<1||instantHit){
  const tail=(weapon==='crawler'?46:weaponProfile?.trail==='high-velocity'?38:weaponProfile?.trail==='burst-tracer'?30:24)
   *Math.max(.78,Math.min(1.24,distance/240));
  ctx.save();ctx.translate(instantHit?shot.tx:x,instantHit?shot.ty:y);ctx.rotate(angle);ctx.shadowBlur=0;ctx.globalCompositeOperation='source-over';
  if(image){
   const frame=art.frames[profile.glint],width=Math.min(tail/Math.max(.25,frame.anchorX-.13),distance*flightProgress/frame.anchorX);
   const height=(profile.glint===2?12:profile.glint===0?14:18)*(1+combatVariation(seed,81)*.08);
   if(width>0)paintCell(ctx,image,frame,width,height,inherited*(profile.glint===2?.84:.94)*instantFade);
  }else{
   // The older pack has the existing painted steel-motion texture. It supplies
   // a short flight glint, never the former lozenge or vector beam. Optional
   // spent-case detail waits for the new verified material.
   const fallback=objects?.['v104-steel'],width=Math.min(tail,distance*flightProgress);
   if(fallback?.complete&&fallback.naturalWidth&&fallback.naturalHeight&&width>0){
    ctx.globalAlpha=inherited*.68*instantFade;ctx.drawImage(fallback,-width,-1.6,width,3.2);
   }
  }
  ctx.restore();
 }
 if(image&&shot.casing&&p<.52){
  const eject=4+(shot.shotIndex??0)*1.8+p*12;
  const frame=art.frames[profile.casing],size=profile.caseWidth/frame.bodyWidthFraction;
  ctx.save();ctx.translate(shot.x-ux*3-uy*eject,shot.y-uy*3+ux*eject+p*p*9);
  ctx.rotate(angle+p*8);ctx.shadowBlur=0;ctx.globalCompositeOperation='source-over';
  paintCell(ctx,image,frame,size,size,inherited*Math.max(0,1-p*1.6));ctx.restore();
 }
 // Actual damage already owns the authored V102 wound/impact presentation.
 // A projectile must not linger as a glowing dot or invent later hit splinters.
 return true;
}
