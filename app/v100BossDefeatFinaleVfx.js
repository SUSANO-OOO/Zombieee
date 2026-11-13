import {V099_BOSS_DEFEAT_TIMELINE as TIMELINE} from './battlePresentationV099.js';
import {V100_BOSS_DEFEAT_ART} from './v100BossDefeatArt.js';

// Presentation-only state stays outside the simulation and its receipts. Once
// a major burst starts, a late optional decode cannot replace it mid-collapse.
const finaleChoices=new WeakMap();
const effectKey=(world,effect)=>JSON.stringify([world.battlePresentation?.generation??0,effect.generation??0,
  effect.id??effect.receiptId??effect.ownerId,effect.label,effect.seed]);
export function bossDefeatFinaleWasDrawn(ctx,world,effect){
  if(!world||typeof world!=='object')return false;
  const choice=finaleChoices.get(world)?.get(effectKey(world,effect));
  return Boolean(choice?.source&&choice.ctx===ctx&&choice.drawnElapsed===effect.elapsed);
}

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
  if(!world||typeof world!=='object')return 0;
  let choices=finaleChoices.get(world);
  if(!choices){choices=new Map();finaleChoices.set(world,choices);}
  for(const choice of choices.values()){choice.ctx=null;choice.drawnElapsed=null;}
  const effects=world.battlePresentation?.effects??[];
  const activeKeys=new Set(effects.filter(effect=>effect.kind==='boss-defeat').map(effect=>effectKey(world,effect)));
  for(const key of choices.keys())if(!activeKeys.has(key))choices.delete(key);
  if(!world?.definition?.missionConfig?.v100StageNumber
    ||![viewportWidth,viewportHeight,worldScale,density].every(Number.isFinite)
    ||viewportWidth<=0||viewportHeight<=0||worldScale<=0||density<=0)return 0;
  let drawn=0;
  for(const effect of effects){
    const includesPrelude=V100_BOSS_DEFEAT_ART[effect.label]?.includesPrelude===true;
    const startAt=includesPrelude?TIMELINE.smallBursts[0].at:TIMELINE.majorBurst.at;
    if(effect.kind!=='boss-defeat'||![effect.x,effect.y,effect.elapsed,effect.duration,effect.seed].every(Number.isFinite)
      ||effect.duration<=TIMELINE.majorBurst.at||effect.elapsed<startAt||effect.elapsed>=effect.duration)continue;
    const key=effectKey(world,effect);
    if(!choices.has(key))choices.set(key,{source:bossDefeatFinaleSource(objects,effect.label),ctx:null,drawnElapsed:null});
    const choice=choices.get(key),source=choice.source;if(!source)continue;
    const {art,image}=source,elapsed=effect.elapsed-startAt,duration=effect.duration-startAt;
    const majorDuration=effect.duration-TIMELINE.majorBurst.at;
    // A full organic/energy collapse replaces the orange prelude too. Keep
    // the authored medium beat and the exact original major peak/tail times.
    const p=elapsed/duration,stops=includesPrelude
      ? [startAt,TIMELINE.mediumBurst.at,...[.16,.42,.72,.94].map(at=>TIMELINE.majorBurst.at+majorDuration*at)].map(at=>(at-startAt)/duration)
      : [0,.06,.16,.42,.72,.94];
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
    ctx.restore();choice.ctx=ctx;choice.drawnElapsed=effect.elapsed;drawn++;
  }
  return drawn;
}
