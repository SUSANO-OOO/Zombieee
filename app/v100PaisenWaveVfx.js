import {V100_PAISEN_WAVE_ART as ART} from './v100PaisenWaveArt.js';

const selections=new WeakMap();
export function clearV100PaisenWavePaint(world){selections.delete(world);}
function selection(world,key,objects){
 let choices=selections.get(world);
 if(!choices){choices=new Map();selections.set(world,choices);}
 if(!choices.has(key)){
  const image=objects?.[ART.id];
  const valid=image?.complete===true&&image.naturalWidth===ART.width&&image.naturalHeight===ART.height;
  choices.set(key,valid?{image,material:true}:{image:objects?.['v105-fist-wave'],dust:objects?.['v100-dust'],material:false});
 }
 return choices.get(key);
}
function drawCells(ctx,image,frames,position,size,alpha){
 const first=Math.floor(position),blend=position-first;
 const pairs=[[frames[first%frames.length],1-blend],[frames[(first+1)%frames.length],blend]];
 for(const [cell,weight]of pairs){
  if(weight<=0)continue;
  ctx.globalAlpha=alpha*weight;
  ctx.drawImage(image,cell%ART.columns*256,Math.floor(cell/ART.columns)*256,256,256,
   -ART.anchors[cell][0]*size,-ART.anchors[cell][1]*size,size,size);
 }
}

// Reads the existing battle-owned queues. This module cannot advance a wave,
// choose a target, apply damage, consume RNG, queue sound, or write a save.
export function drawV100PaisenWavePaint(ctx,objects,world,state){
 const liveKeys=new Set([...state.waves,...state.impacts].map(entry=>entry.key));
 const choices=selections.get(world);
 if(choices)for(const key of choices.keys())if(!liveKeys.has(key))choices.delete(key);
 for(const wave of state.waves){
  const chosen=selection(world,wave.key,objects);
  if(!chosen.image?.naturalWidth)continue;
  const age=Math.max(0,world.time-wave.startedAt);
  ctx.save();ctx.translate(wave.x,wave.y);ctx.rotate(Math.atan2(wave.uy,wave.ux));
  ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
  if(chosen.material){
   const size=ART.flightWorldSize*Math.min(1,.55+age*8);
   const position=(age%ART.flightCycleSeconds)/ART.flightCycleSeconds*ART.flightFrames.length;
   drawCells(ctx,chosen.image,ART.flightFrames,position,size,.94);
  }else{
   const width=64*Math.min(1,.55+age*8),height=width*chosen.image.naturalHeight/chosen.image.naturalWidth;
   ctx.globalAlpha=.94;ctx.drawImage(chosen.image,-width*.9,-height*.5,width,height);
  }
  ctx.restore();
 }
 for(const hit of state.impacts){
  const chosen=selection(world,hit.key,objects),p=Math.min(1,Math.max(0,(world.time-hit.at)/ART.impactSeconds));
  if(p>=1)continue;
  ctx.save();
  if(chosen.material){
   ctx.translate(hit.x,hit.y);ctx.rotate(Math.atan2(hit.uy,hit.ux));
   ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
   const position=Math.min(ART.impactFrames.length-1,p/.9*(ART.impactFrames.length-1));
   const fade=p<=.65?.9:.9*(1-p)/.35;
   drawCells(ctx,chosen.image,ART.impactFrames,position,ART.impactWorldSize,fade);
  }else if(chosen.image?.naturalWidth&&chosen.dust?.naturalWidth){
   const size=28+p*44;ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(1-p)*.85;
   ctx.drawImage(chosen.dust,hit.x-size/2,hit.y-size/2,size,size);
  }
  ctx.restore();
 }
}
