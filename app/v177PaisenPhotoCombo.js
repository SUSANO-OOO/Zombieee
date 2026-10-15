import { V100_BRAWLER_HIT_INTERVAL, v100BrawlerCanAct, v100BrawlerComboTiming } from './v100BrawlerCombo.js';
import { V177_JOINT_ATLASES, v177JointPose } from './v177JointPresentation.js';

const PHOTO_PATH = '/art/v100/joints/brawler-photo-r2.webp';
const ACTIVE_SECONDS = .03;
const RETURN_SECONDS = .035;
const clamp = value => Math.max(0, Math.min(1, value));

// Consume the existing ability clock and contact cadence. This function does
// not advance time, move the fighter, create an impact or change its damage.
export function v177PaisenPhotoComboSample(runtime, definition) {
  if (!runtime || !['windup', 'salvo', 'recovery'].includes(runtime.phase)
    || runtime.sequentialBrawler !== true || !Number.isFinite(runtime.abilityElapsed)
    || runtime.abilityElapsed < 0 || !Number.isInteger(definition?.hitCount)
    || definition.hitCount < 1 || !(definition.windupSeconds > 0)
    || !(definition.recoverySeconds > ACTIVE_SECONDS)) return null;
  const time = runtime.abilityElapsed;
  const timing = v100BrawlerComboTiming(definition);
  if (time >= timing.recoveryEnd) return null;
  if (time < definition.windupSeconds) {
    return { requestedState: 'wind-up', clipProgress: clamp(time / definition.windupSeconds) };
  }
  const contact = timing.contacts.findLast(at => at <= time);
  const last = contact === timing.lastContact;
  const elapsed = time - contact;
  if (elapsed < ACTIVE_SECONDS) return { requestedState: 'active', clipProgress: clamp(elapsed / ACTIVE_SECONDS) };
  if (last) return { requestedState: 'recovery',
    clipProgress: clamp((elapsed - ACTIVE_SECONDS) / (definition.recoverySeconds - ACTIVE_SECONDS)) };
  if (elapsed < ACTIVE_SECONDS + RETURN_SECONDS) return { requestedState: 'recovery',
    clipProgress: clamp((elapsed - ACTIVE_SECONDS) / RETURN_SECONDS) };
  return { requestedState: 'wind-up',
    clipProgress: clamp((elapsed - ACTIVE_SECONDS - RETURN_SECONDS)
      / (V100_BRAWLER_HIT_INTERVAL - ACTIVE_SECONDS - RETURN_SECONDS)) };
}

export function v177PaisenPhotoComboJointPose(owner, definition) {
  if (owner?.kind !== 'brawler' || !v100BrawlerCanAct(owner)
    || V177_JOINT_ATLASES.brawler?.path !== PHOTO_PATH) return null;
  const sample = v177PaisenPhotoComboSample(owner.manualAbility, definition);
  return sample ? v177JointPose('brawler', sample, owner.animationPresentation) : null;
}
