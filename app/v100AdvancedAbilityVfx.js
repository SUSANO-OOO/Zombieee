import {clearV100GuardActivations,drawV100GuardActivations,getV100GuardActivationsSnapshot} from './v100GuardActivationVfx.js';
import { drawV100Explosion } from "./v100CombatVfx.js";
import {drawV100ChihaFinalBurst,v100ChihaFinalPaintScale,V100_CHIHA_FINAL_BURST_DURATION} from "./v100ChihaFinalBurstVfx.js";
import {drawV100MusashiImpact} from './v100ManualImpactVfx.js';
export {V100_CHIHA_FINAL_BURST_DURATION};

const MAX_ADVANCED_EFFECTS = 64;
const TYPES = Object.freeze(["mrs-grenade-flight", "mrs-grenade-impact", "zakimiya-bottle", "zakimiya-impact", "tky-lightblade", "musashi-crosscut", "mayo-dust"]);
const queues = new WeakMap();

function active(world) {
  const effects = (queues.get(world) ?? []).filter(effect => {
    const owner = world.fighters?.find?.(fighter => fighter.id === effect.ownerId);
    const pendingOwnerValid = !effect.pendingOrigin || Boolean(owner && owner.hp > 0 && owner.manualAbility?.activationId === effect.activationId);
    return world.time - effect.startedAt < effect.duration && !(effect.ownerAlive === false) && (effect.pendingOrigin ? pendingOwnerValid : true);
  });
  queues.set(world, effects); return effects;
}

export function clearV100AdvancedAbilityEffects(world) { queues.delete(world); clearV100GuardActivations(world); }

export function queueV100AdvancedAbilityEffect(world, entry = {}) {
  const pendingOrigin = entry.pendingOrigin === true;
  if (!world?.definition?.missionConfig?.v100StageNumber || !TYPES.includes(entry.type)
    || !Number.isFinite(entry.ownerId) || !Number.isFinite(entry.activationId)
    || !Number.isFinite(entry.startedAt ?? world.time) || !Number.isFinite(entry.duration) || entry.duration <= 0
    || (!pendingOrigin && (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)))) return false;
  if (["mrs-grenade-flight", "zakimiya-bottle"].includes(entry.type) && ![entry.targetX, entry.targetY].every(Number.isFinite)) return false;
  if (!pendingOrigin && ["mrs-grenade-flight", "zakimiya-bottle"].includes(entry.type) && ![entry.originX, entry.originY].every(Number.isFinite)) return false;
  const startedAt = entry.startedAt ?? world.time; const shotIndex = entry.shotIndex ?? null; const effects = active(world);
  if (effects.some(effect => effect.ownerId === entry.ownerId && effect.activationId === entry.activationId && effect.type === entry.type && effect.shotIndex === shotIndex && effect.startedAt === startedAt)) return false;
  effects.push({ ownerId: entry.ownerId, activationId: entry.activationId, type: entry.type, shotIndex, targetId: entry.targetId ?? null, finalRound: entry.finalRound === true, startedAt, duration: entry.duration, x: entry.x ?? null, y: entry.y ?? null, originX: entry.originX ?? null, originY: entry.originY ?? null, targetX: entry.targetX ?? null, targetY: entry.targetY ?? null, size: entry.size ?? null, direction: entry.direction ?? 1, pendingOrigin, ownerAlive: true });
  queues.set(world, effects.slice(-MAX_ADVANCED_EFFECTS)); return true;
}

export function resolveV100AdvancedAbilityOrigin(world, ownerId, socket, metadata = {}) {
  if (!Number.isFinite(ownerId) || !Number.isFinite(metadata.activationId) || !Number.isFinite(socket?.x) || !Number.isFinite(socket?.y)) return 0;
  const effects = queues.get(world) ?? []; let resolved = 0;
  for (const effect of effects) {
    const requiredState = effect.type === "tky-lightblade" ? "attack-a" : effect.type === "mrs-grenade-flight" ? "attack-b" : effect.type === "zakimiya-bottle" ? "attack-b" : null;
    if (effect.ownerId !== ownerId || effect.activationId !== metadata.activationId || !effect.pendingOrigin || (requiredState && metadata.state !== requiredState)) continue;
    effect.originX = socket.x; effect.originY = socket.y; effect.x = socket.x; effect.y = socket.y; effect.direction = metadata.direction === "left" ? -1 : metadata.direction === "right" ? 1 : effect.direction; effect.resolvedSocketPoint = { x: socket.x, y: socket.y }; effect.sourcePath = metadata.path ?? null; effect.sourceState = metadata.state ?? null; effect.sourcePixel = metadata.sourcePixel ?? null; effect.pendingOrigin = false; resolved += 1;
  }
  return resolved;
}

