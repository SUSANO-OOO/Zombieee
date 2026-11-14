import {V100_GUARD_IMPACT_ART} from './v100GuardImpactArt.js';

// Each real contact owns one source for its entire short lifetime. A delayed
// optional decode may improve the next hit, never replace a flash in flight.
const choices=new WeakMap();
export function drawV100GuardImpact(ctx,objects,entry,elapsed){
  const contact=entry?.guardContact,art=V100_GUARD_IMPACT_ART[contact?.ownerKind];
  if(!art||entry.metal!==true||contact.resolvedSocket!==true||!(contact.ownerHp>0)||!(contact.incomingDamage>0)
    ||![entry.x,entry.y,entry.duration,elapsed].every(Number.isFinite)
    ||entry.duration<=0||elapsed<0||elapsed>=entry.duration)return false;
  if(!choices.has(entry)){
    const image=objects?.[art.id];
    choices.set(entry,image?.complete&&image.naturalWidth===art.width&&image.naturalHeight===art.height?{art,image}:null);
  }
  const selected=choices.get(entry);if(!selected)return false;
  const progress=elapsed/entry.duration,cell=Math.min(5,Math.floor(progress*6));
  const [ax,ay]=selected.art.anchors[cell],size=selected.art.worldSize;
  const fade=progress>.72?(1-progress)/.28:1;
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
  ctx.globalAlpha*=fade;ctx.translate(entry.x,entry.y);
  if(entry.direction<0)ctx.scale(-1,1);
  ctx.drawImage(selected.image,cell%3*256,Math.floor(cell/3)*256,256,256,-ax*size,-ay*size,size,size);
  ctx.restore();return true;
}
