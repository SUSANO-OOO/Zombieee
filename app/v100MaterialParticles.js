import {combatVariation} from './v100RasterAtmosphere.js';

const tintCaches=new WeakMap(),failedSurfaces=new WeakSet();
const particleSources=new WeakMap();
const CELL=48,MAX_TINTS=24;
function sourceForParticle(objects,p,world){
 const image=objects?.['v100-particle-materials'];
 const ready=image?.complete&&image.naturalWidth===768&&image.naturalHeight===512?image:null;
 if(!world||!Number.isFinite(world.time))return ready;
 const generation=world.battlePresentation?.generation??0;
 let state=particleSources.get(world);
 if(!state||state.generation!==generation){state={generation,particles:new WeakMap()};particleSources.set(world,state);}
 // Both values advance by the same simulation dt. Their sum identifies the
 // current pooled-particle lifetime without adding a simulation field or RNG.
 const expiresAt=world.time+p.life;
 let record=state.particles.get(p);
 if(!record||Math.abs(record.expiresAt-expiresAt)>1e-5||record.vx!==p.vx||record.size!==p.size||record.color!==p.color){
  record={expiresAt,vx:p.vx,size:p.size,color:p.color,image:ready};state.particles.set(p,record);
 }
 return record.image;
}
function createSurface(width,height){
 if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(width,height);
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;
}
function tint(image,color,factory){
 if(failedSurfaces.has(image))return null;
 let cache=tintCaches.get(image);if(!cache){cache=new Map();tintCaches.set(image,cache);}
 if(cache.has(color)){const hit=cache.get(color);cache.delete(color);cache.set(color,hit);return hit;}
 let canvas,paint;
 try{canvas=factory(CELL*3,CELL*2);paint=canvas?.getContext('2d');}catch{paint=null;}
 if(!paint){failedSurfaces.add(image);return null;}
 paint.drawImage(image,0,0,CELL*3,CELL*2);
 // Keep the authored light/dark surface detail instead of making a flat silhouette.
 paint.globalCompositeOperation='source-atop';paint.globalAlpha=.64;paint.fillStyle=color;
 paint.fillRect(0,0,CELL*3,CELL*2);paint.globalAlpha=1;
 if(cache.size>=MAX_TINTS){const first=cache.keys().next().value,old=cache.get(first);cache.delete(first);old.width=0;old.height=0;}
 cache.set(color,canvas);return canvas;
}
export function particleMaterialCell(p){
 const seed=p.vx*7+p.size*31,r=combatVariation(seed,0);
 const rgb=/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(p.color??'');
 if(rgb){const [red,green,blue]=rgb.slice(1).map(v=>parseInt(v,16));
  if(red>green*1.1&&green>blue*1.35)return r<.55?2:1;
  if(red>green*1.4)return r<.65?5:3;
 }
 return [0,1,3,4,5][Math.min(4,Math.floor(r*5))];
}
export function drawV100MaterialParticle(ctx,objects,p,{world,createRasterSurface=createSurface}={}){
 if(!p||![p.x,p.y,p.vx,p.life,p.size].every(Number.isFinite)||p.life<=0||p.size<=0)return false;
 const authored=sourceForParticle(objects,p,world);
 const material=authored?tint(authored,p.color,createRasterSurface):null;
 const fallback=objects?.['v100-dust'];
 if(!material&&(!fallback?.complete||!fallback.naturalWidth||!fallback.naturalHeight))return false;
 // vx and size are fixed at birth, so compaction, gravity and changing x/y cannot swap material.
 const seed=p.vx*7+p.size*31,v=combatVariation(seed,1),cell=particleMaterialCell(p);
 const width=p.size*(2.15+v*.75),angle=combatVariation(seed,2)*Math.PI*2+(1-p.life)*(v-.5)*4;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
 ctx.globalAlpha=Math.min(1,Math.max(0,p.life*1.6));ctx.translate(p.x+p.size*.5,p.y+p.size*.5);ctx.rotate(angle);
 if(material)ctx.drawImage(material,cell%3*CELL,Math.floor(cell/3)*CELL,CELL,CELL,-width*.5,-width*.5,width,width);
 else ctx.drawImage(fallback,-width*.5,-width*.5,width,width);
 ctx.restore();return true;
}
