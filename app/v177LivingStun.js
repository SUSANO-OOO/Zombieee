import { sampleAnimationClip } from './combatPresentation.js';

// Gameplay still owns the stun, knockback and all attack/ability timers. This
// selector only fills the visual gap after the ordinary hit flash has ended.
export function v177LivingStunState(fighter, { manualAbilityActive=false, supported=true }={}) {
  if (!supported || !(fighter.hp>0) || !(fighter.stunned>0) || !fighter.combatReady
    || fighter.gateEntering || fighter.contained || fighter.mayoRetreat
    || manualAbilityActive || fighter.attack>0 || fighter.attackWindup>0
    || fighter.abilityWindup>0 || fighter.flash>0
    || fighter.stationAbility?.phase!=='idle') return null;
  return 'incapacitated';
}

export function v177LivingStunSample(kind) {
  // STANDARD incapacitated eventually selects death. A living status must keep
  // the same identity, scale and floor anchor; its joint transition owns motion.
  return {...sampleAnimationClip(kind,'idle',0),requestedState:'incapacitated',movement:false};
}
