const supportEffectQueues = new WeakMap();
const MAX_SUPPORT_EFFECTS = 32;
const SUPPORT_EFFECT_TYPES = Object.freeze(["medic-impact", "trap-deploy", "trap-sprung"]);

function finitePoint(x, y) {
  return Number.isFinite(x) && Number.isFinite(y);
}

function activeEffects(world) {
  const effects = (supportEffectQueues.get(world) ?? []).filter((effect) => world.time - effect.startedAt < effect.duration);
  supportEffectQueues.set(world, effects);
  return effects;
}

export function clearV100SupportAbilityEffects(world) {
  supportEffectQueues.delete(world);
}

export function queueV100SupportAbilityEffect(world, { ownerId, activationId, eventType, targetId = null, x, y, startedAt = world.time, duration = .45 } = {}) {
  if (!world?.definition?.missionConfig?.v100StageNumber
    || !Number.isFinite(ownerId)
    || !Number.isFinite(activationId)
    || !SUPPORT_EFFECT_TYPES.includes(eventType)
    || !finitePoint(x, y)
    || !Number.isFinite(startedAt)
    || !Number.isFinite(duration)
    || duration <= 0) return false;
  const effects = activeEffects(world);
  if (effects.some((effect) => effect.ownerId === ownerId && effect.activationId === activationId && effect.eventType === eventType && effect.startedAt === startedAt)) return false;
  effects.push({ ownerId, activationId, eventType, targetId, x, y, startedAt, duration });
  supportEffectQueues.set(world, effects.slice(-MAX_SUPPORT_EFFECTS));
  return true;
}

export function getV100SupportAbilityEffectsSnapshot(world) {
  return activeEffects(world).map((effect) => ({ ...effect, elapsed: Math.max(0, world.time - effect.startedAt) }));
}

function ready(objects, id) {
  const image = objects[id];
  if (!image?.complete || !image.naturalWidth) throw new Error(`Support VFX must decode before battle: ${id}`);
  return image;
}

function drawDustPuff(ctx, image, x, y, size, alpha, age, offset = 0) {
  const fade = Math.max(0, 1 - age);
  ctx.save();
  ctx.globalAlpha = alpha * fade;
  ctx.translate(x + offset * age, y - 6 * age);
  ctx.drawImage(image, -size / 2, -size * .7, size, size);
  ctx.restore();
}

function drawMedicMist(ctx, objects, effect) {
  const image = ready(objects, "v100-dust");
  const progress = Math.min(1, effect.elapsed / effect.duration);
  for (let index = 0; index < 3; index += 1) {
    const phase = (index - 1) * .22;
    drawDustPuff(ctx, image, effect.x, effect.y, 14 + progress * 10, .22, Math.max(0, progress + phase), (index - 1) * 8);
  }
}

function drawTrapDust(ctx, objects, effect) {
  const image = ready(objects, "v100-dust");
  const progress = Math.min(1, effect.elapsed / effect.duration);
  drawDustPuff(ctx, image, effect.x - 11, effect.y, 12, .16, progress, -8);
  drawDustPuff(ctx, image, effect.x + 11, effect.y, 12, .16, progress, 8);
}

function drawSprungTrap(ctx, objects, effect) {
  const image = ready(objects, "v100-support-trap-sprung");
  const progress = Math.min(1, effect.elapsed / effect.duration);
  const width = 82;
  const height = width * image.naturalHeight / image.naturalWidth;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.drawImage(image, effect.x - width / 2, effect.y - height, width, height);
  ctx.restore();
  drawTrapDust(ctx, objects, effect);
}

export function drawV100SupportAbilityEffects(ctx, objects, world) {
  for (const effect of activeEffects(world)) {
    const renderEffect = { ...effect, elapsed: Math.max(0, world.time - effect.startedAt) };
    if (renderEffect.eventType === "medic-impact") drawMedicMist(ctx, objects, renderEffect);
    else if (renderEffect.eventType === "trap-sprung") drawSprungTrap(ctx, objects, renderEffect);
    else if (renderEffect.eventType === "trap-deploy") drawTrapDust(ctx, objects, renderEffect);
  }
}
