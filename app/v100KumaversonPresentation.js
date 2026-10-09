export const V100_KUMAVERSON_GUARD_ART = Object.freeze({
  path: '/art/v100/characters/kumaverson-guard-v1.png',
  authoredCell: Object.freeze({ w: 480, h: 448 }),
  sourceRect: Object.freeze({ x: 0, y: 0, w: 480, h: 448 }),
  anchorX: 240 / 480,
  anchorY: 432 / 448,
  panSocket: Object.freeze({ x: 303.613, y: 169.996 }),
});

export const V100_KUMAVERSON_STABLE_POSE = Object.freeze({
  offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: 1, scaleY: 1, opacity: 1,
});

export function v100KumaversonGuardPose(runtime, definition, flash = 0, { moving = false, attacking = false } = {}) {
  if (runtime?.kind !== 'kumaverson') return null;
  if (runtime.phase === 'windup') {
    const elapsed = definition.windupSeconds - runtime.windupRemaining;
    return elapsed < .12 ? 'idle' : 'guard';
  }
  if (runtime.phase === 'active') return flash > .04 ? 'hit' : (moving || attacking ? null : 'guard');
  if (runtime.phase === 'recovery') return runtime.windupRemaining > definition.recoverySeconds / 2 ? 'guard' : 'idle';
  return null;
}

export function v100RenderedKumaversonPanSocket({ x, y, bob = 0, direction = 'right', flipX = false, size, pose = V100_KUMAVERSON_STABLE_POSE }) {
  const sign = direction === 'left' ? -1 : 1;
  const localX = (V100_KUMAVERSON_GUARD_ART.panSocket.x / 480 - V100_KUMAVERSON_GUARD_ART.anchorX) * size.w * (flipX ? -1 : 1) * pose.scaleX;
  const localY = (V100_KUMAVERSON_GUARD_ART.panSocket.y / 448 - V100_KUMAVERSON_GUARD_ART.anchorY) * size.h * pose.scaleY;
  return { x: x + pose.offsetX * sign + localX, y: y - bob + pose.offsetY + localY };
}
