import { V102_FALLING_DEATH_FRAMES } from './v102CorpsePoseData.js';

export const V102_FALLING_DEATH_KINDS = Object.freeze([...new Set(V102_FALLING_DEATH_FRAMES.map(frame => frame.kind))]);

function boundFrame(kind, frame) {
  return V102_FALLING_DEATH_FRAMES.find(source => source.kind === kind && source.path === frame.path
    && source.frameFlipX === frame.flipX
    && ['x', 'y', 'w', 'h'].every(key => source.sourceRect[key] === frame.sourceRect[key]));
}

export function v102HasFallingDeathFrame(kind, frame) {
  return Boolean(boundFrame(kind, frame));
}

// A mid-fall source key must reach a horizontal, grounded final pose. Use the
// exact visible source outline so either fall direction and either mirror can
// touch the floor without sinking a claw, boot or weapon below it.
export function v102CorpseFallingPose(kind, frame, width, height, fallDirection, progress) {
  const source = boundFrame(kind, frame);
  if (!source) return null;
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) throw new RangeError('Positive corpse dimensions are required');
  const t = Math.max(0, Math.min(1, Number(progress) || 0));
  // The photo Paisen falls through ninety degrees on the existing .42s clock.
  // A 30% acceleration ramp, constant middle and matching deceleration keep
  // each 60Hz turn below the original .09rad limit without easing twice.
  const ramp = .3, speed = 1 / (1 - ramp);
  const allyProgress = t < ramp ? speed * t * t / (2 * ramp)
    : t > 1 - ramp ? 1 - speed * (1 - t) * (1 - t) / (2 * ramp)
      : speed * (t - ramp / 2);
  const poseProgress = source.kind === 'brawler' ? allyProgress : t * t * (3 - 2 * t);
  const angle = (fallDirection < 0 ? -1 : 1) * source.fallAngleRadians * poseProgress;
  const rotationRadians = angle === 0 ? 0 : angle;
  const c = Math.cos(rotationRadians), s = Math.sin(rotationRadians), sign = frame.flipX ? -1 : 1;
  let groundSupportY = -Infinity;
  for (const [px, py] of source.hull) {
    const x = sign * (px / frame.sourceRect.w - frame.anchorX) * width;
    const y = (py / frame.sourceRect.h - frame.anchorY) * height;
    groundSupportY = Math.max(groundSupportY, s * x + c * y);
  }
  // Preserve the initial airborne key, then lower it to contact. Once a
  // rotating outline would cross the floor, its support point owns contact.
  const groundOffsetY = groundSupportY > 0 ? -groundSupportY : -groundSupportY * poseProgress;
  return { rotationRadians, groundOffsetY, groundSupportY, poseProgress, sourceBound: true, sourceSha256: source.sourceSha256 };
}