// The current articulated actor has different phase names from the archived
// whole-body cells. Accept its actual successful paint without impersonating
// an old attack-a/b frame, and never resolve a windup or stale owner's socket.
export function resolveV105CurrentAbilityOrigin(world, owner, socket, metadata = {}) {
  const kinds = { 'tky-lightblade':'tky', 'mrs-grenade-flight':'mrs-chiha', 'zakimiya-bottle':'zakimiya' };
  if (!owner || !world?.fighters?.some(f => f.id === owner.id && f.kind === owner.kind && f.hp > 0)
    || metadata.activationId !== owner.manualAbility?.activationId
    || metadata.paintedAt !== world.time || !['active','recovery'].includes(metadata.phase)
    || !metadata.path?.startsWith('/art/') || !metadata.sourceBone
    || ![socket?.x,socket?.y,metadata.sourcePixel?.x,metadata.sourcePixel?.y].every(Number.isFinite)) return 0;
  let resolved = 0;
  for (const effect of active(world)) {
    if (!effect.pendingOrigin || effect.ownerId !== owner.id || effect.activationId !== metadata.activationId
      || kinds[effect.type] !== owner.kind || world.time < effect.startedAt) continue;
    if (effect.type === "zakimiya-bottle" && metadata.sourceBone !== "arm-1-hand") continue;
    Object.assign(effect,{originX:socket.x,originY:socket.y,x:socket.x,y:socket.y,
      direction:metadata.direction === 'left' ? -1 : metadata.direction === 'right' ? 1 : effect.direction,
      resolvedSocketPoint:{x:socket.x,y:socket.y},sourcePath:metadata.path,
      sourceState:metadata.phase,sourcePixel:metadata.sourcePixel,sourceBone:metadata.sourceBone,
      sourceModel:'current-joint',paintedAt:metadata.paintedAt,pendingOrigin:false});
    if (effect.type === "zakimiya-bottle" && Number.isFinite(metadata.bottleAngle)) effect.bottleAngle = metadata.bottleAngle;
    resolved += 1;
  }
  return resolved;
}

export function getV100AdvancedAbilityEffectsSnapshot(world) { return [...active(world).map(effect => ({ ...effect, elapsed: Math.max(0, world.time - effect.startedAt) })),...getV100GuardActivationsSnapshot(world)]; }

function image(objects, id) { const value = objects[id]; return value?.complete && value.naturalWidth ? value : null; }

export function drawV100FireWhiskyBottle(ctx, objects, x, y, angle, opacity = 1) {
  const source = image(objects ?? {}, "v100-fire-whisky-projectile");
  if (!source) return;
  const height = 30;
  const width = height * source.naturalWidth / source.naturalHeight;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(source, -width / 2, -height * .78, width, height);
  ctx.restore();
}
function drawCell(ctx, source, effect, width, height, center = false) {
  const elapsed = Math.max(0, effect.elapsed ?? 0); const frame = Math.min(5, Math.floor(Math.max(0, Math.min(1, elapsed / effect.duration)) * 6)); const sx = frame % 3 * 512; const sy = Math.floor(frame / 3) * 512; const pivot = effect.type === "tky-lightblade" ? [[105, 340], [65, 341], [58, 344], [83, 352], [79, 353], [90, 359]][frame] : [256, 256]; const left = center ? -width / 2 : effect.type === "tky-lightblade" ? -pivot[0] / 512 * width : -width / 2; const top = center ? -height / 2 : effect.type === "tky-lightblade" ? -pivot[1] / 512 * height : -height; ctx.save(); ctx.translate(effect.x, effect.y); if (effect.direction < 0) ctx.scale(-1, 1); ctx.drawImage(source, sx, sy, 512, 512, left, top, width, height); ctx.restore();
}

