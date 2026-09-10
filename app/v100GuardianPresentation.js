// Select intact shield poses from the defensive skill's actual phase.
// Active defense permits normal actions; between them, keep the shield braced.
export function v100GuardianGuardPose(runtime, definition, flash = 0, {moving=false,attacking=false}={}) {
  if (runtime?.kind !== 'guardian') return null;
  if (runtime.phase === 'windup') {
    const elapsed = definition.windupSeconds - runtime.windupRemaining;
    return elapsed < .12 ? 'idle' : elapsed < .22 ? 'walk-a' : 'attack-a';
  }
  if (runtime.phase === 'active') {
    if (flash > .04) return 'hit';
    // The defensive skill still permits walking and normal shield bashes.
    // Preserve their authored animation, including the actual damage frame.
    return moving || attacking ? null : 'attack-a';
  }
  if (runtime.phase === 'recovery') return runtime.windupRemaining > definition.recoverySeconds / 2 ? 'attack-a' : 'idle';
  return null;
}

export const V100_GUARDIAN_STABLE_POSE = Object.freeze({
  offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: 1, scaleY: 1, opacity: 1,
});

// Measured on the original 480x448 cells. These are points on the steel plate,
// below its viewing slot, in the braced and impact-reaction poses respectively.
export function v100RenderedShieldSocket({kind,state,direction,frame,size,pose,x,y,bob=0,depthScale=1}) {
  if (kind !== 'guardian' || !['attack-a','hit'].includes(state)) return null;
  if (frame.path !== '/art/v070/characters/guardian-battle-v1.png') throw Error('Recalibrate guardian shield socket for changed atlas');
  const points = direction === 'left' ? {'attack-a':[175,280],hit:[195,286]} : {'attack-a':[304,280],hit:[284,286]};
  const point = points[state], facing = direction === 'left' ? -1 : 1;
  const localX = (point[0]/frame.sourceRect.w-frame.anchorX)*size.w*(frame.flipX?-1:1)*pose.scaleX;
  const localY = (point[1]/frame.sourceRect.h-frame.anchorY)*size.h*pose.scaleY;
  const angle = pose.rotationRadians*facing, c = Math.cos(angle), s = Math.sin(angle);
  return {x:x+pose.offsetX*depthScale*facing+localX*c-localY*s, y:y-bob+pose.offsetY*depthScale+localX*s+localY*c};
}
