import { v100BrawlerCanAct } from './v100BrawlerCombo.js';
import { V177_JOINT_ATLASES, v177JointPose } from './v177JointPresentation.js';
import { V177_PAISEN_PHOTO_JOINT_ATLASES } from './v177PaisenPhotoJointData.js';

const PHOTO_RIG = V177_PAISEN_PHOTO_JOINT_ATLASES.brawler;
const RELEASE_SECONDS = .065;
const clamp = value => Math.max(0, Math.min(1, value));

// Keep the approved photo identity on its current rig for the complete
// fist-wave stance, two-hand release and return. No timed damage is applied.
export function v177PaisenPhotoComboSample(runtime, definition) {
  if (!runtime || !['windup', 'recovery'].includes(runtime.phase)
    || !Number.isFinite(runtime.abilityElapsed) || runtime.abilityElapsed < 0
    || !(definition?.windupSeconds > 0) || !(definition.recoverySeconds > RELEASE_SECONDS)
    || runtime.phase==='windup'&&!Number.isFinite(runtime.windupRemaining)
    || runtime.abilityElapsed>=definition.windupSeconds+definition.recoverySeconds) return null;
  const time = runtime.abilityElapsed;
  let sample;
  if (runtime.phase === 'windup') sample = { requestedState: 'wind-up',
    clipProgress: clamp((definition.windupSeconds - runtime.windupRemaining) / definition.windupSeconds) };
  else if (time < definition.windupSeconds + RELEASE_SECONDS) sample = { requestedState: 'active',
    clipProgress: clamp((time - definition.windupSeconds) / RELEASE_SECONDS) };
  else sample = { requestedState: 'recovery',
    clipProgress: clamp((time - definition.windupSeconds - RELEASE_SECONDS) / (definition.recoverySeconds - RELEASE_SECONDS)) };
  return { ...sample, abilityPresentation: 'fist-wave' };
}

export function v177PaisenPhotoComboJointPose(owner, definition, { world } = {}) {
  const atlas=V177_JOINT_ATLASES.brawler;
  if (owner?.kind !== 'brawler' || !v100BrawlerCanAct(owner)
    // Identity repainting may change the texture URL. The authored body and
    // pose data own the fist-wave timing, rather than that historical URL.
    || atlas?.parts !== PHOTO_RIG.parts || atlas?.poses !== PHOTO_RIG.poses) return null;
  const sample = v177PaisenPhotoComboSample(owner.manualAbility, definition);
  return sample ? v177JointPose('brawler', sample, owner.animationPresentation,
    { grounded:true, actor:owner, world, stunRemaining:owner.stunned }) : null;
}
