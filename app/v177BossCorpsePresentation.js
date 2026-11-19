import {createV177HumanCorpsePaint,sampleV177HumanCorpsePaint,drawV177HumanCorpsePaint} from './v177HumanCorpsePresentation.js';

// These bosses have current living rigs but no matching legacy death cell.
// TAKUYA, the president and Omega retain their existing articulated corpses.
// Upright bodies fall onto their side. The low crawling bodies overturn onto
// their back; a quarter turn left those broad creatures standing on their heads.
const restQuarterTurns=Object.freeze({
  'gate-eater':1,mother:2,ooguchi:2,kurome:1,gairen:2,'futago-separated-a':2,'futago-separated-b':2,
});
export const V177_CONTINUOUS_BOSS_CORPSE_KINDS=Object.freeze(Object.keys(restQuarterTurns));
const kinds=new Set(V177_CONTINUOUS_BOSS_CORPSE_KINDS),worlds=new WeakMap();
function cacheFor(world){let cache=worlds.get(world);if(!cache){cache={live:new Map(),dead:new Map()};worlds.set(world,cache);}return cache;}

export function rememberV177BossCorpsePaint(world,actor,kind,paint){
  if(!world||actor?.side!=='zombie'||!kinds.has(kind))return;
  const cache=cacheFor(world);
  if(!(actor.hp>0)||!paint?.image?.naturalWidth){cache.live.delete(actor.id);return;}
  cache.dead.delete(actor.id);
  cache.live.set(actor.id,{...paint,kind,paintedAt:world.time,corpseSource:'last-painted'});
}

export function pruneV177BossCorpsePaints(world){
  const cache=worlds.get(world);if(!cache)return;
  const live=new Set((world.fighters??[]).map(f=>f.id)),dead=new Set((world.corpses??[]).map(c=>c.id));
  for(const id of cache.live.keys())if(!live.has(id)&&!dead.has(id))cache.live.delete(id);
  for(const id of cache.dead.keys())if(!dead.has(id))cache.dead.delete(id);
}

export function v177BossCorpsePresentation(world,corpse,kind,options={}){
  if(!world||corpse?.side!=='zombie'||!kinds.has(kind))return null;
  const cache=cacheFor(world);
  if(!cache.dead.has(corpse.id)){
    const living=cache.live.get(corpse.id),last=living?.kind===kind?living:null;
    const fallback=last?null:options.fallbackPaint?.();
    const source=last??(fallback?{...fallback,kind,paintedAt:null,corpseSource:'source-rest'}:null);
    if(!source)return null;
    cache.dead.set(corpse.id,createV177HumanCorpsePaint({...source,fallDirection:(options.fallDirection??-1)*restQuarterTurns[kind]}));
  }
  const original=cache.dead.get(corpse.id);if(!original||original.kind!==kind)return null;
  const ashX=Number.isFinite(options.ashScaleX)?Math.max(.01,Math.min(1,options.ashScaleX)):1;
  const ashY=Number.isFinite(options.ashScaleY)?Math.max(.01,Math.min(1,options.ashScaleY)):1;
  const paint=ashX===1?original:{...original,root:{...original.root,scaleX:original.root.scaleX*ashX}};
  return sampleV177HumanCorpsePaint(paint,{progress:options.progress,x:corpse.x,y:corpse.y,scaleY:ashY});
}

export function drawV177BossCorpsePaint(ctx,sample){return drawV177HumanCorpsePaint(ctx,sample);}
