import {V100_MANUAL_IMPACT_ART} from './v100ManualImpactArt.js';

// Contact queue entries survive fighter cloning and expire after the actual
// strike. Latch once per contact: a late optional image waits for the next
// real activation rather than replacing an effect already on screen.
const choices=new WeakMap();
export function drawV100TataraImpact(ctx,objects,entry,elapsed){
 const contact=entry?.tataraGroundContact;
 if(!contact?.resolvedSocket||![entry.x,entry.y,entry.size,elapsed,entry.duration].every(Number.isFinite)
  ||elapsed<0||entry.size<=0||entry.duration<=0||elapsed>=entry.duration)return false;
 if(!choices.has(entry)){
  const art=V100_MANUAL_IMPACT_ART.brute,image=objects?.[art.id];
  const valid=image?.complete&&image.naturalWidth===1536&&image.naturalHeight===1024;
  choices.set(entry,valid?{art,image}:null);
 }
 const selected=choices.get(entry);if(!selected)return false;
 const {art,image}=selected,progress=elapsed/entry.duration;
 const position=progress*5,first=Math.floor(position),next=Math.min(5,first+1),blend=position-first;
 contact.sourcePath=art.path;contact.effectSourcePath=art.path;
 ctx.save();ctx.translate(entry.x,entry.y);ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
 const fade=progress>.8?(1-progress)/.2:1;
 for(const [cell,weight]of [[first,1-blend],[next,blend]]){
  if(weight<=0)continue;ctx.globalAlpha=fade*weight;
  ctx.drawImage(image,cell%3*512,Math.floor(cell/3)*512,512,512,
   -entry.size*art.anchorX,-entry.size*art.anchorY,entry.size,entry.size);
 }
 ctx.restore();return true;
}
