import { drawV100Explosion } from "./v100CombatVfx.js";

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

export function clearV100AdvancedAbilityEffects(world) { queues.delete(world); }

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

export function getV100AdvancedAbilityEffectsSnapshot(world) { return active(world).map(effect => ({ ...effect, elapsed: Math.max(0, world.time - effect.startedAt) })); }

function image(objects, id) { const value = objects[id]; return value?.complete && value.naturalWidth ? value : null; }
function drawCell(ctx, source, effect, width, height, center = false) {
  const elapsed = Math.max(0, effect.elapsed ?? 0); const frame = Math.min(5, Math.floor(Math.max(0, Math.min(1, elapsed / effect.duration)) * 6)); const sx = frame % 3 * 512; const sy = Math.floor(frame / 3) * 512; const pivot = effect.type === "tky-lightblade" ? [[105, 340], [65, 341], [58, 344], [83, 352], [79, 353], [90, 359]][frame] : [256, 256]; const left = center ? -width / 2 : effect.type === "tky-lightblade" ? -pivot[0] / 512 * width : -width / 2; const top = center ? -height / 2 : effect.type === "tky-lightblade" ? -pivot[1] / 512 * height : -height; ctx.save(); ctx.translate(effect.x, effect.y); if (effect.direction < 0) ctx.scale(-1, 1); ctx.drawImage(source, sx, sy, 512, 512, left, top, width, height); ctx.restore();
}

export function drawV100AdvancedAbilityEffects(ctx, objects, world) {
  for (const effect of active(world)) {
    if (effect.pendingOrigin) continue;
    const elapsed = Math.max(0, world.time - effect.startedAt); const progress = Math.max(0, Math.min(1, elapsed / effect.duration)); const renderEffect = { ...effect, elapsed };
    if (effect.type === "mrs-grenade-flight" || effect.type === "zakimiya-bottle") {
      const source = image(objects, effect.type === "mrs-grenade-flight" ? "v100-grenade-projectile" : "v100-fire-whisky-projectile"); if (!source) continue;
      const x = effect.originX + (effect.targetX - effect.originX) * progress; const y = effect.originY + (effect.targetY - effect.originY) * progress - Math.sin(progress * Math.PI) * 30; const height = effect.type === "zakimiya-bottle" ? 30 : 18 * source.naturalHeight / source.naturalWidth; const width = effect.type === "zakimiya-bottle" ? 30 * source.naturalWidth / source.naturalHeight : 18; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(effect.targetY - effect.originY, effect.targetX - effect.originX)); ctx.drawImage(source, -width / 2, -height, width, height); ctx.restore(); continue;
    }
    const id = effect.type === "tky-lightblade" ? "v100-lightblade" : effect.type === "musashi-crosscut" ? "v100-countercut" : effect.type === "mayo-dust" ? "v100-dust" : "v100-explosion"; const source = image(objects, id); if (!source) continue;
    const size = effect.type === "tky-lightblade" ? 180 : effect.type === "musashi-crosscut" ? 90 : effect.type === "mayo-dust" ? 36 : effect.size ?? 64; if (effect.type === "tky-lightblade" || effect.type === "musashi-crosscut") drawCell(ctx, source, renderEffect, size, size, effect.type === "musashi-crosscut"); else if (effect.type === "zakimiya-impact" || effect.type === "mrs-grenade-impact") drawV100Explosion(ctx, objects, { ...renderEffect, scale: effect.finalRound ? "medium" : "small" }, effect.x, effect.y, .6, 1); else if (effect.type === "mayo-dust") { const progress = Math.max(0, Math.min(1, elapsed / effect.duration)); const width = 36 * (.7 + .6 * progress); const height = 12 * (1 + .5 * progress); ctx.save(); ctx.globalAlpha = .28 * (1 - progress) ** 2; ctx.drawImage(source, effect.x - width / 2, effect.y - height * .55, width, height); ctx.restore(); } else ctx.drawImage(source, effect.x - size / 2, effect.y - size, size, size);
  }
}
