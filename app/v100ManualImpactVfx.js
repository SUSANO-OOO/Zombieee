import {drawRasterPlume} from './v100RasterAtmosphere.js';
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

// Only the executed dash leaves this ground-level wake. A short intercept
// makes a single skid, while a long one leaves dust along the real route.
export function drawV100ScoutInterceptDust(ctx,objects,entry,elapsed){
 const {fromX,fromY,toX,toY}=entry.scoutIntercept;
 if(elapsed<0||elapsed>=entry.duration)return;
 const dx=toX-fromX,dy=toY-fromY,distance=Math.hypot(dx,dy);
 const marks=distance>=52?[.16,.52,.92]:[.92];
 for(const mark of marks){
  const age=Math.min(1,(elapsed+(1-mark)*.075)/entry.duration);
  const width=28+mark*22+age*31;
  drawRasterPlume(ctx,objects?.['v100-dust'],{x:fromX+dx*mark-entry.direction*age*16,
   y:fromY+dy*mark+4-age*6,width,height:9+mark*9+age*12,
   alpha:(.34+mark*.29)*(1-age)**1.55,rotation:entry.direction*(mark-.55)*.17,flip:entry.direction<0});
 }
}

function drawAnchoredImpact(ctx,entry,{image,cellSize,size,anchors},position,fade){
 const first=Math.floor(position),next=Math.min(5,first+1),blend=position-first;
 const alpha=ctx.globalAlpha;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;ctx.translate(entry.x,entry.y);
 if(entry.direction<0)ctx.scale(-1,1);
 for(const [cell,weight]of [[first,1-blend],[next,blend]]){
  if(weight<=0)continue;ctx.globalAlpha=alpha*fade*weight;
  ctx.drawImage(image,cell%3*cellSize,Math.floor(cell/3)*cellSize,cellSize,cellSize,
   -anchors[cell][0]*size,-anchors[cell][1]*size,size,size);
 }
 ctx.restore();
}

export function drawV100ScoutInterceptImpact(ctx,objects,entry,elapsed){
 const duration=.35,burstPeak=.05;
 if(!entry?.scoutIntercept||![entry.x,entry.y,elapsed].every(Number.isFinite)||elapsed<0||elapsed>=duration)return false;
 if(!choices.has(entry)){
  const art=V100_MANUAL_IMPACT_ART.scout,image=objects?.[art.id];
  const valid=image?.complete&&image.naturalWidth===art.width&&image.naturalHeight===art.height;
  choices.set(entry,valid?{image,cellSize:art.width/art.columns,size:art.worldSize,anchors:art.anchors}:null);
 }
 const selected=choices.get(entry);if(!selected)return false;
 // The first two cells follow the quick strike. The remaining cells let the
 // grains fall out of the way while the existing skid settles below.
 const position=elapsed<burstPeak?elapsed/burstPeak:1+4*(elapsed-burstPeak)/(duration-burstPeak);
 const fade=Math.min(1,(duration-elapsed)/.1);
 drawAnchoredImpact(ctx,entry,selected,position,fade);
 return true;
}

const musashiChoices=new WeakMap();
export function drawV100MusashiImpact(ctx,objects,entry,elapsed){
 if(entry?.type!=='musashi-crosscut'||![entry.x,entry.y,entry.duration,elapsed].every(Number.isFinite)
  ||entry.duration<=0||elapsed<0||elapsed>=entry.duration)return false;
 if(!musashiChoices.has(entry)){
  const art=V100_MANUAL_IMPACT_ART['miyamoto-musashi'],preferred=objects?.[art.id],fallback=objects?.['v100-contact'];
  const valid=(image,w,h)=>image?.complete&&image.naturalWidth===w&&image.naturalHeight===h;
  const selected=valid(preferred,art.width,art.height)
   ?{image:preferred,cellSize:256,size:art.worldSize,anchors:art.anchors}
   :valid(fallback,1536,1024)
     ?{image:fallback,cellSize:512,size:90,anchors:Array.from({length:6},()=>[228/512,270/512])}:null;
  musashiChoices.set(entry,selected);
 }
 const selected=musashiChoices.get(entry);if(!selected)return false;
 const progress=elapsed/entry.duration,fade=progress>.72?(1-progress)/.28:1;
 drawAnchoredImpact(ctx,entry,selected,progress*5,fade);
 return true;
}
