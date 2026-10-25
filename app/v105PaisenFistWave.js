// A battle-owned projectile. Release is requested by gameplay; only a
// successfully painted current-model fist can supply its launch position.
const battles = new WeakMap();
export function clearV105FistWaves(world) { battles.delete(world); }
const stateFor = world => {
  let state = battles.get(world);
  if (!state) { state = { pending: [], waves: [], impacts: [], receipts: [] }; battles.set(world, state); }
  return state;
};
const canCast = owner => owner?.kind === 'brawler' && owner.side === 'human'
  && owner.hp > 0 && owner.combatReady && !owner.contained && !(owner.stunned > 0);
const receipt = (state, value) => { state.receipts.push(value); state.receipts = state.receipts.slice(-64); };
const liveOwner=(world,row)=>world.fighters?.find(f=>f.id===row.ownerId&&f.kind===row.ownerKind);

export function queueV105FistWave(world, owner, event, definition) {
  if (!world || !canCast(owner) || !event?.target || event.activationId !== owner.manualAbility?.activationId) return false;
  const state = stateFor(world), key = `${owner.id}:${event.activationId}`;
  if ([...state.pending, ...state.waves, ...state.receipts].some(row => row.key === key)) return false;
  state.pending.push({ key, ownerId:owner.id,ownerKind:owner.kind,ownerAtRelease:owner, activationId: event.activationId, target: { ...event.target },
    requestedAt: world.time, range: definition.range, speed: definition.projectileSpeed,
    radius: definition.projectileRadius, damage: definition.impactDamage,
    knockback: definition.finalKnockback, knockbackRadius: definition.finalKnockbackRadius });
  receipt(state, { key, type: 'release-request', at: world.time, ownerId: owner.id, activationId: event.activationId });
  return true;
}

export function resolveV105FistWavePaint(world, owner, fist, { activationId, sourceAtlas, paintedAt } = {}) {
  if (!world || !canCast(owner) || ![fist?.x, fist?.y, paintedAt].every(Number.isFinite)
    || paintedAt !== world.time || activationId !== owner.manualAbility?.activationId) return false;
  const state = stateFor(world), index = state.pending.findIndex(row => row.ownerId === owner.id&&row.ownerKind===owner.kind && row.activationId === activationId);
  if (index < 0) return false;
  const pending = state.pending[index];
  if (paintedAt < pending.requestedAt) return false;
  const tx = Number(pending.target.x), ty = Number(pending.target.y) - 32;
  const direction = Number(pending.target.direction) < 0 ? -1 : 1;
  const dx = tx - fist.x, dy = ty - fist.y, length = Math.hypot(dx, dy);
  const ux = length > .001 ? dx / length : direction, uy = length > .001 ? dy / length : 0;
  // The selected target stays a straight launch aim. No homing, teleport,
  // extra range, piercing, or damage is granted by the visual effect.
  const wave = { ...pending, x: fist.x, y: fist.y, originX: fist.x, originY: fist.y,
    ux, uy, traveled: 0, startedAt: paintedAt, updatedAt: paintedAt, sourceAtlas, launchPending: true };
  state.pending.splice(index, 1); state.waves.push(wave);
  receipt(state, { key: wave.key, type: 'launch', ownerId: owner.id, activationId, at: paintedAt,
    x: fist.x, y: fist.y, sourceAtlas });
  return true;
}

function segmentHit(ax, ay, bx, by, target, radius) {
  const rx = Math.max(8, Number(target.bodyRadius) || 16) + radius, ry = 24 + radius;
  const x = (ax - target.x) / rx, y = (ay - (target.y - 32)) / ry;
  const dx = (bx - ax) / rx, dy = (by - ay) / ry;
  const a = dx * dx + dy * dy, b = 2 * (x * dx + y * dy), c = x * x + y * y - 1;
  if (c <= 0) return 0;
  if (a < 1e-12) return null;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export function advanceV105FistWaves(world, fighters = []) {
  if (!world) return [];
  const state = stateFor(world), events = [], now = world.time;
  if (world.ended || world.over) { state.pending.length = 0; state.waves.length = 0; state.impacts.length = 0; return events; }
  state.pending = state.pending.filter(row => {
    const owner=liveOwner(world,row);
    return canCast(owner)&&owner.manualAbility?.activationId === row.activationId
      && ['windup', 'recovery'].includes(owner.manualAbility.phase);
  });
  state.impacts = state.impacts.filter(row => now - row.at < .3);
  state.waves = state.waves.filter(wave => {
    const owner=liveOwner(world,wave)??wave.ownerAtRelease;
    if (wave.launchPending) { events.push({ ...wave, owner,type: 'launch' }); wave.launchPending = false; }
    const dt = Math.max(0, now - wave.updatedAt), distance = Math.min(wave.range - wave.traveled, wave.speed * dt);
    const nx = wave.x + wave.ux * distance, ny = wave.y + wave.uy * distance;
    let first = null;
    for (const target of fighters) {
      if (target.side !== 'zombie' || !(target.hp > 0) || !target.combatReady || target.targetable === false || target.contained) continue;
      const t = segmentHit(wave.x, wave.y, nx, ny, target, wave.radius);
      if (t !== null && (!first || t < first.t || t === first.t && String(target.id) < String(first.target.id))) first = { target, t };
    }
    if (first) {
      const hit = { ...wave, owner,type: 'contact', target: first.target,
        x: wave.x + (nx - wave.x) * first.t, y: wave.y + (ny - wave.y) * first.t, at: now };
      events.push(hit); state.impacts.push(hit);
      receipt(state, { key: wave.key, type: 'contact', at: now, ownerId: wave.ownerId,
        activationId: wave.activationId, targetId: first.target.id, x: hit.x, y: hit.y });
      return false;
    }
    wave.x = nx; wave.y = ny; wave.traveled += distance; wave.updatedAt = now;
    if (wave.traveled >= wave.range) receipt(state, { key: wave.key, type: 'miss', at: now, ownerId: wave.ownerId, activationId: wave.activationId });
    return wave.traveled < wave.range;
  });
  return events;
}

export function v105FistWaveSnapshot(world) {
  const state = battles.get(world);
  return state ? { pending: state.pending.length, waves: state.waves.map(({ key, x, y, originX, originY, ux, uy, startedAt, sourceAtlas }) =>
    ({ key, x, y, originX, originY, ux, uy, startedAt, sourceAtlas })), receipts: state.receipts.map(row => ({ ...row })) }
    : { pending: 0, waves: [], receipts: [] };
}

export function drawV105FistWaves(ctx, objects, world) {
  const state = battles.get(world); if (!state || world.ended || world.over) return;
  const image = objects?.['v105-fist-wave'],dust=objects?.['v100-dust']; if (!image?.naturalWidth) return;
  for (const wave of state.waves) {
    ctx.save(); ctx.translate(wave.x, wave.y); ctx.rotate(Math.atan2(wave.uy, wave.ux));
    ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;ctx.globalAlpha=.94;
    const age=Math.max(0,world.time-wave.startedAt),width=64*Math.min(1,.55+age*8),height=width*image.naturalHeight/image.naturalWidth;
    // The hot leading core, not the center of the long painted wake, owns
    // the launch point and the swept collision center.
    ctx.drawImage(image,-width*.9,-height*.5,width,height);
    ctx.restore();
  }
  for (const hit of dust?.naturalWidth?state.impacts:[]) {
    const p = Math.min(1, (world.time - hit.at) / .3), size = 28 + p * 44;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - p) * .85;
    ctx.drawImage(dust, hit.x - size / 2, hit.y - size / 2, size, size); ctx.restore();
  }
}
