import {V099_BOSS_DEFEAT_TIMELINE as TIMELINE} from './battlePresentationV099.js';
import {V100_BOSS_DEFEAT_ART} from './v100BossDefeatArt.js';

export function bossDefeatFinaleSource(objects,kind){
  const art=V100_BOSS_DEFEAT_ART[kind],image=art&&objects?.[art.id];
  if(!art||!image?.complete||!Number.isFinite(image.naturalWidth)||!Number.isFinite(image.naturalHeight)||image.naturalWidth<=0||image.naturalHeight<=0
    ||image.naturalWidth%art.columns||image.naturalHeight%art.rows
    ||image.naturalWidth/art.columns!==image.naturalHeight/art.rows)return null;
  return {art,image};
}

// This pass runs before bodies, health labels, telegraphs and touch UI. The
// semantic event's existing elapsed clock owns the entire animation and pause.
export function drawV100BossDefeatFinales(ctx,objects,world,{viewportWidth,viewportHeight,worldScale,density=1}={}){
  if(!world?.definition?.missionConfig?.v100StageNumber
    ||![viewportWidth,viewportHeight,worldScale,density].every(Number.isFinite)
    ||viewportWidth<=0||viewportHeight<=0||worldScale<=0||density<=0)return 0;
  let drawn=0;
  for(const effect of world.battlePresentation?.effects??[]){
    if(effect.kind!=='boss-defeat'||![effect.x,effect.y,effect.elapsed,effect.duration,effect.seed].every(Number.isFinite)
      ||effect.duration<=TIMELINE.majorBurst.at||effect.elapsed<TIMELINE.majorBurst.at||effect.elapsed>=effect.duration)continue;
    const source=bossDefeatFinaleSource(objects,effect.label);if(!source)continue;
    const {art,image}=source,elapsed=effect.elapsed-TIMELINE.majorBurst.at,duration=effect.duration-TIMELINE.majorBurst.at;
    const p=elapsed/duration,stops=[0,.06,.16,.42,.72,.94];
    let first=0;while(first<5&&stops[first+1]<=p)first++;
    const next=Math.min(5,first+1),blend=first===next?0:(p-stops[first])/(stops[next]-stops[first]);
    // Preserve the square painted camera. Bound its rectangle to18% of the
    // current phone viewport; no stretching, opaque flash or large UI overlay.
    const size=Math.min(270,Math.sqrt(viewportWidth*viewportHeight*.18)/worldScale);
    const fade=Math.min(1,(duration-elapsed)/.18),cellWidth=image.naturalWidth/art.columns,cellHeight=image.naturalHeight/art.rows;
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;ctx.translate(effect.x,effect.y);
    if(effect.x>480)ctx.scale(-1,1);
    for(const [frame,weight]of [[first,1-blend],[next,blend]]){
      if(weight<=0)continue;ctx.globalAlpha=weight*fade;
      ctx.drawImage(image,frame%art.columns*cellWidth,Math.floor(frame/art.columns)*cellHeight,cellWidth,cellHeight,
        -art.anchorX*size,-art.anchorY*size,size,size);
    }
    ctx.restore();drawn++;
  }
  return drawn;
}
