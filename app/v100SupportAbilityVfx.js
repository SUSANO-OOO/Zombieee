import {drawV100WireTrapMotion,drawV100BoundWireTethers} from './v100WireTrapMotion.js';

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

export function queueV100SupportAbilityEffect(world, { ownerId, activationId, eventType, targetId = null, targetIds = null, springSeconds = .3, x, y, startedAt = world.time, duration = .45 } = {}) {
  if (!world?.definition?.missionConfig?.v100StageNumber
    || !Number.isFinite(ownerId)
    || !Number.isFinite(activationId)
    || !SUPPORT_EFFECT_TYPES.includes(eventType)
    || !finitePoint(x, y)
    || !Number.isFinite(startedAt)
    || !Number.isFinite(duration)
    || duration <= 0) return false;
  if(targetIds!==null&&(eventType!=='trap-sprung'||!Array.isArray(targetIds)||!targetIds.length
    ||targetIds.some(id=>!Number.isFinite(id))||new Set(targetIds).size!==targetIds.length
    ||!Number.isFinite(springSeconds)||springSeconds<=0))return false;
  const effects = activeEffects(world);
  if (effects.some((effect) => effect.ownerId === ownerId && effect.activationId === activationId && effect.eventType === eventType && effect.startedAt === startedAt)) return false;
  const deployment = eventType === 'trap-sprung' ? effects.find(effect=>effect.eventType==='trap-deploy'
    &&effect.ownerId===ownerId&&effect.activationId===activationId&&effect.x===x&&effect.y===y
    &&effect.startedAt<=startedAt) : null;
  const deploymentProgress = deployment ? Math.max(0,Math.min(1,(startedAt-deployment.startedAt)/deployment.duration)) : 1;
  effects.push({ ownerId, activationId, eventType, targetId, x, y, startedAt, duration,
    ...(eventType==='trap-sprung'?{deploymentProgress}:{}),
    ...(targetIds?{targetIds:[...targetIds],springSeconds:Math.min(springSeconds,duration)}:{}) });
  supportEffectQueues.set(world, effects.slice(-MAX_SUPPORT_EFFECTS));
  return true;
}

export function getV100SupportAbilityEffectsSnapshot(world) {
  return activeEffects(world).map((effect) => ({ ...effect, ...(effect.targetIds?{targetIds:[...effect.targetIds]}:{}), elapsed: Math.max(0, world.time - effect.startedAt) }));
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
  const image=ready(objects,"quality-medic-gauze");
  const progress=Math.max(0,Math.min(1,effect.elapsed/effect.duration));
  const frame=Math.min(5,Math.floor(progress*6));
  const cellWidth=image.naturalWidth/3,cellHeight=image.naturalHeight/2;
  const width=104+Math.sin(progress*Math.PI)*10,height=width*.76;
  ctx.save();ctx.globalCompositeOperation="source-over";ctx.shadowBlur=0;
  ctx.globalAlpha=progress>.8?(1-progress)/.2:1;
  ctx.drawImage(image,frame%3*cellWidth,Math.floor(frame/3)*cellHeight,cellWidth,cellHeight,
    effect.x-width/2,effect.y-height*.8,width,height);
  ctx.restore();
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
  if(drawV100WireTrapMotion(ctx,objects,{x:effect.x,y:effect.y+5,progress,phase:'spring',alpha:Math.max(0,1-progress),deploymentProgress:effect.deploymentProgress??1})){
    drawTrapDust(ctx,objects,effect);return;
  }
  const width = 82 * (1 + Math.sin(progress*Math.PI)*.09);
  const height = width * image.naturalHeight / image.naturalWidth;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.drawImage(image, effect.x - width / 2, effect.y - height - Math.sin(progress*Math.PI)*6, width, height);
  ctx.restore();
  drawTrapDust(ctx, objects, effect);
}

function drawBoundTrap(ctx,objects,world,effect){
  const ids=new Set(effect.targetIds);
  const targets=(world.fighters??[]).filter(f=>ids.has(f.id)&&f.side==='zombie'&&f.hp>0
    &&Number.isFinite(f.stunned)&&f.stunned>0&&finitePoint(f.x,f.y));
  if(!targets.length)return;
  const remaining=Math.min(effect.duration-effect.elapsed,Math.max(...targets.map(f=>f.stunned)));
  const alpha=Math.max(0,Math.min(1,remaining/.18)),progress=Math.max(0,Math.min(1,effect.elapsed/effect.springSeconds));
  if(!drawV100WireTrapMotion(ctx,objects,{x:effect.x,y:effect.y+5,progress,phase:'spring',alpha,deploymentProgress:effect.deploymentProgress??1}))return;
  if(progress<1)drawTrapDust(ctx,objects,{...effect,duration:effect.springSeconds});
  else drawV100BoundWireTethers(ctx,objects,{x:effect.x,y:effect.y+5,targets,alpha:alpha*Math.min(1,(effect.elapsed-effect.springSeconds)/.06),release:1-alpha});
}

export function drawV100DeployedWireTrap(ctx,objects,world,owner,x,y){
 const effects=world?activeEffects(world):[];
 let deployment;
 for(let index=effects.length-1;index>=0;index--){
  const e=effects[index];
  if(e.eventType==='trap-deploy'&&e.ownerId===owner.id&&e.activationId===owner.manualAbility?.activationId
    &&e.x===x&&e.y+5===y){deployment=e;break;}
 }
 const progress=deployment?Math.max(0,(world.time-deployment.startedAt)/deployment.duration):1;
 return drawV100WireTrapMotion(ctx,objects,{x,y,progress});
}

export function drawV100SupportAbilityEffects(ctx, objects, world) {
  for (const effect of activeEffects(world)) {
    const renderEffect = { ...effect, elapsed: Math.max(0, world.time - effect.startedAt) };
    if (renderEffect.eventType === "medic-impact") {
      // Treatment follows the actual recipient through the short aftermath;
      // never leave a dressing on the floor after a moving ally or a corpse.
      if (Array.isArray(world.fighters)) {
        const target = world.fighters.find(fighter => fighter.id === renderEffect.targetId && fighter.side === "human" && fighter.hp > 0);
        if (!target || !finitePoint(target.x, target.y)) continue;
        renderEffect.x = target.x;
        renderEffect.y = target.y - 28;
      }
      drawMedicMist(ctx, objects, renderEffect);
    }
    else if (renderEffect.eventType === "trap-sprung") {
      if(renderEffect.targetIds)drawBoundTrap(ctx,objects,world,renderEffect);
      else drawSprungTrap(ctx, objects, renderEffect);
    }
    else if (renderEffect.eventType === "trap-deploy") drawTrapDust(ctx, objects, renderEffect);
  }
}
