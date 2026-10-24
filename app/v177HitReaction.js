import { v177JointActorKey } from './v177JointActorHistory.js';

const impactStrengths = new WeakMap();
const knock = actor => Number.isFinite(actor?.knock) ? Math.max(0, actor.knock) : 0;
const active = actor => actor?.hp > 0 && actor.flash > 0;

// Observe the original impulse before physical recoil decays. Presentation
// keeps its strength only inside the existing flash window; no actor/save
// field, damage, displacement, resistance or duration is changed.
export function rememberV177HitStrength(actor, world) {
  const key = v177JointActorKey(actor, world);
  if (!key) return;
  if (!active(actor)) { impactStrengths.delete(key); return; }
  impactStrengths.set(key, Math.max(impactStrengths.get(key) ?? 0, knock(actor)));
}

export function v177HitReactionStrength(actor, world) {
  const key = v177JointActorKey(actor, world);
  if (!active(actor) && key) impactStrengths.delete(key);
  return Math.max(knock(actor), active(actor) && key ? impactStrengths.get(key) ?? 0 : 0);
}

export function v177HitReactionState(actor, world) {
  return v177HitReactionStrength(actor, world) >= 12 ? 'hit-heavy' : 'hit-light';
}