export function drawV100ChihaFinalBursts(ctx,objects,world,viewport={}) {
  const paintScale=v100ChihaFinalPaintScale(viewport);
  if(!paintScale)return;
  for(const effect of active(world)){
    if(effect.type!=="mrs-grenade-impact"||effect.finalRound!==true||effect.pendingOrigin)continue;
    drawV100ChihaFinalBurst(ctx,objects,{...effect,elapsed:Math.max(0,world.time-effect.startedAt)},paintScale);
  }
}

// Read the same impact queue before actors. This pass owns no clock, hit or sound.
export function drawV100MusashiImpacts(ctx,objects,world) {
  for(const effect of active(world)){
    if(effect.type==='musashi-crosscut'&&!effect.pendingOrigin)
      drawV100MusashiImpact(ctx,objects,effect,Math.max(0,world.time-effect.startedAt));
  }
}

export function drawV100AdvancedAbilityEffects(ctx, objects, world, {includeGuardActivations=true,includeMusashiImpacts=true}={}) {
  if(includeGuardActivations)drawV100GuardActivations(ctx,objects,world);
  for (const effect of active(world)) {
    if (effect.pendingOrigin || effect.type==="mrs-grenade-impact" && effect.finalRound===true) continue;
    const elapsed = Math.max(0, world.time - effect.startedAt); const progress = Math.max(0, Math.min(1, elapsed / effect.duration)); const renderEffect = { ...effect, elapsed };
    if(effect.type==='musashi-crosscut'){
      // This actual damage-owned entry chooses once, including the physical
      // contact fallback. Never return to the former X marker on a late decode.
      if(includeMusashiImpacts)drawV100MusashiImpact(ctx,objects,effect,elapsed);continue;
    }
    if (effect.type === "mrs-grenade-flight" || effect.type === "zakimiya-bottle") {
      const dx = effect.targetX - effect.originX;
      const dy = effect.targetY - effect.originY;
      const x = effect.originX + dx * progress;
      const y = effect.originY + dy * progress - Math.sin(progress * Math.PI) * 30;
      const travelAngle = Math.atan2(dy, dx);
      if (effect.type === "zakimiya-bottle") {
        const angle = Number.isFinite(effect.bottleAngle) ? effect.bottleAngle + effect.direction * 2.6 * progress : travelAngle;
        drawV100FireWhiskyBottle(ctx, objects, x, y, angle);
      } else {
        const source = image(objects, "v100-grenade-projectile");
        if (!source) continue;
        const height = 18 * source.naturalHeight / source.naturalWidth;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(travelAngle);
        ctx.drawImage(source, -9, -height, 18, height);
        ctx.restore();
      }
      continue;
    }
    const id = effect.type === "tky-lightblade" ? "v100-lightblade" : effect.type === "mayo-dust" ? "v100-dust" : "v100-explosion"; const source = image(objects, id); if (!source) continue;
    const size = effect.type === "tky-lightblade" ? 180 : effect.type === "mayo-dust" ? 36 : effect.size ?? 64; if (effect.type === "tky-lightblade") drawCell(ctx, source, renderEffect, size, size); else if (effect.type === "zakimiya-impact" || effect.type === "mrs-grenade-impact") drawV100Explosion(ctx, objects, { ...renderEffect, scale: effect.finalRound ? "medium" : "small" }, effect.x, effect.y, .6, 1); else if (effect.type === "mayo-dust") { const progress = Math.max(0, Math.min(1, elapsed / effect.duration)); const width = 36 * (.7 + .6 * progress); const height = 12 * (1 + .5 * progress); ctx.save(); ctx.globalAlpha = .28 * (1 - progress) ** 2; ctx.drawImage(source, effect.x - width / 2, effect.y - height * .55, width, height); ctx.restore(); } else ctx.drawImage(source, effect.x - size / 2, effect.y - size, size, size);
  }
}
