import {V100_GROUND_FIRE_BED_ART} from './v100GroundFireArt.js';
import {combatVariation} from './v100RasterAtmosphere.js';
import {MANUAL_ABILITY_REGISTRY} from './manualAbilities.js';

// Area-effect records are cloned by the simulation each tick. Keep visual
// choice in the actual battle's weakly held context, never on those records.
const selections=new WeakMap();
export function clearV100GroundFireBed(world){selections.delete(world);}

function readyLayer(objects, art) {
  const image = objects?.[art.id];
  return image?.complete && image.naturalWidth === art.width && image.naturalHeight === art.height
    ? { image, art } : null;
}

function drawFireLayer(ctx, { image, art }, phase, width, height, alpha) {
  const frame = Math.floor(phase), blend = phase - frame;
  for (const [cell, weight] of [[frame, 1 - blend], [(frame + 1) % 6, blend]]) {
    if (weight <= 0) continue;
    ctx.globalAlpha = alpha * weight;
    ctx.drawImage(image, cell % 3 * 256, Math.floor(cell / 3) * 256, 256, 256,
      -width * art.anchorX, -height * art.anchorY, width, height);
  }
}

// The short flash follows the bottle's contact. The damage area owns the
// lasting ground fire separately, so it keeps burning after this pass ends.
export function drawV100FireWhiskyImpact(ctx, objects, effect, progress) {
  const layer = readyLayer(objects, V100_GROUND_FIRE_BED_ART.burn);
  if (!layer) return false;
  const spread = 1 - (1 - progress) ** 3;
  const lift = Math.sin(Math.PI * spread);
  const opacity = ctx.globalAlpha * (1 - progress) ** 1.4;
  const drift = combatVariation(effect.activationId, effect.ownerId) > .5 ? 1 : -1;

  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.scale(drift, 1);
  // Two uneven tongues of fire fan out along the ground from one impact.
  for (const side of [-1, 1]) {
    const leading = side === 1;
    ctx.save();
    ctx.translate(side * spread * (leading ? 38 : 26), -lift * (leading ? 9 : 4));
    ctx.scale(side, 1);
    const width = 20 + spread * (leading ? 67 : 48);
    const height = 18 + lift * (leading ? 78 : 50);
    drawFireLayer(ctx, layer, (progress * 5 + (leading ? 0 : 2)) % 6, width, height, opacity);
    ctx.restore();
  }
  ctx.restore();
  return true;
}

export function drawV100GroundFireBed(ctx,objects,effect,time,world){
 if(!effect||effect.kind!=='burn'||effect.phase!=='active'||!(effect.remaining>0)||!(effect.radius>0)
  ||![effect.id,effect.x,effect.y,effect.radius,effect.remaining,time].every(Number.isFinite))return false;
 const key=world??effect;
 let entries=selections.get(key);
 if(!entries){entries=new Map();selections.set(key,entries);}
 if(!entries.has(effect.id)){
  // Prune only finished effects; do not replace a live effect's chosen art.
  if(Array.isArray(world?.areaEffects)){
   const active=new Set(world.areaEffects.filter(e=>e.kind==='burn'&&e.phase==='active'&&e.remaining>0).map(e=>e.id));
   for(const id of entries.keys())if(!active.has(id))entries.delete(id);
  }
  const bed = readyLayer(objects, V100_GROUND_FIRE_BED_ART.burn);
  // Drums own a supply id. A fire-whisky hit is owned by the throwing unit.
  const fromDrum = Number.isSafeInteger(effect.sourceSupplyId) && effect.sourceSupplyId >= 0 && !effect.sourceUnitKind;
  const column = fromDrum ? readyLayer(objects, V100_GROUND_FIRE_BED_ART.drum) : null;
  entries.set(effect.id, bed ? { bed, column } : null);
 }
 const layers = entries.get(effect.id);
 if(!layers)return false;
 const variation=combatVariation(effect.id,45),period=.92+variation*.48;
 const phase=((time/period+combatVariation(effect.id,46))%1+1)%1*6;
 const ignition = effect.sourceUnitKind === 'zakimiya'
   ? Math.max(0, Math.min(1, (MANUAL_ABILITY_REGISTRY.zakimiya.burnSeconds - effect.remaining) / .32))
   : 1;
 const spread = 1 - (1 - ignition) ** 2;
 const width=effect.radius*2.2*(.27+.73*spread);
 const height=effect.radius*(layers.column ? .86+variation*.12 : 1.28+variation*.18)*(.48+.52*spread);
 const fade=Math.min(1,effect.remaining/.45);
 ctx.save();
 try {
  ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
  ctx.translate(effect.x,effect.y);
  if(combatVariation(effect.id,47)>.5)ctx.scale(-1,1);
  drawFireLayer(ctx, layers.bed, phase, width, height, fade * (layers.column ? .91 : .96));
  if (layers.column) {
   const columnPhase = (time / (1.28 + variation * .26) + combatVariation(effect.id, 48)) % 1;
   const heat = Math.min(1, effect.remaining / 1.2);
   const columnHeight = effect.radius * (1.82 + variation * .18) * (.8 + .2 * heat);
   drawFireLayer(ctx, layers.column, (columnPhase + 1) % 1 * 6, effect.radius * 1.55, columnHeight, fade * .96);
  }
 } finally {
  ctx.restore();
 }
 return true;
}
